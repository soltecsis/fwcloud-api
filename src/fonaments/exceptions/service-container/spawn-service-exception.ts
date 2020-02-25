export class SpawnServiceException extends Error {
    constructor(serviceName: string, error: Error) {
        super(`Service ${serviceName} can not be initialized by the container: ${error.message}`);
        this.stack = error.stack;
    }
}