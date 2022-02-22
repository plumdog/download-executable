module.exports = {
    "roots": [
        "<rootDir>/tests"
    ],
    testEnvironment: "node",
    testMatch: [ '**/*.test.ts'],
    "transform": {
        "^.+\\.ts$": "ts-jest"
    },
    setupFiles: [
        './tests/setupTests.js',
    ],
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
            statements: 88,
            branches: 80,
            functions: 80,
            lines: 88,
        }
    },
}
