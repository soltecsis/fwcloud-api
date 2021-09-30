import { EventEmitter } from "events";

export type CCDHash = {
    filename: string,
    hash: string
}

export abstract class Communication<ConnectionData> {
    constructor(protected readonly connectionData: ConnectionData) {}

    abstract installOpenVPNConfig(config: unknown, dir: string, name: string, type: number, channel?: EventEmitter): Promise<void>
    abstract installFirewallPolicy(sourcePath: string, eventEmitter?: EventEmitter): Promise<string>;
    abstract uninstallOpenVPNConfig(dir: string, files: string[], channel?: EventEmitter): Promise<void>;
    abstract getFirewallInterfaces(): Promise<string>;
    abstract getFirewallIptablesSave(): Promise<string[]>;
    abstract ccdHashList(dir: string, channel?: EventEmitter): Promise<CCDHash[]>
    abstract ping(): Promise<void>;
}