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

function parseTestCases(content) {
  const testCasesRegex = /<test\s+((?:[\w-]+="[^"]*"\s*)*)>([\s\S]*?)<\/test>/gi
  const attributesRegex = /(\w+)="(.*?)"/gi
  const tests = {}

  // Add line numbers to the content
  const randomUUID = crypto.randomUUID()
  const numberedContent = content.split('\n').map((val, index) => `${val}|${randomUUID}|${index + 1}`).join('\n')
  const lineNumberRegex = new RegExp(`\\|${randomUUID}\\|\\d+$`, 'gim')

  let testMatch
  do {
    testMatch = testCasesRegex.exec(numberedContent)
    if (testMatch) {
      const test = {}
      const allAttributes = testMatch[1]
  
      // Replace line number we added above
      test['content'] = testMatch[2].replace(lineNumberRegex, '')
      for (const match of allAttributes.matchAll(attributesRegex)) {
        const attrName = match[1].replace(lineNumberRegex, '')
        const attrValue = match[2].replace(lineNumberRegex, '')
  
        test[attrName] = attrValue
      }
      const lines = testMatch[0].split('\n')
      test['start'] = +lines[0].split(`|${randomUUID}|`).pop()
      test['end'] = test['start'] + lines.length - 1

      tests[test['name']] = test
    }
  } while (testMatch)
  return tests
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
  /*
    Regex representing a test case
    <test name="test name">
      <!-- Test case here -->
    </test>
  */
  const tests = parseTestCases(fileData)
  // Merge sourceTests and test outputs
  Object.keys(tests).forEach(key => {
    const test = tests[key]
    test.error = errors[test.name]
  })

  // Create test cases
  const generatedTestCases = []
  for (key in tests) {
    const test = tests[key]
    const value = test['content']
      .replace(/\\/g, "/") // Normalize file paths in errors ("folder\\file.md: ..." => "folder/file.md: ...")
      .replace(/\r\n/g, "\\n") // CRLF on Windows with Hugo 0.60+
      .replace(/\n/g, "\\n")

    const testTitle = test.name
    if (test.expected) {
      // Pick the corresponding error from the logs
      const actual = test.error
      const expected = test.expected
      if (!actual) {
        // No error raised
        generatedTestCases.push(
          [
            `it ('${testTitle}', () => {`,
            `  throw new Error('No error raised. Was expecting: "${expected.replaceAll("'", "\\'")}"');`,
            "})"
          ].join("\n")
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

const mapErrorToTest = (source, errors) => {
  const tests = parseTestCases(source)
  // Find the closest test
  const errorMapping = errors.reduce((acc, error) => {
    const errorLine = error.line
    let testForError
    for (const key in tests) {
      const test = tests[key]
      if (errorLine >= test.start && errorLine <= test.end) {
        testForError = test
        break
      }
    }

    if (testForError) {
      acc[testForError.name] = error.log
    } else {
      acc['unknown'] = [...acc['unknown'], error.log]
    }

    return acc
  }, {})

  return errorMapping
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

    const testCases = generateTestCases(hugoTestPath, mapErrorToTest(source, errors[filepath]))
    const code = [`describe('${testName}', () => {`, testCases.join("\n\n"), "})"].join("\n")

    return {
      code
    }
  }
}
