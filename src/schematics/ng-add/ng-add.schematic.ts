import { Rule } from '@angular-devkit/schematics';
import { NodePackageInstallTask } from '@angular-devkit/schematics/tasks';

import { readRequiredFile } from '../utility/tree';

export default function ngAdd(): Rule {
  return async (tree, context) => {
    const packageJson = JSON.parse(readRequiredFile(tree, '/package.json'));
    packageJson.scripts = packageJson.scripts || {};
    packageJson.scripts['skyux:generate-documentation'] =
      'ng generate @skyux-sdk/typedoc-schematics:documentation';
    tree.overwrite('/package.json', JSON.stringify(packageJson, undefined, 2));

    context.addTask(new NodePackageInstallTask());
  };
}
