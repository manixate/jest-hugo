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

  return merge(defaultJestConfig, customConfig, {
    contentDir: ".",
    publishDir: ".output",
    resourceDir: ".output/.tmp",
    dataDir: "data",
    layoutDir: path.resolve(__dirname, "../hugo/layouts"),
    themesDir: rootDir
  });
};

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

    await childProcess.execFileSync(hugoExecutable, ["--config", hugoConfigFile.name], {
      stdio: ["pipe", "pipe", "pipe"],
      encoding: "utf8",
      cwd: testDir
    });
  } catch (error) {
    if (error.stderr && !error.stdout.includes("ERROR")) {
      // stderr represent errors
      // stdout will not have "ERROR" string if the errors are during build process e.g parsing failed.
      throw error;
    } else {
      // stdout will contain errors caused by 'errorf' command prefixed by "ERROR" string
      console.log("\x1b[32m%s\x1b[0m", "\n\nHugo build successful\n"); // green color output
    }
  }
};
