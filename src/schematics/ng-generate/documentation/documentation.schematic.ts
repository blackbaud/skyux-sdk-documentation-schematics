import { normalize } from '@angular-devkit/core';
import { ProjectDefinition } from '@angular-devkit/core/src/workspace';
import { chain, Rule } from '@angular-devkit/schematics';

import TypeDoc from 'typedoc';

import { getProject, getWorkspace } from '../../utility/workspace';

import { Schema } from './schema';

function runTypeDoc(project: ProjectDefinition): Rule {
  return async () => {
    const app = new TypeDoc.Application();

    app.bootstrap({
      entryPoints: [normalize(`${project.sourceRoot}/public-api.ts`)]
    });

    const typedocProject = app.convert();

    if (typedocProject) {
      // Project may not have converted correctly
      const outputDir = 'docs';
      await app.generateJson(typedocProject, outputDir + '/documentation.json');
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

    // Run TypeDoc.
    // Create raw text versions of StackBlitz code examples.
    return chain([runTypeDoc(project)]);
  };
}
