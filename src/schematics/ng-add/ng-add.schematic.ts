import { chain, Rule } from '@angular-devkit/schematics';
import { NodePackageInstallTask } from '@angular-devkit/schematics/tasks';

import { readRequiredFile } from '../utility/tree';

function addPackageJsonScript(): Rule {
  return (tree) => {
    const packageJson = JSON.parse(readRequiredFile(tree, '/package.json'));

    packageJson.scripts = packageJson.scripts || {};
    packageJson.scripts['skyux:generate-documentation'] =
      'ng generate @skyux-sdk/documentation-schematics:documentation';

    tree.overwrite('/package.json', JSON.stringify(packageJson, undefined, 2));
  };
}

export default function ngAdd(): Rule {
  return chain([
    addPackageJsonScript(),
    (_tree, context) => {
      context.addTask(new NodePackageInstallTask());
    },
  ]);
}
