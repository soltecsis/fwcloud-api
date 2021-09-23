import { EventEmitter } from "events";
import { Communication } from "./communication";
import * as http from 'http';
import * as https from 'https';

type AgentCommunicationData = {
    protocol: 'https' | 'http',
    host: string,
    port: number,
    apikey: string
}

export class AgentCommunication extends Communication<AgentCommunicationData> {
    protected readonly options: http.RequestOptions | https.RequestOptions;

    constructor(connectionData: AgentCommunicationData) {
        super(connectionData);

        if (connectionData.apikey === null || connectionData.apikey === undefined) {
            throw new Error("Cannot connect to agent without apikey");
        }

        this.options = {
            protocol: connectionData.protocol,
            host: connectionData.host,
            port: connectionData.port,
            headers: {
                'X-API-Key': connectionData.apikey
            }
        }
    }
    install(scriptPath: string, eventEmitter?: EventEmitter): Promise<string> {
        throw new Error("Method not implemented.");
    }
    
    ping(): Promise<void> {
        this.options.path = 'api/v1';
        
        throw new Error("Method not implemented.");
    }
}