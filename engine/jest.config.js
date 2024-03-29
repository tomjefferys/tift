/** @type {import('ts-jest/dist/types').InitialOptionsTsJest} */
module.exports = {
  testEnvironment: 'node',
  moduleFileExtensions: ['js'],
  testMatch: ["**/out/test/**/*.js"],
  modulePathIgnorePatterns: ["testutils"],
  setupFilesAfterEnv: ["jest-expect-message"],
  transformIgnorePatterns: ["/out/src/.+\\.js", "/out/test/.+\\.js"]
};
