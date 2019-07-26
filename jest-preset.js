const testDir = process.env.JEST_HUGO_TEST_DIR;

module.exports = {
  transform: {
    "\\.md$": require.resolve("./jest/transform.js")
  },
  moduleFileExtensions: [
    "js",
    "md",
    "html"
  ],
  testMatch: [`**/${testDir || "tests"}/**/!(*.ignore).md`],
  snapshotSerializers: [require.resolve("./jest/serializer.js")],
  noStackTrace: true,
  globalSetup: require.resolve("./jest/setup.js"),
  testPathIgnorePatterns: ["/menu/(.+/)*_index.md"],
  reporters: [ "default", "jest-junit" ]
}