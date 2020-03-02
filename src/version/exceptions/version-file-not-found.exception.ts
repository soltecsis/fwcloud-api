export class VersionFileNotFoundException extends Error {
    constructor(path: string) {
        super('Version file not found in ' + path);
    }
}