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
 * Property Model to manage compilation process
 *
 * @property RuleCompileModel
 * @type /models/compile/
 */
import { IPTablesCompiler, IPTablesRuleCompiled } from './iptables/iptables-compiler'
import { Firewall } from '../models/firewall/Firewall';
import { EventEmitter } from 'typeorm/platform/PlatformTools';
import { ProgressNoticePayload, ProgressErrorPayload } from '../sockets/messages/socket-message';

import sshTools from '../utils/ssh';
import { PolicyCompiler } from './PolicyCompiler';

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

    public static dump(req, type: number, eventEmitter: EventEmitter = new EventEmitter()) {
        return new Promise(async (resolve, reject) => {
            try {
                // Compile all rules of the same type.
                const rulesCompiled =  await PolicyCompiler.compile(req.dbCon, req.body.fwcloud, req.body.firewall, type, null, eventEmitter);

                let ps = '';
                for (let i=0; i < rulesCompiled.length; i++) {
                    ps += `\necho \"Rule ${i+1} (ID: ${rulesCompiled[i].id})${!(rulesCompiled[i].active) ? ' [DISABLED]' : ''}\"\n`;
                    if (rulesCompiled[i].comment) ps += `# ${rulesCompiled[i].comment.replace(/\n/g, "\n# ")}\n`;
                    if (rulesCompiled[i].active) ps += rulesCompiled[i].cs;
                }
                resolve(ps);
            } catch (error) { return reject(error) }
        });
    }

    public static install(req, SSHconn, firewall, eventEmitter: EventEmitter = new EventEmitter()) {
        return new Promise(async (resolve, reject) => {
            try {
                eventEmitter.emit('message', new ProgressNoticePayload(`Uploading firewall script (${SSHconn.host})`));
                await sshTools.uploadFile(SSHconn, `${config.get('policy').data_dir}/${req.body.fwcloud}/${firewall}/${config.get('policy').script_name}`, config.get('policy').script_name);

                // Enable sh debug if it is selected in firewalls/cluster options.
                const options: any = await Firewall.getFirewallOptions(req.body.fwcloud, firewall);
                const sh_debug = (options & 0x0008) ? '-x' : '';

                const sudo = SSHconn.username === 'root' ? '' : 'sudo';

                eventEmitter.emit('message', new ProgressNoticePayload("Installing firewall script."));
                await sshTools.runCommand(SSHconn, `${sudo} sh ${sh_debug} ./${config.get('policy').script_name} install`);

                eventEmitter.emit('message', new ProgressNoticePayload("Loading firewall policy."));
                const cmd = `${sudo} sh ${sh_debug} -c 'if [ -d /etc/fwcloud ]; then
                    sh ${sh_debug} /etc/fwcloud/${config.get('policy').script_name} start;
                    else sh ${sh_debug} /config/scripts/post-config.d/${config.get('policy').script_name} start; 
                fi'`
                await sshTools.runCommand(SSHconn, cmd, eventEmitter);

                resolve("DONE");
            } catch (error) {
                eventEmitter.emit('message', new ProgressErrorPayload(`ERROR: ${error}`));
                reject(error);
            }
        });
    }
}