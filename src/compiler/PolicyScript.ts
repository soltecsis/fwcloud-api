/*
    Copyright 2019 SOLTECSIS SOLUCIONES TECNOLOGICAS, SLU
    https://soltecsis.com
    info@soltecsis.com


    This file is part of FWCloud (https://fwcloud.net).

    FWCloud is free software: you can redistribute it and/or modify
    it under the terms of the GNU Affero General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    FWCloud is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU General Public License for more details.

    You should have received a copy of the GNU General Public License
    along with FWCloud.  If not, see <https://www.gnu.org/licenses/>.
*/

/**
* Property Model to manage Policy Compiled Data
*
* @property Policy_cModel
* @type /models/policy_c
*/
import { PolicyCompilation } from '../models/policy/PolicyCompilation';

/**
 * Property Model to manage compilation process
 *
 * @property RuleCompileModel
 * @type /models/compile/
 */
import { RuleCompiler } from './RuleCompiler'
import { Firewall } from '../models/firewall/Firewall';
import { EventEmitter } from 'typeorm/platform/PlatformTools';
import { ProgressNoticePayload, ProgressInfoPayload, ProgressErrorPayload } from '../sockets/messages/socket-message';

const sshTools = require('../utils/ssh');

var config = require('../config/config');

export class PolicyScript {

    public static append(path) {
        return new Promise((resolve, reject) => {
            var fs = require('fs');

            try {
                var data: any = {};
                data.cs = fs.readFileSync(path, 'utf8');
                resolve(data);
            } catch (error) { reject(error); }
        });
    }

    public static dumpFirewallOptions(fwcloud, fw, data) {
        return new Promise((resolve, reject) => {
            Firewall.getFirewallOptions(fwcloud, fw)
                .then((options: any) => {
                    var action = '';
                    data.options = options;
                    data.cs += "options_load() {\n" +
                        "echo\n" +
                        "echo \"OPTIONS\"\n" +
                        "echo \"-------\"\n";

                    // IPv4 packet forwarding
                    action = (options & 0x0002) ? '1' : '0';
                    data.cs += 'if [ -z "$SYSCTL" ]; then\n' +
                        '  echo ' + action + ' > /proc/sys/net/ipv4/ip_forward\n' +
                        'else\n' +
                        '  $SYSCTL -w net.ipv4.conf.all.forwarding=' + action + '\n' +
                        'fi\n\n';

                    // IPv6 packet forwarding
                    action = (options & 0x0004) ? '1' : '0';
                    data.cs += '$SYSCTL -w net.ipv6.conf.all.forwarding=' + action + '\n';

                    data.cs += "}\n\n";

                    resolve(data);
                })
                .catch(error => reject(error));
        });
    }

    public static dump(req, type, eventEmitter: EventEmitter = new EventEmitter()) {
        return new Promise((resolve, reject) => {
            PolicyCompilation.getPolicy_cs_type(req.body.fwcloud, req.body.firewall, type, async (error, data) => {
                if (error) return reject(error);

                for (var ps = "", i = 0; i < data.length; i++) {
                    eventEmitter.emit('message', new ProgressNoticePayload("Rule " + (i + 1) + " (ID: " + data[i].id + ")"));
                    
                    ps += "\necho \"RULE " + (i + 1) + " (ID: " + data[i].id + ")\"\n";
                    
                    if (data[i].comment) {
                        ps += "# " + data[i].comment.replace(/\n/g, "\n# ") + "\n";
                    }
                    
                    // Rule compilation cache disabled until issue "Policy compilation cache invalidation problem."
                    // is solved.
                    /*
                    if (!parseInt(data[i].c_status_recompile)) // The compiled string in the database is ok.
                        ps += data[i].c_compiled;
                    else { // We must compile the rule.
                        try {
                            // The rule compilation order is important, then we must wait until we have the promise fulfilled.
                            // For this reason we use await and async for the callback function of Policy_cModel.getPolicy_cs_type
                            ps += await RuleCompiler.get(req.body.fwcloud, req.body.firewall, type, data[i].id);
                        } catch (error) { return reject(error) }
                    }
                    */
                    try {
                        // The rule compilation order is important, then we must wait until we have the promise fulfilled.
                        // For this reason we use await and async for the callback function of Policy_cModel.getPolicy_cs_type
                        ps += await RuleCompiler.get(req.body.fwcloud, req.body.firewall, type, data[i].id);
                    } catch (error) { return reject(error) }
                }

                resolve(ps);
            });
        });
    }

    public static install(req, SSHconn, firewall, eventEmitter: EventEmitter = new EventEmitter()) {
        return new Promise(async (resolve, reject) => {
            try {
                eventEmitter.emit('message', new ProgressNoticePayload("Uploading firewall script (" + SSHconn.host + ")"));
                await sshTools.uploadFile(SSHconn, config.get('policy').data_dir + "/" + req.body.fwcloud + "/" + firewall + "/" + config.get('policy').script_name, config.get('policy').script_name);

                // Enable sh depuration if it is selected in firewalls/cluster options.
                const options: any = await Firewall.getFirewallOptions(req.body.fwcloud, firewall);
                const sh_debug = (options & 0x0008) ? ' -x' : '';

                eventEmitter.emit('message', new ProgressNoticePayload("Installing firewall script."));
                await sshTools.runCommand(SSHconn, "sudo sh" + sh_debug + " ./" + config.get('policy').script_name + " install");

                eventEmitter.emit('message', new ProgressNoticePayload("Loading firewall policy."));
                const data = await sshTools.runCommand(SSHconn, "sudo sh" + sh_debug + " -c 'if [ -d /etc/fwcloud ]; then " +
                    "sh" + sh_debug + " /etc/fwcloud/" + config.get('policy').script_name + " start; " +
                    "else sh" + sh_debug + " /config/scripts/post-config.d/" + config.get('policy').script_name + " start; fi'")

                eventEmitter.emit('message', new ProgressNoticePayload(data));
                resolve("DONE");
            } catch (error) {
                eventEmitter.emit('message', new ProgressErrorPayload(`ERROR: ${error}`));
                reject(error);
            }
        });
    }
}