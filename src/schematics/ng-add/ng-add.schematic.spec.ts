import {
  SchematicTestRunner,
  UnitTestTree
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
      name: defaultProjectName
    });
  });

  async function runSchematic(
    tree: UnitTestTree,
    options?: { project?: string }
  ): Promise<void> {
    await runner.runSchematicAsync('ng-add', options, tree).toPromise();
  }

  it('should run the NodePackageInstallTask', async () => {
    await runSchematic(tree, {
      project: defaultProjectName
    });

    expect(runner.tasks.some((task) => task.name === 'node-package')).toEqual(
      true,
      'Expected the schematic to setup a package install step.'
    );
  });
});
