module.exports = {
  moduleFileExtensions: ['ts', 'tsx', 'js'],
  collectCoverage: false,
  transform: {
    '^.+\\.tsx?$': 'ts-jest',
  },
  setupFiles: [
    "<rootDir>/enzyme.config.js"
  ],
  testRegex: '(/test/.*)\\.spec\\.(tsx|ts)$',
  verbose: true,
}
