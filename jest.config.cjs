/** @type {import('jest').Config} */
const config = {
  projects: [
    {
      displayName: "unit",
      preset: "ts-jest",
      testEnvironment: "node",
      testMatch: ["<rootDir>/tests/unit/**/*.test.ts"],
      testTimeout: 10000,
      moduleNameMapper: {
        "^@/(.*)\\.js$": "<rootDir>/src/$1",
        "^@/(.*)$": "<rootDir>/src/$1",
        "^(\\.{1,2}/.*)\\.js$": "$1",
      },
      transform: {
        "^.+\\.ts$": ["ts-jest", { tsconfig: "tsconfig.test.json" }],
      },
      setupFiles: ["<rootDir>/tests/__setup__/env.ts"],
    },
    {
      displayName: "integration",
      preset: "ts-jest",
      testEnvironment: "node",
      testMatch: ["<rootDir>/tests/integration/**/*.test.ts"],
      testTimeout: 60000,
      moduleNameMapper: {
        "^@/(.*)\\.js$": "<rootDir>/src/$1",
        "^@/(.*)$": "<rootDir>/src/$1",
        "^(\\.{1,2}/.*)\\.js$": "$1",
      },
      transform: {
        "^.+\\.ts$": ["ts-jest", { tsconfig: "tsconfig.test.json" }],
      },
      setupFiles: ["<rootDir>/tests/__setup__/env.ts"],
    },
    {
      displayName: "e2e",
      preset: "ts-jest",
      testEnvironment: "node",
      testMatch: ["<rootDir>/tests/e2e/**/*.test.ts"],
      testTimeout: 60000,
      moduleNameMapper: {
        "^@/(.*)\\.js$": "<rootDir>/src/$1",
        "^@/(.*)$": "<rootDir>/src/$1",
        "^(\\.{1,2}/.*)\\.js$": "$1",
      },
      transform: {
        "^.+\\.ts$": ["ts-jest", { tsconfig: "tsconfig.test.json" }],
      },
      setupFiles: ["<rootDir>/tests/__setup__/env.ts"],
    },
  ],
  collectCoverageFrom: [
    "src/**/*.ts",
    "!src/index.ts",
    "!src/**/*.d.ts",
    "!src/migrations/**",
    "!src/core/config/**",
  ],
};

module.exports = config;
