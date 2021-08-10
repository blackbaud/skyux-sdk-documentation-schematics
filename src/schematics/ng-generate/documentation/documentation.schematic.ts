import { normalize } from '@angular-devkit/core';
import { ProjectDefinition } from '@angular-devkit/core/src/workspace';
import { chain, Rule } from '@angular-devkit/schematics';

import * as TypeDoc from 'typedoc';
import { ModuleKind, ModuleResolutionKind, ScriptTarget } from 'typescript';

import { getProject, getWorkspace } from '../../utility/workspace';

import { Schema } from './schema';

function runTypeDoc(project: ProjectDefinition, projectName: string): Rule {
  return async () => {
    const files = [normalize(`${project.sourceRoot}/public-api.ts`)];

    const app = new TypeDoc.Application();

    app.bootstrap({
      entryPoints: files
    });

    app.options.setCompilerOptions(
      files,
      {
        experimentalDecorators: true,
        module: ModuleKind.ES2020,
        moduleResolution: ModuleResolutionKind.NodeJs,
        target: ScriptTarget.ES2017
      },
      undefined
    );

    const typedocProject = app.convert();

    if (typedocProject) {
      const outputDir = `${process.cwd()}/dist/${projectName}`;
      await app.generateJson(typedocProject, outputDir + '/documentation.json');
    }
  };
}

export default function generateDocumentation(options: Schema): Rule {
  return async (tree) => {
    const { workspace } = await getWorkspace(tree);

    const { project, projectName } = await getProject(
      workspace,
      options.project || (workspace.extensions.defaultProject as string)
    );

    if (project.extensions.projectType !== 'library') {
      throw new Error('Only library projects can generate documentation.');
    }

    // Run TypeDoc.
    // Create raw text versions of StackBlitz code examples.
    return chain([runTypeDoc(project, projectName)]);
  };
}
