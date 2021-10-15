import { EventEmitter } from "events";

export type CCDHash = {
    filename: string,
    hash: string
}

export type OpenVPNHistoryRecord = {
    timestamp: number;
    name: string;
    address: string;
    bytesReceived: number;
    bytesSent: number;
    connectedAt: Date;
}

export abstract class Communication<ConnectionData> {
    constructor(protected readonly connectionData: ConnectionData) {}

    abstract installOpenVPNConfig(config: unknown, dir: string, name: string, type: number, channel?: EventEmitter): Promise<void>
    abstract installFirewallPolicy(sourcePath: string, eventEmitter?: EventEmitter): Promise<string>;
    abstract uninstallOpenVPNConfig(dir: string, files: string[], channel?: EventEmitter): Promise<void>;
    abstract getFirewallInterfaces(): Promise<string>;
    abstract getFirewallIptablesSave(): Promise<string[]>;
    abstract ccdHashList(dir: string, channel?: EventEmitter): Promise<CCDHash[]>
    abstract getOpenVPNHistoryFile(filepath: string): Promise<OpenVPNHistoryRecord[]>;
    abstract getRealtimeStatus(statusFilepath: string): Promise<string>
    abstract ping(): Promise<void>;
}