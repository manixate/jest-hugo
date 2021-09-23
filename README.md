# jest-hugo
[![](https://img.shields.io/npm/v/jest-hugo.svg)](https://www.npmjs.com/package/jest-hugo)
[![](https://img.shields.io/badge/license-MIT-yellow.svg)](https://github.com/manixate/jest-hugo/blob/master/LICENSE)

## Overview
`jest-hugo` allows you to test your Hugo theme.

Tests are written in the *tests* directory in files having the *.md* extension. [Jest](https://jestjs.io/) is used for testing. Watch mode is also supported and you don't need separate Hugo watch mode for testing.

## Usage
1. Add jest-hugo and jest to your theme repo: `npm install --save jest jest-hugo`
2. Create a `tests` subdirectory and a `first-test.md` file under it
3. Write tests using the `<test name='first test'>{{< myshortcode >}}</test>` convention
4. Run tests using `npm run jest`
5. A snapshot subdirectory will be created at the same level as your test file
6. Update snapshots with `jest -u`

For watch mode, just use `jest --watchAll` which will rerun tests whenever there is an update.

## Configuration
- You can provide your own Hugo config by adding a `jest-hugo.config.json`
- If you need to change the test output directory, you can provide a path in `JEST_HUGO_TEST_DIR` environment variable
- You can specify path to your `hugo` executable by setting `JEST_HUGO_EXECUTABLE` environment variable. By default it uses the one in environment path

## Guidelines
- Each test should be written in Markdown
- Each test case in a test file should be enclosed in a `<test name="test name">` tag where `name` can be any descriptive name representing the test
- To ignore a Markdown file from testing, use *.ignore.md* as the extension instead
- Tests also support asserting errors from `errorf`. Currently this is only supported on Hugo <= 0.61.0. Newer versions of Hugo don't print error to output HTML. The support for newer versions of hugo will be added later.
- The Hugo output will be generated under `<test dir>/.output`. It will be auto-cleaned
- Usage with test reporters is also supported. See `demo` subdirectory
- For Hugo 0.60+
  - Enable `unsafe: true` for goldmark renderer `markup.goldmark.renderer` https://gohugo.io/getting-started/configuration-markup
  - Ensure that the test has frontend (empty works too). See `demo/tests/callout.md` for example.

## Demo
1. Checkout this repo
2. Go to the `demo` subdirectory
3. Run `npm install` or `yarn install`
4. Run tests using `npm run jest` or `yarn jest`

The demo uses Hugo 0.55

## Requirements
1. Jest 24+
2. NodeJS 8+
3. Hugo <= 0.61.0

Feel free to give feedback.
