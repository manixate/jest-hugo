const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const cheerio = require('cheerio');

/*
  Regex representing a test case
  <test name="test name">
    <!-- Test case here -->
  </test>
*/
const regex = new RegExp(/<test.*?name="([^"]*?)".*?>((?:.*?\r?\n?)*?)<\/test>/gi);

/**
 * Returns the path to index.html output file related to the test file
 * 
 * If the test is inside <test>/xyz/_index.md then the test output will be in <output>/xyz/index.html
 * If the test is inside <test>/xyz/abc.md then the test output will be in <output>/xyz/abc/index.html  
 * 
 * @param {string} testPath Path of the test file
 * @param {string} hugoContentDir Path of hugo content directory.
 * @param {string} hugoOutputDir Path of hugo output directory.
 * 
 * @returns {string} Path of the index.html file
 */
function findHugoTestOutputPath(testPath, hugoContentDir, hugoOutputDir) {
  const testDirectory = path.parse(path.relative(hugoContentDir, testPath));

  if (testDirectory.base === "_index.md") {
    return path.resolve(hugoOutputDir, testDirectory.dir, 'index.html');
  } else {
    return path.resolve(hugoOutputDir, testDirectory.dir, testDirectory.name, 'index.html');
  }
}

/**
 * Return the "{folder}/{file}.md" part.
 */
 function extractPathFromErrorf(output) {
  var regexp = /(.*).md:/
  var matches = regexp.exec(output)
  return (matches && matches.length > 0) ? matches[1] : ""
}

/**
 * Generate test cases from the test file
 * 
 * @param
 * @param {string} testPath Path of the test file
 * 
 * @returns {string} Generated test case string
 */
function generateTestCases(testPath, errors) {
  console.log("errors", errors);
  const fileData = fs.readFileSync(testPath, "utf-8");

  const $ = cheerio.load(fileData, null, false);
  const tests = $('test');
  if (tests.length === 0) {
    return [];
  }

  console.log('');
  const generatedTestCases = tests.map((i, test) => {
    const testTitle = test.attribs.name;
    // Normalize file paths in errors ("{folder}\{file}.md: ..." => "{folder}/{file}.md: ...")
    const filepath = extractPathFromErrorf(testCases[key])
    const value = $(test).html()
      .replace(filepath, filepath.replace(/\\/g, '/'))
      .replace(/[^\\]'/g, '\\\'')
      .replace(/\r\n/g, '\\n') // CRLF on Windows with Hugo 0.60+
      .replace(/\n/g, '\\n');

    // Test for asserting on errors
    const expectedError = $('div#expected-error', test);
    if (expectedError.length > 0) {
      const errorId = expectedError.attr('data-id');
      const errorText = expectedError.attr('data-error');
      // Pick the corresponding error from the logs
      const error = (errors.find((e) => e.expected.startsWith(`${errorId}|`)) || {}).actual
        .replace(/'/g, '\\\'');

      const expected = errorText.replace(/'/g, '\\\'');

      return [
        `it ('${testTitle}', () => {`,
        `  const actual = '${error}';`,
        `  const expected = '${expected}';`,
        `  expect(actual).toEqual(expected);`,
        "})"
      ].join("\n");
    } else {
      return [
        `it ('${testTitle}', () => {`,
        `  const value = '${value}';`,
        "  expect({custom: 'beautify', input: value}).toMatchSnapshot();",
        "})"
      ].join("\n");
    }
  }).get();

  return generatedTestCases;
}

module.exports = {
  getCacheKey: (source, filepath, configString) => {
    const jestHugoOutputDir = process.env.JEST_HUGO_OUTPUT_DIR;
    const jestHugoContentDir = process.env.JEST_HUGO_CONTENT_DIR;

    const hugoTestPath = findHugoTestOutputPath(filepath, jestHugoContentDir, jestHugoOutputDir)
    const testFileData = fs.readFileSync(hugoTestPath, "utf-8");

    return crypto
      .createHash("md5")
      .update(source)
      .update("\0", "utf8")
      .update(filepath)
      .update("\0", "utf8")
      .update(hugoTestPath)
      .update("\0", "utf8")
      .update(testFileData)
      .update("\0", "utf8")
      .update(JSON.stringify(configString))
      .update("\0", "utf8")
      .digest("hex");
  },
  process: function(source, filepath) {
    console.log("filepath", filepath);
    const jestHugoOutputDir = process.env.JEST_HUGO_OUTPUT_DIR;
    const jestHugoContentDir = process.env.JEST_HUGO_CONTENT_DIR;

    const hugoTestPath = findHugoTestOutputPath(filepath, jestHugoContentDir, jestHugoOutputDir)
    const testName = path.basename(path.dirname(hugoTestPath));

    var errors = null;
    const errorFile = path.resolve(jestHugoOutputDir, 'output.err.json');
    if (fs.existsSync(errorFile)) {
      errors = JSON.parse(fs.readFileSync(errorFile));
    }

    const relativeFilePath = path.relative(jestHugoContentDir, filepath);

    const testCases = generateTestCases(hugoTestPath, errors[relativeFilePath]);
    const code = [
      `describe('${testName}', () => {`,
      testCases.join("\n\n"),
      "})"
    ].join("\n");

    return {
      code
    }
  }
}