/**
 * Module to routing COMPILE requests
 * <br>BASE ROUTE CALL: <b>/policy/compile</b>
 *
 * @module Compile
 *
 * @requires express
 * @requires Policy_rModel
 *
 */


/**
 * Class to manage Compile Policy
 *
 * @class CompileRouter
 */


/**
 * Property  to manage express
 *
 * @property express
 * @type express
 */
var express = require('express');
/**
 * Property  to manage  route
 *
 * @property router
 * @type express.Router
 */
var router = express.Router();

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

/**
 * Property Model to manage compilation process
 *
 * @property RuleCompileModel
 * @type ../../models/compile/
 */
var RuleCompile = require('../../models/policy/rule_compile');

/**
 * Property Model to manage policy script generation and install process
 *
 * @property PolicyScript
 * @type ../../models/compile/
 */
var PolicyScript = require('../../models/policy/policy_script');

const config = require('../../config/config');
const FirewallModel = require('../../models/firewall/firewall');
const socketTools = require('../../utils/socket');
const policy_rModel = require('../../models/policy/policy_r');



/*----------------------------------------------------------------------------------------------------------------------*/
/* Compile a firewall rule. */
/*----------------------------------------------------------------------------------------------------------------------*/
router.put('/rule', async (req, res) => {
	try {
  	/* The get method of the RuleCompile model returns a promise. */
  	const data = await RuleCompile.get(req.body.fwcloud, req.body.firewall, req.body.type, req.body.rule);
		api_resp.getJson({"result": true, "cs": data}, api_resp.ACR_OK, '', 'COMPILE', null, jsonResp => res.status(200).json(jsonResp));
	} catch(error) { api_resp.getJson(error, api_resp.ACR_ERROR, '', 'COMPILE', error, jsonResp => res.status(200).json(jsonResp)) }
});
/*----------------------------------------------------------------------------------------------------------------------*/

/*----------------------------------------------------------------------------------------------------------------------*/
/* Compile a firewall. */
/*----------------------------------------------------------------------------------------------------------------------*/
router.put('/', (req, res) => {
	var fs = require('fs');
	var path = config.get('policy').data_dir;
	if (!fs.existsSync(path))
		fs.mkdirSync(path);
	path += "/" + req.body.fwcloud;
	if (!fs.existsSync(path))
		fs.mkdirSync(path);
	path += "/" + req.body.firewall;
	if (!fs.existsSync(path))
		fs.mkdirSync(path);
	path += "/" + config.get('policy').script_name;
	var stream = fs.createWriteStream(path);

	stream.on('open', async fd => {
		socketTools.init(req); // Init the socket used for message notification by the socketTools module.

		try {
			/* Generate the policy script. */
			let data = await PolicyScript.append(config.get('policy').header_file);
			data = await PolicyScript.dumpFirewallOptions(req.body.fwcloud,req.body.firewall,data);
			stream.write(data.cs + "greeting_msg() {\n" +
				"log \"FWCloud.net - Loading firewall policy generated: " + Date() + "\"\n}\n\n" +
				"policy_load() {\n");
			
			if (data.options & 0x0001) // Statefull firewall
				socketTools.msg("<strong>--- STATEFUL FIREWALL ---</strong>\n\n");
			else
				socketTools.msg("<strong>--- STATELESS FIREWALL ---</strong>\n\n");

			// Generate default rules for mangle table
			if (await policy_rModel.firewallWithMarkRules(req.dbCon,req.body.firewall)) {
				socketTools.msg("<strong>MANGLE TABLE:</strong>\n");
				socketTools.msg("Automatic rules.\n\n");
				stream.write("\n\necho -e \"\\n****************\\n* MANGLE TABLE *\\n****************\"\n");
				stream.write("#Automatic rules for mangle table.\n");
				stream.write("$IPTABLES -t mangle -A PREROUTING -j CONNMARK --restore-mark\n");
				stream.write("$IPTABLES -t mangle -A PREROUTING -m mark ! --mark 0 -j ACCEPT\n\n");
				stream.write("$IPTABLES -t mangle -A OUTPUT -j CONNMARK --restore-mark\n");
				stream.write("$IPTABLES -t mangle -A OUTPUT -m mark ! --mark 0 -j ACCEPT\n\n");
				stream.write("$IPTABLES -t mangle -A POSTROUTING -j CONNMARK --restore-mark\n");
				stream.write("$IPTABLES -t mangle -A POSTROUTING -m mark ! --mark 0 -j ACCEPT\n\n");
			}
			

			stream.write("\n\necho -e \"\\n***********************\\n* FILTER TABLE (IPv4) *\\n***********************\"\n");
			socketTools.msg("<strong>FILTER TABLE (IPv4):</strong>\n");
			stream.write("\n\necho -e \"\\nINPUT CHAIN\\n-----------\"\n");
			socketTools.msg("<strong>INPUT CHAIN:</strong>\n");
			let cs = await PolicyScript.dump(req,1);

			stream.write(cs + "\n\necho -e \"\\nOUTPUT CHAIN\\n------------\"\n");
			socketTools.msg("<strong>OUTPUT CHAIN:</strong>\n");
			cs = await PolicyScript.dump(req,2);

			stream.write(cs + "\n\necho -e \"\\nFORWARD CHAIN\\n-------------\"\n");
			socketTools.msg("<strong>FORWARD CHAIN:</strong>\n");
			cs = await PolicyScript.dump(req,3);

			socketTools.msg("<strong>NAT TABLE (IPv4):</strong>\n");
			stream.write(cs + "\n\necho -e \"\\nSNAT\\n----------\"\n");
			socketTools.msg("<strong>SNAT:</strong>\n");
			cs = await PolicyScript.dump(req,4);

			stream.write(cs + "\n\necho -e \"\\nDNAT\\n----------\"\n");
			socketTools.msg("<strong>DNAT:</strong>\n");
			cs = await PolicyScript.dump(req, 5);

			stream.write(cs+"\n\n");


			stream.write("\n\necho -e \"\\n***********************\\n* FILTER TABLE (IPv6) *\\n***********************\"\n");
			socketTools.msg("\n");
			socketTools.msg("\n");
			socketTools.msg("<strong>FILTER TABLE (IPv6):</strong>\n");
			stream.write("\n\necho -e \"\\nINPUT CHAIN\\n-----------\"\n");
			socketTools.msg("<strong>INPUT CHAIN:</strong>\n");
			cs = await PolicyScript.dump(req,61);

			stream.write(cs + "\n\necho -e \"\\nOUTPUT CHAIN\\n------------\"\n");
			socketTools.msg("<strong>OUTPUT CHAIN:</strong>\n");
			cs = await PolicyScript.dump(req,62);

			stream.write(cs + "\n\necho -e \"\\nFORWARD CHAIN\\n-------------\"\n");
			socketTools.msg("<strong>FORWARD CHAIN:</strong>\n");
			cs = await PolicyScript.dump(req,63);

			socketTools.msg("<strong>NAT TABLE (IPv6):</strong>\n");
			stream.write(cs + "\n\necho -e \"\\nSNAT\\n----------\"\n");
			socketTools.msg("<strong>SNAT:</strong>\n");
			cs = await PolicyScript.dump(req,64);

			stream.write(cs + "\n\necho -e \"\\nDNAT\\n----------\"\n");
			socketTools.msg("<strong>DNAT:</strong>\n");
			cs = await PolicyScript.dump(req, 65);

			stream.write(cs+"\n}\n\n");
			

			data = await PolicyScript.append(config.get('policy').footer_file);
			stream.write(data.cs);
			
			/* Close stream. */
			stream.end();
			
			// Update firewall status flags.
			await FirewallModel.updateFirewallStatus(req.body.fwcloud,req.body.firewall,"&~1");
			socketTools.msgEnd();
			api_resp.getJson(null, api_resp.ACR_OK, '', 'COMPILE', null, jsonResp => res.status(200).json(jsonResp));
		} catch(error) { 
			socketTools.msg(`\nERROR: ${error}\n`);
			socketTools.msgEnd();
			api_resp.getJson(null, api_resp.ACR_ERROR, '', 'COMPILE', error, jsonResp => res.status(200).json(jsonResp)) 
		}
	}).on('error', error => api_resp.getJson(null, api_resp.ACR_ERROR, '', 'COMPILE', error, jsonResp => res.status(200).json(jsonResp)))
});
/*----------------------------------------------------------------------------------------------------------------------*/

module.exports = router;

