/*
    Copyright 2022 SOLTECSIS SOLUCIONES TECNOLOGICAS, SLU
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
import { AvailablePolicyCompilers } from './PolicyCompiler';
import { SpecialRuleCode, RuleOptionsMask } from '../../models/Policy/PolicyRule';
const ip = require('ip');
const fwcError = require('../../utils/error_table');
const shellescape = require('shell-escape');

export const RuleActionsMap = new Map<string, number>([
  ['ACCEPT',1],  ['DROP',2],  ['REJECT',3],  ['ACCOUNTING',4]
]);

export const POLICY_TYPE = ['', 'INPUT', 'OUTPUT', 'FORWARD', 'POSTROUTING', 'PREROUTING'];
POLICY_TYPE[61] = 'INPUT'; // IPv6
POLICY_TYPE[62] = 'OUTPUT'; // IPv6
POLICY_TYPE[63] = 'FORWARD'; // IPv6
POLICY_TYPE[64] = 'POSTROUTING'; // IPv6
POLICY_TYPE[65] = 'PREROUTING'; // IPv6

export const MARK_CHAIN = ['', 'INPUT', 'OUTPUT', 'FORWARD'];

const CompilerDir = new Map<string, string>([
  ['IPTables:IN', '-i'],     ['NFTables:IN', 'iifname'],
  ['IPTables:OUT', '-o'],    ['NFTables:OUT', 'oifname'],
  ['IPTables:SRC', '-s'],    ['NFTables:SRC', 'saddr'],
  ['IPTables:DST', '-d'],    ['NFTables:DST', 'daddr'],
]);

export const CompilerAction = new Map<string, string>([
  ['IPTables:1', 'ACCEPT'],     ['NFTables:1', 'counter accept'],
  ['IPTables:2', 'DROP'],       ['NFTables:2', 'counter drop'],
  ['IPTables:3', 'REJECT'],     ['NFTables:3', 'counter reject'],
  ['IPTables:4', 'ACCOUNTING'], ['NFTables:4', 'ACCOUNTING'],
]);

export type RuleCompilationResult = {
    id: number;
    active: number;
    comment: string;
    cs: string;
}

type CompiledPosition = {
  negate: boolean;
  items: string[];
}

export abstract class PolicyCompilerTools {
  protected _compiler: AvailablePolicyCompilers;
  protected _ruleData: any;
	protected _policyType: number;
	protected _cs: string;
	protected _cmd: string;
	private _afterLogAction = '';
	private _logChain = ''; 
	private _accChain = ''; 
	private _csEnd = ''; 
	private _stateful = '';
  private _family: string; 
	private _table = ''; 
	private _action = '';
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

    if (this._ruleData.style) metaData['fwc_rs'] = this._ruleData.style;
    if (this._ruleData.group_name) metaData['fwc_rgn'] = this._ruleData.group_name;
    if (this._ruleData.group_style) metaData['fwc_rgs'] = this._ruleData.group_style;

    if (JSON.stringify(metaData) !== '{}') comment = `${JSON.stringify(metaData)}${comment}`;

    comment = comment.trim();

    if (comment.length > 0) {
      if (this._compiler === 'IPTables') {
        // Avoid the presence of the ' character, used as comment delimiter for the iptables command.
        comment = comment.replace(/'/g, '"'); 

        // IPTables comment extension allows you to add comments (up to 256 characters) to any rule.
        comment = shellescape([comment]).substring(0,250);
        // Comment must start and and end with ' character.
        if (comment.charAt(0) !== "'") comment =`'${comment}`;
        if (comment.charAt(comment.length-1) !== "'") comment =`${comment}'`;
        comment = `-m comment --comment ${comment.replace(/\r/g,' ').replace(/\n/g,' ')} `;
      } else { // NFTables compiler.
        comment = comment.replace(/"/g,"'"); 
        comment = comment.trim().replace(/(['$`\\&><!()|])/g,'\\$1'); 

        // Comment must start and and end with \" characters.
        comment = ` comment \\"${comment.replace(/\r/g,' ').replace(/\n/g,' ')}\\"\n`;
      }
    }

    return comment;
  }


  public static isPositionNegated(negate: string, position: number): boolean {
    if (!negate) return false;

    let negatedPositionsList = negate.split(' ').map(val => { return parseInt(val) });
    // If the position that we want negate is already in the list, don't add again to the list.
    for (let pos of negatedPositionsList) {
        if (pos === position) return true;
    }

    return false;
  }


  protected specialRuleCompilation(): void {
    // SPECIAL POLICY RULES
    switch(this._ruleData.special) {
      case SpecialRuleCode.get('STATEFUL'): // Special rule for ESTABLISHED,RELATED packages.
        this._csEnd = `${this._compiler=='IPTables' ? '-m conntrack --ctstate ESTABLISHED,RELATED -j' : 'ct state related,established'} ${this._action}\n`;
        break;

      case SpecialRuleCode.get('CROWDSEC'): 
        const setName = `crowdsec${this._family==='ip6' ? '6' : ''}-blacklists`;
        this._csEnd = `${this._compiler=='IPTables' ? `-m set --match-set ${setName} src -j` : `ip saddr . ip daddr vmap @${setName}`} ${this._action}\n`;
        break;

      case SpecialRuleCode.get('DOCKER'):
        if (this._policyType === PolicyTypesMap.get('IPv4:OUTPUT') || this._policyType === PolicyTypesMap.get('IPv6:OUTPUT')) {
          this._csEnd = `${this._compiler=='IPTables' ? '! -d 127.0.0.0/8 -m addrtype --dst-type LOCAL -j DOCKER' : 'ip daddr != 127.0.0.0/8 fib daddr type local counter jump DOCKER'}\n`;
        } else if (this._policyType === PolicyTypesMap.get('IPv4:FORWARD') || this._policyType === PolicyTypesMap.get('IPv6:FORWARD')) {
          this._csEnd = `${this._compiler=='IPTables' ? '-j DOCKER-USER' : 'counter jump DOCKER-USER'}\n`;
          this._csEnd += `${this._compiler=='IPTables' ? '$IPTABLES -A FORWARD -j DOCKER-ISOLATION-STAGE-1' : '$NFT add rule ip filter FORWARD counter jump DOCKER-ISOLATION-STAGE-1'}\n`;
        }
        break;

      default:
        this._csEnd = `${this._stateful} ${this._compiler=='IPTables' ? '-j ' :''}${this._action}\n`;
        break;
    }
  }


	protected beforeCompilation(): void {
		if (!this.validPolicyType()) throw(new Error('Invalid policy type'));

		// The compilation process for IPv6 is the same that the one for IPv4.
		if (this._policyType >= PolicyTypesMap.get('IPv6:INPUT')) {
			this._policyType -= 60;
			this._ruleData.type -= 60;
			this._ruleData.ip_version = 6;
      this._family = 'ip6';
		} else {
      this._family = 'ip';
      this._ruleData.ip_version = 4;
    }	

		if (this._policyType===PolicyTypesMap.get('IPv4:SNAT') || this._policyType===PolicyTypesMap.get('IPv4:DNAT')) { // SNAT / DNAT
      const chain = this._policyType===PolicyTypesMap.get('IPv4:SNAT') ? 'POSTROUTING' : 'PREROUTING';
      if (this._compiler === 'IPTables') {
        this._table = '-t nat';
        this._cs += this._table + ` -A ${chain} ${this._comment}`;
      } else { // NFTables
        this._table = 'nat';
        this._cs += `add rule ${this._family} ${this._table} ${chain} `;
      }
			this._action = this.natAction();
		}
		else { // Filter policy
			if (!(this._ruleData.positions)
				|| !(this._ruleData.positions[0].ipobjs) || !(this._ruleData.positions[1].ipobjs) || !(this._ruleData.positions[2].ipobjs)
				|| (this._policyType === PolicyTypesMap.get('IPv4:FORWARD') && !(this._ruleData.positions[3].ipobjs))) {
				throw(new Error("Bad rule data"));
			}

      if (this._compiler === 'IPTables')
			  this._cs += `-A ${POLICY_TYPE[this._policyType]} ${this._comment}`;
      else { // NFTables
        this._table = 'filter';
        this._cs += `add rule ${this._family} ${this._table} ${POLICY_TYPE[this._policyType]} `;  
      }

      this._ruleData.special = parseInt(this._ruleData.special);
			if (this._ruleData.special === SpecialRuleCode.get('STATEFUL')) // Special rule for ESTABLISHED,RELATED packages.
				this._action = CompilerAction.get(`${this._compiler}:1`); // 1 = ACCEPT
			else if (this._ruleData.special === SpecialRuleCode.get('CATCHALL')) // Special rule for catch-all.
				this._action = CompilerAction.get(`${this._compiler}:${this._ruleData.action}`);
			else {
				this._action = CompilerAction.get(`${this._compiler}:${this._ruleData.action}`);
				if (this._action === CompilerAction.get(`${this._compiler}:1`)) { // 1 = ACCEPT
					if (this._ruleData.options & 0x0001) // Stateful rule.
						this._stateful = this._compiler=='IPTables' ? '-m conntrack --ctstate  NEW ' : 'ct state new ';
					else if ((this._ruleData.firewall_options & RuleOptionsMask.get('STATEFUL')) && !(this._ruleData.options & RuleOptionsMask.get('CATCHALL'))) // Stateful firewall and this rule is not stateless.
            this._stateful = this._compiler=='IPTables' ? '-m conntrack --ctstate  NEW ' : 'ct state new ';
					}
				else if (this._action === "ACCOUNTING") {
					this._accChain = "FWCRULE" + this._ruleData.id + ".ACC";
					this._action = `${this._compiler == 'NFTables' ? 'jump ' : ''}${this._accChain}`;
				}
			}

			// If log all rules option is enabled or log option for this rule is enabled.
			if ((this._ruleData.firewall_options & 0x0010) || (this._ruleData.options & 0x0004)) {
				this._logChain = "FWCRULE" + this._ruleData.id + ".LOG";
				if (!this._accChain) {
					this._afterLogAction = this._action;
					this._action = `${this._compiler=='NFTables' ? 'jump ' : ''}${this._logChain}`;
				} else
					this._afterLogAction = this._compiler=='IPTables' ? 'RETURN' : 'counter return';
			}
		}
	}


  protected afterCompilation(): string {
    // In NFTables comment goes at the end.
    if (this._compiler=='NFTables' && this._comment)
      this._cs = `${this._cs.slice(0,-1)} ${this._comment}`;

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


  private compileSrcDst(dir: 'SRC' | 'DST', sd: any, negate: boolean, ipv: 4 | 6): void {
    let cmpPos: CompiledPosition = { negate: negate, items: [] };
    const opt = `${this._compiler === 'NFTables' ? (ipv===4 ? 'ip ' : 'ip6 '): ''}${CompilerDir.get(`${this._compiler}:${dir}`)}`;

    for (let i = 0; i < sd.length; i++) {
      if (sd[i].type === 9) // DNS
        cmpPos.items.push(`${opt} ${sd[i].name}`);
      else if (ipv === sd[i].ip_version) { // Only add this type of IP objects if they have the same IP version than the compiled rule.
        if (sd[i].type === 5) // Address
          cmpPos.items.push(`${opt} ${sd[i].address}`);
        else if (sd[i].type === 7) { // Network
          // We have two formats for the netmask (for example, 255.255.255.0 or /24).
          // IPTables support both formats, but NFTables only the CIDR format, for this reason we use only CIDR format.
          if (sd[i].netmask[0] === '/')
            cmpPos.items.push(`${opt} ${sd[i].address}${sd[i].netmask}`); 
          else { 
            const net = ip.subnet(sd[i].address, sd[i].netmask);
            cmpPos.items.push(`${opt} ${sd[i].address}/${net.subnetMaskLength}`); 
          }
        }
        else if (sd[i].type === 6) { // Address range
          const range = `${sd[i].range_start}-${sd[i].range_end}`;
          if (this._compiler === 'IPTables') 
            cmpPos.items.push(`-m iprange ${(dir === 'SRC' ? '--src-range' : '--dst-range')} ${range}`);
          else
            cmpPos.items.push(`${opt} ${range}`);
        }
      }
    }

    if (cmpPos.items.length > 0) this._compiledPositions.push(cmpPos);
  }


  private compileInterface(dir: 'IN' | 'OUT', ifs: any, negate: boolean): void {
    let cmpPos: CompiledPosition = { negate: negate, items: [] };
    const opt = CompilerDir.get(`${this._compiler}:${dir}`);

    for (var i = 0; i < ifs.length; i++)
      cmpPos.items.push(`${opt} ${this._compiler=='NFTables' ? '"' : ''}${ifs[i].name}${this._compiler=='NFTables' ? '"' : ''}`);

    if (cmpPos.items.length > 0) this._compiledPositions.push(cmpPos);
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
  private portsLimitControl(proto: 'tcp' | 'udp', portsStr: string, cmpPos: CompiledPosition): void {
    const portsList = portsStr.split(',');
    const sep = this._compiler=='IPTables' ? ':' : '-';

    //tcpPorts = tcpPorts.indexOf(",") > -1 ? `-p ${proto} -m multiport --dports ${tcpPorts}` : ;
    if (portsList.length === 1)
      cmpPos.items.push(`${this._compiler=='IPTables' ? `-p ${proto} --dport ${portsStr}` : `${proto} dport ${portsStr}`}`);
    else { // Up to 15 ports can be specified. A port range (port:port) counts as two ports.
      let n = 0;
      let currentPorts: string[] = [];
      for(let port of portsList) {
        // Is the current port a port range (port:port)?
        n += port.indexOf(sep) === -1 ? 1 : 2;

        if (n <= 15) 
          currentPorts.push(port);
        else {
          cmpPos.items.push(`${this._compiler=='IPTables' ? `-p ${proto} -m multiport --dports ${currentPorts.join(',')}` : `ip protocol ${proto} ${proto} dport { ${currentPorts.join(',')}}`}`);
          currentPorts = [];
          currentPorts.push(port);
          n = port.indexOf(sep) === -1 ? 1 : 2;
        }
      } 
      cmpPos.items.push(`${this._compiler=='IPTables' ? `-p ${proto} -m multiport --dports ${currentPorts.join(',')}` : `ip protocol ${proto} ${proto} dport { ${currentPorts.join(',')}}`}`);
    }
  }
              
    
  private compileSvc(svc: any, negate: boolean, ipv: 4 | 6): void {
    let cmpPos: CompiledPosition = { negate: negate, items: [] };
    let tcpPorts = '';
    let udpPorts = '';
    let tmp = '';
    const sep = this._compiler === 'IPTables' ? ':' : '-';

    for (let i = 0; i < svc.length; i++) {
      switch (svc[i].protocol) { // PROTOCOL NUMBER
        case 6: // TCP
          const mask = svc[i].tcp_flags_mask;

          if (!mask || mask === 0) { // No TCP flags.
            if (svc[i].source_port_end===0 || svc[i].source_port_end===null) { // No source port.
              if (tcpPorts)
                tcpPorts += ',';
              tcpPorts += (svc[i].destination_port_start === svc[i].destination_port_end) ? svc[i].destination_port_start : `${svc[i].destination_port_start}${sep}${svc[i].destination_port_end}`;
            } else { // With source port.
              tmp = `${this._compiler=='IPTables' ? '-p tcp --sport' : 'tcp sport'} ${svc[i].source_port_start === svc[i].source_port_end ? svc[i].source_port_start : `${svc[i].source_port_start}${sep}${svc[i].source_port_end}`}`;
              if (svc[i].destination_port_end !== 0)
                tmp += ` ${this._compiler=='IPTables' ? '--dport' : 'tcp dport'} ${svc[i].destination_port_start === svc[i].destination_port_end ? svc[i].destination_port_start : `${svc[i].destination_port_start}${sep}${svc[i].destination_port_end}`}`;
              cmpPos.items.push(tmp);
            }
          }
          else { // Add the TCP flags.
            tmp = this._compiler=='IPTables' ? '-p tcp' : '';
            if (svc[i].source_port_end!==0 && svc[i].source_port_end!==null) // Exists source port
              tmp += ` ${this._compiler=='IPTables' ? '--sport' : 'tcp sport'} ${svc[i].source_port_start === svc[i].source_port_end ? svc[i].source_port_start : `${svc[i].source_port_start}${sep}${svc[i].source_port_end}`}`;
            if (svc[i].destination_port_end!==0 && svc[i].destination_port_end!==null) // Exists destination port
              tmp += ` ${this._compiler=='IPTables' ? '--dport' : 'tcp dport'} ${svc[i].destination_port_start === svc[i].destination_port_end ? svc[i].destination_port_start : `${svc[i].destination_port_start}${sep}${svc[i].destination_port_end}`}`;
            tmp += this._compiler=='IPTables' ? ' --tcp-flags ' : ' tcp flags \\& \\(';

            // If all mask bits are set.
            if (mask === 0b00111111)
              tmp += this._compiler=='IPTables' ? 'ALL ' : 'fin\\|syn\\|rst\\|psh\\|ack\\|urg\\) == ';
            else {
              // Compose the mask.
              if (mask & 0b00000001) // URG
                tmp += this._compiler=='IPTables' ? 'URG,' : 'urg\\|';
              if (mask & 0b00000010) // ACK
                tmp += this._compiler=='IPTables' ? 'ACK,' : 'ack\\|';
              if (mask & 0b00000100) // PSH
                tmp += this._compiler=='IPTables' ? 'PSH,' : 'psh\\|';
              if (mask & 0b00001000) // RST
                tmp += this._compiler=='IPTables' ? 'RST,' : 'rst\\|';
              if (mask & 0b00010000) // SYN
                tmp += this._compiler=='IPTables' ? 'SYN,' : 'syn\\|';
              if (mask & 0b00100000) // FIN
                tmp += this._compiler=='IPTables' ? 'FIN,' : 'fin\\|';
              tmp = this._compiler=='IPTables' ? tmp.replace(/.$/, ' ') : tmp.replace(/..$/, '\\) == ');
            }

            // Compose the flags that must be set.
            const settings = svc[i].tcp_flags_settings;
            if (!settings || settings === 0)
              tmp += this._compiler=='IPTables' ? ' NONE' : '0x0';
            else {
              // Compose the mask.
              if (settings & 0b00000001) // URG
                tmp += this._compiler=='IPTables' ? 'URG,' : 'urg\\|';
              if (settings & 0b00000010) // ACK
                tmp += this._compiler=='IPTables' ? 'ACK,' : 'ack\\|';
              if (settings & 0b00000100) // PSH
                tmp += this._compiler=='IPTables' ? 'PSH,' : 'psh\\|';
              if (settings & 0b00001000) // RST
                tmp += this._compiler=='IPTables' ? 'RST,' : 'rst\\|';
              if (settings & 0b00010000) // SYN
                tmp += this._compiler=='IPTables' ? 'SYN,' : 'syn\\|';
              if (settings & 0b00100000) // FIN
                tmp += this._compiler=='IPTables' ? 'FIN,' : 'fin\\|';
              tmp = this._compiler=='IPTables' ? tmp.substring(0, tmp.length - 1) : tmp.substring(0, tmp.length - 2);
            }

            cmpPos.items.push(tmp);
          }
          break;

        case 17: // UDP
          if (svc[i].source_port_end===0 || svc[i].source_port_end===null) { // No source port.
            if (udpPorts)
              udpPorts += ',';
            udpPorts += `${svc[i].destination_port_start === svc[i].destination_port_end ? svc[i].destination_port_start : `${svc[i].destination_port_start}${sep}${svc[i].destination_port_end}`}`;
          } else {
            tmp = `${this._compiler=='IPTables' ? '-p udp --sport' : 'udp sport'} ${svc[i].source_port_start === svc[i].source_port_end ? svc[i].source_port_start : `${svc[i].source_port_start}${sep}${svc[i].source_port_end}`}`;
            if (svc[i].destination_port_end !== 0)
              tmp += ` ${this._compiler=='IPTables' ? '--dport' : 'udp dport'} ${svc[i].destination_port_start === svc[i].destination_port_end ? svc[i].destination_port_start : `${svc[i].destination_port_start}${sep}${svc[i].destination_port_end}`}`;
            cmpPos.items.push(tmp);
          }
          break;

        case 1: // ICMP
          const iptablesOpt = (ipv === 4) ? '-p icmp -m icmp --icmp-type' : '-p icmpv6 -m ipv6-icmp --icmpv6-type';

          if (svc[i].icmp_type === -1 && svc[i].icmp_code === -1) // Any ICMP
            cmpPos.items.push(`${this._compiler=='IPTables' ? `${iptablesOpt} any` : `${this._family} protocol icmp`}`);
          else if (svc[i].icmp_type !== -1 && svc[i].icmp_code === -1)
            cmpPos.items.push(this._compiler=='IPTables' ? `${iptablesOpt} ${svc[i].icmp_type}` : `icmp type ${svc[i].icmp_type}`);
          else if (svc[i].icmp_type !== -1 && svc[i].icmp_code !== -1)
            cmpPos.items.push(this._compiler=='IPTables' ?  `${iptablesOpt} ${svc[i].icmp_type}/${svc[i].icmp_code}` : `icmp type ${svc[i].icmp_type} icmp code ${svc[i].icmp_code}`);
          break;

        default: // Other IP protocols.
          cmpPos.items.push(`${this._compiler=='IPTables' ? '-p' : 'ip protocol'} ${svc[i].protocol}`);
          break;
      }
    }

    if (tcpPorts) this.portsLimitControl('tcp',tcpPorts,cmpPos);
    if (udpPorts) this.portsLimitControl('udp',udpPorts,cmpPos);

    if (cmpPos.items.length > 0) this._compiledPositions.push(cmpPos);
  }


  private natAction(): string {
    if (this._ruleData.positions[4].ipobjs.length > 1 || this._ruleData.positions[5].ipobjs.length > 1)
      throw(fwcError.other('Translated fields must contain a maximum of one item'));

    if (this._policyType === PolicyTypesMap.get('IPv4:SNAT') && this._ruleData.positions[4].ipobjs.length === 0) {
      if (this._ruleData.positions[5].ipobjs.length === 0) return (this._compiler=='IPTables' ? 'MASQUERADE' : 'counter masquerade');
      throw(fwcError.other("For SNAT 'Translated Service' must be empty if 'Translated Source' is empty"));
    }

    // For DNAT the translated destination is mandatory.
    if (this._policyType === PolicyTypesMap.get('IPv4:DNAT') && this._ruleData.positions[4].ipobjs.length === 0)
      throw(fwcError.other("For DNAT 'Translated Destination' is mandatory"));

    // Only TCP and UDP protocols are allowed for the translated service position.
    if (this._ruleData.positions[5].ipobjs.length === 1 && this._ruleData.positions[5].ipobjs[0].protocol !== 6 && this._ruleData.positions[5].ipobjs[0].protocol !== 17)
      throw(fwcError.other("For 'Translated Service' only protocols TCP and UDP are allowed"));

    let protocol = '';
    let action: string;
    if (this._compiler == 'IPTables') {
      if (this._ruleData.positions[5].ipobjs.length === 1) 
        protocol = (this._ruleData.positions[5].ipobjs[0].protocol==6) ? '-p tcp ' : '-p udp ';
      action = (this._policyType === PolicyTypesMap.get('IPv4:SNAT')) ? `SNAT ${protocol}--to-source ` : `DNAT ${protocol}--to-destination `;
    } else { // NFTables
      if (this._ruleData.positions[5].ipobjs.length === 1) 
        protocol = `${this._family} protocol ${this._ruleData.positions[5].ipobjs[0].protocol==6 ? 'tcp ' : 'udp '}`;
      action = `${protocol}counter ${this._policyType === PolicyTypesMap.get('IPv4:SNAT') ? 'snat to ' : 'dnat to '}`;
    }

    if (this._ruleData.positions[4].ipobjs.length === 1) {
      const ipobj = this._ruleData.positions[4].ipobjs[0];
      action += ` ${ipobj.address ? ipobj.address : `${ipobj.range_start}-${ipobj.range_end}`}`;
    }

    if (this._ruleData.positions[5].ipobjs.length === 1) {
      const ipobj = this._ruleData.positions[5].ipobjs[0];
      action += `:${ipobj.destination_port_start === ipobj.destination_port_end ? ipobj.destination_port_start : `${ipobj.destination_port_start}-${ipobj.destination_port_end}`}`;
    }

    return action;
  }


  protected compileRulePositions(): void {
    this._compiledPositions = [];
    let src_position: number, dst_position: number, svc_position: number, objs: any, negated: boolean;
    let dir: 'IN' | 'OUT';
    let i: number, j: number, p: number;

    if (this._policyType === PolicyTypesMap.get('IPv4:FORWARD')) { src_position = 2; dst_position = 3; svc_position = 4; }
    else { src_position = 1; dst_position = 2; svc_position = 3; }

    // Generate items strings for all the rule positions.
    // WARNING: The order of creation of the arrays is important for optimization!!!!
    // The positions first in the array will be used first in the conditions.
    // INTERFACE IN / OUT
    dir = (this._policyType === PolicyTypesMap.get('IPv4:OUTPUT') || this._policyType === PolicyTypesMap.get('IPv4:SNAT')) ? 'OUT' : 'IN';
    objs = this._ruleData.positions[0].ipobjs;
    negated = PolicyCompilerTools.isPositionNegated(this._ruleData.negate, this._ruleData.positions[0].id);
    this.compileInterface(dir, objs, negated);

    // INTERFACE OUT
    if (this._policyType === PolicyTypesMap.get('IPv4:FORWARD')) {
      objs = this._ruleData.positions[1].ipobjs;
      negated = PolicyCompilerTools.isPositionNegated(this._ruleData.negate, this._ruleData.positions[1].id);
      this.compileInterface('OUT', objs, negated);
    }

    // SERVICE
    objs = this._ruleData.positions[svc_position].ipobjs;
    negated = PolicyCompilerTools.isPositionNegated(this._ruleData.negate, this._ruleData.positions[svc_position].id);
    this.compileSvc(objs, negated, this._ruleData.ip_version);

    // SOURCE
    objs = this._ruleData.positions[src_position].ipobjs;
    negated = PolicyCompilerTools.isPositionNegated(this._ruleData.negate, this._ruleData.positions[src_position].id);
    this.compileSrcDst('SRC', objs, negated, this._ruleData.ip_version);

    // DESTINATION
    objs = this._ruleData.positions[dst_position].ipobjs;
    negated = PolicyCompilerTools.isPositionNegated(this._ruleData.negate, this._ruleData.positions[dst_position].id);
    this.compileSrcDst('DST', objs, negated, this._ruleData.ip_version);

    // Order the resulting array by number of strings into each array.
    if (this._compiledPositions.length < 2) // Don't need ordering.
        return;
    for (i = 0; i < this._compiledPositions.length; i++) {
        for (p = i, j = i + 1; j < this._compiledPositions.length; j++) {
            if (this._compiledPositions[j].items.length < this._compiledPositions[p].items.length)
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
    let position_items_not_negate = [];
    let position_items_negate = [];
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
    let chainNumber = 1;

    // Rule compilation process.
    if (this._compiledPositions.length === 0) // No conditions rule.
      cs += this._csEnd;
    else if (this._compiledPositions.length === 1 && !(this._compiledPositions[0].negate)) { // One condition rule and no negated position.
      if (this._compiledPositions[0].items.length === 1) // Only one item in the condition.
        cs += `${this._compiledPositions[0].items[0]} ${this._csEnd}`;
      else { // Multiple items in the condition.
        let cs1 = cs;
        cs = '';
        for (let i = 0; i < this._compiledPositions[0].items.length; i++)
          cs += `${cs1}${this._compiledPositions[0].items[i]} ${this._csEnd}`;
      }
    } else { // Multiple condition rules or one condition rule with the condition (position) negated.
      for (let i = 0, j: number, chainName = '', chainNext = ''; i < this._compiledPositions.length; i++) {
        // We have the position_items array ordered by arrays length.
        if (this._compiledPositions[i].items.length === 1 && !(this._compiledPositions[i].negate))
            cs += `${this._compiledPositions[i].items[0]} `;
        else {
          chainName = `FWCRULE${id}.CH${chainNumber}`;
          // If we are in the first condition and it is not negated.
          if (i === 0 && !(this._compiledPositions[i].negate)) {
            let cs1 = cs;
            cs = '';
            for (let j = 0; j < this._compiledPositions[0].items.length; j++)
              cs += `${cs1}${this._compiledPositions[0].items[j]} ${j < (this._compiledPositions[0].items.length - 1) ? `${this._stateful} ${this._compiler=='IPTables' ? '-j':'jump'} ${chainName}\n` : ''}`;
          } else {
            if (!(this._compiledPositions[i].negate)) {
              // If we are at the end of the array, the next chain will be the rule action.
              chainNext = (i === (this._compiledPositions.length - 1)) ? this._action : `FWCRULE${id}.CH${chainNumber+1}`;
            } else { // If the position is negated.
              chainNext = this._compiler=='IPTables' ? 'RETURN' : 'return';
            }

            cs = `${this._cmd} ${this._compiler=='IPTables' ? `${this._table} -N` : `add chain ${this._family} ${this._table}`} ${chainName}\n${cs}`;
            cs += `${chainNumber === 1 ? `${this._stateful} ${this._compiler=='IPTables' ? '-j':'counter jump'} ${chainName}\n` : ''}`;
            for (j = 0; j < this._compiledPositions[i].items.length; j++) {
              if (this._compiler === 'IPTables')
                cs += `${this._cmd} ${this._table} -A ${chainName} ${this._compiledPositions[i].items[j]} -j ${chainNext}\n`;
              else // NFTables
                cs += `${this._cmd} add rule ${this._family} ${this._table} ${chainName} ${this._compiledPositions[i].items[j]} ${i != (this._compiledPositions.length - 1) ? `counter ${chainNext!='return' ? 'jump ' : ''}` : ''}${chainNext}\n`;
            }
            chainNumber++;

            if (this._compiledPositions[i].negate) {
              if (this._compiler === 'IPTables')
                cs += `${this._cmd} ${this._table} -A ${chainName} -j ${((i === ((this._compiledPositions.length) - 1)) ? this._action : `FWCRULE${id}.CH${chainNumber}`)}\n`;
              else // NFTables
                cs += `${this._cmd} add rule ${this._family} ${this._table} ${chainName} ${((i === ((this._compiledPositions.length) - 1)) ? this._action : `counter jump FWCRULE${id}.CH${chainNumber}`)}\n`;
            }
          }
        }
      }

      // If we have not used user defined chains.
      if (chainNumber === 1)
        cs += this._csEnd;
    }

    return cs;
  }

	protected addAccounting(): void {
		// Accounting, logging and marking is not allowed with SNAT and DNAT chains.
		if (this._accChain && this._policyType <= PolicyTypesMap.get('IPv4:FORWARD')) {
      let createChain: string;
      let chainAction: string;

      if (this._compiler == 'IPTables') {
        createChain = `${this._cmd} -N ${this._accChain}`;
        chainAction =	`${this._cmd} -A ${this._accChain} -j ${(this._logChain) ? this._logChain : "RETURN"}`;  
      } else { // NFTables
        createChain = `${this._cmd} add chain ${this._family} ${this._table} ${this._accChain}`;
        chainAction =	`${this._cmd} add rule ${this._family} ${this._table} ${this._accChain} counter ${this._logChain ? `jump ${this._logChain}` : 'return'}`;  
      }

      this._cs = `${createChain}\n${chainAction}\n${this._cs}`;
		}
	}


	protected addLog(): void {
		// Accounting, logging and marking is not allowed with SNAT and DNAT chains.
		if (this._logChain && this._policyType <= PolicyTypesMap.get('IPv4:FORWARD')) {
      let createChain: string;
      let chainAction: string;
      let afterLog: string;

      if (this._compiler == 'IPTables') {
        createChain = `${this._cmd} -N ${this._logChain}`;
        chainAction =	`${this._cmd} -A ${this._logChain} -m limit --limit 60/minute -j LOG --log-level info --log-prefix "RULE ID ${this._ruleData.id} [${this._afterLogAction}] "`;  
        afterLog = `${this._cmd} -A ${this._logChain} -j ${this._afterLogAction}`
      } else { // NFTables
        createChain = `${this._cmd} add chain ${this._family} ${this._table} ${this._logChain}`;
        chainAction =	`${this._cmd} add rule ${this._family} ${this._table} ${this._logChain} limit rate 1/second burst 5 packets counter log prefix \\"RULE ID ${this._ruleData.id} [${this._afterLogAction}]\\" level info`;  
        afterLog = `${this._cmd} add rule ${this._family} ${this._table} ${this._logChain} ${this._afterLogAction}`
      }

      this._cs = `${createChain}\n${chainAction}\n${afterLog}\n${this._cs}`;
		}
	}


	protected addMark(): void {
		// Accounting, logging and marking is not allowed with SNAT and DNAT chains.
		if (parseInt(this._ruleData.mark_code) !== 0 && this._policyType <= PolicyTypesMap.get('IPv4:FORWARD')) {
      let cs1: string;
      let cs2: string;

      if (this._compiler == 'IPTables') {
        this._table = '-t mangle';
        this._action = `MARK --set-mark ${this._ruleData.mark_code}`;
        this._csEnd = `${this._stateful} -j ${this._action}\n`;
        cs1 = `${this._cmd} -t mangle -A ${MARK_CHAIN[this._policyType]} `; 
        cs2 = `${this._cmd} -t mangle -A PREROUTING `; 
      } else { // NFTables
        this._table = 'mangle';
        this._action = `counter meta mark set ${this._ruleData.mark_code}`;
        this._csEnd = `${this._stateful} ${this._action}\n`;
        cs1 = `${this._cmd} add rule ${this._family} ${this._table} ${MARK_CHAIN[this._policyType]} `; 
        cs2 = `${this._cmd} add rule ${this._family} ${this._table} PREROUTING `; 
      }

			this._cs += this.generateCompilationString(`${this._ruleData.id}-M1`, cs1);
			// Add the mark to the PREROUTING chain of the mangle table.
			if (this._policyType === PolicyTypesMap.get('IPv4:FORWARD')) {
				let str  = this.generateCompilationString(`${this._ruleData.id}-M1`, cs2);
				str = str.replace(/-o \w+ /g, "")
				this._cs += str;
			}

      if (this._compiler == 'IPTables') {
			  this._action = `CONNMARK --save-mark`;
			  this._csEnd = `${this._stateful} -j ${this._action}\n`;
      } else { // NFTables
        this._action = `counter meta mark set mark`;
        this._csEnd = `${this._stateful} ${this._action}\n`;
      }

			this._cs += this.generateCompilationString(`${this._ruleData.id}-M2`, cs1);
			// Add the mark to the PREROUTING chain of the mangle table.
			if (this._policyType === PolicyTypesMap.get('IPv4:FORWARD')) {
				let str  = this.generateCompilationString(`${this._ruleData.id}-M2`, cs2);
				str = str.replace(/-o \w+ /g, "")
				this._cs += str;
			}
		}
	}
}