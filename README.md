# jest-hugo

[![](https://img.shields.io/npm/v/jest-hugo.svg)](https://www.npmjs.com/package/jest-hugo)
[![](https://img.shields.io/badge/license-MIT-yellow.svg)](https://github.com/manixate/jest-hugo/blob/master/LICENSE)
[![](https://github.com/manixate/jest-hugo/workflows/Demo/badge.svg)](https://github.com/manixate/jest-hugo/actions/workflows/demo.yml)
[![](https://github.com/manixate/jest-hugo/workflows/Prettier/badge.svg)](https://github.com/manixate/jest-hugo/actions/workflows/prettier.yml)

## Overview

`jest-hugo` allows you to test your [Hugo](https://github.com/gohugoio/hugo) theme.

Tests are written in a _tests_ directory in files having the _.md_ extension.
[Jest](https://jestjs.io/) is used for testing. The Jest watch mode is also supported (no need for Hugo in watch mode).

`jest-hugo` also supports Hugo multilingual output resolution for localized test files that use language suffixes such as `page.fr.md`.

## Requirements

1. Jest 24+
2. NodeJS 8+
3. Hugo >= [v0.100.0](https://github.com/gohugoio/hugo/releases/tag/v0.100.0)

## Usage

### Adding Dependencies

Add `jest-hugo` and `jest` packages to your theme repo: `npm install --save jest jest-hugo`

### Writing Tests

#### Guidelines

- Create a `tests` subdirectory with `.md` files under it
- Each test must be written in Markdown
- The Hugo output is generated under `<test dir>/.output` and is auto-cleaned before each run
- To exclude a Markdown file from testing, use _.ignore.md_ as file extension (instead of _.md_)
- Usage with test reporters is also supported. For that, refer to the [`demo`](./demo) subdirectory.

#### Nominal Cases ✔️

Write each test case enclosed in a `<test name="test name">` tag where `name` can be any descriptive name representing the test. Example:

```
<test name="should render successfully">
  {{% myshortcode %}}
  ...
  {{% /myshortcode %}}
</test>
```

When running the tests, a Jest `__snapshots__` subdirectory will be created at the same level as your test file.

#### Error Cases ❌

This project allows asserting errors from [`errorf`](https://gohugo.io/functions/errorf/). For that, use the `expect` keyword the following way:

```
<test name="should throw an error when invalid type is provided">
  {{< expect error="Invalid type!" >}}
  {{% myshortcode type="invalid" %}}
  ...
  {{% /myshortcode %}}
</test>
```

When running the tests, _ERROR YYYY/MM/DD HH:MM:SS shortcodes\\myshortcode.md: Invalid type!_ will be expected to be found in the Hugo output.

#### Localized test files

`jest-hugo` supports Hugo-style language suffixes in test file names such as `page.fr.md` and `_index.fr.md`.

If the suffix matches a configured Hugo language and is **not** the default language, the expected output path is resolved under the corresponding language subdirectory.

Example with `defaultContentLanguage = "en"` and languages `en`, `fr`:

- `tests/page.md` → `.output/page/index.html`
- `tests/page.en.md` → `.output/page/index.html`
- `tests/page.fr.md` → `.output/fr/page/index.html`

For `_index` files:

- `tests/docs/_index.md` → `.output/docs/index.html`
- `tests/docs/_index.fr.md` → `.output/fr/docs/index.html`

### Running Tests

1. Run tests using `npm run jest`
2. Update Jest snapshots with `jest -u`
3. For watch mode, use `jest --watchAll` which will rerun tests whenever there is an update.

## Configuration

### Hugo Configuration

You can provide your own Hugo config by creating a `jest-hugo.config.json` file at the root of your project.

### Environment Variables

| Variable               | Description                | Default |
| ---------------------- | -------------------------- | ------- |
| `JEST_HUGO_TEST_DIR`   | Name of the test directory | "tests" |
| `JEST_HUGO_EXECUTABLE` | Name of the Hugo command   | "hugo"  |
| `JEST_HUGO_DEBUG`      | Output additional logs     | false   |

### Multilingual Configuration

For multilingual filename-based output resolution, make sure your Hugo configuration defines a default language and the available languages. Example:

```toml
defaultContentLanguage = "en"

[languages]
  [languages.en]
    weight = 1

  [languages.fr]
    weight = 2
```

## Demo

1. Checkout this repo
2. Run `npm install` or `yarn install`
3. Go to the `demo` subdirectory
4. Run `npm install` or `yarn install`
5. Run tests using `npm run jest` or `yarn jest`

The demo was tested with Hugo [v0.100.0](https://github.com/gohugoio/hugo/releases/tag/v0.100.0) and the [latest](https://github.com/gohugoio/hugo/releases/latest) version.

## Known Limitations

- This project requires to enable `unsafe: true` for the Goldmark renderer. See: [`markup.goldmark.renderer`](https://gohugo.io/getting-started/configuration-markup).
- Ensure that each test file has a front matter (an empty one works too). See [`callout.md`](./demo/tests/shortcodes/callout.md?plain=1) for example.
- One single log message is created for multiple calls to [`errorf`](https://gohugo.io/functions/errorf/) with the exact same string. This means a single test file can't output multiple times the same error, and test cases expecting an exact same error message must be defined in their own _.md_ file (see [`demo/tests/shortcodes`](./demo/tests/shortcodes) subdirectory) (see also: [#20](https://github.com/manixate/jest-hugo/issues/20)).

Feel free to give feedback.
