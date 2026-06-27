module.exports = {
  testEnvironment: 'node',
  testEnvironmentOptions: {
    localStorage: false,
  },
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/index.js',
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'text-summary', 'lcov'],
  verbose: true,
};
