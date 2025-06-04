const childProcess = require("child_process")
const path = require("path")
const fs = require("fs-extra")
const merge = require("lodash.merge")
const tmp = require("tmp")
tmp.setGracefulCleanup()

const defaultJestConfig = require("../jest-hugo.config.json")
const defaultJestHugoTestDir = "tests"
const defaultJestHugoExecutable = "hugo"
const debug = process.env.JEST_HUGO_DEBUG || false

const getJestHugoConfig = (rootDir) => {
  const configPath = path.resolve(rootDir, "jest-hugo.config.json")
  const configExists = fs.existsSync(configPath)
  let customConfig = null
  if (configExists) {
    customConfig = require(configPath)
  }

  // Create a temporary layout dir
  const tmpLayoutDir = tmp.dirSync().name
  const thisLayoutDir = path.resolve(__dirname, "../hugo/layouts")
  fs.copySync(thisLayoutDir, tmpLayoutDir, {})
  if (customConfig && customConfig.layoutDir) {
    const projectLayoutDir = path.resolve(rootDir, customConfig.layoutDir)
    fs.copySync(projectLayoutDir, tmpLayoutDir, {})
  }

  let config = merge(
    defaultJestConfig,
    {
      contentDir: ".",
      publishDir: ".output",
      resourceDir: ".output/.tmp",
      dataDir: "data",
      themesDir: rootDir
    },
    customConfig
  )

  config.layoutDir = tmpLayoutDir

  // In case the config uses relative paths
  config.themesDir = path.resolve(rootDir, config.themesDir)
  return config
}

const extractInfoFromLog = (logLine, isOlderVersion) => {
  let filename
  let log

  const logSplit = logLine.split(/\s+/g)
  const level = logSplit[0]

  if (isOlderVersion) {
    // <level> <YYYY/MM/DD> <HH:MM:SS> <filename>: <log line>
    // Example: ERROR 2021/09/23 13:08:34 shortcodes/file.md: Error here
    filename = logSplit[3].replace(":", "")
    log = logSplit.slice(4).join(" ")
  } else {
    // <level> <filename>: <log line>
    // Example: WARN  shortcodes/file.md: Error here
    filename = logSplit[1].replace(":", "")
    log = logSplit.slice(2).join(" ")
  }

  return {
    level: level,
    filename: filename,
    log: log
  }
}

/**
 * Parse the hugo version string and return the numbers
 * Hugo version is returned in string example hugo vX.xxx.x-xxx
 * This function returns it as an array of Number [X,xxx,x]
 */
const parseHugoVersion = (version) => {
  return version.match(/\d+/g).map(Number)
}

/**
 * This function compares the current hugo version with version specified by user
 * returns true if users version is older than current version
 * @param {*} hugoVersion string
 * @param {*} currentVersion string
 * @returns boolean
 */
const isOlderVersionFn = (hugoVersion, currentVersion) => {
  const [a1, a2, a3] = parseHugoVersion(currentVersion)
  const [b1, b2, b3] = parseHugoVersion(hugoVersion)
  if (a1 !== b1) return a1 > b1
  if (a2 !== b2) return a2 > b2
  return a3 > b3
}

module.exports = async (globalConfig) => {
  const jestHugoConfig = getJestHugoConfig(globalConfig.rootDir)

  const testDir = path.resolve(globalConfig.rootDir, process.env.JEST_HUGO_TEST_DIR || defaultJestHugoTestDir)

  const outputDir = path.resolve(testDir, jestHugoConfig.publishDir)
  process.env.JEST_HUGO_CONTENT_DIR = path.resolve(testDir, jestHugoConfig.contentDir)
  process.env.JEST_HUGO_OUTPUT_DIR = outputDir

  const hugoExecutable = process.env.JEST_HUGO_EXECUTABLE || defaultJestHugoExecutable

  // Detect Hugo version
  const hugoVersion = childProcess
    .execFileSync(hugoExecutable, ["version"], {
      encoding: "utf8"
    })
    .match(/hugo v(\d+\.\d+\.\d+)/)[1]

  // https://github.com/gohugoio/hugo/pull/13138
  const isOlderVersion = isOlderVersionFn(hugoVersion, "0.120.0")

  try {
    // Delete the previous ".output" dir
    fs.removeSync(outputDir)

    // Create a temporary hugo config json file. It will be cleaned up automatically.
    const hugoConfigFile = tmp.fileSync({ postfix: ".json" })
    fs.writeFileSync(hugoConfigFile.name, JSON.stringify(jestHugoConfig))

    // Run Hugo
    await childProcess.execFileSync(hugoExecutable, ["--config", hugoConfigFile.name], {
      stdio: ["pipe", "pipe", "pipe"],
      encoding: "utf8",
      cwd: testDir
    })
  } catch (error) {
    const errorLog = isOlderVersion ? error.stdout : error.stderr
    // if for older versions stdout doesn't contain the expected error or for newer version stderr doesn't contain expected error
    // then there's error during the build process and we just simply throw that error
    const hasErrorLog = errorLog?.includes("ERROR")
    if (!hasErrorLog) {
      throw error
    }

    // Parse error log that contains errors caused by 'errorf' prefixed by "ERROR" or "WARN"
    const groupedLogByFilename = errorLog
      .replace("Building sites … ", "")
      .replace("Start building sites … ", "")
      .split("\n")
      .filter((s) => (s.startsWith("WARN") && s.indexOf("'jest-expected-error") >= 0) || s.startsWith("ERROR"))
      .reduce((map, log) => {
        const logDetail = extractInfoFromLog(log.replace(/\s'jest-expected-error'\s/gi, " "), isOlderVersion)
        if (map[logDetail.filename]) {
          map[logDetail.filename].push({
            level: logDetail.level,
            log: logDetail.log
          })
        } else {
          map[logDetail.filename] = [{ level: logDetail.level, log: logDetail.log }]
        }
        return map
      }, {})
    const output = {}
    Object.entries(groupedLogByFilename).forEach(([key, detail]) => {
      const expectedErrorGroups = []
      for (let index = 0; index < detail.length; index++) {
        const logDetail = detail[index]
        const group = {
          expected: null,
          actual: null
        }
        if (logDetail.level === "WARN") {
          group.expected = logDetail.log
          const actualError = detail.find((d) => d.level === "ERROR" && d.log === logDetail.log.split("|")[1])
          if (actualError != null && Object.keys(actualError).length > 0) {
            group.actual = actualError.log
          }

          expectedErrorGroups.push(group)
        }
      }

      output[key] = expectedErrorGroups
    })

    fs.writeFileSync(path.resolve(outputDir, "output.err.json"), JSON.stringify(output, null, 2))

    if (debug) {
      console.log("\x1b[32m%s\x1b[0m", "\n\nHugo build successful\n", "with warning", error) // green color output
    }
  }
}
