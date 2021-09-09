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
  let typedocBootstrapSpy: jasmine.Spy;

  beforeEach(async () => {
    tree = await createTestLibrary(runner, {
      name: defaultProjectName,
    });

    mockTypeDocProject = {};
    mockTypeDocProjectJson = {};

    typedocBootstrapSpy = jasmine.createSpy('TypeDoc.Application.boostrap');

    mock('typedoc', {
      Application: function () {
        return {
          bootstrap: typedocBootstrapSpy,
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
      `import {
  Component
} from '@angular/core';

import {
  MyService
} from 'projects/${defaultProjectName}/src/public-api';

import {
  Subscription
} from 'rxjs';

@Component({
  selector: 'app-my-demo',
  templateUrl: './my-demo.component.html'
})
export class MyDemoComponent {}
`
    );

    tree.create(
      'projects/my-lib/documentation/code-examples/foobar/foobar.component.html',
      `import {
  Component
} from '@angular/core';

import {
  MyService
} from 'projects/${defaultProjectName}/src/public-api';

import {
  MyType
} from 'projects/${defaultProjectName}/src/public-api';

import {
  Subscription
} from 'rxjs';

@Component({
  selector: 'app-my-demo',
  templateUrl: './my-demo.component.html'
})
export class MyDemoComponent {}
`
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
        rawContents: `import {
  Component
} from '@angular/core';

import {
  MyService
} from '${defaultProjectName}';

import {
  Subscription
} from 'rxjs';

@Component({
  selector: 'app-my-demo',
  templateUrl: './my-demo.component.html'
})
export class MyDemoComponent {}
`,
      },
      {
        fileName: 'foobar.component.html',
        filePath:
          '/projects/my-lib/documentation/code-examples/foobar/foobar.component.html',
        rawContents: `import {
  Component
} from '@angular/core';

import {
  MyService
} from '${defaultProjectName}';

import {
  MyType
} from '${defaultProjectName}';

import {
  Subscription
} from 'rxjs';

@Component({
  selector: 'app-my-demo',
  templateUrl: './my-demo.component.html'
})
export class MyDemoComponent {}
`,
      },
      {
        fileName: 'foobar.component.scss',
        filePath:
          '/projects/my-lib/documentation/code-examples/foobar/foobar.component.scss',
        rawContents: 'CODE EXAMPLE CONTENT 3',
      },
    ]);
  });

  it('should remap component/directive export aliases', async () => {
    mockTypeDocProjectJson = {
      children: [
        {
          id: 100,
          name: 'λ2',
          kind: 128,
          kindString: 'Class',
          flags: {},
          comment: {
            shortText: 'COMMENT',
          },
          decorators: [
            {
              name: 'Directive',
              type: {
                type: 'reference',
                name: 'Directive',
              },
              arguments: {
                obj: "{\n  selector: '[skyId]',\n  exportAs: 'skyId'\n}",
              },
            },
          ],
          children: [
            {
              id: 101,
              name: 'constructor',
              kind: 512,
              kindString: 'Constructor',
              flags: {},
              sources: [
                {
                  fileName: 'projects/core/src/modules/id/id.directive.ts',
                  line: 32,
                  character: 2,
                },
              ],
              signatures: [
                {
                  id: 102,
                  name: 'new λ2',
                  kind: 16384,
                  kindString: 'Constructor signature',
                  flags: {},
                  parameters: [],
                  type: {
                    type: 'reference',
                    id: 100,
                    name: 'SkyIdDirective',
                  },
                },
              ],
            },
            {
              id: 105,
              name: 'id',
              kind: 262144,
              kindString: 'Accessor',
              flags: {},
            },
          ],
        },
      ],
    };

    const updatedTree = await runSchematic();

    expect(
      JSON.parse(updatedTree.readContent('dist/my-lib/documentation.json'))
    ).toEqual({
      anchorIds: {
        SkyIdDirective: 'class-skyiddirective',
      },
      typedoc: {
        children: [
          {
            id: 100,
            name: 'SkyIdDirective',
            kind: 128,
            kindString: 'Class',
            flags: {},
            comment: {
              shortText: 'COMMENT',
            },
            decorators: [
              {
                name: 'Directive',
                type: {
                  type: 'reference',
                  name: 'Directive',
                },
                arguments: {
                  obj: "{\n  selector: '[skyId]',\n  exportAs: 'skyId'\n}",
                },
              },
            ],
            children: [
              {
                id: 101,
                name: 'constructor',
                kind: 512,
                kindString: 'Constructor',
                flags: {},
                sources: [
                  {
                    fileName: 'projects/core/src/modules/id/id.directive.ts',
                    line: 32,
                    character: 2,
                  },
                ],
                signatures: [
                  {
                    id: 102,
                    name: 'SkyIdDirective',
                    kind: 16384,
                    kindString: 'Constructor signature',
                    flags: {},
                    parameters: [],
                    type: {
                      type: 'reference',
                      id: 100,
                      name: 'SkyIdDirective',
                    },
                  },
                ],
              },
              {
                id: 105,
                name: 'id',
                kind: 262144,
                kindString: 'Accessor',
                flags: {},
              },
            ],
          },
        ],
      },
      codeExamples: [],
    });
  });
});
