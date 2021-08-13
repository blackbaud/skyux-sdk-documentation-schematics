import {
  SchematicTestRunner,
  UnitTestTree,
} from '@angular-devkit/schematics/testing';

import path from 'path';

import { createTestLibrary } from '../testing/scaffold';

const COLLECTION_PATH = path.resolve(__dirname, '../../../collection.json');

describe('ng-add.schematic', () => {
  const defaultProjectName = 'my-lib';

  let runner: SchematicTestRunner;
  let tree: UnitTestTree;

  beforeEach(async () => {
    runner = new SchematicTestRunner('schematics', COLLECTION_PATH);

    tree = await createTestLibrary(runner, {
      name: defaultProjectName,
    });
  });

  function runSchematic(
    tree: UnitTestTree,
    options?: { project?: string }
  ): Promise<UnitTestTree> {
    return runner.runSchematicAsync('ng-add', options, tree).toPromise();
  }

  it('should run the NodePackageInstallTask', async () => {
    await runSchematic(tree, {
      project: defaultProjectName,
    });

    expect(runner.tasks.some((task) => task.name === 'node-package')).toEqual(
      true,
      'Expected the schematic to setup a package install step.'
    );
  });

  it('should add scripts to package.json', async () => {
    const updatedTree = await runSchematic(tree, {
      project: defaultProjectName,
    });

    const packageJson = JSON.parse(updatedTree.readContent('package.json'));

    expect(packageJson.scripts['skyux:generate-documentation']).toEqual(
      'ng generate @skyux-sdk/documentation-schematics:documentation'
    );
  });

  it('should handle missing scripts section in package.json', async () => {
    // Remove scripts section before schematic is executed.
    let packageJson = JSON.parse(tree.readContent('package.json'));
    delete packageJson.scripts;
    tree.overwrite('package.json', JSON.stringify(packageJson));

    const updatedTree = await runSchematic(tree, {
      project: defaultProjectName,
    });

    packageJson = JSON.parse(updatedTree.readContent('package.json'));

    expect(packageJson.scripts['skyux:generate-documentation']).toEqual(
      'ng generate @skyux-sdk/documentation-schematics:documentation'
    );
  });
});
