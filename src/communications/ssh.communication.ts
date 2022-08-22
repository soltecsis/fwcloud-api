import { EventEmitter } from "events";
import { FireWallOptMask } from "../models/firewall/Firewall";
import { ProgressInfoPayload, ProgressNoticePayload } from "../sockets/messages/socket-message";
import sshTools from "../utils/ssh";
import { CCDHash, Communication, OpenVPNHistoryRecord } from "./communication";
var config = require('../config/config');

type SSHConnectionData = {
    host: string;
    port: number;
    username: string;
    password: string;
    options: any;
}

export class SSHCommunication extends Communication<SSHConnectionData> {
    getOpenVPNHistoryFile(filepath: string): Promise<OpenVPNHistoryRecord[]> {
        throw new Error("Method not implemented.");
    }

    async installFirewallPolicy(scriptPath: string, eventEmitter: EventEmitter = new EventEmitter()): Promise<string> {
        try {
            eventEmitter.emit('message', new ProgressNoticePayload(`Uploading firewall script (${this.connectionData.host})`));
            await sshTools.uploadFile(this.connectionData, scriptPath, config.get('policy').script_name);

            // Enable sh debug if it is selected in firewalls/cluster options.
            const sh_debug = (this.connectionData.options & FireWallOptMask.DEBUG) ? '-x' : '';

            const sudo = this.connectionData.username === 'root' ? '' : 'sudo';

            eventEmitter.emit('message', new ProgressNoticePayload("Installing firewall script."));
            await sshTools.runCommand(this.connectionData, `${sudo} sh ${sh_debug} ./${config.get('policy').script_name} install`);

            eventEmitter.emit('message', new ProgressNoticePayload("Loading firewall policy."));
            const cmd = `${sudo} sh ${sh_debug} -c 'if [ -d /etc/fwcloud ]; then
                sh ${sh_debug} /etc/fwcloud/${config.get('policy').script_name} start;
                else sh ${sh_debug} /config/scripts/post-config.d/${config.get('policy').script_name} start;
            fi'`
            await sshTools.runCommand(this.connectionData, cmd, eventEmitter);

            return "DONE";

        } catch (error) {
            this.handleRequestException(error, eventEmitter)
        }
    }

    async installOpenVPNServerConfigs(dir: string, configs: {name: string, content: string}[], eventEmitter?: EventEmitter): Promise<void> {
        try {
            const sudo = this.connectionData.username === 'root' ? '' : 'sudo';

            const existsDir = await sshTools.runCommand(this.connectionData, `if [ -d "${dir}" ]; then echo -n 1; else echo -n 0; fi`);
            if (existsDir === "0") {
                eventEmitter.emit('message', new ProgressNoticePayload(`Creating install directory.\n`));
                await sshTools.runCommand(this.connectionData, `${sudo} mkdir "${dir}"`);
                await sshTools.runCommand(this.connectionData, `${sudo} chown root:root "${dir}"`);
                await sshTools.runCommand(this.connectionData, `${sudo} chmod 755 "${dir}"`);
            }

            for(let config of configs) {
                eventEmitter.emit('message', new ProgressNoticePayload(`Uploading OpenVPN configuration file '${dir}/${config.name}' to: (${this.connectionData.host})\n`));
                eventEmitter.emit('message', new ProgressNoticePayload(`Installing OpenVPN configuration file.\n`));
                await sshTools.uploadStringToFile(this.connectionData, config.content, config.name);
                await sshTools.runCommand(this.connectionData, `${sudo} mv ${config.name} ${dir}/`);
                eventEmitter.emit('message', new ProgressNoticePayload(`Setting up file permissions.\n\n`));
                await sshTools.runCommand(this.connectionData, `${sudo} chown root:root ${dir}/${config.name}`);
                await sshTools.runCommand(this.connectionData, `${sudo} chmod 600 ${dir}/${config.name}`);
            }

            return;
        } catch (error) {
            this.handleRequestException(error, eventEmitter)
        }
    }

    async installOpenVPNClientConfigs(dir: string, configs: {name: string, content: string}[], eventEmitter: EventEmitter = new EventEmitter()): Promise<void> {
        try {
            const sudo = this.connectionData.username === 'root' ? '' : 'sudo';

            const existsDir = await sshTools.runCommand(this.connectionData, `if [ -d "${dir}" ]; then echo -n 1; else echo -n 0; fi`);
            if (existsDir === "0") {
                eventEmitter.emit('message', new ProgressNoticePayload(`Creating install directory.\n`));
                await sshTools.runCommand(this.connectionData, `${sudo} mkdir "${dir}"`);
                await sshTools.runCommand(this.connectionData, `${sudo} chown root:root "${dir}"`);
                await sshTools.runCommand(this.connectionData, `${sudo} chmod 755 "${dir}"`);
            }

            for(let config of configs) {
                eventEmitter.emit('message', new ProgressInfoPayload(`Uploading CCD configuration file '${dir}/${config.name}' to: (${this.connectionData.host})\n`));
                eventEmitter.emit('message', new ProgressNoticePayload(`Installing OpenVPN configuration file.\n`));
                await sshTools.uploadStringToFile(this.connectionData, config.content, config.name);
                await sshTools.runCommand(this.connectionData, `${sudo} mv ${config.name} ${dir}/`);
                eventEmitter.emit('message', new ProgressNoticePayload(`Setting up file permissions.\n\n`));
                await sshTools.runCommand(this.connectionData, `${sudo} chown root:root ${dir}/${config.name}`);
                await sshTools.runCommand(this.connectionData, `${sudo} chmod 644 ${dir}/${config.name}`);
            }

            return;
        } catch (error) {
            this.handleRequestException(error, eventEmitter)
        }
    }

    async uninstallOpenVPNConfigs(dir: string, files: string[], eventEmitter: EventEmitter = new EventEmitter()): Promise<void> {
        try {
            eventEmitter.emit('message', new ProgressNoticePayload(`Removing OpenVPN configuration file '${dir}/[${files.join(", ")}]' from: (${this.connectionData.host})\n`));
            const sudo = this.connectionData.username === 'root' ? '' : 'sudo';

            for(let file of files) {
                await sshTools.runCommand(this.connectionData, `${sudo} rm -f "${dir}/${file}"`);
            }
            
            return;
        } catch (error) {
            this.handleRequestException(error, eventEmitter)
        }
    }

    async getFirewallInterfaces(): Promise<string> {
        try {
            const sudo = this.connectionData.username === 'root' ? '' : 'sudo';
            const data: any = await sshTools.runCommand(this.connectionData, `${sudo} ip a`);

            // Before answer, parse data to see if we have get a valid answer.

            return data;
        } catch(error) {
            this.handleRequestException(error);
        }
    }

    async getFirewallIptablesSave(): Promise<string[]> {
        try {
            const sudo = this.connectionData.username === 'root' ? '' : 'sudo';
            const data: string = await sshTools.runCommand(this.connectionData, `${sudo} iptables-save`);
            let iptablesSaveOutput: string[] = data.split('\r\n');

            if (iptablesSaveOutput[0].startsWith('[sudo]')) iptablesSaveOutput.shift();
            if (iptablesSaveOutput[iptablesSaveOutput.length-1] === '') iptablesSaveOutput = iptablesSaveOutput.slice(0, -1);;

            return iptablesSaveOutput;
        } catch(error) {
            this.handleRequestException(error);
        }
    }

    async ccdHashList(dir: string, eventEmitter: EventEmitter = new EventEmitter()): Promise<CCDHash[]> {
        try {
            eventEmitter.emit('message', new ProgressInfoPayload(`Comparing files with OpenVPN client configurations.\n`));
            const commandResult: string = (await sshTools.runCommand(this.connectionData,
                `echo "file,sha256"; find ${dir} -maxdepth 1 -type f -exec sh -c "basename -z {}; echo -n ','; grep -v '^#' {} | sha256sum" \\; | awk '{print $1}'`
            ));

            return commandResult.split("\n").filter(item => item !== '').slice(1).map(item => ({
                filename: item.split(',')[0].replace("\x00", ""),
                hash: item.split(',')[1].replace("\r", "")
            }));
        } catch(error) {
            this.handleRequestException(error, eventEmitter);
        }
    };

    async getRealtimeStatus(statusFilepath: string): Promise<string> {
        try {
            const sudo = this.connectionData.username === 'root' ? '' : 'sudo';
            let data = await sshTools.runCommand(this.connectionData, `${sudo} cat "${statusFilepath}"`);
            // Remove the first line ()
            let lines = data.split('\n');
            if (lines[0].startsWith('[sudo] password for ')) {
                lines.splice(0, 1);
            }
            return lines.join('\n');
        } catch(error) {
            this.handleRequestException(error);
        }
    }

    ping(): Promise<void> {
        throw new Error("Method not implemented.");
    }

    installPlugin(name: string,enabled: boolean): Promise<string> {
        throw new Error("Method not implemented.");
    }

    createWebSocket(): Promise<string> {
        throw new Error("Method not implemented.");
    }
}