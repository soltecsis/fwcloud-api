import { EventEmitter } from "events";
import { CCDHash, Communication, OpenVPNHistoryRecord } from "./communication";
import axios, { AxiosRequestConfig, AxiosResponse } from 'axios';
import { ProgressErrorPayload, ProgressInfoPayload, ProgressNoticePayload } from "../sockets/messages/socket-message";
import * as fs from 'fs';
import FormData from 'form-data';
import * as path from "path";
import * as https from 'https';

type AgentCommunicationData = {
    protocol: 'https' | 'http',
    host: string,
    port: number,
    apikey: string
}

export class AgentCommunication extends Communication<AgentCommunicationData> {
    protected readonly url: string;
    protected readonly headers: Record<string, unknown>;
    protected readonly config: AxiosRequestConfig;

    constructor(connectionData: AgentCommunicationData) {
        super(connectionData);

        if (connectionData.apikey === null || connectionData.apikey === undefined) {
            throw new Error("Cannot connect to agent without apikey");
        }

        this.url = `${this.connectionData.protocol}://${this.connectionData.host}:${this.connectionData.port}`
        this.config = {
            headers: {
                'X-API-Key': this.connectionData.apikey
            }
        }

        if (this.connectionData.protocol === 'https') {
            this.config = {
                httpsAgent: new https.Agent({
                    rejectUnauthorized: false
                })
            }
        }
    }

    async installFirewallPolicy(scriptPath: string, eventEmitter?: EventEmitter): Promise<string> {
        try {
            const pathUrl: string = this.url + '/api/v1/fwcloud_script/upload';

            const form = new FormData();
            form.append('dst_dir', './tmp');
            form.append('perms', 700);
            form.append('upload', fs.createReadStream(scriptPath));

            eventEmitter.emit('message', new ProgressNoticePayload(`Uploading firewall script (${this.connectionData.host})`));
            eventEmitter.emit('message', new ProgressNoticePayload("Installing firewall script."));
            eventEmitter.emit('message', new ProgressNoticePayload("Loading firewall policy."));

            const config: AxiosRequestConfig = Object.assign(this.config, {});
            config.headers = Object.assign(form.getHeaders(), config.headers);

            await axios.post(pathUrl, form, config);

            return "DONE";
        } catch(error) {
            eventEmitter.emit('message', new ProgressErrorPayload(`ERROR: ${error}`));
            throw error;
        }
    }

    async installOpenVPNConfig(config: unknown, dir: string, name: string, type: number, channel?: EventEmitter): Promise<void> {
        try {
            const pathUrl: string = this.url + '/api/v1/openvpn/files/upload';
            const form = new FormData();
            form.append('dst_dir', dir);
            form.append('data', config, name);


            if (type === 1) {
                // Client certificarte
                channel.emit('message', new ProgressInfoPayload(`Uploading CCD configuration file '${dir}/${name}' to: (${this.connectionData.host})\n`));
                form.append('perms', 644);
            } else {
                channel.emit('message', new ProgressNoticePayload(`Uploading OpenVPN configuration file '${dir}/${name}' to: (${this.connectionData.host})\n`));
                form.append('perms', 600);
            }

            const requestConfig: AxiosRequestConfig = Object.assign(this.config, {});
            requestConfig.headers = Object.assign(form.getHeaders(), requestConfig.headers);

            await axios.post(pathUrl, form, requestConfig);

        } catch(error) {
            channel.emit('message', new ProgressErrorPayload(`ERROR: ${error}\n`));
            throw error;
        }
    }

    async uninstallOpenVPNConfig(dir: string, files: string[], channel?: EventEmitter): Promise<void> {
        try {
            channel.emit('message', new ProgressNoticePayload(`Removing OpenVPN configuration file '${dir}/[${files.join(", ")}]' from: (${this.connectionData.host})\n`));

            const pathUrl: string = this.url + '/api/v1/openvpn/files/remove';

            const config: AxiosRequestConfig = Object.assign(this.config, {});
            config.data = {
                dir: dir,
                files: files
            }

            axios.delete(pathUrl, this.config);

        } catch(error) {
            channel.emit('message', new ProgressErrorPayload(`ERROR: ${error}\n`));
            throw error;
        }
    }

    async getFirewallInterfaces(): Promise<string> {
        const pathUrl: string = this.url + "/api/v1/interfaces/info";

        const response: AxiosResponse<string> = await axios.get(pathUrl, this.config);

        if (response.status === 200) {
            return response.data;
        }

        throw new Error("Unexpected getInterfaces response");
    }

    async getFirewallIptablesSave(): Promise<string[]> {
        const pathUrl: string = this.url + "/api/v1/iptables-save/data";

        const response: AxiosResponse<string> = await axios.get(pathUrl, this.config);

        if (response.status === 200) {
            return response.data.split("\n");
        }

        throw new Error("Unexpected getInterfaces response");
    }

    async ccdHashList(dir: string, channel?: EventEmitter): Promise<CCDHash[]> {
        const pathUrl: string = this.url + "/api/v1/openvpn/files/sha256";

        const config: AxiosRequestConfig = Object.assign(this.config, {});
        config.headers["Content-Type"] = "application/json";

        const response: AxiosResponse<string> = await axios.put(pathUrl, {
            dir: dir,
            files: []
        }, config);

        if (response.status === 200) {
            return response.data.split("\n").filter(item => item !== '').slice(1).map(item => ({
                filename: item.split(',')[0],
                hash: item.split(',')[1]
            }));
        }

        throw new Error("Unexpected ccdHashList response");
    }
    
    async ping(): Promise<void> {
        const pathUrl: string = this.url + '/api/v1/ping';
    
        const response: AxiosResponse<any> = await axios.put(pathUrl, "", this.config);

        return;
    }

    async getRealtimeStatus(statusFilepath: string): Promise<string> {
        const urlPath: string = this.url + '/api/v1/openvpn/get/status/rt';
        const dir: string = path.dirname(statusFilepath);
        const filename: string = path.basename(statusFilepath);

        const config: AxiosRequestConfig = Object.assign(this.config, {});
        config.headers["Content-Type"] = "application/json";

        const response: AxiosResponse<string> = await axios.put(urlPath, {
            dir: dir,
            files: [filename]
        }, this.config);

        if (response.status === 200) {
            return response.data;
        }

        throw new Error("Unexpected getRealtimeStatus response");
    }

    async getOpenVPNHistoryFile(filepath: string): Promise<OpenVPNHistoryRecord[]> {
        const filename: string = path.basename(filepath);
        const dir: string = path.dirname(filepath);
        const pathUrl: string = this.url + "/api/v1/openvpn/get/status";

        const config: AxiosRequestConfig = Object.assign(this.config, {});
        config.headers["Content-Type"] = "application/json";

        const response: AxiosResponse<string> = await axios.put(pathUrl, {
            dir,
            files: [filename]
        }, this.config);

        if (response.status === 200) {
            return response.data.split("\n").filter(item => item !== '').slice(1).map(item => ({
                timestamp: parseInt(item.split(',')[0]) * 1000,
                name: item.split(',')[1],
                address: item.split(',')[2],
                bytesReceived: parseInt(item.split(',')[3]),
                bytesSent: parseInt(item.split(',')[4]),
                connectedAt: new Date(item.split(',')[5])
            }));
        }

        throw new Error("Unexpected getOpenVPNHistoryFile response");
    }
}