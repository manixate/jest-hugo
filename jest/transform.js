const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

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
 * Generate test cases from the test file
 * 
 * @param {string} testPath Path of the test file
 * 
 * @returns {string} Generated test case string
 */
function generateTestCases(testPath) {
  const fileData = fs.readFileSync(testPath, "utf-8");

  const testCases = {};
  var match;
  do {
    match = regex.exec(fileData);
    if (match) {
      testCases[match[1]] = match[2];
    }
  } while (match);

  // Create test cases
  const generatedTestCases = []
  for (key in testCases) {
    const value = testCases[key]
      .replace(/[^\\]'/g, '\\\'')
      .replace(/\n/g, '\\n');

    var testTitle = key.replace(/[^\\]'/g, '\\\'')

    generatedTestCases.push([
      `it ('${testTitle}', () => {`,
      `  const value = '${value}';`,
      "  expect({custom: 'beautify', input: value}).toMatchSnapshot();",
      "})"
    ].join("\n"));
  }

  return generatedTestCases;
}

module.exports = {
  getCacheKey: (source, filepath, configString, { instrument }) => {
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
      .update(configString)
      .update("\0", "utf8")
      .update(instrument ? "instrument" : "")
      .digest("hex");
  },
  process: function(source, filepath) {
    const jestHugoOutputDir = process.env.JEST_HUGO_OUTPUT_DIR;
    const jestHugoContentDir = process.env.JEST_HUGO_CONTENT_DIR;

    const hugoTestPath = findHugoTestOutputPath(filepath, jestHugoContentDir, jestHugoOutputDir)
    const testName = path.basename(path.dirname(hugoTestPath));

    const testCases = generateTestCases(hugoTestPath);
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