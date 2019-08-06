# Overview
`jest-hugo` allows you to test your hugo theme.

Tests are written in the *tests* directory and with filename ending in **.md** extension. *Jest* is used for testing. Watch mode is also supported and you don't need separate hugo watch mode for testing.

## Usage
1. Add jest-hugo and jest to your theme repo. `npm install --save jest manixate/jest-hugo`
2. Create `tests` subdirectory and a `first-test.md` file under it.
3. Write test using `<test name='first test'>{{< myshortcode >}}</test>`
4. Run test using `npm run jest`
5. A snapshot subdirectory will be created at the same level as your test file

For watch mode just use `jest --watchAll` which will rerun tests whenever there is an update

## Configuration
- You can provide your own hugo config by adding a `jest-hugo.config.json`
- If you need to change the test output directory, you can provide a path in `JEST_HUGO_TEST_DIR` environment variable

## Guidelines:
- Each test should be written in markdown.
- Tests should be compatible with Hugo v0.55.
- Each test case in a test file should be enclosed in a `<test name="test name">` tag where `name` can be any descriptive name representing the test.
- If you want to ignore a markdown file from testing then you should use *.ignore.md* as the extension instead.
- Tests also support asserting errors from `errorf`.
- Hugo output will be generated under `<test dir>/.output`. It will be auto-cleaned.
- Usage with test reporters is also supported. See `demo` subdirectory.

## Demo
1. Checkout this repo
2. Go to `demo` subdirectory
3. Run `npm install` or `yarn install`
4. Run tests using `npm run jest` or `yarn jest`

## Requirements
1. Hugo v0.55
2. Jest 24+
3. NodeJS 8+

Feel free to give feedback.