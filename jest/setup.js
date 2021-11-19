const childProcess = require("child_process")
const path = require("path")
const fs = require("fs")
const merge = require("lodash.merge")
const tmp = require("tmp")
tmp.setGracefulCleanup()

const defaultJestConfig = require("../jest-hugo.config.json")
const defaultJestHugoTestDir = "tests"
const defaultJestHugoExecutable = "hugo"

const getJestHugoConfig = (rootDir) => {
  const configPath = path.resolve(rootDir, "jest-hugo.config.json")
  const configExists = fs.existsSync(configPath)
  let customConfig = null
  if (configExists) {
    customConfig = require(configPath)
  }

  let config = merge(
    defaultJestConfig,
    {
      contentDir: ".",
      publishDir: ".output",
      resourceDir: ".output/.tmp",
      dataDir: "data",
      layoutDir: path.resolve(__dirname, "../hugo/layouts"),
      themesDir: rootDir
    },
    customConfig
  )

  // In case the config uses relative paths
  config.layoutDir = path.resolve(rootDir, config.layoutDir)
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
    // Create temporary hugo config json file. It will be cleaned up automatically.
    const hugoConfigFile = tmp.fileSync({ postfix: ".json" })
    fs.writeFileSync(hugoConfigFile.name, JSON.stringify(jestHugoConfig))

    // Creates .output if it doesn't exist
    const outputDirExists = fs.existsSync(outputDir)
    if (!outputDirExists) {
      fs.mkdirSync(outputDir)
    }

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

    const groupedLogByFilename = error.stdout
      .replace("Building sites … ", "")
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
      console.log("key", key, detail)
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

    console.log("grouping", output)

    fs.writeFileSync(path.resolve(outputDir, "output.err.json"), JSON.stringify(output, null, 2))

    // stdout will contain errors caused by 'errorf' command prefixed by "ERROR" string
    console.log("\x1b[32m%s\x1b[0m", "\n\nHugo build successful\n", "with warning", error) // green color output
  }
}
