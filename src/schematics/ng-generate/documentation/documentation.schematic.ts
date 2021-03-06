import { normalize, resolve, Path, basename } from '@angular-devkit/core';
import { ProjectDefinition } from '@angular-devkit/core/src/workspace';
import {
  chain,
  Rule,
  SchematicsException,
  Tree,
} from '@angular-devkit/schematics';

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

/**
 * Remaps the component/directive exports that use the lambda 'λ' prefix to the component's class name.
 * @example
 * ```
 * export { SkyAffixDirective as λ1 } from './modules/affix/affix.directive';
 * ```
 */
function remapComponentExports(
  json: Partial<JSONOutput.ProjectReflection>
): Partial<JSONOutput.ProjectReflection> {
  json.children
    ?.filter((child) => {
      return child.name.startsWith('λ');
    })
    .forEach((child) => {
      let originalName = child.name;

      child.children!.forEach((x) => {
        if (x.name === 'constructor') {
          // Using 'any' because TypeDoc has invalid typings.
          const signature: any = x.signatures && x.signatures[0];
          originalName = signature.type.name;
          // Fix the constructor's name.
          signature.name = originalName;
        }
      });

      // Fix the class's name.
      child.name = originalName;
    });

  return json;
}

function applyTypeDocDefinitions(
  documentationJson: DocumentationJson,
  project: ProjectDefinition
): Rule {
  return async () => {
    const publicApiPath = normalize(`${project.sourceRoot}/public-api.ts`);

    const files: string[] = [publicApiPath];

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
      const projectReflection = app.serializer.toObject(typedocProject);
      const json = remapComponentExports(projectReflection);

      const anchorIds = getAnchorIds(json);

      documentationJson.anchorIds = anchorIds;
      documentationJson.typedoc = json;
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

/**
 * Escapes a string value to be used in a `RegExp` constructor.
 * @see https://stackoverflow.com/questions/3446170/escape-string-for-use-in-javascript-regex
 */
function regexEscape(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function applyCodeExamples(
  documentationJson: DocumentationJson,
  project: ProjectDefinition,
  projectName: string
): Rule {
  return (tree, context) => {
    const codeExamples: CodeExample[] = [];

    const packageName = getPackageName(tree, projectName);

    tree
      .getDir(`${project.root}/documentation/code-examples`)
      .visit((filePath) => {
        context.logger.info(`Processing code example: ${filePath}`);

        const rawContents = readRequiredFile(tree, filePath).replace(
          new RegExp(
            `('|")(${regexEscape(
              `projects/${projectName}/src/public-api`
            )})('|")`,
            'gi'
          ),
          `'${packageName}'`
        );

        codeExamples.push({
          fileName: basename(filePath),
          filePath,
          rawContents,
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

function getPackageName(tree: Tree, projectName: string): string {
  const packageJson = JSON.parse(
    readRequiredFile(tree, `projects/${projectName}/package.json`)
  );
  return packageJson.name;
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
      applyCodeExamples(documentationJson, project, projectName),
      updateDocumentationJson(documentationJson, project),
    ]);
  };
}
