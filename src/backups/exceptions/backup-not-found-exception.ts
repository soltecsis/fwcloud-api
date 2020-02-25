export class BackupNotFoundException extends Error {
    constructor(path: string) {
        super('Backup not found in ' + path);
    }
}