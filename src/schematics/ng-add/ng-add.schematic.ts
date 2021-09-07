import { normalize } from '@angular-devkit/core';
import { ProjectDefinition } from '@angular-devkit/core/src/workspace';
import { chain, Rule } from '@angular-devkit/schematics';
import { NodePackageInstallTask } from '@angular-devkit/schematics/tasks';

import { readRequiredFile } from '../utility/tree';
import { getProject, getWorkspace } from '../utility/workspace';

import { Schema } from './schema';

function addPackageJsonScript(): Rule {
  return (tree) => {
    const packageJson = JSON.parse(readRequiredFile(tree, '/package.json'));

    packageJson.scripts = packageJson.scripts || {};
    packageJson.scripts['skyux:generate-documentation'] =
      'ng generate @skyux-sdk/documentation-schematics:documentation';

    packageJson.scripts.postbuild = 'npm run skyux:generate-documentation';

    tree.overwrite('/package.json', JSON.stringify(packageJson, undefined, 2));
  };
}

function addDocumentationDirectoryToEslintIgnore(
  project: ProjectDefinition
): Rule {
  return (tree) => {
    const eslintPath = normalize(`${project.root}/.eslintrc.json`);
    if (tree.exists(eslintPath)) {
      const eslintJson = JSON.parse(tree.read(eslintPath)!.toString());
      eslintJson.ignorePatterns.push('documentation/**/*');
      tree.overwrite(eslintPath, JSON.stringify(eslintJson, undefined, 2));
    }
  };
}

export default function ngAdd(options: Schema): Rule {
  return async (tree) => {
    const { workspace } = await getWorkspace(tree);

    const { project } = await getProject(
      workspace,
      options.project || (workspace.extensions.defaultProject as string)
    );

    return chain([
      addPackageJsonScript(),
      addDocumentationDirectoryToEslintIgnore(project),
      (_tree, context) => {
        context.addTask(new NodePackageInstallTask());
      },
    ]);
  };
}
