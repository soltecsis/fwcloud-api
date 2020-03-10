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

var fwcError = require('../utils/error_table');
import { PolicyRule } from '../models/policy/PolicyRule';
import { PolicyCompilation } from '../models/policy/PolicyCompilation';

export const POLICY_TYPE_INPUT = 1;
export const POLICY_TYPE_OUTPUT = 2;
export const POLICY_TYPE_FORWARD = 3;
export const POLICY_TYPE_SNAT = 4;
export const POLICY_TYPE_DNAT = 5;
export const POLICY_TYPE_INPUT_IPv6 = 61;
export const POLICY_TYPE_OUTPUT_IPv6 = 62;
export const POLICY_TYPE_FORWARD_IPv6 = 63;
export const POLICY_TYPE_SNAT_IPv6 = 64;
export const POLICY_TYPE_DNAT_IPv6 = 65;
export const POLICY_TYPE = ['', 'INPUT', 'OUTPUT', 'FORWARD'];
export const ACTION = ['', 'ACCEPT', 'DROP', 'REJECT', 'ACCOUNTING'];
//const MARK_CHAIN = ['', 'PREROUTING', 'OUTPUT', 'POSTROUTING'];
export const MARK_CHAIN = ['', 'INPUT', 'OUTPUT', 'FORWARD'];

export class RuleCompiler {

    public static isPositionNegated(negate, position) {
        if (!negate) return false;

        let negate_position_list = negate.split(' ').map(val => { return parseInt(val) });
        // If the position that we want negate is already in the list, don't add again to the list.
        for (let pos of negate_position_list) {
            if (pos === position) return true;
        }

        return false;
    }

    public static pre_compile_sd(dir, sd, negate, rule_ip_version) {
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

    public static pre_compile_if(dir, ifs, negate) {
        var items = {
            'negate': negate,
            'str': []
        };

        for (var i = 0; i < ifs.length; i++)
            items.str.push(dir + ifs[i].name);

        return ((items.str.length > 0) ? items : null);
    }

    /**
     * Agrupate services position by protocol number (TCP, UDP, ICMP, etc.) 
     * Returns an array of strings with the services agrupated by protocol.
     * 
     * @param sep 
     * @param svc 
     * @param negate 
     * @param rule_ip_version 
     */
    public static pre_compile_svc(sep, svc, negate, rule_ip_version) {
        var items = {
            'negate': negate,
            'str': []
        };
        var tcp = "";
        let udp = "";
        let imcp = "";
        let tmp = "";

        for (var i = 0; i < svc.length; i++) {
            switch (svc[i].protocol) { // PROTOCOL NUMBER
                case 6: // TCP
                    const mask = svc[i].tcp_flags_mask;

                    if (!mask || mask === 0) { // No TCP flags.
                        if (svc[i].source_port_end === 0) { // No source port.
                            if (tcp)
                                tcp += ",";
                            tcp += (svc[i].destination_port_start === svc[i].destination_port_end) ? svc[i].destination_port_start : (svc[i].destination_port_start + sep + svc[i].destination_port_end);
                        } else {
                            tmp = "-p tcp --sport " + ((svc[i].source_port_start === svc[i].source_port_end) ? svc[i].source_port_start : (svc[i].source_port_start + sep + svc[i].source_port_end));
                            if (svc[i].destination_port_end !== 0)
                                tmp += " --dport " + ((svc[i].destination_port_start === svc[i].destination_port_end) ? svc[i].destination_port_start : (svc[i].destination_port_start + sep + svc[i].destination_port_end));
                            items.str.push(tmp);
                        }
                    }
                    else { // Add the TCP flags.
                        tmp = "-p tcp";
                        if (svc[i].source_port_end !== 0) // Exists source port
                            tmp += " --sport " + ((svc[i].source_port_start === svc[i].source_port_end) ? svc[i].source_port_start : (svc[i].source_port_start + sep + svc[i].source_port_end));
                        if (svc[i].destination_port_end !== 0) // Exists destination port
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
                    if (svc[i].source_port_end === 0) { // No source port.
                        if (udp)
                            udp += ",";
                        udp += (svc[i].destination_port_start === svc[i].destination_port_end) ? svc[i].destination_port_start : (svc[i].destination_port_start + sep + svc[i].destination_port_end);
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

        if (tcp) {
            if (sep === ":")
                tcp = (tcp.indexOf(",") > -1) ? ("-p tcp -m multiport --dports " + tcp) : ("-p tcp --dport " + tcp);
            items.str.push(tcp);
        }
        if (udp) {
            if (sep === ":")
                udp = (udp.indexOf(",") > -1) ? ("-p udp -m multiport --dports " + udp) : ("-p udp --dport " + udp);
            items.str.push(udp);
        }

        return ((items.str.length > 0) ? items : null);
    }

    /**
     * This function will return an array of arrays of strings. 
     * Each array will contain the precompiled strings for the items of each rule position.
     * 
     * @param rule 
     */
    public static pre_compile(rule) {
        let position_items = [];
        const policy_type = rule.type;
        let items, src_position, dst_position, svc_position, dir, objs, negated;
        let i, j, p;

        if (policy_type === POLICY_TYPE_FORWARD) { src_position = 2; dst_position = 3; svc_position = 4; }
        else { src_position = 1; dst_position = 2; svc_position = 3; }

        // Generate items strings for all the rule positions.
        // WARNING: The order of creation of the arrays is important for optimization!!!!
        // The positions first in the array will be used first in the conditions.
        // INTERFACE IN / OUT
        dir = (policy_type === POLICY_TYPE_OUTPUT || policy_type === POLICY_TYPE_SNAT) ? "-o " : "-i ";
        objs = rule.positions[0].position_objs;
        negated = this.isPositionNegated(rule.negate, rule.positions[0].id);
        if (items = this.pre_compile_if(dir, objs, negated))
            position_items.push(items);

        // INTERFACE OUT
        if (policy_type === POLICY_TYPE_FORWARD) {
            objs = rule.positions[1].position_objs;
            negated = this.isPositionNegated(rule.negate, rule.positions[1].id);
            if (items = this.pre_compile_if("-o ", objs, negated))
                position_items.push(items);
        }

        // SERVICE
        objs = rule.positions[svc_position].position_objs;
        negated = this.isPositionNegated(rule.negate, rule.positions[svc_position].id);
        if (items = this.pre_compile_svc(":", objs, negated, rule.ip_version))
            position_items.push(items);

        // SOURCE
        objs = rule.positions[src_position].position_objs;
        negated = this.isPositionNegated(rule.negate, rule.positions[src_position].id);
        if (items = this.pre_compile_sd("-s ", objs, negated, rule.ip_version))
            position_items.push(items);

        // DESTINATION
        objs = rule.positions[dst_position].position_objs;
        negated = this.isPositionNegated(rule.negate, rule.positions[dst_position].id);
        if (items = this.pre_compile_sd("-d ", objs, negated, rule.ip_version))
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
    /*----------------------------------------------------------------------------------------------------------------------*/

    /*----------------------------------------------------------------------------------------------------------------------*/
    public static nat_action(policy_type, trans_addr, trans_port, rule_ip_version) {
        return new Promise((resolve, reject) => {
            if (trans_addr.length > 1 || trans_port.length > 1)
                return reject(fwcError.other('Translated fields must contain a maximum of one item'));

            if (policy_type === POLICY_TYPE_SNAT && trans_addr.length === 0) {
                if (trans_port.length === 0) return resolve('MASQUERADE');
                return reject(fwcError.other("For SNAT 'Translated Service' must be empty if 'Translated Source' is empty"));
            }

            // For DNAT the translated destination is mandatory.
            if (policy_type === POLICY_TYPE_DNAT && trans_addr.length === 0)
                return reject(fwcError.other("For DNAT 'Translated Destination' is mandatory"));

            // Only TCP and UDP protocols are allowed for the translated service position.
            if (trans_port.length === 1 && trans_port[0].protocol !== 6 && trans_port[0].protocol !== 17)
                return reject(fwcError.other("For 'Translated Service' only protocols TCP and UDP are allowed"));

            var action = "";
            if (policy_type === POLICY_TYPE_SNAT)
                action = "SNAT --to-source "
            else
                action = "DNAT --to-destination "

            if (trans_addr.length === 1)
                action += (this.pre_compile_sd("", trans_addr, false, rule_ip_version)).str[0];
            if (trans_port.length === 1)
                action += ":" + (this.pre_compile_svc("-", trans_port, false, rule_ip_version)).str[0];

            resolve(action);
        });
    }
    /*----------------------------------------------------------------------------------------------------------------------*/


    /*----------------------------------------------------------------------------------------------------------------------*/
    public static generate_compilation_string(rule, position_items, cs, cs_trail, table, stateful, action, iptables_cmd) {
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

    /**
     * Get  policy_r by id and  by Id
     * 
     * @param fwcloud 
     * @param firewall 
     * @param type 
     * @param rule 
     */
    public static rule_compile(fwcloud, firewall, type, rule) {
        return new Promise(async (resolve, reject) => {
            let data;
            try {
                data = await PolicyRule.getPolicyDataDetailed(fwcloud, firewall, type, rule);
                if (!data) return reject(fwcError.other('Rule data not found'));

                let policy_type = data[0].type;
                if (!policy_type ||
                    (policy_type !== POLICY_TYPE_INPUT && policy_type !== POLICY_TYPE_OUTPUT && policy_type !== POLICY_TYPE_FORWARD && policy_type !== POLICY_TYPE_SNAT && policy_type !== POLICY_TYPE_DNAT
                        && policy_type !== POLICY_TYPE_INPUT_IPv6 && policy_type !== POLICY_TYPE_OUTPUT_IPv6 && policy_type !== POLICY_TYPE_FORWARD_IPv6 && policy_type !== POLICY_TYPE_SNAT_IPv6 && policy_type !== POLICY_TYPE_DNAT_IPv6)) {
                    return reject('Invalid policy type');
                }

                let iptables_cmd = (policy_type < POLICY_TYPE_INPUT_IPv6) ? "$IPTABLES" : "$IP6TABLES"; // iptables command variable.
                let cs = `${iptables_cmd} `; // Compile string.
                let after_log_action = "";
                let log_chain = ""; 
                let acc_chain = ""; 
                let cs_trail = ""; 
                let stateful = ""; 
                let table = ""; 
                let action = ""; 

                // Since now, all the compilation process for IPv6 is the same that the one for IPv4.
                if (policy_type >= POLICY_TYPE_INPUT_IPv6) {
                    policy_type -= 60;
                    data[0].type -= 60;
                    data[0].ip_version = 6;
                } else data[0].ip_version = 4;

                if (policy_type === POLICY_TYPE_SNAT) { // SNAT
                    table = "-t nat";
                    cs += table + " -A POSTROUTING ";
                    const action = await this.nat_action(policy_type, data[0].positions[4].position_objs, data[0].positions[5].position_objs, data[0].ip_version);
                }
                else if (policy_type === POLICY_TYPE_DNAT) { // DNAT
                    table = "-t nat";
                    cs += table + " -A PREROUTING ";
                    const action = await this.nat_action(policy_type, data[0].positions[4].position_objs, data[0].positions[5].position_objs, data[0].ip_version);
                }
                else { // Filter policy
                    if (data.length != 1 || !(data[0].positions)
                        || !(data[0].positions[0].position_objs) || !(data[0].positions[1].position_objs) || !(data[0].positions[2].position_objs)
                        || (policy_type === POLICY_TYPE_FORWARD && !(data[0].positions[3].position_objs))) {
                        return reject("Bad rule data");
                    }

                    cs += `-A ${POLICY_TYPE[policy_type]} `;

                    if (data[0].special === 1) // Special rule for ESTABLISHED,RELATED packages.
                        action = "ACCEPT";
                    else if (data[0].special === 2) // Special rule for catch-all.
                        action = ACTION[data[0].action];
                    else {
                        action = ACTION[data[0].action];
                        if (action === "ACCEPT") {
                            if (data[0].options & 0x0001) // Stateful rule.
                                stateful = "-m state --state NEW ";
                            else if ((data[0].firewall_options & 0x0001) && !(data[0].options & 0x0002)) // Statefull firewall and this rule is not stateless.
                                stateful = "-m state --state NEW ";
                        }
                        else if (action === "ACCOUNTING") {
                            acc_chain = "FWCRULE" + rule + ".ACC";
                            action = acc_chain;
                        }
                    }

                    // If log all rules option is enabled or log option for this rule is enabled.
                    if ((data[0].firewall_options & 0x0010) || (data[0].options & 0x0004)) {
                        log_chain = "FWCRULE" + rule + ".LOG";
                        if (!acc_chain) {
                            after_log_action = action;
                            action = log_chain;
                        } else
                            after_log_action = "RETURN";
                    }
                }

                if (parseInt(data[0].special) === 1) // Special rule for ESTABLISHED,RELATED packages.
                    cs_trail = `-m state --state ESTABLISHED,RELATED -j ${action}\n`;
                else
                    cs_trail = `${stateful} -j ${action}\n`;

                const position_items = this.pre_compile(data[0]);

                // Generate the compilation string.
                cs = this.generate_compilation_string(rule, position_items, cs, cs_trail, table, stateful, action, iptables_cmd);

                // If we are using UDP or TCP ports in translated service position for NAT rules, 
                // make sure that the -p tcp or -p udp is included in the compilation string.
                if ((policy_type === POLICY_TYPE_SNAT || policy_type === POLICY_TYPE_DNAT) && data[0].positions[5].position_objs.length === 1) { // SNAT or DNAT
                    var substr = "";
                    if (data[0].positions[5].position_objs[0].protocol === 6) // TCP
                        substr += " -p tcp ";
                    else if (data[0].positions[5].position_objs[0].protocol === 17) // UDP
                        substr += " -p udp ";

                    if (cs.indexOf(substr) === -1) {
                        if (policy_type === POLICY_TYPE_SNAT)  // SNAT
                            cs = cs.replace(/-A POSTROUTING/g, "-A POSTROUTING" + substr);
                        else // DNAT
                            cs = cs.replace(/-A PREROUTING/g, "-A PREROUTING" + substr);
                    }
                }

                // Accounting ,logging and marking is not allowed with SNAT and DNAT chains.
                if (policy_type <= POLICY_TYPE_FORWARD) {
                    if (acc_chain) {
                        cs = `${iptables_cmd} -N ${acc_chain}\n` +
                            `${iptables_cmd} -A ${acc_chain} -j ${(log_chain) ? log_chain : "RETURN"}\n` +
                            `${cs}`;
                    }

                    if (log_chain) {
                        cs = `${iptables_cmd} -N ${log_chain}\n` +
                            `${iptables_cmd} -A ${log_chain} -m limit --limit 60/minute -j LOG --log-level info --log-prefix "RULE ID ${rule} [${after_log_action}] "\n` +
                            `${iptables_cmd} -A ${log_chain} -j ${after_log_action}\n` +
                            `${cs}`;
                    }

                    if (parseInt(data[0].mark_code) !== 0) {
                        table = '-t mangle';

                        action = `MARK --set-mark ${data[0].mark_code}`;
                        cs_trail = `${stateful} -j ${action}\n`
                        cs += this.generate_compilation_string(`${rule}-M1`, position_items, `${iptables_cmd} -t mangle -A ${MARK_CHAIN[policy_type]} `, cs_trail, table, stateful, action, iptables_cmd);

                        action = `CONNMARK --save-mark`;
                        cs_trail = `${stateful} -j ${action}\n`
                        cs += this.generate_compilation_string(`${rule}-M2`, position_items, `${iptables_cmd} -t mangle -A ${MARK_CHAIN[policy_type]} `, cs_trail, table, stateful, action, iptables_cmd);
                    }
                }

                // Apply rule only to the selected firewall.
                if (data[0].fw_apply_to && data[0].firewall_name)
                    cs = "if [ \"$HOSTNAME\" = \"" + data[0].firewall_name + "\" ]; then\n" + cs + "fi\n";

                cs = cs.replace(/  +/g, ' ');

                //Save compilation
                var policy_cData = {
                    rule: rule,
                    rule_compiled: cs,
                    status_compiled: 1
                };

                // Store compilation string in the database
                await PolicyCompilation.insertPolicy_c(policy_cData);

                resolve(cs);
            } catch (error) { return reject(error) }
        });
    }
    /*----------------------------------------------------------------------------------------------------------------------*/

    /*----------------------------------------------------------------------------------------------------------------------*/
    /* Get the rule compilation string or compile it if this string is not uptodate.
    /*----------------------------------------------------------------------------------------------------------------------*/
    public static get(fwcloud, firewall, type, rule) {
        return new Promise(async (resolve, reject) => {
            try {
                let data: any = await PolicyCompilation.getPolicy_c(fwcloud, firewall, rule);
                if (data && data.length > 0) {
                    if (parseInt(data[0].c_status_recompile) === 0)
                        resolve(data[0].c_compiled);
                    else
                        resolve(await this.rule_compile(fwcloud, firewall, type, rule));
                }
                else
                    resolve("");

            } catch (error) { reject(error) }
        });
    }
}