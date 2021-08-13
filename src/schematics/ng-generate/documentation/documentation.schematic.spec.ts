import {
  SchematicTestRunner,
  UnitTestTree,
} from '@angular-devkit/schematics/testing';

import mock from 'mock-require';
import path from 'path';
import { JSONOutput, ProjectReflection } from 'typedoc';

import { createTestApp, createTestLibrary } from '../../testing/scaffold';

import { Schema } from './schema';

describe('Setup protractor schematic', () => {
  const collectionPath = path.join(__dirname, '../../../../collection.json');
  const defaultProjectName = 'my-lib';
  const schematicName = 'documentation';

  const runner = new SchematicTestRunner('generate', collectionPath);

  let tree: UnitTestTree;

  let mockTypeDocProject: Partial<ProjectReflection> | undefined;
  let mockTypeDocProjectJson: Partial<JSONOutput.ProjectReflection>;

  beforeEach(async () => {
    tree = await createTestLibrary(runner, {
      name: defaultProjectName,
    });

    mockTypeDocProject = {};
    mockTypeDocProjectJson = {};

    mock('typedoc', {
      Application: function () {
        return {
          bootstrap() {},
          convert() {
            return mockTypeDocProject;
          },
          options: {
            setCompilerOptions() {},
          },
          serializer: {
            toObject() {
              return mockTypeDocProjectJson;
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

  function runSchematic(options: Schema = {}): Promise<UnitTestTree> {
    return runner
      .runSchematicAsync(
        schematicName,
        {
          ...{
            project: defaultProjectName,
          },
          ...options,
        },
        tree
      )
      .toPromise();
  }

  it('should generate documentation JSON', async () => {
    mockTypeDocProjectJson = {
      children: [
        {
          id: 1,
          flags: {},
          kind: 0,
          kindString: 'Class',
          name: 'FooService',
        },
        {
          id: 2,
          flags: {},
          kind: 1,
          kindString: 'Variable', // Variables should be omitted from anchorIds.
          name: 'FOOBAR_VAR',
        },
        {
          id: 3,
          flags: {},
          kind: 2,
          name: 'missing-kind-string', // Entries without `kindString` should be omitted from anchorIds.
        },
      ],
    };

    const updatedTree = await runSchematic();

    expect(updatedTree.readContent('dist/my-lib/documentation.json')).toEqual(
      `{
  "anchorIds": {
    "FooService": "class-fooservice"
  },
  "typedoc": {
    "children": [
      {
        "id": 1,
        "flags": {},
        "kind": 0,
        "kindString": "Class",
        "name": "FooService"
      },
      {
        "id": 2,
        "flags": {},
        "kind": 1,
        "kindString": "Variable",
        "name": "FOOBAR_VAR"
      },
      {
        "id": 3,
        "flags": {},
        "kind": 2,
        "name": "missing-kind-string"
      }
    ]
  },
  "codeExamples": []
}`
    );
  });

  it('should generate documentation for `defaultProject` if project not defined', async () => {
    const updatedTree = await runSchematic({
      project: undefined,
    });

    expect(updatedTree.files).toContain('/dist/my-lib/documentation.json');
  });

  it('should throw an error if project is not a library', async () => {
    tree = await createTestApp(runner, { defaultProjectName: 'my-app' });

    await expectAsync(
      runSchematic({
        project: 'my-app',
      })
    ).toBeRejectedWithError(
      'Only library projects can generate documentation.'
    );
  });

  it('should throw an error if TypeDoc fails to compile', async () => {
    mockTypeDocProject = undefined;

    await expectAsync(runSchematic()).toBeRejectedWithError(
      'TypeDoc project generation failed. ' +
        'This usually occurs when the target TypeScript project cannot compile or is invalid. ' +
        'Try running `ng build` to debug any compiler issues.'
    );
  });

  it('should stringify code examples', async () => {
    tree.create(
      'projects/my-lib/documentation/code-examples/foobar/foobar.component.ts',
      'CODE EXAMPLE CONTENT 1'
    );
    tree.create(
      'projects/my-lib/documentation/code-examples/foobar/foobar.component.html',
      'CODE EXAMPLE CONTENT 2'
    );
    tree.create(
      'projects/my-lib/documentation/code-examples/foobar/foobar.component.scss',
      'CODE EXAMPLE CONTENT 3'
    );

    const updatedTree = await runSchematic();

    const documentationJson = JSON.parse(
      updatedTree.readContent('dist/my-lib/documentation.json')
    );

    expect(documentationJson.codeExamples).toEqual([
      {
        fileName: 'foobar.component.ts',
        filePath:
          '/projects/my-lib/documentation/code-examples/foobar/foobar.component.ts',
        rawContents: 'CODE EXAMPLE CONTENT 1',
      },
      {
        fileName: 'foobar.component.html',
        filePath:
          '/projects/my-lib/documentation/code-examples/foobar/foobar.component.html',
        rawContents: 'CODE EXAMPLE CONTENT 2',
      },
      {
        fileName: 'foobar.component.scss',
        filePath:
          '/projects/my-lib/documentation/code-examples/foobar/foobar.component.scss',
        rawContents: 'CODE EXAMPLE CONTENT 3',
      },
    ]);
  });
});
