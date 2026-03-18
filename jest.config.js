module.exports = {
  testEnvironment: 'node',
  coverageDirectory: 'coverage',
  modulePathIgnorePatterns: [
    '<rootDir>/.claude/worktrees/',
    '<rootDir>/coverage/',
    '<rootDir>/frontend/dist/',
  ],
  testPathIgnorePatterns: [
    '<rootDir>/.claude/worktrees/',
    '<rootDir>/node_modules/',
  ],
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/index.js',
    '!src/database/migrations/**',
    '!src/database/seeds/**',
  ],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
  },
  testMatch: ['**/tests/**/*.test.js'],
  setupFiles: ['./tests/setup.js'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  verbose: true,
  testTimeout: 10000,
};
