module.exports = {
  projects: [
    {
      displayName: 'unit',
      testEnvironment: 'node',
      testMatch: ['<rootDir>/tests/unit/**/*.test.js'],
      setupFiles: ['<rootDir>/tests/setup-env.js'],
    },
    {
      displayName: 'integration',
      testEnvironment: 'node',
      testMatch: ['<rootDir>/tests/integration/**/*.test.js'],
      setupFiles: ['<rootDir>/tests/setup-env.js'],
      globalSetup: '<rootDir>/tests/global-setup.js',
    },
    {
      displayName: 'performance',
      testEnvironment: 'node',
      testMatch: ['<rootDir>/tests/performance/**/*.test.js'],
      setupFiles: ['<rootDir>/tests/setup-env.js'],
      globalSetup: '<rootDir>/tests/global-setup.js',
    },
  ],
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/server.js',
    '!src/database/seed.js',
  ],
  coverageThreshold: {
    global: { statements: 95, branches: 95, functions: 95, lines: 95 },
  },
};
