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
 * Property Model to manage compilation process
 *
 * @property RuleCompileModel
 * @type ../../models/compile/
 */
import { IPTablesCompiler } from '../../compiler/iptables/iptables-compiler';

/**
 * Property Model to manage policy script generation and install process
 *
 * @property PolicyScript
 * @type ../../models/compile/
 */
import { PolicyScript } from '../../compiler/PolicyScript';

import { PolicyCompiler } from '../../compiler/PolicyCompiler';


const config = require('../../config/config');
import { Firewall } from '../../models/firewall/Firewall';
import { PolicyRule } from '../../models/policy/PolicyRule';
import { Channel } from '../../sockets/channels/channel';
import { ProgressPayload, ProgressNoticePayload, ProgressErrorPayload } from '../../sockets/messages/socket-message';
import { logger } from '../../fonaments/abstract-application';
const fwcError = require('../../utils/error_table');


/*----------------------------------------------------------------------------------------------------------------------*/
/* Compile a firewall rule. */
/*----------------------------------------------------------------------------------------------------------------------*/
router.put('/rule', async (req, res) => {
	try {
		//console.time(`Rule compile (ID: ${req.body.rule})`);
		const rulesCompiled = await PolicyCompiler.compile(req.dbCon, req.body.fwcloud, req.body.firewall, req.body.type, req.body.rule);
		//console.timeEnd(`Rule compile (ID: ${req.body.rule})`);

		if (rulesCompiled.length === 0)
			throw new Error('It was not possible to compile the rule');

		res.status(200).json({"result": true, "cs": rulesCompiled[0].cs});
	} catch(error) {
		logger().error('Error compiling firewall rule: ' + JSON.stringify(error));
		res.status(400).json(error);
	}
});
/*----------------------------------------------------------------------------------------------------------------------*/

/*----------------------------------------------------------------------------------------------------------------------*/
/* Compile a firewall. */
/*----------------------------------------------------------------------------------------------------------------------*/
router.put('/', async (req, res) => {
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

	const channel = await Channel.fromRequest(req);

	stream.on('open', async fd => {
		try {
			/* Generate the policy script. */
			let data = await PolicyScript.append(config.get('policy').header_file);
			data = await PolicyScript.dumpFirewallOptions(req.body.fwcloud,req.body.firewall,data);
			stream.write(data.cs + "greeting_msg() {\n" +
				"log \"FWCloud.net - Loading firewall policy generated: " + Date() + "\"\n}\n\n" +
				"policy_load() {\n");
			
			if (data.options & 0x0001) { // Statefull firewall
				channel.emit('message', new ProgressNoticePayload('--- STATEFUL FIREWALL ---', true));
			} else {
				channel.emit('message', new ProgressNoticePayload('--- STATELESS FIREWALL ---', true));
			}

			// Generate default rules for mangle table
			if (await PolicyRule.firewallWithMarkRules(req.dbCon,req.body.firewall)) {
				channel.emit('message', new ProgressNoticePayload("MANGLE TABLE:", true));
				channel.emit('message', new ProgressNoticePayload("Automatic rules."));
				stream.write("\n\necho\n");
				stream.write("echo \"****************\"\n");
				stream.write("echo \"* MANGLE TABLE *\"\n");
				stream.write("echo \"****************\"\n");
				stream.write("#Automatic rules for mangle table.\n");
				stream.write("$IPTABLES -t mangle -A PREROUTING -j CONNMARK --restore-mark\n");
				stream.write("$IPTABLES -t mangle -A PREROUTING -m mark ! --mark 0 -j ACCEPT\n\n");
				stream.write("$IPTABLES -t mangle -A OUTPUT -j CONNMARK --restore-mark\n");
				stream.write("$IPTABLES -t mangle -A OUTPUT -m mark ! --mark 0 -j ACCEPT\n\n");
				stream.write("$IPTABLES -t mangle -A POSTROUTING -j CONNMARK --restore-mark\n");
				stream.write("$IPTABLES -t mangle -A POSTROUTING -m mark ! --mark 0 -j ACCEPT\n\n");
			}
			

			stream.write("\n\necho\n");
			stream.write("echo \"***********************\"\n");
			stream.write("echo \"* FILTER TABLE (IPv4) *\"\n");
			stream.write("echo \"***********************\"\n");
			channel.emit('message', new ProgressNoticePayload("FILTER TABLE (IPv4):", true));
			stream.write("\n\necho \"INPUT CHAIN\"\n");
			stream.write("echo \"-----------\"\n");
			channel.emit('message', new ProgressNoticePayload("INPUT CHAIN:", true));
			let cs = await PolicyScript.dump(req, 1, channel);

			stream.write(cs + "\n\necho\n");
			stream.write("echo \"OUTPUT CHAIN\"\n");
			stream.write("echo \"------------\"\n");
			channel.emit('message', new ProgressNoticePayload("OUTPUT CHAIN:", true));
			cs = await PolicyScript.dump(req,2, channel);

			stream.write(cs + "\n\necho\n");
			stream.write("echo \"FORWARD CHAIN\"\n");
			stream.write("echo \"-------------\"\n");
			channel.emit('message', new ProgressNoticePayload("FORWARD CHAIN:", true));
			cs = await PolicyScript.dump(req,3, channel);

			stream.write(cs + "\n\necho\n");
			stream.write("echo \"********************\"\n");
			stream.write("echo \"* NAT TABLE (IPv4) *\"\n");
			stream.write("echo \"********************\"\n");
			channel.emit('message', new ProgressNoticePayload("NAT TABLE (IPv4):", true));
			stream.write("\n\necho \"SNAT\"\n");
			stream.write("echo \"----\"\n");
			channel.emit('message', new ProgressNoticePayload("SNAT:", true));
			cs = await PolicyScript.dump(req,4, channel);

			stream.write(cs + "\n\necho\n");
			stream.write("echo \"DNAT\"\n");
			stream.write("echo \"----\"\n");
			channel.emit('message', new ProgressNoticePayload("DNAT:", true));
			cs = await PolicyScript.dump(req, 5, channel);

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
			cs = await PolicyScript.dump(req,61, channel);

			stream.write(cs + "\n\necho\n");
			stream.write("echo \"OUTPUT CHAIN\"\n");
			stream.write("echo \"------------\"\n");
			channel.emit('message', new ProgressNoticePayload("OUTPUT CHAIN:", true));
			cs = await PolicyScript.dump(req,62, channel);

			stream.write(cs + "\n\necho\n");
			stream.write("echo \"FORWARD CHAIN\"\n");
			stream.write("echo \"-------------\"\n");
			channel.emit('message', new ProgressNoticePayload("FORWARD CHAIN:", true));
			cs = await PolicyScript.dump(req,63, channel);

			stream.write(cs + "\n\necho\n");
			stream.write("echo \"********************\"\n");
			stream.write("echo \"* NAT TABLE (IPv6) *\"\n");
			stream.write("echo \"********************\"\n");
			channel.emit('message', new ProgressNoticePayload("NAT TABLE (IPv6):", true));
			stream.write("\n\necho \"SNAT\"\n");
			stream.write("echo \"----\"\n");
			channel.emit('message', new ProgressNoticePayload("SNAT:", true));
			cs = await PolicyScript.dump(req,64, channel);

			stream.write(cs + "\n\necho\n");
			stream.write("echo \"DNAT\"\n");
			stream.write("echo \"----\"\n");
			channel.emit('message', new ProgressNoticePayload("DNAT:", true));
			cs = await PolicyScript.dump(req, 65, channel);

			stream.write(cs+"\n}\n\n");
			

			data = await PolicyScript.append(config.get('policy').footer_file);
			stream.write(data.cs);
			
			/* Close stream. */
			stream.end();
			
			// Update firewall status flags.
			await Firewall.updateFirewallStatus(req.body.fwcloud,req.body.firewall,"&~1");
			// Update firewall compile date.
			await Firewall.updateFirewallCompileDate(req.body.fwcloud,req.body.firewall);

			channel.emit('message', new ProgressPayload('end', false, "Compilation finished"));

			//console.log(`Total get data time: ${IPTablesCompiler.totalGetDataTime}ms`)
			//console.timeEnd(`Firewall compile (ID: ${req.body.firewall})`);

			res.status(204).end();
		} catch(error) { 
			channel.emit('message', new ProgressErrorPayload('end', true, `ERROR: ${error}`));
			logger().error('Error compiling firewall: ' + JSON.stringify(error));
			res.status(400).json(error);		
		}
	}).on('error', error => {
		throw error;
	});
});
/*----------------------------------------------------------------------------------------------------------------------*/

module.exports = router;

