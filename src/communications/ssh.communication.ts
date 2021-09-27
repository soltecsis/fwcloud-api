import { EventEmitter } from "events";
import { ProgressErrorPayload, ProgressInfoPayload, ProgressNoticePayload, ProgressWarningPayload } from "../sockets/messages/socket-message";
import sshTools from "../utils/ssh";
import { Communication } from "./communication";
var config = require('../config/config');

type SSHConnectionData = {
    host: string;
    port: number;
    username: string;
    password: string;
    options: any;
}

export class SSHCommunication extends Communication<SSHConnectionData> {
    async installFirewallPolicy(scriptPath: string, eventEmitter: EventEmitter = new EventEmitter()): Promise<string> {
        try {
            eventEmitter.emit('message', new ProgressNoticePayload(`Uploading firewall script (${this.connectionData.host})`));
            await sshTools.uploadFile(this.connectionData, scriptPath, config.get('policy').script_name);

            // Enable sh debug if it is selected in firewalls/cluster options.
            const sh_debug = (this.connectionData.options & 0x0008) ? '-x' : '';

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
            eventEmitter.emit('message', new ProgressErrorPayload(`ERROR: ${error}`));
            throw error;
        }
    }

    async installOpenVPNConfig(config: unknown, dir: string, name: string, type: number, channel: EventEmitter = new EventEmitter()): Promise<void> {
        try {
            if (type === 1) { 
                // Client certificarte
                channel.emit('message', new ProgressInfoPayload(`Uploading CCD configuration file '${dir}/${name}' to: (${this.connectionData.host})\n`));
            } else {
                channel.emit('message', new ProgressNoticePayload(`Uploading OpenVPN configuration file '${dir}/${name}' to: (${this.connectionData.host})\n`));
            }
            
            await sshTools.uploadStringToFile(this.connectionData, config, name);

            const sudo = this.connectionData.username === 'root' ? '' : 'sudo';

            const existsDir = await sshTools.runCommand(this.connectionData, `if [ -d "${dir}" ]; then echo -n 1; else echo -n 0; fi`);
            if (existsDir === "0") {
                channel.emit('message', new ProgressNoticePayload(`Creating install directory.\n`));
                await sshTools.runCommand(this.connectionData, `${sudo} mkdir "${dir}"`);
                await sshTools.runCommand(this.connectionData, `${sudo} chown root:root "${dir}"`);
                await sshTools.runCommand(this.connectionData, `${sudo} chmod 755 "${dir}"`);
            }

            channel.emit('message', new ProgressNoticePayload(`Installing OpenVPN configuration file.\n`));
            await sshTools.runCommand(this.connectionData, `${sudo} mv ${name} ${dir}/`);

            channel.emit('message', new ProgressNoticePayload(`Setting up file permissions.\n\n`));
            await sshTools.runCommand(this.connectionData, `${sudo} chown root:root ${dir}/${name}`);

            if (type === 1) { 
                // Client certificate.
                await sshTools.runCommand(this.connectionData, `${sudo} chmod 644 ${dir}/${name}`);
            } else {
                // Server certificate.
                await sshTools.runCommand(this.connectionData, `${sudo} chmod 600 ${dir}/${name}`);
            }

            return;
        } catch (error) {
            channel.emit('message', new ProgressErrorPayload(`ERROR: ${error}\n`));
            throw error;
        }
    }

    async uninstallOpenVPNConfig(dir: string, name: string, channel: EventEmitter = new EventEmitter()): Promise<void> {
        try {
            channel.emit('message', new ProgressNoticePayload(`Removing OpenVPN configuration file '${dir}/${name}' from: (${this.connectionData.host})\n`));
            const sudo = this.connectionData.username === 'root' ? '' : 'sudo';
            await sshTools.runCommand(this.connectionData, `${sudo} rm -f "${dir}/${name}"`);

            return;
        } catch (error) {
            channel.emit('message', new ProgressErrorPayload(`ERROR: ${error}\n`));
            throw error;
        }
    }

    async getFirewallInterfaces(): Promise<string> {
        const sudo = this.connectionData.username === 'root' ? '' : 'sudo';
        const data: any = await sshTools.runCommand(this.connectionData, `${sudo} ip a`);

        // Before answer, parse data to see if we have get a valid answer.

		return data;
    }

    async getFirewallIptablesSave(): Promise<string[]> {
        const sudo = this.connectionData.username === 'root' ? '' : 'sudo';
        const data: string = await sshTools.runCommand(this.connectionData, `${sudo} iptables-save`);
        let iptablesSaveOutput: string[] = data.split('\r\n');

        if (iptablesSaveOutput[0].startsWith('[sudo]')) iptablesSaveOutput.shift();
        if (iptablesSaveOutput[iptablesSaveOutput.length-1] === '') iptablesSaveOutput = iptablesSaveOutput.slice(0, -1);;

        return iptablesSaveOutput;
    }

    async ccdCompare(dir: string, clients: unknown[], channel: EventEmitter = new EventEmitter()): Promise<string> {
        try {
            channel.emit('message', new ProgressInfoPayload(`Comparing files with OpenVPN client configurations.\n`));
            const fileList = (await sshTools.runCommand(this.connectionData, `cd ${dir}; ls -p | grep -v "/$"`)).trim().split('\r\n');

            let found;
            let notFoundList = "";
            for (let file of fileList) {
                found = 0;
                for (let client of clients) {
                    if ((client as Record<string, unknown>).cn === file) {
                        found = 1;
                        break;
                    }
                }
                if (!found) notFoundList += `${file}\n`;
            }

            if (notFoundList) {
                channel.emit('message', new ProgressWarningPayload(`Found files in the directory '${dir}' without OpenVPN config:
                    ${notFoundList}
                    `));
            }
            else {
                channel.emit('message', new ProgressInfoPayload(`Ok.\n\n`));
            }

            return notFoundList;
        } catch (error) {
            channel.emit('message', new ProgressErrorPayload(`ERROR: ${error}\n`));
            throw error;
        }
    };

    
    ping(): Promise<void> {
        throw new Error("Method not implemented.");
    }

}