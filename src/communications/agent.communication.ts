import { EventEmitter } from "events";
import { CCDHash, Communication } from "./communication";
import axios, { AxiosResponse } from 'axios';
import { ProgressErrorPayload, ProgressInfoPayload, ProgressNoticePayload } from "../sockets/messages/socket-message";
import * as fs from 'fs';
import FormData from 'form-data';

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


            const form = new FormData();
            form.append('dst_dir', config.get('policy').script_name);
            form.append('perms', 700);
            form.append('upload', fs.createReadStream(scriptPath));

            eventEmitter.emit('message', new ProgressNoticePayload("Installing firewall script."));
            const response: AxiosResponse<any> = await axios.post(path, form, {
                headers: Object.assign(form.getHeaders(), this.headers)
            });

            return "DONE";
        } catch(error) {
            eventEmitter.emit('message', new ProgressErrorPayload(`ERROR: ${error}`));
            throw error;
        }
    }

    async installOpenVPNConfig(config: unknown, dir: string, name: string, type: number, channel?: EventEmitter): Promise<void> {
        try {
            const path: string = this.url + '/api/v1/openvpn/files/upload';
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

            await axios.post(path, form, {
                headers: Object.assign(form.getHeaders(), this.headers)
            });

        } catch(error) {
            channel.emit('message', new ProgressErrorPayload(`ERROR: ${error}\n`));
            throw error;
        }
    }

    async uninstallOpenVPNConfig(dir: string, files: string[], channel?: EventEmitter): Promise<void> {
        try {
            channel.emit('message', new ProgressNoticePayload(`Removing OpenVPN configuration file '${dir}/[${files.join(", ")}]' from: (${this.connectionData.host})\n`));

            const path: string = this.url + '/api/v1/openvpn/files/remove';

            axios.delete(path, {
                headers: this.headers,
                data: {
                    dir: dir,
                    files: files
                }
            });

        } catch(error) {
            channel.emit('message', new ProgressErrorPayload(`ERROR: ${error}\n`));
            throw error;
        }
    }

    async getFirewallInterfaces(): Promise<string> {
        const path: string = this.url + "/api/v1/interfaces/info";

        const response: AxiosResponse<string> = await axios.get(path, {
            headers: this.headers
        });

        if (response.status === 200) {
            return response.data;
        }

        throw new Error("Unexpected getInterfaces response");
    }

    async getFirewallIptablesSave(): Promise<string[]> {
        const path: string = this.url + "/api/v1/iptables-save/data";

        const response: AxiosResponse<string> = await axios.get(path, {
            headers: this.headers
        });

        if (response.status === 200) {
            return response.data.split("\n");
        }

        throw new Error("Unexpected getInterfaces response");
    }

    async ccdHashList(dir: string, channel?: EventEmitter): Promise<CCDHash[]> {
        const path: string = this.url + "/api/v1/openvpn/files/sha256";

        const response: AxiosResponse<string> = await axios.put(path, {
            dir: dir,
            files: []
        }, {
            headers: Object.assign({
                "Content-Type": "application/json"
            }, this.headers)
        });

        if (response.status === 200) {
            return response.data.split("\n").filter(item => item !== '').slice(1).map(item => ({
                filename: item.split(',')[0],
                hash: item.split(',')[1]
            }));
        }

        throw new Error("Unexpected ccdHashList response");
    }
    
    async ping(): Promise<void> {
        const path: string = this.url + '/api/v1/ping';
    
        const response: AxiosResponse<any> = await axios.put(path, "", {
            headers: this.headers
        });

        return;
    }
}