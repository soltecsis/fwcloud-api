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

import { PolicyTypesMap } from '../../models/policy/PolicyType';
import { PolicyCompilerTools, ACTION, POLICY_TYPE, MARK_CHAIN } from '../PolicyCompilerTools';

export class IPTablesCompiler {
   public static ruleCompile(ruleData: any): string {
		let policy_type = ruleData.type;

		if (!PolicyCompilerTools.validPolicyType(policy_type)) throw(new Error('Invalid policy type'));

		let cmd = (policy_type < PolicyTypesMap.get('IPv6:INPUT')) ? "$IPTABLES" : "$IP6TABLES"; // iptables command variable.
		let cs = `${cmd} `; // Compile string.
		let after_log_action = "";
		let log_chain = ""; 
		let acc_chain = ""; 
		let cs_trail = ""; 
		let stateful = ""; 
		let table = ""; 
		let action = "";
		let comment = PolicyCompilerTools.ruleComment(ruleData);

		// Since now, all the compilation process for IPv6 is the same that the one for IPv4.
		if (policy_type >= PolicyTypesMap.get('IPv6:INPUT')) {
			policy_type -= 60;
			ruleData.type -= 60;
			ruleData.ip_version = 6;
		} else ruleData.ip_version = 4;

		if (policy_type === PolicyTypesMap.get('IPv4:SNAT')) { // SNAT
			table = "-t nat";
			cs += table + ` -A POSTROUTING ${comment}`;
			action = PolicyCompilerTools.natAction(policy_type, ruleData.positions[4].ipobjs, ruleData.positions[5].ipobjs, ruleData.ip_version);
		}
		else if (policy_type === PolicyTypesMap.get('IPv4:DNAT')) { // DNAT
			table = "-t nat";
			cs += table + ` -A PREROUTING ${comment}`;
			action = PolicyCompilerTools.natAction(policy_type, ruleData.positions[4].ipobjs, ruleData.positions[5].ipobjs, ruleData.ip_version);
		}
		else { // Filter policy
			if (!(ruleData.positions)
				|| !(ruleData.positions[0].ipobjs) || !(ruleData.positions[1].ipobjs) || !(ruleData.positions[2].ipobjs)
				|| (policy_type === PolicyTypesMap.get('IPv4:FORWARD') && !(ruleData.positions[3].ipobjs))) {
				throw(new Error("Bad rule data"));
			}

			cs += `-A ${POLICY_TYPE[policy_type]} ${comment}`;

			if (ruleData.special === 1) // Special rule for ESTABLISHED,RELATED packages.
				action = "ACCEPT";
			else if (ruleData.special === 2) // Special rule for catch-all.
				action = ACTION[ruleData.action];
			else {
				action = ACTION[ruleData.action];
				if (action === "ACCEPT") {
					if (ruleData.options & 0x0001) // Stateful rule.
						stateful = "-m conntrack --ctstate  NEW ";
					else if ((ruleData.firewall_options & 0x0001) && !(ruleData.options & 0x0002)) // Statefull firewall and this rule is not stateless.
						stateful = "-m conntrack --ctstate  NEW ";
					}
				else if (action === "ACCOUNTING") {
					acc_chain = "FWCRULE" + ruleData.id + ".ACC";
					action = acc_chain;
				}
			}

			// If log all rules option is enabled or log option for this rule is enabled.
			if ((ruleData.firewall_options & 0x0010) || (ruleData.options & 0x0004)) {
				log_chain = "FWCRULE" + ruleData.id + ".LOG";
				if (!acc_chain) {
					after_log_action = action;
					action = log_chain;
				} else
					after_log_action = "RETURN";
			}
		}

		if (parseInt(ruleData.special) === 1) // Special rule for ESTABLISHED,RELATED packages.
			//cs_trail = `-m state --state ESTABLISHED,RELATED -j ${action}\n`;
			cs_trail = `-m conntrack --ctstate ESTABLISHED,RELATED -j ${action}\n`;
		else
			cs_trail = `${stateful} -j ${action}\n`;

		const position_items = PolicyCompilerTools.preCompile(ruleData);

		// Generate the compilation string.
		cs = PolicyCompilerTools.generateCompilationString(ruleData.id, position_items, cs, cs_trail, table, stateful, action, cmd);

		// If we are using UDP or TCP ports in translated service position for NAT rules, 
		// make sure that we have only one -p flag per line into the compilation string.
		if ((policy_type === PolicyTypesMap.get('IPv4:SNAT') || policy_type === PolicyTypesMap.get('IPv4:DNAT')) && ruleData.positions[5].ipobjs.length === 1) { // SNAT or DNAT
			const lines = cs.split('\n');
			cs = '';
			for(let i=0; i<lines.length; i++) {
				if (lines[i] === '') continue; // Ignore empty lines.
				if ((lines[i].match(/ -p tcp /g) || []).length > 1)
					cs += `${policy_type===PolicyTypesMap.get('IPv4:SNAT') ? lines[i].replace(/ -j SNAT -p tcp /, ' -j SNAT ') : lines[i].replace(/ -j DNAT -p tcp /, ' -j DNAT ')}\n`;
				else if ((lines[i].match(/ -p udp /g) || []).length > 1)
					cs += `${policy_type===PolicyTypesMap.get('IPv4:SNAT') ? lines[i].replace(/ -j SNAT -p udp /, ' -j SNAT ') : lines[i].replace(/ -j DNAT -p udp /, ' -j DNAT ')}\n`;
				else cs += `${lines[i]}\n`;
			}
		}

		// Accounting ,logging and marking is not allowed with SNAT and DNAT chains.
		if (policy_type <= PolicyTypesMap.get('IPv4:FORWARD')) {
			if (acc_chain) {
				cs = `${cmd} -N ${acc_chain}\n` +
					`${cmd} -A ${acc_chain} -j ${(log_chain) ? log_chain : "RETURN"}\n` +
					`${cs}`;
			}

			if (log_chain) {
				cs = `${cmd} -N ${log_chain}\n` +
					`${cmd} -A ${log_chain} -m limit --limit 60/minute -j LOG --log-level info --log-prefix "RULE ID ${ruleData.id} [${after_log_action}] "\n` +
					`${cmd} -A ${log_chain} -j ${after_log_action}\n` +
					`${cs}`;
			}

			if (parseInt(ruleData.mark_code) !== 0) {
				table = '-t mangle';

				action = `MARK --set-mark ${ruleData.mark_code}`;
				cs_trail = `${stateful} -j ${action}\n`
				cs += PolicyCompilerTools.generateCompilationString(`${ruleData.id}-M1`, position_items, `${cmd} -t mangle -A ${MARK_CHAIN[policy_type]} `, cs_trail, table, stateful, action, cmd);
				// Add the mark to the PREROUTING chain of the mangle table.
				if (policy_type === PolicyTypesMap.get('IPv4:FORWARD')) {
					let str:string = PolicyCompilerTools.generateCompilationString(`${ruleData.id}-M1`, position_items, `${cmd} -t mangle -A PREROUTING `, cs_trail, table, stateful, action, cmd);
					str = str.replace(/-o \w+ /g, "")
					cs += str;
				}

				action = `CONNMARK --save-mark`;
				cs_trail = `${stateful} -j ${action}\n`
				cs += PolicyCompilerTools.generateCompilationString(`${ruleData.id}-M2`, position_items, `${cmd} -t mangle -A ${MARK_CHAIN[policy_type]} `, cs_trail, table, stateful, action, cmd);
				// Add the mark to the PREROUTING chain of the mangle table.
				if (policy_type === PolicyTypesMap.get('IPv4:FORWARD')) {
					let str:string = PolicyCompilerTools.generateCompilationString(`${ruleData.id}-M2`, position_items, `${cmd} -t mangle -A PREROUTING `, cs_trail, table, stateful, action, cmd);
					str = str.replace(/-o \w+ /g, "")
					cs += str;
				}
			}
		}
		
		return PolicyCompilerTools.afterCompilation(ruleData,cs);
	}
}