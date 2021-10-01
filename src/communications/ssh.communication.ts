import { EventEmitter } from "events";
import { ProgressErrorPayload, ProgressInfoPayload, ProgressNoticePayload, ProgressWarningPayload } from "../sockets/messages/socket-message";
import sshTools from "../utils/ssh";
import { CCDHash, Communication } from "./communication";
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

    async uninstallOpenVPNConfig(dir: string, files: string[], channel: EventEmitter = new EventEmitter()): Promise<void> {
        try {
            channel.emit('message', new ProgressNoticePayload(`Removing OpenVPN configuration file '${dir}/[${files.join(", ")}]' from: (${this.connectionData.host})\n`));
            const sudo = this.connectionData.username === 'root' ? '' : 'sudo';

            for(let file of files) {
                await sshTools.runCommand(this.connectionData, `${sudo} rm -f "${dir}/${file}"`);
            }
            
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

    async ccdHashList(dir: string, channel: EventEmitter = new EventEmitter()): Promise<CCDHash[]> {
        channel.emit('message', new ProgressInfoPayload(`Comparing files with OpenVPN client configurations.\n`));
        const commandResult: string = (await sshTools.runCommand(this.connectionData,
            `echo "file,sha256"; find ${dir} -maxdepth 1 -type f -exec sh -c "basename -z {}; echo -n ','; grep -v '^#' {} | sha256sum" \\; | awk '{print $1}'`
        ));

        return commandResult.replace("\x00", "").split("\n").filter(item => item !== '').slice(1).map(item => ({
            filename: item.split(',')[0],
            hash: item.split(',')[1]
        }));
    };

    
    ping(): Promise<void> {
        throw new Error("Method not implemented.");
    }

}