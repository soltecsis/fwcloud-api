import { EventEmitter } from "events";

export abstract class Communication<ConnectionData> {
    constructor(protected readonly connectionData: ConnectionData) {}

    abstract install(sourcePath: string, eventEmitter?: EventEmitter): Promise<string>;
    abstract ping(): Promise<void>;
}