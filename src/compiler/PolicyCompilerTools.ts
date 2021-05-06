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

export class PolicyCompilerTools {
  public static validPolicyType(type: number): boolean {
    return (type === PolicyTypesMap.get('IPv4:INPUT') || 
            type === PolicyTypesMap.get('IPv4:OUTPUT') ||
            type === PolicyTypesMap.get('IPv4:FORWARD') ||
            type === PolicyTypesMap.get('IPv4:SNAT') ||
            type === PolicyTypesMap.get('IPv4:DNAT') ||
            type === PolicyTypesMap.get('IPv6:INPUT') ||
            type === PolicyTypesMap.get('IPv6:OUTPUT') || 
            type === PolicyTypesMap.get('IPv6:FORWARD') ||
            type === PolicyTypesMap.get('IPv6:SNAT') ||
            type === PolicyTypesMap.get('IPv6:DNAT'));
  }


  public static ruleComment(ruleData: any): string {
    let metaData = {};
    let comment:string = ruleData.comment ? ruleData.comment : '';
    // Avoid the presence of the ' character, used as comment delimiter for the iptables command.
    comment = comment.trim().replace(/'/g, '"'); 

    if (ruleData.style) metaData['fwc_rs'] = ruleData.style;
    if (ruleData.group_name) metaData['fwc_rgn'] = ruleData.group_name;
    if (ruleData.group_style) metaData['fwc_rgs'] = ruleData.group_style;

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


  public static afterCompilation(ruleData: any, cs: string): string {
    // Replace two consecutive spaces by only one.
    cs = cs.replace(/  +/g, ' ');

    // Apply rule only to the selected firewall.
    if (ruleData.fw_apply_to && ruleData.firewall_name)
      cs = "if [ \"$HOSTNAME\" = \"" + ruleData.firewall_name + "\" ]; then\n" + cs + "fi\n";

    // Include before and/or after rule script code.
    if (ruleData.run_before) cs = `###########################\n# Before rule load code:\n${ruleData.run_before}\n###########################\n${cs}`;
    if (ruleData.run_after) cs += `###########################\n# After rule load code:\n${ruleData.run_after}\n###########################\n`;
  
    return cs;
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
  public static portsLimitControl(proto: 'tcp' | 'udp', portsStr: string, items) {
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
          

  public static preCompileSrcDst(dir, sd, negate, rule_ip_version) {
    var items = {
      'negate': negate,
      'str': []
    };

    for (var i = 0; i < sd.length; i++) {
      if (sd[i].type === 9) // DNS
        items.str.push(dir + sd[i].name);
      else if (rule_ip_version === sd[i].ip_version) { // Only add this type of IP objects if they have the same IP version than the compiled rule.
        if (sd[i].type === 5) // Address
          items.str.push(dir + sd[i].address);
        else if (sd[i].type === 7) // Network
          items.str.push(dir + sd[i].address + "/" + sd[i].netmask.replace('/', ''));
        else if (sd[i].type === 6) // Address range
          items.str.push((dir !== "" ? ("-m iprange " + (dir === "-s " ? "--src-range " : "--dst-range ")) : " ") + sd[i].range_start + "-" + sd[i].range_end);
      }
    }

    return ((items.str.length > 0) ? items : null);
  }


  public static preCompileInterface(dir, ifs, negate) {
    var items = {
      'negate': negate,
      'str': []
    };

    for (var i = 0; i < ifs.length; i++)
      items.str.push(dir + ifs[i].name);

    return ((items.str.length > 0) ? items : null);
  }


  /**
   * Group services position by protocol number (TCP, UDP, ICMP, etc.) 
   * Returns an array of strings with the services grouped by protocol.
   * 
   * @param sep 
   * @param svc 
   * @param negate 
   * @param rule_ip_version 
   */
  public static preCompileSvc(sep, svc, negate, rule_ip_version) {
    var items = {
      'negate': negate,
      'str': []
    };
    var tcpPorts = "";
    let udpPorts = "";
    let tmp = "";

    for (var i = 0; i < svc.length; i++) {
      switch (svc[i].protocol) { // PROTOCOL NUMBER
        case 6: // TCP
          const mask = svc[i].tcp_flags_mask;

          if (!mask || mask === 0) { // No TCP flags.
            if (svc[i].source_port_end===0 || svc[i].source_port_end===null) { // No source port.
              if (tcpPorts)
                tcpPorts += ",";
              tcpPorts += (svc[i].destination_port_start === svc[i].destination_port_end) ? svc[i].destination_port_start : (svc[i].destination_port_start + sep + svc[i].destination_port_end);
            } else {
              tmp = "-p tcp --sport " + ((svc[i].source_port_start === svc[i].source_port_end) ? svc[i].source_port_start : (svc[i].source_port_start + sep + svc[i].source_port_end));
              if (svc[i].destination_port_end !== 0)
                tmp += " --dport " + ((svc[i].destination_port_start === svc[i].destination_port_end) ? svc[i].destination_port_start : (svc[i].destination_port_start + sep + svc[i].destination_port_end));
              items.str.push(tmp);
            }
          }
          else { // Add the TCP flags.
            tmp = "-p tcp";
            if (svc[i].source_port_end!==0 && svc[i].source_port_end!==null) // Exists source port
              tmp += " --sport " + ((svc[i].source_port_start === svc[i].source_port_end) ? svc[i].source_port_start : (svc[i].source_port_start + sep + svc[i].source_port_end));
            if (svc[i].destination_port_end!==0 && svc[i].destination_port_end!==null) // Exists destination port
              tmp += " --dport " + ((svc[i].destination_port_start === svc[i].destination_port_end) ? svc[i].destination_port_start : (svc[i].destination_port_start + sep + svc[i].destination_port_end));
            tmp += " --tcp-flags ";

            // If all mask bits are set.
            if (mask === 0b00111111)
              tmp += "ALL ";
            else {
              // Compose the mask.
              if (mask & 0b00000001) // URG
                tmp += "URG,";
              if (mask & 0b00000010) // ACK
                tmp += "ACK,";
              if (mask & 0b00000100) // PSH
                tmp += "PSH,";
              if (mask & 0b00001000) // RST
                tmp += "RST,";
              if (mask & 0b00010000) // SYN
                tmp += "SYN,";
              if (mask & 0b00100000) // FIN
                tmp += "FIN,";
              tmp = tmp.replace(/.$/, " ");
            }

            // Compose the flags that must be set.
            const settings = svc[i].tcp_flags_settings;
            if (!settings || settings === 0)
              tmp += " NONE";
            else {
              // Compose the mask.
              if (settings & 0b00000001) // URG
                tmp += "URG,";
              if (settings & 0b00000010) // ACK
                tmp += "ACK,";
              if (settings & 0b00000100) // PSH
                tmp += "PSH,";
              if (settings & 0b00001000) // RST
                tmp += "RST,";
              if (settings & 0b00010000) // SYN
                tmp += "SYN,";
              if (settings & 0b00100000) // FIN
                tmp += "FIN,";
              tmp = tmp.substring(0, tmp.length - 1);
            }

            items.str.push(tmp);
          }
          break;

        case 17: // UDP
          if (svc[i].source_port_end===0 || svc[i].source_port_end===null) { // No source port.
            if (udpPorts)
              udpPorts += ",";
            udpPorts += (svc[i].destination_port_start === svc[i].destination_port_end) ? svc[i].destination_port_start : (svc[i].destination_port_start + sep + svc[i].destination_port_end);
          } else {
            tmp = "-p udp --sport " + ((svc[i].source_port_start === svc[i].source_port_end) ? svc[i].source_port_start : (svc[i].source_port_start + sep + svc[i].source_port_end));
            if (svc[i].destination_port_end !== 0)
              tmp += " --dport " + ((svc[i].destination_port_start === svc[i].destination_port_end) ? svc[i].destination_port_start : (svc[i].destination_port_start + sep + svc[i].destination_port_end));
            items.str.push(tmp);
          }
          break;

        case 1: // ICMP
          const shared = (rule_ip_version === 4) ? "-p icmp -m icmp --icmp-type" : "-p icmpv6 -m ipv6-icmp --icmpv6-type";

          if (svc[i].icmp_type === -1 && svc[i].icmp_code === -1) // Any ICMP
            items.str.push(`${shared} any`);
          else if (svc[i].icmp_type !== -1 && svc[i].icmp_code === -1)
            items.str.push(`${shared} ${svc[i].icmp_type}`);
          else if (svc[i].icmp_type !== -1 && svc[i].icmp_code !== -1)
            items.str.push(`${shared} ${svc[i].icmp_type}/${svc[i].icmp_code}`);
          break;

        default: // Other IP protocols.
          items.str.push("-p " + svc[i].protocol);
          break;
      }
    }

    if (tcpPorts) {
      if (sep === ":") this.portsLimitControl('tcp',tcpPorts,items);
      else items.str.push(tcpPorts);
    }
    if (udpPorts) {
      if (sep === ":") this.portsLimitControl('udp',udpPorts,items);
      else items.str.push(udpPorts);
    }

    return ((items.str.length > 0) ? items : null);
  }


  /**
   * This function will return an array of arrays of strings. 
   * Each array will contain the pre-compiled strings for the items of each rule position.
   * 
   * @param rule 
   */
  public static preCompile(rule) {
    let position_items = [];
    const policy_type = rule.type;
    let items, src_position, dst_position, svc_position, dir, objs, negated;
    let i, j, p;

    if (policy_type === PolicyTypesMap.get('IPv4:FORWARD')) { src_position = 2; dst_position = 3; svc_position = 4; }
    else { src_position = 1; dst_position = 2; svc_position = 3; }

    // Generate items strings for all the rule positions.
    // WARNING: The order of creation of the arrays is important for optimization!!!!
    // The positions first in the array will be used first in the conditions.
    // INTERFACE IN / OUT
    dir = (policy_type === PolicyTypesMap.get('IPv4:OUTPUT') || policy_type === PolicyTypesMap.get('IPv4:SNAT')) ? "-o " : "-i ";
    objs = rule.positions[0].ipobjs;
    negated = this.isPositionNegated(rule.negate, rule.positions[0].id);
    if (items = this.preCompileInterface(dir, objs, negated))
        position_items.push(items);

    // INTERFACE OUT
    if (policy_type === PolicyTypesMap.get('IPv4:FORWARD')) {
        objs = rule.positions[1].ipobjs;
        negated = this.isPositionNegated(rule.negate, rule.positions[1].id);
        if (items = this.preCompileInterface("-o ", objs, negated))
            position_items.push(items);
    }

    // SERVICE
    objs = rule.positions[svc_position].ipobjs;
    negated = this.isPositionNegated(rule.negate, rule.positions[svc_position].id);
    if (items = this.preCompileSvc(":", objs, negated, rule.ip_version))
        position_items.push(items);

    // SOURCE
    objs = rule.positions[src_position].ipobjs;
    negated = this.isPositionNegated(rule.negate, rule.positions[src_position].id);
    if (items = this.preCompileSrcDst("-s ", objs, negated, rule.ip_version))
        position_items.push(items);

    // DESTINATION
    objs = rule.positions[dst_position].ipobjs;
    negated = this.isPositionNegated(rule.negate, rule.positions[dst_position].id);
    if (items = this.preCompileSrcDst("-d ", objs, negated, rule.ip_version))
        position_items.push(items);

    // Order the resulting array by number of strings into each array.
    if (position_items.length < 2) // Don't need ordering.
        return position_items;
    for (i = 0; i < position_items.length; i++) {
        for (p = i, j = i + 1; j < position_items.length; j++) {
            if (position_items[j].str.length < position_items[p].str.length)
                p = j;
        }
        const tmp = position_items[i];
        position_items[i] = position_items[p];
        position_items[p] = tmp;
    }

    // If we have only one item, no further process is required.
    if (position_items.length === 1)
        return position_items;

    // If we have negated positions and not negated positions, then move the negated positions to the end of the array.
    var position_items_not_negate = [];
    var position_items_negate = [];
    for (i = 0; i < position_items.length; i++) {
        // Is this position item is negated, search for the next one no negated.
        if (!(position_items[i].negate))
            position_items_not_negate.push(position_items[i]);
        else
            position_items_negate.push(position_items[i]);
    }

    return position_items_not_negate.concat(position_items_negate);
  }


  public static natAction(policy_type, trans_addr, trans_port, rule_ip_version): string {
    if (trans_addr.length > 1 || trans_port.length > 1)
      throw(fwcError.other('Translated fields must contain a maximum of one item'));

    if (policy_type === PolicyTypesMap.get('IPv4:SNAT') && trans_addr.length === 0) {
      if (trans_port.length === 0) return 'MASQUERADE';
      throw(fwcError.other("For SNAT 'Translated Service' must be empty if 'Translated Source' is empty"));
    }

    // For DNAT the translated destination is mandatory.
    if (policy_type === PolicyTypesMap.get('IPv4:DNAT') && trans_addr.length === 0)
      throw(fwcError.other("For DNAT 'Translated Destination' is mandatory"));

    // Only TCP and UDP protocols are allowed for the translated service position.
    if (trans_port.length === 1 && trans_port[0].protocol !== 6 && trans_port[0].protocol !== 17)
      throw(fwcError.other("For 'Translated Service' only protocols TCP and UDP are allowed"));

    let protocol = ' ';
    if (trans_port.length === 1) 
      protocol = (trans_port[0].protocol==6) ? ' -p tcp ' : ' -p udp ';

    let action = (policy_type === PolicyTypesMap.get('IPv4:SNAT')) ? `SNAT${protocol}--to-source ` : `DNAT${protocol}--to-destination `;

    if (trans_addr.length === 1)
      action += (this.preCompileSrcDst("", trans_addr, false, rule_ip_version)).str[0];
    if (trans_port.length === 1)
      action += ":" + (this.preCompileSvc("-", trans_port, false, rule_ip_version)).str[0];

    return action;
  }


  public static generateCompilationString(rule, position_items, cs, cs_trail, table, stateful, action, iptables_cmd) {
    // Rule compilation process.
    if (position_items.length === 0) // No conditions rule.
        cs += cs_trail;
    else if (position_items.length === 1 && !(position_items[0].negate)) { // One condition rule and no negated position.
        if (position_items[0].str.length === 1) // Only one item in the condition.
            cs += position_items[0].str[0] + " " + cs_trail;
        else { // Multiple items in the condition.
            var cs1 = cs;
            cs = "";
            for (var i = 0; i < position_items[0].str.length; i++)
                cs += cs1 + position_items[0].str[i] + " " + cs_trail;
        }
    } else { // Multiple condition rules or one condition rule with the condition (position) negated.
        for (var i = 0, j, chain_number = 1, chain_name = "", chain_next = ""; i < position_items.length; i++) {
            // We have the position_items array ordered by arrays length.
            if (position_items[i].str.length === 1 && !(position_items[i].negate))
                cs += position_items[i].str[0] + " ";
            else {
                chain_name = "FWCRULE" + rule + ".CH" + chain_number;
                // If we are in the first condition and it is not negated.
                if (i === 0 && !(position_items[i].negate)) {
                    var cs1 = cs;
                    cs = "";
                    for (let j = 0; j < position_items[0].str.length; j++)
                        cs += cs1 + position_items[0].str[j] + ((j < (position_items[0].str.length - 1)) ? " " + stateful + " -j " + chain_name + "\n" : " ");
                } else {
                    if (!(position_items[i].negate)) {
                        // If we are at the end of the array, the next chain will be the rule action.
                        chain_next = (i === ((position_items.length) - 1)) ? action : "FWCRULE" + rule + ".CH" + (chain_number + 1);
                    } else { // If the position is negated.
                        chain_next = "RETURN";
                    }

                    cs = `${iptables_cmd} ${table} -N ${chain_name}\n${cs}${((chain_number === 1) ? stateful + " -j " + chain_name + "\n" : "")}`;
                    for (j = 0; j < position_items[i].str.length; j++) {
                        cs += `${iptables_cmd} ${table} -A ${chain_name} ${position_items[i].str[j]} -j ${chain_next}\n`;
                    }
                    chain_number++;

                    if (position_items[i].negate)
                        cs += `${iptables_cmd} ${table} -A ${chain_name} -j ${((i === ((position_items.length) - 1)) ? action : "FWCRULE" + rule + ".CH" + chain_number)}\n`;
                }
            }
        }

        // If we have not used IPTABLES user defined chains.
        if (chain_number === 1)
            cs += cs_trail;
    }

    return cs;
  }
}