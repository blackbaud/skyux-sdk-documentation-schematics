# 5.0.0-beta.3 (2021-09-07)

- Updated the `add` schematic to ignore the documentation directory for ESLint. [#6](https://github.com/blackbaud/skyux-sdk-documentation-schematics/pull/6)
- Updated the `add` schematic to add a "postbuild" step to the workspace `package.json` file. [#6](https://github.com/blackbaud/skyux-sdk-documentation-schematics/pull/6)

# 5.0.0-beta.2 (2021-09-07)

- Updated the `documentation` schematic to map relative import statements within code examples to the library's NPM package name. For example, the import path `'projects/my-lib/src/public-api'` will be replaced with `'@skyux/my-lib'`. [#4](https://github.com/blackbaud/skyux-sdk-documentation-schematics/pull/4)

# 5.0.0-beta.1 (2021-08-18)

- Fixed the `documentation` generate schematic to handle components and directives that are not exported from the public API. [#3](https://github.com/blackbaud/skyux-sdk-documentation-schematics/pull/3)

# 5.0.0-beta.0 (2021-08-13)

- Initial beta release.
