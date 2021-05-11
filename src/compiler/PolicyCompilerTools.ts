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

import { PolicyTypesMap } from '../models/policy/PolicyType';
var fwcError = require('../utils/error_table');
var shellescape = require('shell-escape');

export const RuleActionsMap = new Map<string, number>([
  ['ACCEPT',1],  ['DROP',2],  ['REJECT',3],  ['ACCOUNTING',4]
]);

export const ACTION = ['', 'ACCEPT', 'DROP', 'REJECT', 'ACCOUNTING' ];

export const POLICY_TYPE = ['', 'INPUT', 'OUTPUT', 'FORWARD', 'POSTROUTING', 'PREROUTING'];
POLICY_TYPE[61] = 'INPUT'; // IPv6
POLICY_TYPE[62] = 'OUTPUT'; // IPv6
POLICY_TYPE[63] = 'FORWARD'; // IPv6
POLICY_TYPE[64] = 'POSTROUTING'; // IPv6
POLICY_TYPE[65] = 'PREROUTING'; // IPv6

export const MARK_CHAIN = ['', 'INPUT', 'OUTPUT', 'FORWARD'];

export type IPTablesRuleCompiled = {
    id: number;
    active: number;
    comment: string;
    cs: string;
}

type CompiledPosition = {
  negate: boolean;
  str: string[];
}

export abstract class PolicyCompilerTools {
  protected _ruleData: any;
	protected _policyType: number;
	protected _cs: string;
	protected _cmd: string;
	protected _afterLogAction: string;
	protected _logChain: string; 
	protected _accChain: string; 
	protected _csEnd: string; 
	protected _stateful: string; 
	protected _table: string; 
	protected _action: string;
	protected _comment: string;
  private _compiledPositions: CompiledPosition[];

  private validPolicyType(): boolean {
    return (this._policyType === PolicyTypesMap.get('IPv4:INPUT') || 
            this._policyType === PolicyTypesMap.get('IPv4:OUTPUT') ||
            this._policyType === PolicyTypesMap.get('IPv4:FORWARD') ||
            this._policyType === PolicyTypesMap.get('IPv4:SNAT') ||
            this._policyType === PolicyTypesMap.get('IPv4:DNAT') ||
            this._policyType === PolicyTypesMap.get('IPv6:INPUT') ||
            this._policyType === PolicyTypesMap.get('IPv6:OUTPUT') || 
            this._policyType === PolicyTypesMap.get('IPv6:FORWARD') ||
            this._policyType === PolicyTypesMap.get('IPv6:SNAT') ||
            this._policyType === PolicyTypesMap.get('IPv6:DNAT'));
  }


  protected ruleComment(): string {
    let metaData = {};
    let comment:string = this._ruleData.comment ? this._ruleData.comment : '';
    // Avoid the presence of the ' character, used as comment delimiter for the iptables command.
    comment = comment.trim().replace(/'/g, '"'); 

    if (this._ruleData.style) metaData['fwc_rs'] = this._ruleData.style;
    if (this._ruleData.group_name) metaData['fwc_rgn'] = this._ruleData.group_name;
    if (this._ruleData.group_style) metaData['fwc_rgs'] = this._ruleData.group_style;

    if (JSON.stringify(metaData) !== '{}') comment = `${JSON.stringify(metaData)}${comment}`;

    if (comment) {
      // IPTables comment extension allows you to add comments (up to 256 characters) to any rule.
      comment = shellescape([comment]).substring(0,250);
      // Comment must start and and end with ' character.
      if (comment.charAt(0) !== "'") comment =`'${comment}`;
      if (comment.charAt(comment.length-1) !== "'") comment =`${comment}'`;
      comment = `-m comment --comment ${comment.replace(/\r/g,' ').replace(/\n/g,' ')} `;
    }

    return comment;
  }


  public static isPositionNegated(negate, position) {
    if (!negate) return false;

    let negate_position_list = negate.split(' ').map(val => { return parseInt(val) });
    // If the position that we want negate is already in the list, don't add again to the list.
    for (let pos of negate_position_list) {
        if (pos === position) return true;
    }

    return false;
  }


	protected beforeCompilation(): void {
		if (!this.validPolicyType()) throw(new Error('Invalid policy type'));

		// The compilation process for IPv6 is the same that the one for IPv4.
		if (this._policyType >= PolicyTypesMap.get('IPv6:INPUT')) {
			this._policyType -= 60;
			this._ruleData.type -= 60;
			this._ruleData.ip_version = 6;
		} else this._ruleData.ip_version = 4;	

		if (this._policyType === PolicyTypesMap.get('IPv4:SNAT')) { // SNAT
			this._table = "-t nat";
			this._cs += this._table + ` -A POSTROUTING ${this._comment}`;
			this._action = this.natAction();
		}
		else if (this._policyType === PolicyTypesMap.get('IPv4:DNAT')) { // DNAT
			this._table = "-t nat";
			this._cs += this._table + ` -A PREROUTING ${this._comment}`;
			this._action = this.natAction();
		}
		else { // Filter policy
			if (!(this._ruleData.positions)
				|| !(this._ruleData.positions[0].ipobjs) || !(this._ruleData.positions[1].ipobjs) || !(this._ruleData.positions[2].ipobjs)
				|| (this._policyType === PolicyTypesMap.get('IPv4:FORWARD') && !(this._ruleData.positions[3].ipobjs))) {
				throw(new Error("Bad rule data"));
			}

			this._cs += `-A ${POLICY_TYPE[this._policyType]} ${this._comment}`;

			if (this._ruleData.special === 1) // Special rule for ESTABLISHED,RELATED packages.
				this._action = "ACCEPT";
			else if (this._ruleData.special === 2) // Special rule for catch-all.
				this._action = ACTION[this._ruleData.action];
			else {
				this._action = ACTION[this._ruleData.action];
				if (this._action === "ACCEPT") {
					if (this._ruleData.options & 0x0001) // Stateful rule.
						this._stateful = "-m conntrack --ctstate  NEW ";
					else if ((this._ruleData.firewall_options & 0x0001) && !(this._ruleData.options & 0x0002)) // Statefull firewall and this rule is not stateless.
						this._stateful = "-m conntrack --ctstate  NEW ";
					}
				else if (this._action === "ACCOUNTING") {
					this._accChain = "FWCRULE" + this._ruleData.id + ".ACC";
					this._action = this._accChain;
				}
			}

			// If log all rules option is enabled or log option for this rule is enabled.
			if ((this._ruleData.firewall_options & 0x0010) || (this._ruleData.options & 0x0004)) {
				this._logChain = "FWCRULE" + this._ruleData.id + ".LOG";
				if (!this._accChain) {
					this._afterLogAction = this._action;
					this._action = this._logChain;
				} else
					this._afterLogAction = "RETURN";
			}
		}

		if (parseInt(this._ruleData.special) === 1) // Special rule for ESTABLISHED,RELATED packages.
			this._csEnd = `-m conntrack --ctstate ESTABLISHED,RELATED -j ${this._action}\n`;
		else
			this._csEnd = `${this._stateful} -j ${this._action}\n`;
	}


  protected afterCompilation(): string {
    // Replace two consecutive spaces by only one.
    this._cs = this._cs.replace(/  +/g, ' ');

    // Apply rule only to the selected firewall.
    if (this._ruleData.fw_apply_to && this._ruleData.firewall_name)
      this._cs = "if [ \"$HOSTNAME\" = \"" + this._ruleData.firewall_name + "\" ]; then\n" + this._cs + "fi\n";

    // Include before and/or after rule script code.
    if (this._ruleData.run_before) this._cs = `###########################\n# Before rule load code:\n${this._ruleData.run_before}\n###########################\n${this._cs}`;
    if (this._ruleData.run_after) this._cs += `###########################\n# After rule load code:\n${this._ruleData.run_after}\n###########################\n`;
  
    return this._cs;
  }


  /*
      multiport

      This module matches a set of source or destination ports. Up to 15 ports can be specified. A port range (port:port) counts as two ports. It can only be used in conjunction with -p tcp or -p udp.
      --source-ports [!] port[,port[,port:port...]]
      Match if the source port is one of the given ports. The flag --sports is a convenient alias for this option.
      --destination-ports [!] port[,port[,port:port...]]
      Match if the destination port is one of the given ports. The flag --dports is a convenient alias for this option.
      --ports [!] port[,port[,port:port...]]
      Match if either the source or destination ports are equal to one of the given ports.
  */
  private portsLimitControl(proto: 'tcp' | 'udp', portsStr: string, items) {
    const portsList = portsStr.split(',');

    //tcpPorts = tcpPorts.indexOf(",") > -1 ? `-p ${proto} -m multiport --dports ${tcpPorts}` : ;
    if (portsList.length === 1)
      items.str.push(`-p ${proto} --dport ${portsStr}`);
    else { // Up to 15 ports can be specified. A port range (port:port) counts as two ports.
      let n = 0;
      let currentPorts: string[] = [];
      for(let port of portsList) {
        // Is the current port a port range (port:port)?
        n += port.indexOf(':') === -1 ? 1 : 2;

        if (n <= 15) 
          currentPorts.push(port);
        else {
          items.str.push(`-p ${proto} -m multiport --dports ${currentPorts.join(',')}`);
          currentPorts = [];
          currentPorts.push(port);
          n = port.indexOf(':') === -1 ? 1 : 2;
        }
      } 
      items.str.push(`-p ${proto} -m multiport --dports ${currentPorts.join(',')}`);
    }
  }
          

  private preCompileSrcDst(dir: '' | '-s ' | '-d ', sd: any, negate: boolean, ipv: 4 | 6) {
    let items: CompiledPosition = { negate: negate, str: [] };

    for (let i = 0; i < sd.length; i++) {
      if (sd[i].type === 9) // DNS
        items.str.push(`${dir}${sd[i].name}`);
      else if (ipv === sd[i].ip_version) { // Only add this type of IP objects if they have the same IP version than the compiled rule.
        if (sd[i].type === 5) // Address
          items.str.push(`${dir}${sd[i].address}`);
        else if (sd[i].type === 7) // Network
          items.str.push(`${dir}${sd[i].address}/${sd[i].netmask.replace('/', '')}`);
        else if (sd[i].type === 6) // Address range
          items.str.push((dir !== '' ? `-m iprange ${(dir === '-s ' ? '--src-range ' : '--dst-range ')}` : ' ') + `${sd[i].range_start}-${sd[i].range_end}`);
      }
    }

    return ((items.str.length > 0) ? items : null);
  }


  private preCompileInterface(dir: '-o ' | '-i ', ifs: any, negate: boolean) {
    let items: CompiledPosition = { negate: negate, str: [] };

    for (var i = 0; i < ifs.length; i++)
      items.str.push(`${dir}${ifs[i].name}`);

    return ((items.str.length > 0) ? items : null);
  }


  /**
   * Group services position by protocol number (TCP, UDP, ICMP, etc.) 
   * Returns an array of strings with the services grouped by protocol.
   * 
   * @param sep 
   * @param svc 
   * @param negate 
   * @param ipv 
   */
  private preCompileSvc(sep: '-' | ':', svc: any, negate: boolean, ipv: 4 | 6) {
    let items: CompiledPosition = { negate: negate, str: [] };
    let tcpPorts = '';
    let udpPorts = '';
    let tmp = '';

    for (var i = 0; i < svc.length; i++) {
      switch (svc[i].protocol) { // PROTOCOL NUMBER
        case 6: // TCP
          const mask = svc[i].tcp_flags_mask;

          if (!mask || mask === 0) { // No TCP flags.
            if (svc[i].source_port_end===0 || svc[i].source_port_end===null) { // No source port.
              if (tcpPorts)
                tcpPorts += ',';
              tcpPorts += (svc[i].destination_port_start === svc[i].destination_port_end) ? svc[i].destination_port_start : `${svc[i].destination_port_start}${sep}${svc[i].destination_port_end}`;
            } else {
              tmp = `-p tcp --sport ${svc[i].source_port_start === svc[i].source_port_end ? svc[i].source_port_start : `${svc[i].source_port_start}${sep}${svc[i].source_port_end}`}`;
              if (svc[i].destination_port_end !== 0)
                tmp += ` --dport ${svc[i].destination_port_start === svc[i].destination_port_end ? svc[i].destination_port_start : `${svc[i].destination_port_start}${sep}${svc[i].destination_port_end}`}`;
              items.str.push(tmp);
            }
          }
          else { // Add the TCP flags.
            tmp = '-p tcp';
            if (svc[i].source_port_end!==0 && svc[i].source_port_end!==null) // Exists source port
              tmp += ` --sport ${svc[i].source_port_start === svc[i].source_port_end ? svc[i].source_port_start : `${svc[i].source_port_start}${sep}${svc[i].source_port_end}`}`;
            if (svc[i].destination_port_end!==0 && svc[i].destination_port_end!==null) // Exists destination port
              tmp += ` --dport ${svc[i].destination_port_start === svc[i].destination_port_end ? svc[i].destination_port_start : `${svc[i].destination_port_start}${sep}${svc[i].destination_port_end}`}`;
            tmp += ` --tcp-flags `;

            // If all mask bits are set.
            if (mask === 0b00111111)
              tmp += 'ALL ';
            else {
              // Compose the mask.
              if (mask & 0b00000001) // URG
                tmp += 'URG,';
              if (mask & 0b00000010) // ACK
                tmp += 'ACK,';
              if (mask & 0b00000100) // PSH
                tmp += 'PSH,';
              if (mask & 0b00001000) // RST
                tmp += 'RST,';
              if (mask & 0b00010000) // SYN
                tmp += 'SYN,';
              if (mask & 0b00100000) // FIN
                tmp += 'FIN,';
              tmp = tmp.replace(/.$/, ' ');
            }

            // Compose the flags that must be set.
            const settings = svc[i].tcp_flags_settings;
            if (!settings || settings === 0)
              tmp += ' NONE';
            else {
              // Compose the mask.
              if (settings & 0b00000001) // URG
                tmp += 'URG,';
              if (settings & 0b00000010) // ACK
                tmp += 'ACK,';
              if (settings & 0b00000100) // PSH
                tmp += 'PSH,';
              if (settings & 0b00001000) // RST
                tmp += 'RST,';
              if (settings & 0b00010000) // SYN
                tmp += 'SYN,';
              if (settings & 0b00100000) // FIN
                tmp += 'FIN,';
              tmp = tmp.substring(0, tmp.length - 1);
            }

            items.str.push(tmp);
          }
          break;

        case 17: // UDP
          if (svc[i].source_port_end===0 || svc[i].source_port_end===null) { // No source port.
            if (udpPorts)
              udpPorts += ',';
            udpPorts += `${svc[i].destination_port_start === svc[i].destination_port_end ? svc[i].destination_port_start : `${svc[i].destination_port_start}${sep}${svc[i].destination_port_end}`}`;
          } else {
            tmp = `-p udp --sport ${svc[i].source_port_start === svc[i].source_port_end ? svc[i].source_port_start : `${svc[i].source_port_start}${sep}${svc[i].source_port_end}`}`;
            if (svc[i].destination_port_end !== 0)
              tmp += ` --dport ${svc[i].destination_port_start === svc[i].destination_port_end ? svc[i].destination_port_start : `${svc[i].destination_port_start}${sep}${svc[i].destination_port_end}`}`;
            items.str.push(tmp);
          }
          break;

        case 1: // ICMP
          const shared = (ipv === 4) ? '-p icmp -m icmp --icmp-type' : '-p icmpv6 -m ipv6-icmp --icmpv6-type';

          if (svc[i].icmp_type === -1 && svc[i].icmp_code === -1) // Any ICMP
            items.str.push(`${shared} any`);
          else if (svc[i].icmp_type !== -1 && svc[i].icmp_code === -1)
            items.str.push(`${shared} ${svc[i].icmp_type}`);
          else if (svc[i].icmp_type !== -1 && svc[i].icmp_code !== -1)
            items.str.push(`${shared} ${svc[i].icmp_type}/${svc[i].icmp_code}`);
          break;

        default: // Other IP protocols.
          items.str.push(`-p ${svc[i].protocol}`);
          break;
      }
    }

    if (tcpPorts) {
      if (sep === ':') this.portsLimitControl('tcp',tcpPorts,items);
      else items.str.push(tcpPorts);
    }
    if (udpPorts) {
      if (sep === ':') this.portsLimitControl('udp',udpPorts,items);
      else items.str.push(udpPorts);
    }

    return ((items.str.length > 0) ? items : null);
  }


  private natAction(): string {
    if (this._ruleData.positions[4].ipobjs.length > 1 || this._ruleData.positions[5].ipobjs.length > 1)
      throw(fwcError.other('Translated fields must contain a maximum of one item'));

    if (this._policyType === PolicyTypesMap.get('IPv4:SNAT') && this._ruleData.positions[4].ipobjs.length === 0) {
      if (this._ruleData.positions[5].ipobjs.length === 0) return 'MASQUERADE';
      throw(fwcError.other("For SNAT 'Translated Service' must be empty if 'Translated Source' is empty"));
    }

    // For DNAT the translated destination is mandatory.
    if (this._policyType === PolicyTypesMap.get('IPv4:DNAT') && this._ruleData.positions[4].ipobjs.length === 0)
      throw(fwcError.other("For DNAT 'Translated Destination' is mandatory"));

    // Only TCP and UDP protocols are allowed for the translated service position.
    if (this._ruleData.positions[5].ipobjs.length === 1 && this._ruleData.positions[5].ipobjs[0].protocol !== 6 && this._ruleData.positions[5].ipobjs[0].protocol !== 17)
      throw(fwcError.other("For 'Translated Service' only protocols TCP and UDP are allowed"));

    let protocol = ' ';
    if (this._ruleData.positions[5].ipobjs.length === 1) 
      protocol = (this._ruleData.positions[5].ipobjs[0].protocol==6) ? ' -p tcp ' : ' -p udp ';

    let action = (this._policyType === PolicyTypesMap.get('IPv4:SNAT')) ? `SNAT${protocol}--to-source ` : `DNAT${protocol}--to-destination `;

    if (this._ruleData.positions[4].ipobjs.length === 1)
      action += (this.preCompileSrcDst('', this._ruleData.positions[4].ipobjs, false, this._ruleData.ip_version)).str[0];
    if (this._ruleData.positions[5].ipobjs.length === 1)
      action += ":" + (this.preCompileSvc('-', this._ruleData.positions[5].ipobjs, false, this._ruleData.ip_version)).str[0];

    return action;
  }


  /**
   * This function will return an array of arrays of strings. 
   * Each array will contain the pre-compiled strings for the items of each rule position.
   * 
   * @param this._ruleData 
   */
  protected preCompile(): void {
    this._compiledPositions = [];
    let items, src_position, dst_position, svc_position, dir, objs, negated;
    let i, j, p;

    if (this._policyType === PolicyTypesMap.get('IPv4:FORWARD')) { src_position = 2; dst_position = 3; svc_position = 4; }
    else { src_position = 1; dst_position = 2; svc_position = 3; }

    // Generate items strings for all the rule positions.
    // WARNING: The order of creation of the arrays is important for optimization!!!!
    // The positions first in the array will be used first in the conditions.
    // INTERFACE IN / OUT
    dir = (this._policyType === PolicyTypesMap.get('IPv4:OUTPUT') || this._policyType === PolicyTypesMap.get('IPv4:SNAT')) ? '-o ' : '-i ';
    objs = this._ruleData.positions[0].ipobjs;
    negated = PolicyCompilerTools.isPositionNegated(this._ruleData.negate, this._ruleData.positions[0].id);
    if (items = this.preCompileInterface(dir, objs, negated))
        this._compiledPositions.push(items);

    // INTERFACE OUT
    if (this._policyType === PolicyTypesMap.get('IPv4:FORWARD')) {
        objs = this._ruleData.positions[1].ipobjs;
        negated = PolicyCompilerTools.isPositionNegated(this._ruleData.negate, this._ruleData.positions[1].id);
        if (items = this.preCompileInterface('-o ', objs, negated))
            this._compiledPositions.push(items);
    }

    // SERVICE
    objs = this._ruleData.positions[svc_position].ipobjs;
    negated = PolicyCompilerTools.isPositionNegated(this._ruleData.negate, this._ruleData.positions[svc_position].id);
    if (items = this.preCompileSvc(":", objs, negated, this._ruleData.ip_version))
        this._compiledPositions.push(items);

    // SOURCE
    objs = this._ruleData.positions[src_position].ipobjs;
    negated = PolicyCompilerTools.isPositionNegated(this._ruleData.negate, this._ruleData.positions[src_position].id);
    if (items = this.preCompileSrcDst('-s ', objs, negated, this._ruleData.ip_version))
        this._compiledPositions.push(items);

    // DESTINATION
    objs = this._ruleData.positions[dst_position].ipobjs;
    negated = PolicyCompilerTools.isPositionNegated(this._ruleData.negate, this._ruleData.positions[dst_position].id);
    if (items = this.preCompileSrcDst('-d ', objs, negated, this._ruleData.ip_version))
        this._compiledPositions.push(items);

    // Order the resulting array by number of strings into each array.
    if (this._compiledPositions.length < 2) // Don't need ordering.
        return;
    for (i = 0; i < this._compiledPositions.length; i++) {
        for (p = i, j = i + 1; j < this._compiledPositions.length; j++) {
            if (this._compiledPositions[j].str.length < this._compiledPositions[p].str.length)
                p = j;
        }
        const tmp = this._compiledPositions[i];
        this._compiledPositions[i] = this._compiledPositions[p];
        this._compiledPositions[p] = tmp;
    }

    // If we have only one item, no further process is required.
    if (this._compiledPositions.length === 1)
        return;

    // If we have negated positions and not negated positions, then move the negated positions to the end of the array.
    var position_items_not_negate = [];
    var position_items_negate = [];
    for (i = 0; i < this._compiledPositions.length; i++) {
        // Is this position item is negated, search for the next one no negated.
        if (!(this._compiledPositions[i].negate))
            position_items_not_negate.push(this._compiledPositions[i]);
        else
            position_items_negate.push(this._compiledPositions[i]);
    }

    this._compiledPositions =  position_items_not_negate.concat(position_items_negate);
  }


  protected generateCompilationString(id: string, cs: string): string {
    // Rule compilation process.
    if (this._compiledPositions.length === 0) // No conditions rule.
        cs += this._csEnd;
    else if (this._compiledPositions.length === 1 && !(this._compiledPositions[0].negate)) { // One condition rule and no negated position.
        if (this._compiledPositions[0].str.length === 1) // Only one item in the condition.
            cs += this._compiledPositions[0].str[0] + " " + this._csEnd;
        else { // Multiple items in the condition.
            var cs1 = cs;
            cs = "";
            for (var i = 0; i < this._compiledPositions[0].str.length; i++)
                cs += cs1 + this._compiledPositions[0].str[i] + " " + this._csEnd;
        }
    } else { // Multiple condition rules or one condition rule with the condition (position) negated.
        for (var i = 0, j, chain_number = 1, chain_name = "", chain_next = ""; i < this._compiledPositions.length; i++) {
            // We have the position_items array ordered by arrays length.
            if (this._compiledPositions[i].str.length === 1 && !(this._compiledPositions[i].negate))
                cs += this._compiledPositions[i].str[0] + " ";
            else {
                chain_name = "FWCRULE" + id + ".CH" + chain_number;
                // If we are in the first condition and it is not negated.
                if (i === 0 && !(this._compiledPositions[i].negate)) {
                    var cs1 = cs;
                    cs = "";
                    for (let j = 0; j < this._compiledPositions[0].str.length; j++)
                        cs += cs1 + this._compiledPositions[0].str[j] + ((j < (this._compiledPositions[0].str.length - 1)) ? " " + this._stateful + " -j " + chain_name + "\n" : " ");
                } else {
                    if (!(this._compiledPositions[i].negate)) {
                        // If we are at the end of the array, the next chain will be the rule action.
                        chain_next = (i === ((this._compiledPositions.length) - 1)) ? this._action : "FWCRULE" + id + ".CH" + (chain_number + 1);
                    } else { // If the position is negated.
                        chain_next = "RETURN";
                    }

                    cs = `${this._cmd} ${this._table} -N ${chain_name}\n${cs}${((chain_number === 1) ? this._stateful + " -j " + chain_name + "\n" : "")}`;
                    for (j = 0; j < this._compiledPositions[i].str.length; j++) {
                        cs += `${this._cmd} ${this._table} -A ${chain_name} ${this._compiledPositions[i].str[j]} -j ${chain_next}\n`;
                    }
                    chain_number++;

                    if (this._compiledPositions[i].negate)
                        cs += `${this._cmd} ${this._table} -A ${chain_name} -j ${((i === ((this._compiledPositions.length) - 1)) ? this._action : "FWCRULE" + id + ".CH" + chain_number)}\n`;
                }
            }
        }

        // If we have not used IPTABLES user defined chains.
        if (chain_number === 1)
          cs += this._csEnd;
    }

    return cs;
  }

	protected addAccounting(): void {
		// Accounting, logging and marking is not allowed with SNAT and DNAT chains.
		if (this._accChain && this._policyType <= PolicyTypesMap.get('IPv4:FORWARD')) {
			this._cs = `${this._cmd} -N ${this._accChain}\n` +
				`${this._cmd} -A ${this._accChain} -j ${(this._logChain) ? this._logChain : "RETURN"}\n` +
				`${this._cs}`;
		}
	}


	protected addLog(): void {
		// Accounting, logging and marking is not allowed with SNAT and DNAT chains.
		if (this._logChain && this._policyType <= PolicyTypesMap.get('IPv4:FORWARD')) {
			this._cs = `${this._cmd} -N ${this._logChain}\n` +
				`${this._cmd} -A ${this._logChain} -m limit --limit 60/minute -j LOG --log-level info --log-prefix "RULE ID ${this._ruleData.id} [${this._afterLogAction}] "\n` +
				`${this._cmd} -A ${this._logChain} -j ${this._afterLogAction}\n` +
				`${this._cs}`;
		}
	}


	protected addMark(): void {
		// Accounting, logging and marking is not allowed with SNAT and DNAT chains.
		if (parseInt(this._ruleData.mark_code) !== 0 && this._policyType <= PolicyTypesMap.get('IPv4:FORWARD')) {
			this._table = '-t mangle';

			this._action = `MARK --set-mark ${this._ruleData.mark_code}`;
			this._csEnd = `${this._stateful} -j ${this._action}\n`
			this._cs += this.generateCompilationString(`${this._ruleData.id}-M1`, `${this._cmd} -t mangle -A ${MARK_CHAIN[this._policyType]} `);
			// Add the mark to the PREROUTING chain of the mangle table.
			if (this._policyType === PolicyTypesMap.get('IPv4:FORWARD')) {
				let str:string = this.generateCompilationString(`${this._ruleData.id}-M1`, `${this._cmd} -t mangle -A PREROUTING `);
				str = str.replace(/-o \w+ /g, "")
				this._cs += str;
			}

			this._action = `CONNMARK --save-mark`;
			this._csEnd = `${this._stateful} -j ${this._action}\n`
			this._cs += this.generateCompilationString(`${this._ruleData.id}-M2`, `${this._cmd} -t mangle -A ${MARK_CHAIN[this._policyType]} `);
			// Add the mark to the PREROUTING chain of the mangle table.
			if (this._policyType === PolicyTypesMap.get('IPv4:FORWARD')) {
				let str:string = this.generateCompilationString(`${this._ruleData.id}-M2`, `${this._cmd} -t mangle -A PREROUTING `);
				str = str.replace(/-o \w+ /g, "")
				this._cs += str;
			}
		}
	}
}