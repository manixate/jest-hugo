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

const extractInfoFromLog = (logLine) => {
  // Each log line is of format:
  // <level> <YYYY/MM/DD> <HH:MM:SS> <filename>: <log line>
  // Example:
  // ERROR 2021/09/23 13:08:34 shortcodes/file.md: Error here
  const logSplit = logLine.split(" ")
  const level = logSplit[0]
  const filename = logSplit[3].replace(":", "")
  const log = logSplit.slice(4).join(" ")

  return {
    level: level,
    filename: filename,
    log: log
  }
}

module.exports = async (globalConfig) => {
  const jestHugoConfig = getJestHugoConfig(globalConfig.rootDir)

  const testDir = path.resolve(globalConfig.rootDir, process.env.JEST_HUGO_TEST_DIR || defaultJestHugoTestDir)

  const outputDir = path.resolve(testDir, jestHugoConfig.publishDir)
  process.env.JEST_HUGO_CONTENT_DIR = path.resolve(testDir, jestHugoConfig.contentDir)
  process.env.JEST_HUGO_OUTPUT_DIR = outputDir

  try {
    // Delete the previous ".output" dir
    fs.removeSync(outputDir)

    // Create a temporary hugo config json file. It will be cleaned up automatically.
    const hugoConfigFile = tmp.fileSync({ postfix: ".json" })
    fs.writeFileSync(hugoConfigFile.name, JSON.stringify(jestHugoConfig))

    // Run Hugo
    const hugoExecutable = process.env.JEST_HUGO_EXECUTABLE || defaultJestHugoExecutable
    await childProcess.execFileSync(hugoExecutable, ["--config", hugoConfigFile.name], {
      stdio: ["pipe", "pipe", "pipe"],
      encoding: "utf8",
      cwd: testDir
    })
  } catch (error) {
    if (error.stderr && !error.stdout.includes("ERROR")) {
      // stderr represent errors
      // stdout will not have "ERROR" string if the errors are during build process e.g parsing failed.
      throw error
    }

    // Parse stdout that contains errors caused by 'errorf' prefixed by "ERROR" or "WARN"
    const groupedLogByFilename = error.stdout
      .replace("Building sites … ", "")
      .replace("Start building sites … ", "")
      .split("\n")
      .filter((s) => (s.startsWith("WARN") && s.indexOf("'jest-expected-error") >= 0) || s.startsWith("ERROR"))
      .reduce((map, log) => {
        const logDetail = extractInfoFromLog(log.replace(/\s'jest-expected-error'\s/gi, " "))
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
