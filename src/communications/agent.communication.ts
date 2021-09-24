import { EventEmitter } from "events";
import { Communication } from "./communication";
import axios, { AxiosResponse } from 'axios';
import { ProgressErrorPayload, ProgressNoticePayload } from "../sockets/messages/socket-message";
var utilsModel = require("../utils/utils.js");
const config = require('../config/config');

type AgentCommunicationData = {
    protocol: 'https' | 'http',
    host: string,
    port: number,
    apikey: string
}

export class AgentCommunication extends Communication<AgentCommunicationData> {
    protected readonly url: string;
    protected readonly headers: Record<string, unknown>;

    constructor(connectionData: AgentCommunicationData) {
        super(connectionData);

        if (connectionData.apikey === null || connectionData.apikey === undefined) {
            throw new Error("Cannot connect to agent without apikey");
        }

        const decipherApiKey: string = utilsModel.decrypt(this.connectionData.apikey);

        this.url = `${this.connectionData.protocol}://${this.connectionData.host}:${this.connectionData.port}`
        this.headers = {
            'X-API-Key': decipherApiKey
        }
    }

    async installFirewallPolicy(scriptPath: string, eventEmitter?: EventEmitter): Promise<string> {
        try {
            const path: string = this.url + '/api/v1/fwcloud_script/upload';

            eventEmitter.emit('message', new ProgressNoticePayload("Installing firewall script."));
            const response: AxiosResponse<any> = await axios.post(path, "", {
                headers: this.headers
            });

            if (response.status >= 400) {
                throw new Error('Installation failed');
            }

            return "DONE";
        } catch(error) {
            eventEmitter.emit('message', new ProgressErrorPayload(`ERROR: ${error}`));
            throw error;
        }
    }

    installOpenVPNConfig(config: unknown, dir: string, name: string, type: number, channel?: EventEmitter): Promise<void> {
        throw new Error("Method not implemented.");
    }

    uninstallOpenVPNConfig(dir: string, name: string, channel?: EventEmitter): Promise<void> {
        throw new Error("Method not implemented.");
    }
    
    async ping(): Promise<void> {
        const path: string = this.url + '/api/v1';
    
        const response: AxiosResponse<any> = await axios.put(path, "", {
            headers: this.headers
        });

        if (response.status >= 400) {
            throw new Error('Agent connection failed');
        }

        return;
    }
}