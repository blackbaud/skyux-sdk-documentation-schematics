import {
  SchematicTestRunner,
  UnitTestTree,
} from '@angular-devkit/schematics/testing';

import mock from 'mock-require';
import path from 'path';
import { JSONOutput } from 'typedoc';

import { createTestLibrary } from '../../testing/scaffold';

describe('Setup protractor schematic', () => {
  const collectionPath = path.join(__dirname, '../../../../collection.json');
  const defaultProjectName = 'my-lib';
  const schematicName = 'documentation';

  const runner = new SchematicTestRunner('generate', collectionPath);

  let tree: UnitTestTree;
  let mockTypeDocProject: Partial<JSONOutput.ProjectReflection>;

  beforeEach(async () => {
    tree = await createTestLibrary(runner, {
      name: defaultProjectName,
    });

    mockTypeDocProject = {};

    mock('typedoc', {
      Application: function () {
        return {
          bootstrap() {},
          convert() {
            return {};
          },
          options: {
            setCompilerOptions() {},
          },
          serializer: {
            toObject() {
              return mockTypeDocProject;
            },
          },
        };
      },
      JSONOutput: {
        ProjectReflection: {},
      },
    });
  });

  afterEach(() => {
    mock.stopAll();
  });

  function runSchematic(): Promise<UnitTestTree> {
    return runner
      .runSchematicAsync(
        schematicName,
        {
          project: defaultProjectName,
        },
        tree
      )
      .toPromise();
  }

  it('should generate documentation JSON', async () => {
    const updatedTree = await runSchematic();
    expect(updatedTree.readContent('dist/my-lib/documentation.json')).toEqual(
      `{
  "anchorIds": {},
  "typedoc": {}
}`
    );
  });
});
