module.exports = {
    "verbose": false,
    "testTimeout": 30000,
    "moduleFileExtensions": [
        "js",
        "json",
        "ts"
    ],
    "rootDir": "tests",
    "transform": {
        "^.+\\.(t|j)s$": "ts-jest"
    },
    "collectCoverageFrom": [
        "**/*.(t|j)s"
    ],
    "coverageDirectory": "../coverage",
    "testEnvironment": "node",
    "globalSetup" : './jest/global-setup.ts',
    "globalTeardown": './jest/global-teardown.ts',
    "setupFilesAfterEnv": [
        './jest/setup-after-env.ts',
    ]
}
