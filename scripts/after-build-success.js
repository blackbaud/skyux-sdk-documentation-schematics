const fs = require('fs-extra');
const path = require('path');

// const minimist = require('minimist');
// const rimraf = require('rimraf');

// const argv = minimist(process.argv.slice(2));

// Pass `--test-app-directory=my-dir` to change the testing application directory.
// const TEST_APP_DIR = argv['test-app-directory'] || 'builders-test-app';
const TEST_LIB_DIR = argv['test-lib-directory'] || 'builders-test-lib';
const TEST_DIST = '.buildersdist';

function cleanDist() {
  // rimraf.sync(path.join(TEST_APP_DIR, TEST_DIST));
  rimraf.sync(path.join(TEST_LIB_DIR, TEST_DIST));
}

function copyFilesToDist() {
  const pathsToCopy = [
    ['README.md'],
    ['CHANGELOG.md'],
    ['package.json'],
    // ['builders.json'],
    ['collection.json']
    // ['src/builders/protractor/schema.ext.json'],
    // ['src/schematics/ng-generate/setup-protractor/files'],
    // ['src/schematics/ng-generate/setup-protractor/schema.json'],
    // ['src/schematics/ng-generate/setup-tslint/files'],
    // ['src/schematics/ng-generate/setup-tslint/schema.json']
  ];

  pathsToCopy.forEach((pathArr) => {
    const sourcePath = path.join(...pathArr);
    const distPath = path.join('dist', ...pathArr);
    if (fs.existsSync(sourcePath)) {
      fs.copySync(sourcePath, distPath);
      console.log(`Successfully copied ${sourcePath} to ${distPath}`);
    } else {
      throw `File not found: ${sourcePath}`;
    }
  });

  // fs.copySync('dist', path.join(TEST_APP_DIR, TEST_DIST));
  fs.copySync('dist', path.join(TEST_LIB_DIR, TEST_DIST));
}

function mergeBuilderSchemas() {
  const schemaConfigs = [
    // {
    //   baseSchemaPath:
    //     './node_modules/@angular-devkit/build-angular/src/protractor/schema.json',
    //   schemaPath: './dist/src/builders/protractor/schema.ext.json'
    // }
  ];

  schemaConfigs.forEach((config) => {
    const schemaJson = fs.readJsonSync(path.resolve(config.schemaPath));
    const baseSchemaJson = fs.readJsonSync(path.resolve(config.baseSchemaPath));

    const newJson = Object.assign({}, baseSchemaJson, schemaJson);
    newJson.properties = Object.assign(
      {},
      baseSchemaJson.properties,
      schemaJson.properties || {}
    );

    fs.writeJsonSync(config.schemaPath, newJson, {
      encoding: 'utf8',
      spaces: 2
    });

    console.log(`Successfully merged ${config.schemaPath}`);
  });
}

cleanDist();
copyFilesToDist();
mergeBuilderSchemas();
