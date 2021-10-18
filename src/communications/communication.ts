import { EventEmitter } from "events";
import { HttpException } from "../fonaments/exceptions/http/http-exception";
import { InternalServerException } from "../fonaments/exceptions/internal-server-exception";
import { ProgressErrorPayload } from "../sockets/messages/socket-message";

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

type ErrorWithCode = {
    code: string,
} & Error;

function errorHasCode(error: Error): error is ErrorWithCode {
    return Object.prototype.hasOwnProperty.call(error, "code");
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

    protected handleRequestException(error: Error, eventEmitter?: EventEmitter) {
        if (errorHasCode(error)) {
            if ((error).code === "ECONNREFUSED") {
                eventEmitter?.emit('message', new ProgressErrorPayload(`ECONNREFUSED: Port is not valid\n`));
                throw new HttpException(`ECONNREFUSED: Port is not valid`, 400)
            }

            if (error.code === "ETIMEDOUT") {
                eventEmitter?.emit('message', new ProgressErrorPayload(`ETIMEDOUT: Host is not valid\n`));
                throw new HttpException(`ETIMEDOUT: IP is not valid`, 400)
            }

            if (error.code === "ECONNRESET") {
                eventEmitter?.emit('message', new ProgressErrorPayload(`ECONNRESET: Port or protocol might not be valid\n`));
                throw new HttpException(`ECONNRESET: Port or protocol might not be valid`, 400)
            }
        }

        throw error;
    }
}