import { Firewall } from "./Firewall";
import { SSHConfig } from "./firewall.service";
import { app } from "../../fonaments/abstract-application";
import sshTools from '../../utils/ssh';
import { EventEmitter } from "typeorm/platform/PlatformTools";
import { ProgressInfoPayload, ProgressNoticePayload } from "../../sockets/messages/socket-message";

export class Installer {
    protected _firewall: Firewall;

    constructor(firewall: Firewall) {
        this._firewall = firewall;
    }

    public async install(sshConfig: SSHConfig, eventEmitter: EventEmitter): Promise<string> {
        return new Promise(async (resolve, reject) => {
            try {
                eventEmitter.emit('message', new ProgressNoticePayload("Uploading firewall script (" + sshConfig.host + ")\n"));
                await sshTools.uploadFile(sshConfig, this._firewall.getPolicyFilePath(), app().config.get('policy').script_name);

                // Enable sh depuration if it is selected in firewalls/cluster options.
                const options: any = await Firewall.getFirewallOptions(this._firewall.fwCloudId, this._firewall.id);
                const sh_debug = (options & 0x0008) ? ' -x' : '';

                eventEmitter.emit('message', new ProgressNoticePayload("Installing firewall script.\n"));
                await sshTools.runCommand(sshConfig, "sudo sh" + sh_debug + " ./" + app().config.get('policy').script_name + " install");

                eventEmitter.emit('message', new ProgressNoticePayload("Loading firewall policy.\n"));
                const data = await sshTools.runCommand(sshConfig, "sudo sh" + sh_debug + " -c 'if [ -d /etc/fwcloud ]; then " +
                    "sh" + sh_debug + " /etc/fwcloud/" + app().config.get('policy').script_name + " start; " +
                    "else sh" + sh_debug + " /config/scripts/post-config.d/" + app().config.get('policy').script_name + " start; fi'")

                eventEmitter.emit('message', new ProgressNoticePayload(data));
                resolve("DONE");
            } catch (error) {
                reject(error);
            }
        });
    }
}