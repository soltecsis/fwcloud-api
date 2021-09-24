import { EventEmitter } from "events";

export abstract class Communication<ConnectionData> {
    constructor(protected readonly connectionData: ConnectionData) {}

    abstract installOpenVPNConfig(config: unknown, dir: string, name: string, type: number, channel?: EventEmitter): Promise<void>
    abstract installFirewallPolicy(sourcePath: string, eventEmitter?: EventEmitter): Promise<string>;
    abstract ping(): Promise<void>;
}