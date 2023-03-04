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
  // <level> <YYYY/MM/DD> <HH:MM:SS> <some optional extra info>? "<full path to file>:<line>:<column>": <log line>
  // Example:
  // ERROR 2023/03/04 12:22:11 "<test dir>/shortcodes/file.md:17:3": Error here
  const logSplit = logLine.split(" ")
  const level = logSplit[0]

  /**
    TODO: Special handling for REF_NOT_FOUND errors
    ERROR 2023/03/04 12:22:11 [en] REF_NOT_FOUND: Ref "invalid_reference.md": "<test dir>/shortcodes/file.md:17:3": page not found
  */
  const position = logSplit[3].replace(/:$/, "").replace(/^"(.*)"$/, "$1")
  const [filename, line, column] = position.split(":")
  const log = logSplit.slice(4).join(" ")

  // Throw error/warning if filename is not a path

  return {
    level: level,
    filename: filename,
    line: line,
    column: column,
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

    console.error(error.stdout)

    // Parse stdout that contains errors caused by 'errorf' prefixed by "ERROR" or "WARN"
    const groupedLogByFilename = error.stdout
      .replace("Building sites … ", "")
      .replace("Start building sites … ", "")
      .split("\n")
      .filter((s) => s.startsWith("ERROR"))
      .reduce((map, log) => {
        const logDetail = extractInfoFromLog(log.replace(/\s'jest-expected-error'\s/gi, " "))
        if (map[logDetail.filename]) {
          map[logDetail.filename].push({
            level: logDetail.level,
            log: logDetail.log,
            line: logDetail.line,
            column: logDetail.column
          })
        } else {
          map[logDetail.filename] = [{ level: logDetail.level, log: logDetail.log, line: logDetail.line, column: logDetail.column }]
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
          if (index < detail.length - 1 && detail[index + 1].level === "ERROR") {
            group.actual = detail[index + 1].log
            index++
          }

          expectedErrorGroups.push(group)
        }
      }

      output[key] = expectedErrorGroups
    })

    fs.writeFileSync(path.resolve(outputDir, "output.err.json"), JSON.stringify(groupedLogByFilename, null, 2))

    if (debug) {
      console.log("\x1b[32m%s\x1b[0m", "\n\nHugo build successful\n", "with warning", error) // green color output
    }
  }
}
