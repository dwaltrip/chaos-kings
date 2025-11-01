module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@common/(.*)$': '<rootDir>/../../packages/common/$1',
    '^@core/(.*)$': '<rootDir>/../../packages/core/src/$1',
    '^@kernel/(.*)$': '<rootDir>/../../packages/kernel/$1',
    '^@protocol/(.*)$': '<rootDir>/../../packages/protocol/$1',
    '^@platform/(.*)$': '<rootDir>/../../packages/platform/$1',
  },
  testMatch: ['<rootDir>/src/**/*.test.ts', '<rootDir>/src/**/*.spec.ts'],
  collectCoverageFrom: ['src/**/*.ts', '!src/**/*.d.ts'],
  setupFilesAfterEnv: ['<rootDir>/src/tests/jest.setup.ts'],
  testTimeout: 30000,
  maxWorkers: 1,
};
