const path = require("path")
const fs = require("fs")
const crypto = require("crypto")
const cheerio = require("cheerio")

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
  const testDirectory = path.parse(path.relative(hugoContentDir, testPath))

  if (testDirectory.base === "_index.md") {
    return path.resolve(hugoOutputDir, testDirectory.dir, "index.html")
  } else {
    return path.resolve(hugoOutputDir, testDirectory.dir, testDirectory.name, "index.html")
  }
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
  const fileData = fs.readFileSync(testPath, "utf-8")

  const $ = cheerio.load(fileData, null, false)
  const tests = $("test")
  if (tests.length === 0) {
    return []
  }

  const generatedTestCases = tests
    .map((i, test) => {
      const testTitle = test.attribs.name
      const value = $(test)
        .html()
        .replace(/[^\\]'/g, "\\'")
        .replace(/\r\n/g, "\\n") // CRLF on Windows with Hugo 0.60+
        .replace(/\n/g, "\\n")

      const expectedError = $("div#expected-error", test)
      if (expectedError.length > 0) {
        // Error test case
        const errorId = expectedError.attr("data-id")
        const errorText = expectedError.attr("data-error")
        const expected = errorText.replace(/'/g, "\\'")
        // Pick the corresponding error from the logs
        const actual = (errors.find((e) => e.expected.startsWith(`${errorId}|`)) || {}).actual
        if (!actual) {
          // No error raised
          return [`it ('${testTitle}', () => {`, `  throw new Error('No error raised. Was expecting: "${expected}"');`, "})"].join("\n")
        } else {
          // Compare errors
          const error = actual.replace(/'/g, "\\'")
          return [
            `it ('${testTitle}', () => {`,
            `  const actual = '${error}';`,
            `  const expected = '${expected}';`,
            `  expect(actual).toEqual(expected);`,
            "})"
          ].join("\n")
        }
      } else {
        // Nominal test case, use snapshots
        return [
          `it ('${testTitle}', () => {`,
          `  const value = '${value}';`,
          "  expect({custom: 'beautify', input: value}).toMatchSnapshot();",
          "})"
        ].join("\n")
      }
    })
    .get()

  return generatedTestCases
}

module.exports = {
  getCacheKey: (source, filepath, configString) => {
    const jestHugoOutputDir = process.env.JEST_HUGO_OUTPUT_DIR
    const jestHugoContentDir = process.env.JEST_HUGO_CONTENT_DIR

    const hugoTestPath = findHugoTestOutputPath(filepath, jestHugoContentDir, jestHugoOutputDir)
    const testFileData = fs.readFileSync(hugoTestPath, "utf-8")

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
      .digest("hex")
  },
  process: function (source, filepath) {
    const jestHugoOutputDir = process.env.JEST_HUGO_OUTPUT_DIR
    const jestHugoContentDir = process.env.JEST_HUGO_CONTENT_DIR

    const hugoTestPath = findHugoTestOutputPath(filepath, jestHugoContentDir, jestHugoOutputDir)
    const testName = path.basename(path.dirname(hugoTestPath))

    var errors = null
    const errorFile = path.resolve(jestHugoOutputDir, "output.err.json")
    if (fs.existsSync(errorFile)) {
      errors = JSON.parse(fs.readFileSync(errorFile))
    }

    const relativeFilePath = path.relative(jestHugoContentDir, filepath)

    const testCases = generateTestCases(hugoTestPath, errors[relativeFilePath])
    const code = [`describe('${testName}', () => {`, testCases.join("\n\n"), "})"].join("\n")

    return {
      code
    }
  }
}
