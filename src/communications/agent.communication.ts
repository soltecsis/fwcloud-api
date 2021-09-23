import { EventEmitter } from "events";
import { Communication } from "./communication";
import axios, { AxiosResponse } from 'axios';

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

        this.url = `${this.connectionData.protocol}://${this.connectionData.host}:${this.connectionData.protocol}`
        this.headers = {
            'X-API-Key': this.connectionData.apikey
        }
    }

    async install(scriptPath: string, eventEmitter?: EventEmitter): Promise<string> {
        const path: string = this.url + '/api/v1/fwcloud_script/upload';

        const response: AxiosResponse<any> = await axios.post(path, {
            headers: this.headers
        });

        if (response.status >= 400) {
            throw new Error('Installation failed');
        }

        return "DONE";
    }
    
    async ping(): Promise<void> {
        const path: string = this.url + '/api/v1';
    
        const response: AxiosResponse<any> = await axios.get(path, {
            headers: this.headers
        });

        if (response.status >= 400) {
            throw new Error('Agent connection failed');
        }

        return;
    }
}