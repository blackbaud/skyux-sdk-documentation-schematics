import { normalize, resolve, Path, basename } from '@angular-devkit/core';
import { ProjectDefinition } from '@angular-devkit/core/src/workspace';
import { chain, Rule, Tree } from '@angular-devkit/schematics';

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
  typedoc?: JSONOutput.ProjectReflection;
  codeExamples?: CodeExample[];
}

function parseFriendlyUrlFragment(value: string): string | undefined {
  if (!value) {
    return;
  }

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
function getAnchorIds(json: JSONOutput.ProjectReflection): AnchorIds {
  const anchorIdMap: AnchorIds = {};

  json.children
    ?.filter((child) => {
      const kindString = child.kindString?.toLowerCase();
      return kindString && kindString !== 'variable';
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
  return async () => {
    const files: string[] = [normalize(`${project.sourceRoot}/public-api.ts`)];

    const app = new TypeDocApplication();

    app.bootstrap({
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
      const anchorIds = getAnchorIds(projectReflection);

      documentationJson.anchorIds = anchorIds;
      documentationJson.typedoc = projectReflection;
    } else {
      console.log('Documentation generation failed.');
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
  if (!tree.exists(documentationJsonPath)) {
    tree.create(documentationJsonPath, '{}');
  }
}

function applyCodeExamples(
  documentationJson: DocumentationJson,
  project: ProjectDefinition
): Rule {
  return (tree) => {
    const codeExamples: CodeExample[] = [];

    tree
      .getDir(`${project.root}/documentation/code-examples`)
      .visit((filePath) => {
        console.log('Code example found:', filePath);
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
  return async (tree) => {
    const { workspace } = await getWorkspace(tree);

    const { project } = await getProject(
      workspace,
      options.project || (workspace.extensions.defaultProject as string)
    );

    if (project.extensions.projectType !== 'library') {
      throw new Error('Only library projects can generate documentation.');
    }

    const documentationJson = getDocumentationJson(tree, project);

    return chain([
      applyTypeDocDefinitions(documentationJson, project),
      applyCodeExamples(documentationJson, project),
      updateDocumentationJson(documentationJson, project),
    ]);
  };
}
