module.exports = {
    "roots": [
        "<rootDir>/tests"
    ],
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
            statements: 100,
            branches: 100,
            functions: 100,
            lines: 100,
        }
    },
}
