import { Rule } from '@angular-devkit/schematics';
import { NodePackageInstallTask } from '@angular-devkit/schematics/tasks';

export default function ngAdd(): Rule {
  return async (_tree, context) => {
    context.addTask(new NodePackageInstallTask());
  };
}
