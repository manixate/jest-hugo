# jest-hugo

[![](https://img.shields.io/npm/v/jest-hugo.svg)](https://www.npmjs.com/package/jest-hugo)
[![](https://img.shields.io/badge/license-MIT-yellow.svg)](https://github.com/manixate/jest-hugo/blob/master/LICENSE)
[![](https://github.com/manixate/jest-hugo/workflows/Demo/badge.svg)](https://github.com/manixate/jest-hugo/actions/workflows/demo.yml)

## Overview
`jest-hugo` allows you to test your [Hugo](https://github.com/gohugoio/hugo) theme.

Tests are written in the *tests* directory in files having the *.md* extension. [Jest](https://jestjs.io/) is used for testing. Watch mode is also supported and you don't need separate Hugo watch mode for testing.

## Requirements
1. Jest 24+
2. NodeJS 8+
3. Hugo >= [v0.55.0](https://github.com/gohugoio/hugo/releases/tag/v0.55.0)

## Usage
1. Add jest-hugo and jest to your theme repo: `npm install --save jest jest-hugo`
2. Create a `tests` subdirectory and a `first-test.md` file under it
3. Write tests using the `<test name='first test'>{{< MyShortcode >}}</test>` convention
4. Run tests using `npm run jest`
5. A snapshot subdirectory will be created at the same level as your test file
6. Update snapshots with `jest -u`

For watch mode, just use `jest --watchAll` which will rerun tests whenever there is an update.

## Configuration
- You can provide your own Hugo config by adding a `jest-hugo.config.json`
- If you need to change the test output directory, you can provide a path in `JEST_HUGO_TEST_DIR` environment variable
- You can specify path to your `hugo` executable by setting `JEST_HUGO_EXECUTABLE` environment variable. By default it uses the one in environment path.

## Guidelines
- Each test should be written in Markdown
- Each test case in a test file should be enclosed in a `<test name="test name">` tag where `name` can be any descriptive name representing the test
- To exclude a Markdown file from testing, use *.ignore.md* as the extension instead
- Tests also support asserting errors from `errorf`
- The Hugo output is generated under `<test dir>/.output` and is auto-cleaned
- Usage with test reporters is also supported. For that, see `demo` subdirectory.

## Demo
1. Checkout this repo
2. Run `npm install` or `yarn install`
3. Go to the `demo` subdirectory
4. Run `npm install` or `yarn install`
5. Run tests using `npm run jest` or `yarn jest`

The demo was tested with Hugo [v0.55.0](https://github.com/gohugoio/hugo/releases/tag/v0.55.0) up to Hugo [v0.59.1](https://github.com/gohugoio/hugo/releases/tag/v0.59.1).

## Known Limitations
- Asserting errors from `errorf` is currently only supported with Hugo <= [v0.61.0](https://github.com/gohugoio/hugo/releases/tag/v0.61.0) (see issue [#20](https://github.com/manixate/jest-hugo/issues/20)). The support for newer versions of hugo will be added later.
- For Hugo [v0.60.0](https://github.com/gohugoio/hugo/releases/tag/v0.60.0)+, it is required to:
  - Enable `unsafe: true` for goldmark renderer `markup.goldmark.renderer` https://gohugo.io/getting-started/configuration-markup
  - Ensure that the test has a front matter (an empty one works too). See `demo/tests/callout.md` for example.
- For Hugo < [v0.60.0](https://github.com/gohugoio/hugo/releases/tag/v0.60.0), tests cases should always be wrapped into a `<div />`. Example:
```html
<div>
  <test name="first test">{{< MyShortcode >}}</test>
  ...
</div>
```

Feel free to give feedback.
