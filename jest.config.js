module.exports = {
    "roots": [
        "<rootDir>/tests"
    ],
    testEnvironment: "node",
    testMatch: [ '**/*.test.ts'],
    "transform": {
        "^.+\\.ts$": "ts-jest"
    },
    collectCoverage: true,
    collectCoverageFrom: [
        "**/*.{ts,js}",
        "!**/*.d.{ts,js}",
        "!**/*.test.{ts,js}",
        "!**/node_modules/**",
        "!**/vendor/**"
    ],
    coverageThreshold: {
        global: {
            statements: 80,
            branches: 40,
            functions: 80,
            lines: 80,
        }
    },
}
