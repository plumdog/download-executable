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
            statements: 90,
            branches: 80,
            functions: 80,
            lines: 90,
        }
    },
}
