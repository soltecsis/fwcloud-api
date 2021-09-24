import { EventEmitter } from "events";
import { ProgressErrorPayload, ProgressNoticePayload } from "../sockets/messages/socket-message";
import sshTools from "../utils/ssh";
import { Communication } from "./communication";
var config = require('../config/config');

type SSHConnectionData = {
    host: string;
    port: string;
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
    
    ping(): Promise<void> {
        throw new Error("Method not implemented.");
    }

}