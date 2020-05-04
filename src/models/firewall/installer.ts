import { Firewall } from "./Firewall";
import { SSHConfig } from "./firewall.service";
import { app } from "../../fonaments/abstract-application";
import sshTools from '../../utils/ssh';

export class Installer {
    protected _firewall: Firewall;

    constructor(firewall: Firewall) {
        this._firewall = firewall;
    }

    public async install(sshConfig: SSHConfig): Promise<string> {
        return new Promise(async (resolve, reject) => {
            //SocketTools.init(req); // Init the socket used for message notification by the socketTools module.

            try {
                //SocketTools.msg("Uploading firewall script (" + SSHconn.host + ")\n");
                await sshTools.uploadFile(sshConfig, this._firewall.getPolicyFilePath(), app().config.get('policy').script_name);

                // Enable sh depuration if it is selected in firewalls/cluster options.
                const options: any = await Firewall.getFirewallOptions(this._firewall.fwCloudId, this._firewall.id);
                const sh_debug = (options & 0x0008) ? ' -x' : '';

                //SocketTools.msg("Installing firewall script.\n");
                await sshTools.runCommand(sshConfig, "sudo sh" + sh_debug + " ./" + app().config.get('policy').script_name + " install");

                //SocketTools.msg("Loading firewall policy.\n");
                const data = await sshTools.runCommand(sshConfig, "sudo sh" + sh_debug + " -c 'if [ -d /etc/fwcloud ]; then " +
                    "sh" + sh_debug + " /etc/fwcloud/" + app().config.get('policy').script_name + " start; " +
                    "else sh" + sh_debug + " /config/scripts/post-config.d/" + app().config.get('policy').script_name + " start; fi'")

                //SocketTools.msg(data);
                //SocketTools.msgEnd();
                resolve("DONE");
            } catch (error) {
                //SocketTools.msg(`ERROR: ${error}\n`);
                //SocketTools.msgEnd();
                reject(error);
            }
        });
    }
}