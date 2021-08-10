import {
  SchematicTestRunner,
  UnitTestTree
} from '@angular-devkit/schematics/testing';

import path from 'path';

import { createTestLibrary } from '../../testing/scaffold';

describe('Setup protractor schematic', () => {
  const collectionPath = path.join(__dirname, '../../../../collection.json');
  const defaultProjectName = 'my-lib';
  const schematicName = 'documentation';

  const runner = new SchematicTestRunner('generate', collectionPath);

  let tree: UnitTestTree;

  beforeEach(async () => {
    tree = await createTestLibrary(runner, {
      name: defaultProjectName
    });
  });

  function runSchematic(): Promise<UnitTestTree> {
    return runner
      .runSchematicAsync(
        schematicName,
        {
          project: defaultProjectName
        },
        tree
      )
      .toPromise();
  }
});
