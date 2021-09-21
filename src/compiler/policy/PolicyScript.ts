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
import { RoutingCompiled, RoutingCompiler } from '../routing/RoutingCompiler';
import fs from 'fs';
import { RouteData, RoutingTableService } from '../../models/routing/routing-table/routing-table.service';
import { app } from '../../fonaments/abstract-application';
import { RoutingTable } from '../../models/routing/routing-table/routing-table.model';
import { RouteItemForCompiler, RoutingRuleItemForCompiler } from '../../models/routing/shared';
import { RoutingRulesData, RoutingRuleService } from '../../models/routing/routing-rule/routing-rule.service';

var config = require('../../config/config');

export class PolicyScript {
	private routingCompiler: RoutingCompiler;
	private policyCompiler: AvailablePolicyCompilers;
  private path: string;
  private stream: any;

  constructor(private dbCon: any, private fwcloud: number, private firewall: number, private channel: Channel) {
		this.routingCompiler = new RoutingCompiler;
		this.buildPath();
		this.stream = fs.createWriteStream(this.path);
  }

	private buildPath(): void {
		this.path = config.get('policy').data_dir;

		if (!fs.existsSync(this.path))
			fs.mkdirSync(this.path);		
		this.path += "/" + this.fwcloud;
		if (!fs.existsSync(this.path))
			fs.mkdirSync(this.path);
		this.path += "/" + this.firewall;
		if (!fs.existsSync(this.path))
			fs.mkdirSync(this.path);
		
		this.path += "/" + config.get('policy').script_name;
	}

	private greetingMessage(): Promise<void> {
		this.stream.write('greeting_msg() {\n' +
  		`  log \"FWCloud.net - Loading firewall policy generated: ${Date()} \"\n` +
  		'}\n\n'
		);
		return;
	}

	private async dumpFirewallOptions(): Promise<void> {
		let options = await	Firewall.getFirewallOptions(this.fwcloud, this.firewall);
		let action = '';

		this.stream.write('options_load() {\n' +
			'  echo\n' +
			'  echo \"OPTIONS\"\n' +
			'  echo \"-------\"\n');

		// IPv4 packet forwarding
		action = (options & 0x0002) ? '1' : '0';
		this.stream.write('  if [ -z "$SYSCTL" ]; then\n' +
			`    echo ${action} > /proc/sys/net/ipv4/ip_forward\n` +
			'  else\n' +
			`    $SYSCTL -w net.ipv4.conf.all.forwarding=${action}\n` +
			'  fi\n\n');

		// IPv6 packet forwarding
		action = (options & 0x0004) ? '1' : '0';
		this.stream.write(`  $SYSCTL -w net.ipv6.conf.all.forwarding=${action}\n`);

		this.stream.write('}\n\n');

		this.channel.emit('message', new ProgressNoticePayload(`--- STATE${(options & 0x0001) ? 'FUL':'LESS'} FIREWALL ---`, true));
		return;
	}

	private async dumpCompilation(type: number): Promise<void> {
		// Compile all rules of the same type.
		const rulesData: any = await PolicyRule.getPolicyData('compiler', this.dbCon, this.fwcloud, this.firewall, type, null, null);
		const rulesCompiled =  await PolicyCompiler.compile(this.policyCompiler, rulesData, this.channel);

		let cs = '';
		for (let i=0; i < rulesCompiled.length; i++) {
			cs += `\necho \"Rule ${i+1} (ID: ${rulesCompiled[i].id})${!(rulesCompiled[i].active) ? ' [DISABLED]' : ''}\"\n`;
			if (rulesCompiled[i].comment) cs += `# ${rulesCompiled[i].comment.replace(/\n/g, "\n# ")}\n`;
			if (rulesCompiled[i].active) cs += rulesCompiled[i].cs;
		}
		this.stream.write(cs);
		return;
	}

	public dump(): Promise<void> {
		return new Promise(async (resolve, reject) => {
			this.stream.on('open', async () => {
				try {
					/* Generate the policy script. */
					this.policyCompiler = await Firewall.getFirewallCompiler(this.fwcloud, this.firewall);
					this.stream.write(fs.readFileSync(config.get('policy').header_file, 'utf8'));
					await this.greetingMessage();
					await this.dumpFirewallOptions();

					this.stream.write('policy_load() {\n');
							
					if (this.policyCompiler == 'NFTables') 
						await this.dumpNFTablesStd(); // Create the standard NFTables tables and chains.
					
					if (await PolicyRule.firewallWithMarkRules(this.dbCon,this.firewall))
						await this.dumpMangeTableRules(); // Generate default rules for mangle table
					
					this.stream.write("\n\necho\n");
					this.stream.write("echo \"***********************\"\n");
					this.stream.write("echo \"* FILTER TABLE (IPv4) *\"\n");
					this.stream.write("echo \"***********************\"\n");
					this.channel.emit('message', new ProgressNoticePayload("FILTER TABLE (IPv4):", true));
					this.stream.write("\n\necho \"INPUT CHAIN\"\n");
					this.stream.write("echo \"-----------\"\n");
					this.channel.emit('message', new ProgressNoticePayload("INPUT CHAIN:", true));
					await this.dumpCompilation(PolicyTypesMap.get('IPv4:INPUT'));
		
					this.stream.write("\n\necho\n");
					this.stream.write("echo \"OUTPUT CHAIN\"\n");
					this.stream.write("echo \"------------\"\n");
					this.channel.emit('message', new ProgressNoticePayload("OUTPUT CHAIN:", true));
					await this.dumpCompilation(PolicyTypesMap.get('IPv4:OUTPUT'));
		
					this.stream.write("\n\necho\n");
					this.stream.write("echo \"FORWARD CHAIN\"\n");
					this.stream.write("echo \"-------------\"\n");
					this.channel.emit('message', new ProgressNoticePayload("FORWARD CHAIN:", true));
					await this.dumpCompilation(PolicyTypesMap.get('IPv4:FORWARD'));
		
					this.stream.write("\n\necho\n");
					this.stream.write("echo \"********************\"\n");
					this.stream.write("echo \"* NAT TABLE (IPv4) *\"\n");
					this.stream.write("echo \"********************\"\n");
					this.channel.emit('message', new ProgressNoticePayload("NAT TABLE (IPv4):", true));
					this.stream.write("\n\necho \"SNAT\"\n");
					this.stream.write("echo \"----\"\n");
					this.channel.emit('message', new ProgressNoticePayload("SNAT:", true));
					await this.dumpCompilation(PolicyTypesMap.get('IPv4:SNAT'));
		
					this.stream.write("\n\necho\n");
					this.stream.write("echo \"DNAT\"\n");
					this.stream.write("echo \"----\"\n");
					this.channel.emit('message', new ProgressNoticePayload("DNAT:", true));
					await this.dumpCompilation(PolicyTypesMap.get('IPv4:DNAT'));
		
					this.stream.write("\n\n");
		
		
					this.stream.write("\n\necho\n");
					this.stream.write("echo\n");
					this.stream.write("echo \"***********************\"\n");
					this.stream.write("echo \"* FILTER TABLE (IPv6) *\"\n");
					this.stream.write("echo \"***********************\"\n");
					this.channel.emit('message', new ProgressNoticePayload(""));
					this.channel.emit('message', new ProgressNoticePayload(""));
					this.channel.emit('message', new ProgressNoticePayload("FILTER TABLE (IPv6):", true));
					this.stream.write("\n\necho \"INPUT CHAIN\"\n");
					this.stream.write("echo \"-----------\"\n");
					this.channel.emit('message', new ProgressNoticePayload("INPUT CHAIN:", true));
					await this.dumpCompilation(PolicyTypesMap.get('IPv6:INPUT'));
		
					this.stream.write("\n\necho\n");
					this.stream.write("echo \"OUTPUT CHAIN\"\n");
					this.stream.write("echo \"------------\"\n");
					this.channel.emit('message', new ProgressNoticePayload("OUTPUT CHAIN:", true));
					await this.dumpCompilation(PolicyTypesMap.get('IPv6:OUTPUT'));
		
					this.stream.write("\n\necho\n");
					this.stream.write("echo \"FORWARD CHAIN\"\n");
					this.stream.write("echo \"-------------\"\n");
					this.channel.emit('message', new ProgressNoticePayload("FORWARD CHAIN:", true));
					await this.dumpCompilation(PolicyTypesMap.get('IPv6:FORWARD'));
		
					this.stream.write("\n\necho\n");
					this.stream.write("echo \"********************\"\n");
					this.stream.write("echo \"* NAT TABLE (IPv6) *\"\n");
					this.stream.write("echo \"********************\"\n");
					this.channel.emit('message', new ProgressNoticePayload("NAT TABLE (IPv6):", true));
					this.stream.write("\n\necho \"SNAT\"\n");
					this.stream.write("echo \"----\"\n");
					this.channel.emit('message', new ProgressNoticePayload("SNAT:", true));
					await this.dumpCompilation(PolicyTypesMap.get('IPv6:SNAT'));
		
					this.stream.write("\n\necho\n");
					this.stream.write("echo \"DNAT\"\n");
					this.stream.write("echo \"----\"\n");
					this.channel.emit('message', new ProgressNoticePayload("DNAT:", true));
					await this.dumpCompilation(PolicyTypesMap.get('IPv6:DNAT'));
		
					this.stream.write("\n}\n\n");

					await this.dumpRouting();
					
					// Footer file.
					this.stream.write(fs.readFileSync(config.get('policy').footer_file, 'utf8'));
					
					/* Close stream. */
					this.stream.end();
					
					// Update firewall status flags.
					await Firewall.updateFirewallStatus(this.fwcloud, this.firewall, "&~1");
					// Update firewall compile date.
					await Firewall.updateFirewallCompileDate(this.fwcloud, this.firewall);
		
					this.channel.emit('message', new ProgressPayload('end', false, "Compilation finished"));
		
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

	private dumpNFTablesStd(): Promise<void> {
		// Code for create the standard nftables tables and chain.
		this.stream.write("\n\necho\n");
		this.stream.write("echo \"******************************\"\n");
		this.stream.write("echo \"* NFTABLES TABLES AND CHAINS *\"\n");
		this.stream.write("echo \"******************************\"\n");
		const families = ['ip', 'ip6'];
		for (let family of families) {
			this.stream.write(`$NFT add table ${family} filter\n`);
			this.stream.write(`$NFT add chain ${family} filter INPUT { type filter hook input priority 0\\; policy drop\\; }\n`);
			this.stream.write(`$NFT add chain ${family} filter FORWARD { type filter hook forward priority 0\\; policy drop\\; }\n`);
			this.stream.write(`$NFT add chain ${family} filter OUTPUT { type filter hook output priority 0\\; policy drop\\; }\n`);
			this.stream.write(`$NFT add table ${family} nat\n`);
			this.stream.write(`$NFT add chain ${family} nat PREROUTING { type nat hook prerouting priority - 100\\; policy accept\\; }\n`);
			this.stream.write(`$NFT add chain ${family} nat INPUT { type nat hook input priority 100\\; policy accept\\; }\n`);
			this.stream.write(`$NFT add chain ${family} nat OUTPUT { type nat hook output priority - 100\\; policy accept\\; }\n`);
			this.stream.write(`$NFT add chain ${family} nat POSTROUTING { type nat hook postrouting priority 100\\; policy accept\\; }\n`);
			this.stream.write(`$NFT add table ${family} mangle\n`);
			this.stream.write(`$NFT add chain ${family} mangle PREROUTING { type filter hook prerouting priority - 150\\; policy accept\\; }\n`);
			this.stream.write(`$NFT add chain ${family} mangle INPUT { type filter hook input priority - 150\\; policy accept\\; }\n`);
			this.stream.write(`$NFT add chain ${family} mangle FORWARD { type filter hook forward priority - 150\\; policy accept\\; }\n`);
			this.stream.write(`$NFT add chain ${family} mangle OUTPUT { type route hook output priority - 150\\; policy accept\\; }\n`);
			this.stream.write(`$NFT add chain ${family} mangle POSTROUTING { type filter hook postrouting priority - 150\\; policy accept\\; }\n`);
		}

		this.stream.write('\n\n# What happens when you mix Iptables and Nftables?\n');
		this.stream.write('# How do they interact?\n');
		this.stream.write('#    nft       Empty     Accept  Accept      Block        Blank\n');
		this.stream.write('#    iptables  Empty     Empty   Block       Accept       Accept\n');
		this.stream.write('#    Results   Pass      Pass    Unreachable Unreachable  Pass \n');
		this.stream.write('# For this reason, if we have Nftables policy we must allow pass all from Iptables.\n');
		this.stream.write('iptables_default_filter_policy ACCEPT\n');
		return;
	}

	private dumpMangeTableRules(): Promise<void> {
		this.channel.emit('message', new ProgressNoticePayload("MANGLE TABLE:", true));
		this.channel.emit('message', new ProgressNoticePayload("Automatic rules."));
		this.stream.write("\n\necho\n");
		this.stream.write("echo \"****************\"\n");
		this.stream.write("echo \"* MANGLE TABLE *\"\n");
		this.stream.write("echo \"****************\"\n");
		this.stream.write("#Automatic rules for mangle table.\n");
		if (this.policyCompiler == 'IPTables') {
			this.stream.write("$IPTABLES -t mangle -A PREROUTING -j CONNMARK --restore-mark\n");
			this.stream.write("$IPTABLES -t mangle -A PREROUTING -m mark ! --mark 0 -j ACCEPT\n\n");
			this.stream.write("$IPTABLES -t mangle -A OUTPUT -j CONNMARK --restore-mark\n");
			this.stream.write("$IPTABLES -t mangle -A OUTPUT -m mark ! --mark 0 -j ACCEPT\n\n");
			this.stream.write("$IPTABLES -t mangle -A POSTROUTING -j CONNMARK --restore-mark\n");
			this.stream.write("$IPTABLES -t mangle -A POSTROUTING -m mark ! --mark 0 -j ACCEPT\n\n");
		} else { // NFTables
			this.stream.write("$NFT add rule ip mangle PREROUTING counter meta mark set ct mark\n");
			this.stream.write("$NFT add rule ip mangle PREROUTING mark != 0x0 counter accept\n");
			this.stream.write("$NFT add rule ip mangle OUTPUT counter meta mark set ct mark\n");
			this.stream.write("$NFT add rule ip mangle OUTPUT mark != 0x0 counter accept\n");
			this.stream.write("$NFT add rule ip mangle POSTROUTING counter meta mark set ct mark\n");
			this.stream.write("$NFT add rule ip mangle POSTROUTING mark != 0x0 counter accept\n");
		}
		return;
	}

	private async dumpRouting(): Promise<void> {
		let routingTableService = await app().getService<RoutingTableService>(RoutingTableService.name);
		let routingRuleService = await app().getService<RoutingRuleService>(RoutingRuleService.name);
		let routes: RouteData<RouteItemForCompiler>[];
		let routesCompiled: RoutingCompiled[];
		let rules: RoutingRulesData<RoutingRuleItemForCompiler>[];
		let rulesCompiled: RoutingCompiled[];

		let routingTables: RoutingTable[] = await routingTableService.findManyInPath({fwCloudId: this.fwcloud, firewallId: this.firewall});

		this.stream.write('routing_apply() {\necho -n ""\n');

		// Only dump routing compilation if we have routing tables.
		if (routingTables.length > 0) {
			this.stream.write("echo\n");
			this.stream.write("echo\n");
			this.stream.write("echo \"******************\"\n");
			this.stream.write("echo \"* ROUTING POLICY *\"\n");
			this.stream.write("echo \"******************\"\n");
			this.channel.emit('message', new ProgressNoticePayload(""));
			this.channel.emit('message', new ProgressNoticePayload(""));
			this.channel.emit('message', new ProgressNoticePayload("ROUTING POLICY:", true));
			// Flush all routing tables except the main table.
			this.stream.write("echo -n \"Flushing routing tables and rules ... \"\n");
			this.stream.write('$IP route flush cache\n');
			this.stream.write('T=1\n');
			this.stream.write('while [ $T -lt 251 ]; do\n');
			this.stream.write('  $IP route flush table $T 2>/dev/null\n');
			this.stream.write('  T=`expr $T + 1`\n');
			this.stream.write('done\n');
			this.stream.write('$IP rule flush\n');
			this.stream.write('$IP rule add from all lookup main pref 32766\n');
			this.stream.write('$IP rule add from all lookup default pref 32767\n');
			this.stream.write("echo \"DONE\"\n\n");

			// Compile and dump all routing tables.
			for(let i=0; i<routingTables.length; i++) {
				this.stream.write("echo\n");
				const msg = `ROUTING TABLE: ${routingTables[i].number} (${routingTables[i].name})`;
				this.stream.write(`echo \"${msg}\"\n`);
				// If the main table exists in our firewall, then flush it before loading its routes.
				if (routingTables[i].number === 254) this.stream.write('$IP route flush scope global table main\n');
				this.channel.emit('message', new ProgressNoticePayload(msg, true));

				routes = await routingTableService.getRoutingTableData<RouteItemForCompiler>('compiler', this.fwcloud, this.firewall, routingTables[i].id);            
				if (routes.length > 0) {
					routesCompiled = this.routingCompiler.compile('Route',routes,this.channel);

					let cs ='';
					for (let j=0; j < routesCompiled.length; j++) {
						cs += `echo \"Route ${j+1} (ID: ${routesCompiled[j].id})${!(routesCompiled[j].active) ? ' [DISABLED]' : ''}\"\n`;
						if (routesCompiled[j].comment) cs += `# ${routesCompiled[j].comment.replace(/\n/g, "\n# ")}\n`;
						if (routesCompiled[j].active) cs += routesCompiled[j].cs;
					}
					this.stream.write(cs);
				}		
			}

			// Compile and dump routing policy.
			rules = await routingRuleService.getRoutingRulesData<RoutingRuleItemForCompiler>('compiler', this.fwcloud, this.firewall);            
			if (rules.length > 0) {
				rulesCompiled = this.routingCompiler.compile('Rule',rules,this.channel);		

				this.stream.write(`\necho\necho \"ROUTING RULES:\"\n`);
				this.channel.emit('message', new ProgressNoticePayload("ROUTING RULES:", true));
				let cs ='';
				for (let j=0; j < rulesCompiled.length; j++) {
					cs += `\necho \"Routing rule ${j+1} (ID: ${rulesCompiled[j].id})${!(rulesCompiled[j].active) ? ' [DISABLED]' : ''}\"\n`;
					if (rulesCompiled[j].comment) cs += `# ${rulesCompiled[j].comment.replace(/\n/g, "\n# ")}\n`;
					if (rulesCompiled[j].active) cs += rulesCompiled[j].cs;
				}
				this.stream.write(cs);	
			}	
		}

		this.stream.write("\n}\n\n");
		return;
	}
}
