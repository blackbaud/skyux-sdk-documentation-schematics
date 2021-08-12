import { normalize } from '@angular-devkit/core';
import { ProjectDefinition } from '@angular-devkit/core/src/workspace';
import { chain, Rule } from '@angular-devkit/schematics';

import { Application as TypeDocApplication, JSONOutput } from 'typedoc';
import { ModuleKind, ModuleResolutionKind, ScriptTarget } from 'typescript';

import { getProject, getWorkspace } from '../../utility/workspace';

import { Schema } from './schema';

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
function getAnchorIds(
  json: JSONOutput.ProjectReflection
): { [_: string]: string } {
  const anchorIdMap: { [_: string]: string } = {};
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

function runTypeDoc(project: ProjectDefinition): Rule {
  return async (tree) => {
    const files: string[] = [normalize(`${project.sourceRoot}/public-api.ts`)];

    const app = new TypeDocApplication();

    app.bootstrap({
      entryPoints: files,
      excludeExternals: true,
      excludeInternal: true,
      excludeNotDocumented: true,
      excludePrivate: true,
      excludeProtected: true,
      logLevel: 'Verbose'
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
        baseUrl: './'
      },
      undefined
    );

    const typedocProject = app.convert();

    if (typedocProject) {
      const documentationJsonPath = getDocumentationJsonPath(project);
      const projectReflection = app.serializer.toObject(typedocProject);
      const anchorIds = getAnchorIds(projectReflection);

      const contents = JSON.stringify(
        {
          anchorIds,
          typedoc: projectReflection
        },
        undefined,
        2
      );

      tree.overwrite(documentationJsonPath, contents);
    } else {
      console.log('Documentation generation failed.');
    }
  };
}

function getDocumentationJsonPath(project: ProjectDefinition): string {
  return `${project.root}/documentation/documentation.json`;
}

function ensureDocumentationJson(project: ProjectDefinition): Rule {
  return (tree) => {
    const documentationJsonPath = getDocumentationJsonPath(project);
    if (!tree.exists(documentationJsonPath)) {
      tree.create(documentationJsonPath, '{}');
    }
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

    return chain([ensureDocumentationJson(project), runTypeDoc(project)]);
  };
}
