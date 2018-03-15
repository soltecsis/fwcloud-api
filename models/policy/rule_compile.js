
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
const ACTION = ['', 'ACCEPT', 'DENY', 'REJECT', 'CONTINUE'];

/*----------------------------------------------------------------------------------------------------------------------*/
RuleCompileModel.pre_compile_sd = (dir, sd) => {
	var items = [];
	for (var i = 0; i < sd.length; i++) {
		if (sd[i].type === 5) // Host
			items.push(dir + sd[i].address);
		else if (sd[i].type === 7) // Network
			items.push(dir + sd[i].address + "/" + sd[i].netmask);
	}

	return ((items.length>0) ? items : null);
};
/*----------------------------------------------------------------------------------------------------------------------*/

/*----------------------------------------------------------------------------------------------------------------------*/
RuleCompileModel.pre_compile_if = (dir, ifs) => {
	var items = [];
	for (var i = 0; i < ifs.length; i++)
		items.push(dir + ifs[i].name);
	
	return ((items.length>0) ? items : null);
};
/*----------------------------------------------------------------------------------------------------------------------*/

/*----------------------------------------------------------------------------------------------------------------------*/
// Agrupate services position by protocol number (TCP, UDP, ICMP, etc.) 
// Returns an array of strings with the services agrupated by protocol.
/*----------------------------------------------------------------------------------------------------------------------*/
RuleCompileModel.pre_compile_svc = (sep,svc) => {
	var items = [];
	var tcp = "";
	var udp = "";
	var icmp = "";
	var tmp = "";
	for (var i = 0; i < svc.length; i++) {
		switch (svc[i].protocol) {
			case 6: // TCP
				if (svc[i].source_port_end === 0) { // No source port.
					if (tcp)
						tcp += ",";
					tcp += (svc[i].destination_port_start === svc[i].destination_port_end) ? svc[i].destination_port_start : (svc[i].destination_port_start + sep + svc[i].destination_port_end);
				} else {
					tmp = "-p tcp --sport " + ((svc[i].source_port_start === svc[i].source_port_end) ? svc[i].source_port_start : (svc[i].source_port_start + sep + svc[i].source_port_end));
					if (svc[i].destination_port_end !== 0)
						tmp += " --dport " + ((svc[i].destination_port_start === svc[i].destination_port_end) ? svc[i].destination_port_start : (svc[i].destination_port_start + sep + svc[i].destination_port_end));
					items.push(tmp);
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
					items.push(tmp);
				}
				break;

			default: // Other IP protocols.
				items.push("-p "+svc[i].protocol);
				break;
		}
	}

	if (tcp) {
		if (sep===":")
			tcp = (tcp.indexOf(",") > -1) ? ("-p tcp -m multiport --dports " + tcp) : ("-p tcp --dport " + tcp);
		items.push(tcp);
	}
	if (udp) {
		if (sep===":")
			udp = (udp.indexOf(",") > -1) ? ("-p udp -m multiport --dports " + udp) : ("-p udp --dport " + udp);
		items.push(udp);
	}

	return ((items.length>0) ? items : null);
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

	if (policy_type === POLICY_TYPE_FORWARD) { src_position=2; dst_position=3; svc_position=4;}
	else { src_position=1; dst_position=2; svc_position=3;}
	
	// Generate items strings for all the rule positions.
	// WARNING: The order of creation of the arrays is important for optimization!!!!
	// The positions first in the array will be used first in the conditions.
	// INTERFACE IN / OUT
	if (items=RuleCompileModel.pre_compile_if(((policy_type===POLICY_TYPE_OUTPUT || policy_type===POLICY_TYPE_SNAT) ? "-o " : "-i "), data[0].positions[0].ipobjs)) position_items.push(items);
	// INTERFACE OUT
	if (policy_type===POLICY_TYPE_FORWARD && (items=RuleCompileModel.pre_compile_if("-o ", data[0].positions[1].ipobjs))) position_items.push(items);
	// SERVICE
	if (items=RuleCompileModel.pre_compile_svc(":",data[0].positions[svc_position].ipobjs)) position_items.push(items);
	// SOURCE
	if (items=RuleCompileModel.pre_compile_sd("-s ", data[0].positions[src_position].ipobjs)) position_items.push(items);
	// DESTINATION
	if (items=RuleCompileModel.pre_compile_sd("-d ", data[0].positions[dst_position].ipobjs)) position_items.push(items);

	// Order the resulting array by number of strings into each array.
	if (position_items.length < 2) // Don't need ordering.
		return position_items;
	for (var i = 0; i < position_items.length; i++) {
		for (var p = i, j = i + 1; j < position_items.length; j++) {
			if (position_items[j].length < position_items[p].length)
				p = j;
		}
		tmp = position_items[i];
		position_items[i] = position_items[p];
		position_items[p] = tmp;
	}

	return position_items;
};
/*----------------------------------------------------------------------------------------------------------------------*/

/*----------------------------------------------------------------------------------------------------------------------*/
RuleCompileModel.nat_action = (policy_type,trans_addr,trans_port) => {
  try {
		if (policy_type===POLICY_TYPE_SNAT && trans_addr.length === 0)
			return "MASQUERADE";

		if (trans_addr.length !== 1 || (trans_port.length!==0 && trans_port.length!==1))
			return null;
	
		var action = "";
		if (policy_type===POLICY_TYPE_SNAT)
			action = "SNAT --to-source "
		else
			action = "DNAT --to-destination "

		if (trans_addr.length === 1) 
			action += (RuleCompileModel.pre_compile_sd("",trans_addr))[0];
		if (trans_port.length === 1) 
			action += ":"+(RuleCompileModel.pre_compile_svc("-",trans_port))[0];

		return action;
  } catch (e) {        
    return null;	
  }
};
/*----------------------------------------------------------------------------------------------------------------------*/

/*----------------------------------------------------------------------------------------------------------------------*/
/* Get  policy_r by id and  by Id */
/*----------------------------------------------------------------------------------------------------------------------*/
RuleCompileModel.rule_compile = (cloud, fw, type, rule, callback) => {        
	Policy_rModel.getPolicy_rs_type(cloud, fw, type, rule, (error, data) => {
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
		var cs_trail = statefull = table = action = "";

		// Apply rule only to the selected firewall.
		if (data.fw_apply_to) {
			cs = "if [ \"$HOSTNAME\" = \""+data.firewall_name+"\" ]; then\n"+cs;
			cs_trail += "\nfi\n";
		}

		if (policy_type === 4) { // SNAT
			table = "-t nat";
			cs += table+" -A POSTROUTING ";
			if (!(action=RuleCompileModel.nat_action(policy_type,data[0].positions[4].ipobjs,data[0].positions[5].ipobjs))) {
				callback({"Msg": "Invalid NAT positions."},null);
				return;
			}
		}
		else if (policy_type === 5) { // DNAT
			table = "-t nat";
			cs += table+" -A PREROUTING ";
			if (!(action=RuleCompileModel.nat_action(policy_type,data[0].positions[4].ipobjs,data[0].positions[5].ipobjs))) {
				callback({"Msg": "Invalid NAT positions."},null);
				return;
			}
		}
		else { // Filter policy
			if (data.length != 1 || !(data[0].positions)
					|| !(data[0].positions[0].ipobjs) || !(data[0].positions[1].ipobjs) || !(data[0].positions[2].ipobjs)
					|| (policy_type === POLICY_TYPE_FORWARD && !(data[0].positions[3].ipobjs))) {
				callback({"Msg": "Bad rule data."},null);
				return;
			}
			cs += "-A " + POLICY_TYPE[policy_type] + " ";
			statefull ="-m state --state NEW ";
			action = ACTION[data[0].action];
		}
		cs_trail = statefull+"-j "+action+"\n";

		const position_items = RuleCompileModel.pre_compile(data);
		
		// Rule compilation process.
		if (position_items.length === 0) // No conditions rule.
			cs += cs_trail;
		else if (position_items.length === 1) { // One condition rule.
			if (position_items[0].length === 1) // Only one item in the condition.
				cs += position_items[0][0] + " " + cs_trail;
			else { // Multiple items in the condition.
				var cs1 = cs;
				cs = "";
				for (var i = 0; i < position_items[0].length; i++)
					cs += cs1 + position_items[0][i] + " " + cs_trail;
			}
		} else { // Multiple condition rules.
			for (var i = 0, j, chain_number = 1, chain_name = "", chain_next = ""; i < position_items.length; i++) {
				// We have the position_items array ordered by arrays length.
				if (position_items[i].length === 1)
					cs += position_items[i][0]+" ";
				else {
					chain_name = "FWCRULE"+rule+".CH"+chain_number;
					// If we are in the first condition.
					if (i === 0) {
						var cs1 = cs;
						cs = "";
						for (var j = 0; j < position_items[0].length; j++)
							cs += cs1+position_items[0][j]+((j < (position_items[0].length - 1)) ? " "+statefull+" -j "+chain_name+"\n" : " ");
					} else {
						// If we are at the end of the array, the next chain will be the rule action.
						chain_next = (i === ((position_items.length) - 1)) ? action : "FWCRULE"+rule+".CH"+(chain_number+1);
						cs = "$IPTABLES "+table+" -N "+chain_name+"\n"+cs+((chain_number === 1) ? statefull+" -j "+chain_name+"\n" : "");
						for (j = 0; j < position_items[i].length; j++) {
							cs += "$IPTABLES "+table+" -A "+chain_name+" "+position_items[i][j]+" -j "+chain_next+"\n";
						}
						chain_number++;
					}
				}
			}

			// If we have not used IPTABLES user defined chains.
			if (chain_number === 1)
				cs += cs_trail;
		}

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
	});
};
/*----------------------------------------------------------------------------------------------------------------------*/

/*----------------------------------------------------------------------------------------------------------------------*/
/* Get the rule compilation string or compile it if this string is not uptodate.
 /*----------------------------------------------------------------------------------------------------------------------*/
RuleCompileModel.get = (cloud, fw, type, rule) => {
	return new Promise((resolve,reject) => { 
		Policy_cModel.getPolicy_c(cloud, fw, rule, (error, data) => {
			if (error)
				reject(error);
			else if (data && data.length > 0) {
				if (data[0].c_status_recompile === 0)
					resolve(data[0].c_compiled);
				else {
					RuleCompileModel.rule_compile(cloud, fw, type, rule, (error,data) => {
						if (error)
							reject(error)
						else
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
