/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/*.test.ts'],
  // Solver tests must run without the tsconfig `strict`/`exclude` quirks
  // (tsconfig.json excludes **/*.test.ts from `tsc` builds; ts-jest compiles
  // test files independently via this config, unaffected by that exclude).
  transform: {
    '^.+\\.ts$': ['ts-jest', {}]
  }
}
