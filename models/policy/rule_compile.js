
//create object
var RuleCompileModel = {};

module.exports = RuleCompileModel;

/**
 * Property Model to manage Policy Data
 *
 * @property PolicyModel
 * @type ../../models/policy/policy_r
 */
var Policy_rModel = require('../../models/policy/policy_r');

/**
 * Property Model to manage Policy Compiled Data
 *
 * @property Policy_cModel
 * @type ../../models/policy_c
 */
var Policy_cModel = require('../../models/policy/policy_c');

/**
 * Property Logger to manage App logs
 *
 * @property logger
 * @type log4js/app
 *
 */
var logger = require('log4js').getLogger("compiler");


/**
 * Property Model to manage API RESPONSE data
 *
 * @property api_resp
 * @type ../../models/api_response
 *
 */
var api_resp = require('../../utils/api_response');

const POLICY_TYPE_INPUT = 1;
const POLICY_TYPE_OUTPUT = 2;
const POLICY_TYPE_FORWARD = 3;
const POLICY_TYPE_SNAT = 4;
const POLICY_TYPE_DNAT = 5;
const POLICY_TYPE = ['', 'INPUT', 'OUTPUT', 'FORWARD'];
const ACTION = ['', 'ACCEPT', 'DROP', 'REJECT', 'ACCOUNTING'];

/*----------------------------------------------------------------------------------------------------------------------*/
RuleCompileModel.pre_compile_sd = (dir, sd) => {
	var items = {
		'negate' : ((sd.length>0) ? sd[0].negate : 0),
		'str': []
	};

	for (var i = 0; i < sd.length; i++) {
		if (sd[i].type === 5) // Address
			items.str.push(dir+sd[i].address);
		else if (sd[i].type === 7) // Network
			items.str.push(dir+sd[i].address+"/"+sd[i].netmask);
		else if (sd[i].type === 6) // Address range
			items.str.push((dir!=="" ? ("-m iprange "+(dir==="-s " ? "--src-range " : "--dst-range ")) : " ")+sd[i].range_start+"-"+sd[i].range_end);
	}

	return ((items.str.length>0) ? items : null);
};
/*----------------------------------------------------------------------------------------------------------------------*/

/*----------------------------------------------------------------------------------------------------------------------*/
RuleCompileModel.pre_compile_if = (dir, ifs) => {
	var items = {
		'negate' : ((ifs.length>0) ? ifs[0].negate : 0),
		'str': []
	};

	for (var i = 0; i < ifs.length; i++)
		items.str.push(dir+ifs[i].name);
	
	return ((items.str.length>0) ? items : null);
};
/*----------------------------------------------------------------------------------------------------------------------*/

/*----------------------------------------------------------------------------------------------------------------------*/
// Agrupate services position by protocol number (TCP, UDP, ICMP, etc.) 
// Returns an array of strings with the services agrupated by protocol.
/*----------------------------------------------------------------------------------------------------------------------*/
RuleCompileModel.pre_compile_svc = (sep,svc) => {
	var items = {
		'negate' : ((svc.length>0) ? svc[0].negate : 0),
		'str': []
	};
	var tcp = udp = imcp = tmp = "";
	
	for (var i = 0; i < svc.length; i++) {
		switch (svc[i].protocol) { // PROTOCOL NUMBER
			case 6: // TCP
				const mask = svc[i].tcp_flags_mask;
			
				if (!mask || mask===0) { // No TCP flags.
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
						tmp = tmp.replace(/.$/," ");
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
				if (svc[i].icmp_type===-1 && svc[i].icmp_code===-1) // Any ICMP
					items.str.push("-p icmp -m icmp --icmp-type any");
				else if (svc[i].icmp_type!==-1 && svc[i].icmp_code===-1)
					items.str.push("-p icmp -m icmp --icmp-type "+svc[i].icmp_type);
				else if (svc[i].icmp_type!==-1 && svc[i].icmp_code!==-1)
					items.str.push("-p icmp -m icmp --icmp-type "+svc[i].icmp_type+"/"+svc[i].icmp_code);
				break;

			default: // Other IP protocols.
				items.str.push("-p "+svc[i].protocol);
				break;
		}
	}

	if (tcp) {
		if (sep===":")
			tcp = (tcp.indexOf(",") > -1) ? ("-p tcp -m multiport --dports "+tcp) : ("-p tcp --dport "+tcp);
		items.str.push(tcp);
	}
	if (udp) {
		if (sep===":")
			udp = (udp.indexOf(",") > -1) ? ("-p udp -m multiport --dports "+udp) : ("-p udp --dport "+udp);
		items.str.push(udp);
	}

	return ((items.str.length>0) ? items : null);
};
/*----------------------------------------------------------------------------------------------------------------------*/

/*----------------------------------------------------------------------------------------------------------------------*/
// This function will return an array of arrays of strings. 
// Each array will contain the precompiled strings for the items of each rule position.
/*----------------------------------------------------------------------------------------------------------------------*/
RuleCompileModel.pre_compile = (data) => {
	var position_items = [];
	const policy_type = data[0].type;
	var items, src_position, dst_position, svc_position;
	var i, j, p;

	if (policy_type === POLICY_TYPE_FORWARD) { src_position=2; dst_position=3; svc_position=4;}
	else { src_position=1; dst_position=2; svc_position=3;}
	
	// Generate items strings for all the rule positions.
	// WARNING: The order of creation of the arrays is important for optimization!!!!
	// The positions first in the array will be used first in the conditions.
	// INTERFACE IN / OUT
	if (items=RuleCompileModel.pre_compile_if(((policy_type===POLICY_TYPE_OUTPUT || policy_type===POLICY_TYPE_SNAT) ? "-o " : "-i "), data[0].positions[0].position_objs)) position_items.push(items);
	// INTERFACE OUT
	if (policy_type===POLICY_TYPE_FORWARD && (items=RuleCompileModel.pre_compile_if("-o ", data[0].positions[1].position_objs))) position_items.push(items);
	// SERVICE
	if (items=RuleCompileModel.pre_compile_svc(":",data[0].positions[svc_position].position_objs)) position_items.push(items);
	// SOURCE
	if (items=RuleCompileModel.pre_compile_sd("-s ", data[0].positions[src_position].position_objs)) position_items.push(items);
	// DESTINATION
	if (items=RuleCompileModel.pre_compile_sd("-d ", data[0].positions[dst_position].position_objs)) position_items.push(items);

	// Order the resulting array by number of strings into each array.
	if (position_items.length < 2) // Don't need ordering.
		return position_items;
	for (i = 0; i < position_items.length; i++) {
		for (p = i, j = i + 1; j < position_items.length; j++) {
			if (position_items[j].str.length < position_items[p].str.length)
				p = j;
		}
		tmp = position_items[i];
		position_items[i] = position_items[p];
		position_items[p] = tmp;
	}

	// If we have negated positions and not negated positions, then move the negated positions to the end of the array.
	if (position_items.length === 1) // Don't need it.
		return position_items;
	
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
};
/*----------------------------------------------------------------------------------------------------------------------*/

/*----------------------------------------------------------------------------------------------------------------------*/
RuleCompileModel.nat_action = (policy_type,trans_addr,trans_port,callback) => {
  try {
		if (trans_addr.length>1 || trans_port.length>1) {
			callback({"Msg": "Translated fields must contain a maximum of one item."},null);			
			return null;
		}

		if (policy_type===POLICY_TYPE_SNAT && trans_addr.length===0) {
			if (trans_port.length===0)
				return "MASQUERADE";
			callback({"Msg": "For SNAT 'Translated Service' must be empty if 'Translated Source' is empty."},null);
			return null;
		}

		// For DNAT the translated destination is mandatory.
		if (policy_type===POLICY_TYPE_DNAT && trans_addr.length===0) {
			callback({"Msg": "For DNAT 'Translated Destination' is mandatory."},null);
			return null;
		}
	
		// Only TCP and UDP protocols are allowed for the translated service position.
		if (trans_port.length===1 && trans_port[0].protocol!==6 && trans_port[0].protocol!==17)
		{
			callback({"Msg": "For 'Translated Service' only protocols TCP and UDP are allowed."},null);
			return null;
		}
	
		var action = "";
		if (policy_type===POLICY_TYPE_SNAT)
			action = "SNAT --to-source "
		else
			action = "DNAT --to-destination "

		if (trans_addr.length === 1) 
			action += (RuleCompileModel.pre_compile_sd("",trans_addr)).str[0];
		if (trans_port.length === 1) 
			action += ":"+(RuleCompileModel.pre_compile_svc("-",trans_port)).str[0];

		return action;
  } catch (e) {        
		callback(e,null);
    return null;	
  }
};
/*----------------------------------------------------------------------------------------------------------------------*/

/*----------------------------------------------------------------------------------------------------------------------*/
/* Get  policy_r by id and  by Id */
/*----------------------------------------------------------------------------------------------------------------------*/
RuleCompileModel.rule_compile = (cloud, fw, type, rule, callback) => {        
	Policy_rModel.getPolicy_rs_type_full(cloud, fw, type, rule)
	.then(data => {
		if (!data) {
			callback({"Msg": "Rule data not found."},null);
			return;
		}

		const policy_type = data[0].type;
		if (!policy_type || 
				(policy_type!==POLICY_TYPE_INPUT && policy_type!==POLICY_TYPE_OUTPUT && policy_type!==POLICY_TYPE_FORWARD
				 && policy_type!==POLICY_TYPE_SNAT && policy_type!==POLICY_TYPE_DNAT)) {
			callback({"Msg": "Invalid policy type."},null);
			return;
		}

		var cs = "$IPTABLES "; // Compile string.
		var after_log_action = log_chain = acc_chain = cs_trail = statefull = table = action = "";

		if (policy_type === 4) { // SNAT
			table = "-t nat";
			cs += table+" -A POSTROUTING ";
			if (!(action=RuleCompileModel.nat_action(policy_type,data[0].positions[4].position_objs,data[0].positions[5].position_objs,callback)))
				return;
		}
		else if (policy_type === 5) { // DNAT
			table = "-t nat";
			cs += table+" -A PREROUTING ";
			if (!(action=RuleCompileModel.nat_action(policy_type,data[0].positions[4].position_objs,data[0].positions[5].position_objs,callback)))
				return;
		}
		else { // Filter policy
			if (data.length != 1 || !(data[0].positions)
					|| !(data[0].positions[0].position_objs) || !(data[0].positions[1].position_objs) || !(data[0].positions[2].position_objs)
					|| (policy_type === POLICY_TYPE_FORWARD && !(data[0].positions[3].position_objs))) {
				callback({"Msg": "Bad rule data."},null);
				return;
			}
			cs += "-A " + POLICY_TYPE[policy_type] + " ";
			action = ACTION[data[0].action];
			if (action==="ACCEPT") {
				if (data[0].firewall_options & 0x0001) // Statefull firewall.
					statefull ="-m state --state NEW ";
			}
			else if (action==="ACCOUNTING") {
				acc_chain = "FWCRULE"+rule+".ACC"; 
				action = acc_chain; 
			}

			// If log all rules option is enabled.
			if (data[0].firewall_options & 0x0010) {
				log_chain = "FWCRULE"+rule+".LOG";
				if (!acc_chain) {
					after_log_action = action;
					action = log_chain;
				} else
					after_log_action = "RETURN";
			}		
		}

		cs_trail = statefull+"-j "+action+"\n";
		
		const position_items = RuleCompileModel.pre_compile(data);
		
		// Rule compilation process.
		if (position_items.length === 0) // No conditions rule.
			cs += cs_trail;
		else if (position_items.length===1 && !(position_items[0].negate)) { // One condition rule and no negated position.
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
				if (position_items[i].str.length===1 && !(position_items[i].negate))
					cs += position_items[i].str[0]+" ";
				else {
					chain_name = "FWCRULE"+rule+".CH"+chain_number;
					// If we are in the first condition and it is not negated.
					if (i===0 && !(position_items[i].negate)) {
						var cs1 = cs;
						cs = "";
						for (var j = 0; j < position_items[0].str.length; j++)
							cs += cs1+position_items[0].str[j]+((j < (position_items[0].str.length - 1)) ? " "+statefull+" -j "+chain_name+"\n" : " ");
					} else {
						if (!(position_items[i].negate)) {
							// If we are at the end of the array, the next chain will be the rule action.
							chain_next = (i === ((position_items.length)-1)) ? action : "FWCRULE"+rule+".CH"+(chain_number+1);
						} else { // If the position is negated.
							chain_next = "RETURN";
						}

						cs = "$IPTABLES "+table+" -N "+chain_name+"\n"+cs+((chain_number === 1) ? statefull+" -j "+chain_name+"\n" : "");
						for (j = 0; j < position_items[i].str.length; j++) {
							cs += "$IPTABLES "+table+" -A "+chain_name+" "+position_items[i].str[j]+" -j "+chain_next+"\n";
						}
						chain_number++;

						if (position_items[i].negate)
							cs += "$IPTABLES "+table+" -A "+chain_name+" -j "+((i === ((position_items.length)-1)) ? action : "FWCRULE"+rule+".CH"+chain_number)+"\n";
					}
				}
			}

			// If we have not used IPTABLES user defined chains.
			if (chain_number === 1)
				cs += cs_trail;
		}

		// If we are using UDP or TCP ports in translated service position for NAT rules, 
		// make sure that the -p tcp or -p udp is included in the compilation string.
		if ((policy_type===4 || policy_type===5) && data[0].positions[5].position_objs.length===1) { // SNAT or DNAT
			var substr="";
			if (data[0].positions[5].position_objs[0].protocol===6) // TCP
			 	substr += " -p tcp ";
			else if (data[0].positions[5].position_objs[0].protocol===17) // UDP
				substr += " -p udp ";
				 
			if(cs.indexOf(substr) === -1) {
				if (policy_type===4)  // SNAT
					cs = cs.replace(/-A POSTROUTING/g,"-A POSTROUTING"+substr);
				else // DNAT
				  cs = cs.replace(/-A PREROUTING/g,"-A PREROUTING"+substr);
			}
		}

		// Accounting and logging is not allowed with SNAT and DNAT chains.
		if (policy_type!==4 && policy_type!==5) {
			if (acc_chain) {
				cs = "$IPTABLES -N "+acc_chain+"\n" + "$IPTABLES -A "+acc_chain+" -j "+((log_chain) ? log_chain : "RETURN")+"\n" + cs;
			}
			if (log_chain) {
				cs = "$IPTABLES -N "+log_chain+"\n" +
					"$IPTABLES -A "+log_chain+" -m limit --limit 60/minute -j LOG --log-level info --log-prefix \"RULE ID "+rule+" ["+after_log_action+"] \"\n" +
					"$IPTABLES -A "+log_chain+" -j "+after_log_action+"\n" + cs;
			}
		}

		// Apply rule only to the selected firewall.
		if (data[0].fw_apply_to && data[0].firewall_name)
			cs = "if [ \"$HOSTNAME\" = \""+data[0].firewall_name+"\" ]; then\n"+cs+"fi\n";		
		
		cs = cs.replace(/  +/g,' ');

		//Save compilation
		var policy_cData = {
			rule: rule,
			firewall: fw,
			rule_compiled: cs,
			status_compiled: 1
		};

		Policy_cModel.insertPolicy_c(policy_cData, (error, data) => { 
			/* We don't worry about if the rule compilation string is stored fine in the database. */ });

		callback(null,cs);
	})
	.catch(error => callback(error,null));
};
/*----------------------------------------------------------------------------------------------------------------------*/

/*----------------------------------------------------------------------------------------------------------------------*/
/* Get the rule compilation string or compile it if this string is not uptodate.
/*----------------------------------------------------------------------------------------------------------------------*/
RuleCompileModel.get = (cloud, fw, type, rule) => {
	return new Promise((resolve,reject) => { 
		Policy_cModel.getPolicy_c(cloud, fw, rule, (error, data) => {
			if (error) return reject(error);
			if (data && data.length > 0) {
				if (data[0].c_status_recompile === 0)
					resolve(data[0].c_compiled);
				else {
					RuleCompileModel.rule_compile(cloud, fw, type, rule, (error,data) => {
						if (error) return reject(error)
						resolve(data);
					});
				}
			}
			else
				resolve("");
		});
	});
};
/*----------------------------------------------------------------------------------------------------------------------*/
