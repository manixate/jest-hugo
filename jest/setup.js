const childProcess = require("child_process");
const path = require("path");
const fs = require("fs");
const merge = require("lodash.merge");
const tmp = require("tmp");
tmp.setGracefulCleanup();

const defaultJestConfig = require("../jest-hugo.config.json");
const defaultJestHugoTestDir = "tests";
const defaultJestHugoExecutable = "hugo";

const getJestHugoConfig = rootDir => {
  const configPath = path.resolve(rootDir, "jest-hugo.config.json");
  const configExists = fs.existsSync(configPath);
  let customConfig = null;
  if (configExists) {
    customConfig = require(configPath);
  }

  let config = merge(defaultJestConfig, {
    contentDir: ".",
    publishDir: ".output",
    resourceDir: ".output/.tmp",
    dataDir: "data",
    layoutDir: path.resolve(__dirname, "../hugo/layouts"),
    themesDir: rootDir
  }, customConfig);

  // In case the config uses relative paths
  config.layoutDir = path.resolve(rootDir, config.layoutDir)
  config.themesDir = path.resolve(rootDir, config.themesDir)
  return config
};

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

module.exports = async globalConfig => {
  const jestHugoConfig = getJestHugoConfig(globalConfig.rootDir);

  const testDir = path.resolve(
    globalConfig.rootDir,
    process.env.JEST_HUGO_TEST_DIR || defaultJestHugoTestDir
  );

  process.env.JEST_HUGO_CONTENT_DIR = path.resolve(testDir, jestHugoConfig.contentDir);
  process.env.JEST_HUGO_OUTPUT_DIR = path.resolve(testDir, jestHugoConfig.publishDir);
  
  try {
    // Create temporary hugo config json file. It will be cleaned up automatically.
    const hugoConfigFile = tmp.fileSync({ postfix: ".json" });
    fs.writeFileSync(hugoConfigFile.name, JSON.stringify(jestHugoConfig));

    const hugoExecutable = process.env.JEST_HUGO_EXECUTABLE || defaultJestHugoExecutable;

    // [TODO] Check if this can be avoided somehow. Hugo needs the directory to be present for writing the log file
    fs.mkdirSync(path.resolve(testDir, jestHugoConfig.publishDir));
    await childProcess.execFileSync(hugoExecutable, ["--config", hugoConfigFile.name, '--logFile', 'output.log'], {
      stdio: ["pipe", "pipe", "pipe"],
      encoding: "utf8",
      cwd: testDir
    });
  } catch (error) {
    console.log(error);
    if (error.stderr && !error.stdout.includes("ERROR")) {
      // stderr represent errors
      // stdout will not have "ERROR" string if the errors are during build process e.g parsing failed.
      throw error;
    } else {
      if (error.stdout.includes("ERROR")) {
        const groupedLogByFilename = error.stdout.split("\n")
          .filter((s) => (s.startsWith("WARN") && s.indexOf("'jest-expected-error") >= 0) || s.startsWith("ERROR"))
          .reduce((map, log) => {
            const logDetail = extractInfoFromLog(log.replace(/\s'jest-expected-error'\s/gi, " "));
            if (map[logDetail.filename]) {
              map[logDetail.filename].push({ level: logDetail.level, log: logDetail.log });
            } else {
              map[logDetail.filename] = [{ level: logDetail.level, log: logDetail.log }];
            }
            return map;
          }, {});
        const output = {};
        Object.entries(groupedLogByFilename).forEach(([key, detail]) => {
          console.log("key", key, detail);
          const expectedErrorGroups = [];
          for (let index = 0; index < detail.length; index++) {
            const logDetail = detail[index];
            const group = {
              expected: null, actual: null
            };
            if (logDetail.level === "WARN") {
              group.expected = logDetail.log;
              if (index < detail.length - 1 && detail[index + 1].level === "ERROR") {
                group.actual = detail[index + 1].log;
                index++;
              }

              expectedErrorGroups.push(group);
            }
          }

          output[key] = expectedErrorGroups;
        });

        console.log("grouping", output);
        // const groupedLogByExpectations = groupedLogByFilename.reduce((map, detail) => {
        //   const expectedErrorGroups = [];
        //   for (let index = 0; index < array.length; index++) {
        //     const group = {
        //       expected: null, actual: null
        //     };
        //     if (logDetail.level === "WARN") {
        //       group.expected = logDetail.log;
        //       if (index < detail.length - 1 && detail[index + 1].level === "ERROR") {
        //         group.actual = detail[index + 1].log;
        //         index++;
        //       }

        //       expectedErrorGroups.push(group);
        //     }
        //   }
        //   const updatedDetails = detail.forEach((logDetail, index) => {
        //     const group = {
        //       expected: null, actual: null
        //     };
        //     if (logDetail.level === "WARN") {
        //       group.expected = logDetail.log;
        //       if (index < detail.length - 1 && detail[index + 1].level === "ERROR") {
        //         group.actual = detail[index + 1].log;
        //       }
        //     }

        //     expectedErrorGroups.push(group);
        //   })
        //   if (map[logDetail.filename]) {
        //     map[logDetail.filename].push({ level: logDetail.level, log: logDetail.log });
        //   } else {
        //     map[logDetail.filename] = [{ level: logDetail.level, log: logDetail.log }];
        //   }
        // }, {});
        //   .forEach((logLine, idx, arr) => {
        //     const logDetails = extractInfoFromLog(logLine);

        //     // If this the expected error log then check the next item to find out thrown error
        //     if (logDetails.level..startsWith("WARN") && logLine.contains("'jest-expected-error'")) {
        //       if (i < arr.length - 1 && arr[i + 1].startsWith("ERROR")
        //       return i;
        //     }
        //   })
        //   .map((s, i) => {
        //     // If this the expected error log then check the next item to find out thrown error
        //     if (s.startsWith("WARN") && s.contains("'jest-expected-error'")) {
        //       if (i < error.length)
        //       return i;
        //     }
        //   })
        //   .filter((s) => (s.startsWith("WARN") && s.contains("jest-hugo-output")) || s.startsWith("ERROR"))
        //   .reduce((map, errorLog) => {
        //     // Each error log line is of format:
        //     // ERROR <YYYY/MM/DD> <HH:MM:SS> <filename>: <log line>
        //     // Example:
        //     // ERROR 2021/09/23 13:08:34 shortcodes/file.md: Error here
        //     const errorLine = errorLog.split(" ")
        //     const filename = errorLine[3].replace(":", "")
        //     const error = errorLine.slice(4).join(" ")
        //     if (map[filename]) {
        //       map[filename].push(error);
        //     } else {
        //       map[filename] = [error];
        //     }
        //     return map;
        //   }, {});

        fs.writeFileSync(path.resolve(testDir, jestHugoConfig.publishDir, 'output.err.json'), JSON.stringify(output, null, 2));
      }
      // stdout will contain errors caused by 'errorf' command prefixed by "ERROR" string
      console.log("\x1b[32m%s\x1b[0m", "\n\nHugo build successful\n", "with warning", error ); // green color output
    }
  }
};
