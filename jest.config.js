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
    "setupFilesAfterEnv": [
        './setup.ts'
    ]
}
