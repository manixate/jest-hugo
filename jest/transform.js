const path = require("path")
const fs = require("fs")
const crypto = require("crypto")

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
  const tests = {}
  /*
    Regex representing a test case
    <test name="test name">
      <!-- Test case here -->
    </test>
  */
  const testCasesRegex = /<test.*?name="([^"]*?)".*?>((?:.*?\r?\n?)*?)<\/test>/gi
  let match
  do {
    match = testCasesRegex.exec(fileData)
    if (match) {
      tests[match[1]] = match[2]
    }
  } while (match)

  // Create test cases
  const generatedTestCases = []
  for (key in tests) {
    const value = tests[key]
      .replace(/\\/g, "/") // Normalize file paths in errors ("folder\\file.md: ..." => "folder/file.md: ...")
      .replace(/\r\n/g, "\\n") // CRLF on Windows with Hugo 0.60+
      .replace(/\n/g, "\\n")

    const testTitle = key.replace(/[^\\]'/g, "\\'")
    /*
      Regex representing error
      <div id="expected-error" data-id="<error-title>" data-error="<error-text>" />
    */
    const errorRegex = /<div.*?id="expected-error"(?:.*?\r?\n?).*data-id="(.*)">((?:.*?\r?\n?)*?)<\/div>/gi
    const errorMatch = errorRegex.exec(value)
    if (errorMatch && errorMatch.length >= 2) {
      // Error test case
      const errorId = errorMatch[1]
      const expected = errorMatch[2]
      // Pick the corresponding error from the logs
      const actual = (errors.find((e) => e.expected.startsWith(`${errorId}|`)) || {}).actual
      if (!actual) {
        // No error raised
        generatedTestCases.push(
          [`it ('${testTitle}', () => {`, `  throw new Error(\`No error raised. Was expecting: "${expected}"\`);`, "})"].join("\n")
        )
      } else {
        // Compare errors
        generatedTestCases.push(
          [
            `it ('${testTitle}', () => {`,
            `  const actual = \`${actual}\`;`,
            `  const expected = \`${expected}\`;`,
            `  expect(actual).toEqual(expected);`,
            "})"
          ].join("\n")
        )
      }
    } else {
      // Nominal test case, use snapshots
      generatedTestCases.push(
        [
          `it ('${testTitle}', () => {`,
          `  const value = \`${value}\`;`,
          "  expect({custom: 'beautify', input: value}).toMatchSnapshot();",
          "})"
        ].join("\n")
      )
    }
  }
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

    let errors = {}
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
