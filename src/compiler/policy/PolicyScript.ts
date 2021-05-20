/*
	Copyright 2021 SOLTECSIS SOLUCIONES TECNOLOGICAS, SLU
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
import { Firewall } from '../../models/firewall/Firewall';
import { EventEmitter } from 'typeorm/platform/PlatformTools';
import { ProgressNoticePayload, ProgressErrorPayload, ProgressPayload } from '../../sockets/messages/socket-message';

import sshTools from '../../utils/ssh';
import { AvailablePolicyCompilers, PolicyCompiler } from './PolicyCompiler';
import { Channel } from '../../sockets/channels/channel';
import { PolicyTypesMap } from '../../models/policy/PolicyType';
import { PolicyRule } from '../../models/policy/PolicyRule';

var config = require('../../config/config');

export class PolicyScript {

	private static append(path) {
		return new Promise((resolve, reject) => {
			var fs = require('fs');

			try {
				var data: any = {};
				data.cs = fs.readFileSync(path, 'utf8');
				resolve(data);
			} catch (error) { reject(error); }
		});
	}

	private static dumpFirewallOptions(fwcloud, fw, data) {
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

	private static dump(compiler: AvailablePolicyCompilers, dbCon:any, fwcloud: number, firewall: number,  type: number, eventEmitter: EventEmitter = new EventEmitter()) {
		return new Promise(async (resolve, reject) => {
			try {
				// Compile all rules of the same type.
				const rulesCompiled =  await PolicyCompiler.compile(compiler, dbCon, fwcloud, firewall, type, null, eventEmitter);

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

	public static generate(dbCon:any, fwcloud: number, firewall: number, channel: Channel): Promise<void> {
		return new Promise(async (resolve, reject) => {
			try {
				var fs = require('fs');
				var path = config.get('policy').data_dir;
				if (!fs.existsSync(path))
					fs.mkdirSync(path);
				path += "/" + fwcloud;
				if (!fs.existsSync(path))
					fs.mkdirSync(path);
				path += "/" + firewall;
				if (!fs.existsSync(path))
					fs.mkdirSync(path);
				path += "/" + config.get('policy').script_name;
				var stream = fs.createWriteStream(path);
			} catch (error) { return reject(error) }
			
			stream.on('open', async fd => {
				try {
					/* Generate the policy script. */
					const compiler = await Firewall.getFirewallCompiler(fwcloud, firewall);
					let data: any = await PolicyScript.append(config.get('policy').header_file);
					data = await PolicyScript.dumpFirewallOptions(fwcloud, firewall, data);
					stream.write(data.cs + "greeting_msg() {\n" +
						"log \"FWCloud.net - Loading firewall policy generated: " + Date() + "\"\n}\n\n" +
						"policy_load() {\n");
					
					if (data.options & 0x0001) { // Statefull firewall
						channel.emit('message', new ProgressNoticePayload('--- STATEFUL FIREWALL ---', true));
					} else {
						channel.emit('message', new ProgressNoticePayload('--- STATELESS FIREWALL ---', true));
					}
		
					if (compiler == 'NFTables') {
						// Code for create the standard nftables tables and chain.
						stream.write("\n\necho\n");
						stream.write("echo \"******************************\"\n");
						stream.write("echo \"* NFTABLES TABLES AND CHAINS *\"\n");
						stream.write("echo \"******************************\"\n");
						const families = ['ip', 'ip6'];
						for (let family of families) {
							stream.write(`$NFT add table ${family} filter\n`);
							stream.write(`$NFT add chain ${family} filter INPUT { type filter hook input priority 0\\; policy drop\\; }\n`);
							stream.write(`$NFT add chain ${family} filter FORWARD { type filter hook forward priority 0\\; policy drop\\; }\n`);
							stream.write(`$NFT add chain ${family} filter OUTPUT { type filter hook output priority 0\\; policy drop\\; }\n`);
							stream.write(`$NFT add table ${family} nat\n`);
							stream.write(`$NFT add chain ${family} nat PREROUTING { type nat hook prerouting priority - 100\\; policy accept\\; }\n`);
							stream.write(`$NFT add chain ${family} nat INPUT { type nat hook input priority 100\\; policy accept\\; }\n`);
							stream.write(`$NFT add chain ${family} nat OUTPUT { type nat hook output priority - 100\\; policy accept\\; }\n`);
							stream.write(`$NFT add chain ${family} nat POSTROUTING { type nat hook postrouting priority 100\\; policy accept\\; }\n`);
							stream.write(`$NFT add table ${family} mangle\n`);
							stream.write(`$NFT add chain ${family} mangle PREROUTING { type filter hook prerouting priority - 150\\; policy accept\\; }\n`);
							stream.write(`$NFT add chain ${family} mangle INPUT { type filter hook input priority - 150\\; policy accept\\; }\n`);
							stream.write(`$NFT add chain ${family} mangle FORWARD { type filter hook forward priority - 150\\; policy accept\\; }\n`);
							stream.write(`$NFT add chain ${family} mangle OUTPUT { type route hook output priority - 150\\; policy accept\\; }\n`);
							stream.write(`$NFT add chain ${family} mangle POSTROUTING { type filter hook postrouting priority - 150\\; policy accept\\; }\n`);
						}
					}
		
					// Generate default rules for mangle table
					if (await PolicyRule.firewallWithMarkRules(dbCon,firewall)) {
						channel.emit('message', new ProgressNoticePayload("MANGLE TABLE:", true));
						channel.emit('message', new ProgressNoticePayload("Automatic rules."));
						stream.write("\n\necho\n");
						stream.write("echo \"****************\"\n");
						stream.write("echo \"* MANGLE TABLE *\"\n");
						stream.write("echo \"****************\"\n");
						stream.write("#Automatic rules for mangle table.\n");
						if (compiler == 'IPTables') {
							stream.write("$IPTABLES -t mangle -A PREROUTING -j CONNMARK --restore-mark\n");
							stream.write("$IPTABLES -t mangle -A PREROUTING -m mark ! --mark 0 -j ACCEPT\n\n");
							stream.write("$IPTABLES -t mangle -A OUTPUT -j CONNMARK --restore-mark\n");
							stream.write("$IPTABLES -t mangle -A OUTPUT -m mark ! --mark 0 -j ACCEPT\n\n");
							stream.write("$IPTABLES -t mangle -A POSTROUTING -j CONNMARK --restore-mark\n");
							stream.write("$IPTABLES -t mangle -A POSTROUTING -m mark ! --mark 0 -j ACCEPT\n\n");
						} else { // NFTables
							stream.write("$NFT add rule ip mangle PREROUTING counter meta mark set ct mark\n");
							stream.write("$NFT add rule ip mangle PREROUTING mark != 0x0 counter accept\n");
							stream.write("$NFT add rule ip mangle OUTPUT counter meta mark set ct mark\n");
							stream.write("$NFT add rule ip mangle OUTPUT mark != 0x0 counter accept\n");
							stream.write("$NFT add rule ip mangle POSTROUTING counter meta mark set ct mark\n");
							stream.write("$NFT add rule ip mangle POSTROUTING mark != 0x0 counter accept\n");
						}
					}
					
					stream.write("\n\necho\n");
					stream.write("echo \"***********************\"\n");
					stream.write("echo \"* FILTER TABLE (IPv4) *\"\n");
					stream.write("echo \"***********************\"\n");
					channel.emit('message', new ProgressNoticePayload("FILTER TABLE (IPv4):", true));
					stream.write("\n\necho \"INPUT CHAIN\"\n");
					stream.write("echo \"-----------\"\n");
					channel.emit('message', new ProgressNoticePayload("INPUT CHAIN:", true));
					let cs = await PolicyScript.dump(compiler, dbCon, fwcloud, firewall, PolicyTypesMap.get('IPv4:INPUT'), channel);
		
					stream.write(cs + "\n\necho\n");
					stream.write("echo \"OUTPUT CHAIN\"\n");
					stream.write("echo \"------------\"\n");
					channel.emit('message', new ProgressNoticePayload("OUTPUT CHAIN:", true));
					cs = await PolicyScript.dump(compiler, dbCon, fwcloud, firewall, PolicyTypesMap.get('IPv4:OUTPUT'), channel);
		
					stream.write(cs + "\n\necho\n");
					stream.write("echo \"FORWARD CHAIN\"\n");
					stream.write("echo \"-------------\"\n");
					channel.emit('message', new ProgressNoticePayload("FORWARD CHAIN:", true));
					cs = await PolicyScript.dump(compiler, dbCon, fwcloud, firewall, PolicyTypesMap.get('IPv4:FORWARD'), channel);
		
					stream.write(cs + "\n\necho\n");
					stream.write("echo \"********************\"\n");
					stream.write("echo \"* NAT TABLE (IPv4) *\"\n");
					stream.write("echo \"********************\"\n");
					channel.emit('message', new ProgressNoticePayload("NAT TABLE (IPv4):", true));
					stream.write("\n\necho \"SNAT\"\n");
					stream.write("echo \"----\"\n");
					channel.emit('message', new ProgressNoticePayload("SNAT:", true));
					cs = await PolicyScript.dump(compiler, dbCon, fwcloud, firewall, PolicyTypesMap.get('IPv4:SNAT'), channel);
		
					stream.write(cs + "\n\necho\n");
					stream.write("echo \"DNAT\"\n");
					stream.write("echo \"----\"\n");
					channel.emit('message', new ProgressNoticePayload("DNAT:", true));
					cs = await PolicyScript.dump(compiler, dbCon, fwcloud, firewall, PolicyTypesMap.get('IPv4:DNAT'), channel);
		
					stream.write(cs+"\n\n");
		
		
					stream.write("\n\necho\n");
					stream.write("echo\n");
					stream.write("echo \"***********************\"\n");
					stream.write("echo \"* FILTER TABLE (IPv6) *\"\n");
					stream.write("echo \"***********************\"\n");
					channel.emit('message', new ProgressNoticePayload(""));
					channel.emit('message', new ProgressNoticePayload(""));
					channel.emit('message', new ProgressNoticePayload("FILTER TABLE (IPv6):", true));
					stream.write("\n\necho \"INPUT CHAIN\"\n");
					stream.write("echo \"-----------\"\n");
					channel.emit('message', new ProgressNoticePayload("INPUT CHAIN:", true));
					cs = await PolicyScript.dump(compiler, dbCon, fwcloud, firewall, PolicyTypesMap.get('IPv6:INPUT'), channel);
		
					stream.write(cs + "\n\necho\n");
					stream.write("echo \"OUTPUT CHAIN\"\n");
					stream.write("echo \"------------\"\n");
					channel.emit('message', new ProgressNoticePayload("OUTPUT CHAIN:", true));
					cs = await PolicyScript.dump(compiler, dbCon, fwcloud, firewall, PolicyTypesMap.get('IPv6:OUTPUT'), channel);
		
					stream.write(cs + "\n\necho\n");
					stream.write("echo \"FORWARD CHAIN\"\n");
					stream.write("echo \"-------------\"\n");
					channel.emit('message', new ProgressNoticePayload("FORWARD CHAIN:", true));
					cs = await PolicyScript.dump(compiler, dbCon, fwcloud, firewall, PolicyTypesMap.get('IPv6:FORWARD'), channel);
		
					stream.write(cs + "\n\necho\n");
					stream.write("echo \"********************\"\n");
					stream.write("echo \"* NAT TABLE (IPv6) *\"\n");
					stream.write("echo \"********************\"\n");
					channel.emit('message', new ProgressNoticePayload("NAT TABLE (IPv6):", true));
					stream.write("\n\necho \"SNAT\"\n");
					stream.write("echo \"----\"\n");
					channel.emit('message', new ProgressNoticePayload("SNAT:", true));
					cs = await PolicyScript.dump(compiler, dbCon, fwcloud, firewall, PolicyTypesMap.get('IPv6:SNAT'), channel);
		
					stream.write(cs + "\n\necho\n");
					stream.write("echo \"DNAT\"\n");
					stream.write("echo \"----\"\n");
					channel.emit('message', new ProgressNoticePayload("DNAT:", true));
					cs = await PolicyScript.dump(compiler, dbCon, fwcloud, firewall, PolicyTypesMap.get('IPv6:DNAT'), channel);
		
					stream.write(cs+"\n}\n\n");
					
		
					data = await PolicyScript.append(config.get('policy').footer_file);
					stream.write(data.cs);
					
					/* Close stream. */
					stream.end();
					
					// Update firewall status flags.
					await Firewall.updateFirewallStatus(fwcloud, firewall, "&~1");
					// Update firewall compile date.
					await Firewall.updateFirewallCompileDate(fwcloud, firewall);
		
					channel.emit('message', new ProgressPayload('end', false, "Compilation finished"));
		
					//console.log(`Total get data time: ${IPTablesCompiler.totalGetDataTime}ms`)
					//console.timeEnd(`Firewall compile (ID: ${req.body.firewall})`);
		
					resolve();
				} catch(error) { reject(error) }
			}).on('error', error => { return reject(error) });
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