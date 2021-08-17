import { normalize, resolve, Path, basename } from '@angular-devkit/core';
import { ProjectDefinition } from '@angular-devkit/core/src/workspace';
import {
  chain,
  Rule,
  SchematicsException,
  Tree,
} from '@angular-devkit/schematics';

import glob from 'glob';
import { Application as TypeDocApplication, JSONOutput } from 'typedoc';
import { ModuleKind, ModuleResolutionKind, ScriptTarget } from 'typescript';

import { readRequiredFile } from '../../utility/tree';
import { getProject, getWorkspace } from '../../utility/workspace';

import { Schema } from './schema';

interface AnchorIds {
  [typeName: string]: string;
}

interface CodeExample {
  fileName: string;
  filePath: string;
  rawContents: string;
}

interface DocumentationJson {
  anchorIds?: AnchorIds;
  typedoc?: Partial<JSONOutput.ProjectReflection>;
  codeExamples?: CodeExample[];
}

function parseFriendlyUrlFragment(value: string): string {
  const friendly = value
    .toLowerCase()

    // Remove special characters.
    .replace(/[_~`@!#$%^&*()[\]{};:'/\\<>,.?=+|"]/g, '')

    // Replace space characters with a dash.
    .replace(/\s/g, '-')

    // Remove any double-dashes.
    .replace(/--/g, '-');

  return friendly;
}

/**
 * Returns anchor IDs to be used for same-page linking.
 */
function getAnchorIds(json: Partial<JSONOutput.ProjectReflection>): AnchorIds {
  const anchorIdMap: AnchorIds = {};

  json.children
    ?.filter((child) => {
      const kindString = child.kindString?.toLocaleUpperCase();
      return kindString && kindString !== 'VARIABLE';
    })
    .forEach((child) => {
      const kindString = parseFriendlyUrlFragment(child.kindString!);
      const friendlyName = parseFriendlyUrlFragment(child.name);
      const anchorId = `${kindString}-${friendlyName}`;
      anchorIdMap[child.name] = anchorId;
    });

  return anchorIdMap;
}

function applyTypeDocDefinitions(
  documentationJson: DocumentationJson,
  project: ProjectDefinition
): Rule {
  return async (tree, context) => {
    const publicApiPath = normalize(`${project.sourceRoot}/public-api.ts`);
    const publicApiContents = readRequiredFile(tree, publicApiPath);

    context.logger.info(`Primary entry point: ${publicApiPath}`);

    const files: string[] = [publicApiPath];

    // The following can be removed once we export our components/directives from the public_api.ts file.
    glob
      .sync(`${project.sourceRoot}/**/*.+(component|directive).ts`, {
        nodir: true,
        ignore: ['**/fixtures/**', '**/testing/**'],
      })
      .forEach((file) => {
        if (
          !publicApiContents.includes(
            file.replace(project.sourceRoot || '', '').replace(/.ts$/, '')
          )
        ) {
          context.logger.warn(
            `Adding another entry point for "${file}" because it is not listed in the public-api.ts file. Should it be?`
          );
          files.push(normalize(file));
        }
      });

    const app = new TypeDocApplication();

    app.bootstrap({
      exclude: ['**/node_modules/**', '**/fixtures/**', '**/*.spec.ts'],
      entryPoints: files,
      excludeExternals: true,
      excludeInternal: true,
      excludePrivate: true,
      excludeProtected: true,
      logLevel: 'Verbose',
    });

    app.options.setCompilerOptions(
      files,
      {
        esModuleInterop: true,
        experimentalDecorators: true,
        module: ModuleKind.ES2020,
        moduleResolution: ModuleResolutionKind.NodeJs,
        resolveJsonModule: true,
        target: ScriptTarget.ES2017,
        baseUrl: './',
      },
      undefined
    );

    const typedocProject = app.convert();

    if (typedocProject) {
      const json = app.serializer.toObject(typedocProject);

      let processed: Partial<JSONOutput.ProjectReflection>;

      if (files.length > 1) {
        // const merged: { children: JSONOutput.DeclarationReflection[] } = {
        //   children: [],
        // };
        processed = {
          children: [],
        };
        json.children?.forEach((entrypoint) => {
          processed.children!.push(...(entrypoint.children || []));
        });
      } else {
        processed = json;
      }

      const anchorIds = getAnchorIds(processed);

      documentationJson.anchorIds = anchorIds;
      documentationJson.typedoc = processed;
    } else {
      throw new SchematicsException(
        'TypeDoc project generation failed. ' +
          'This usually occurs when the target TypeScript project cannot compile or is invalid. ' +
          'Try running `ng build` to debug any compiler issues.'
      );
    }
  };
}

function getDocumentationJsonPath(
  tree: Tree,
  project: ProjectDefinition
): string {
  const ngPackageJson = JSON.parse(
    readRequiredFile(tree, `${project.root}/ng-package.json`)
  );

  const outputPath = resolve(`${project.root}` as Path, ngPackageJson.dest);

  return `${outputPath}/documentation.json`;
}

function ensureDocumentationJson(tree: Tree, documentationJsonPath: string) {
  /* istanbul ignore else */
  if (!tree.exists(documentationJsonPath)) {
    tree.create(documentationJsonPath, '{}');
  }
}

function applyCodeExamples(
  documentationJson: DocumentationJson,
  project: ProjectDefinition
): Rule {
  return (tree, context) => {
    const codeExamples: CodeExample[] = [];

    tree
      .getDir(`${project.root}/documentation/code-examples`)
      .visit((filePath) => {
        context.logger.info(`Processing code example: ${filePath}`);
        codeExamples.push({
          fileName: basename(filePath),
          filePath,
          rawContents: readRequiredFile(tree, filePath),
        });
      });

    documentationJson.codeExamples = codeExamples;
  };
}

function getDocumentationJson(
  tree: Tree,
  project: ProjectDefinition
): DocumentationJson {
  const documentationJsonPath = getDocumentationJsonPath(tree, project);

  ensureDocumentationJson(tree, documentationJsonPath);

  return JSON.parse(
    readRequiredFile(tree, documentationJsonPath)
  ) as DocumentationJson;
}

function updateDocumentationJson(
  documentationJson: DocumentationJson,
  project: ProjectDefinition
): Rule {
  return (tree) => {
    const documentationJsonPath = getDocumentationJsonPath(tree, project);
    tree.overwrite(
      documentationJsonPath,
      JSON.stringify(documentationJson, undefined, 2)
    );
  };
}

export default function generateDocumentation(options: Schema): Rule {
  return async (tree, context) => {
    const { workspace } = await getWorkspace(tree);

    const { project, projectName } = await getProject(
      workspace,
      options.project || (workspace.extensions.defaultProject as string)
    );

    context.logger.info(
      `Attempting to generate documentation for project "${projectName}"...`
    );

    if (project.extensions.projectType !== 'library') {
      throw new SchematicsException(
        'Only library projects can generate documentation.'
      );
    }

    const documentationJson = getDocumentationJson(tree, project);

    return chain([
      applyTypeDocDefinitions(documentationJson, project),
      applyCodeExamples(documentationJson, project),
      updateDocumentationJson(documentationJson, project),
    ]);
  };
}
