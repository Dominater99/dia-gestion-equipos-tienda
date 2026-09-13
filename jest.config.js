module.exports = {
  rootDir: '.',
  testEnvironment: 'node',
  setupFilesAfterEnv: ['<rootDir>/test/setup/gas_globals.js'],
  testMatch: ['<rootDir>/test/**/*.test.js'],
  collectCoverageFrom: ['src/backend/**/*.js']
};
