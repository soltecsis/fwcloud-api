export class VersionTagIsNotValidException extends Error {
    constructor(version: string) {
        super(`Version ${version} is not a valid semver version`);
    }
}