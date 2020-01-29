module.exports = {
    "verbose": false,
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
    "testEnvironment": "node"
}
