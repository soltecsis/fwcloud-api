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
 * Module to routing OpenVPN requests
 * <br>BASE ROUTE CALL: <b>/vpn/openvpn</b>
 *
 * @module OpenVPN
 * 
 * @requires express
 * @requires openvpnModel
 * 
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
 * Property Model to manage OpenVPN Data
 *
 * @property ClusterModel
 * @type ../../models/vpn/openvpn
 */

import { PolicyRuleToOpenVPN } from '../../../models/policy/PolicyRuleToOpenVPN';
import { Crt } from '../../../models/vpn/pki/Crt';
import { OpenVPNPrefix } from '../../models/vpn/openvpn/OpenVPNPrefix';
const openvpnModel = require('../../../models/vpn/openvpn/openvpn');
const policy_cModel = require('../../../models/policy/policy_c');
const fwcTreeModel = require('../../../models/tree/tree');
const restrictedCheck = require('../../../middleware/restricted');
const ipobjModel = require('../../../models/ipobj/ipobj');
const fwcError = require('../../../utils/error_table');


/**
 * Create a new OpenVPN configuration in firewall.
 */
router.post('/', async(req, res) => {
	try {
		// Verify that the node tree type is correct.
		if (req.tree_node.node_type !== 'OPN' && req.tree_node.node_type !== 'OSR')
			throw fwcError.BAD_TREE_NODE_TYPE;

		// Verify that the OpenVPN configuration is the same indicated in the tree node.
		if (req.body.openvpn && req.body.openvpn != req.tree_node.id_obj)
			throw {'msg': 'Information in node tree and in API request don\'t match'};

		// Verify that we are using the correct type of certificate.
		// 1=Client certificate, 2=Server certificate.
		if (req.crt.type===1 && !req.body.openvpn)
			throw {'msg': 'When using client certificates you must indicate the OpenVPN server configuration'};
		if (req.crt.type===2 && req.body.openvpn)
			throw {'msg': 'When using server certificates you must not indicate the OpenVPN server configuration'};

		// The client certificate for a new OpenVPN client configuration must belong to the same CA
		// that the OpenVPN server configuration to which we are vinculationg this new client VPN.
		if (req.crt.type===1 && req.crt.ca!==req.openvpn.ca) 
			throw {'msg': 'CRT for a new client OpenVPN configuration must has the same CA that the server OpenVPN configuration to which it belongs'};

		// The firewall id for the new OpenVPN client configuration must be the same firewall id of
		// the server OpenVPN configuration.
		if (req.crt.type===1 && req.body.firewall!==req.openvpn.firewall) 
			throw {'msg': 'Firewall ID for the new client OpenVPN configuration must match server OpenVPN configuration'};

		const cfg = await openvpnModel.addCfg(req);

		// Now create all the options for the OpenVPN configuration.
		var order = 1;
		for (let opt of req.body.options) {
			opt.openvpn = cfg;
			opt.order = order++;
			await openvpnModel.addCfgOpt(req, opt);
		}

		// Create the OpenVPN configuration node in the tree.
		let nodeId;
		if (req.tree_node.node_type === 'OPN') // This will be an OpenVPN server configuration.
			nodeId = await fwcTreeModel.newNode(req.dbCon, req.body.fwcloud, req.crt.cn, req.body.node_id, 'OSR', cfg, 312);
		else if (req.tree_node.node_type === 'OSR') { // This will be an OpenVPN client configuration.
			//nodeId = await fwc_treeModel.newNode(req.dbCon, req.body.fwcloud, req.crt.cn, req.body.node_id, 'OCL', cfg, 311);
			await OpenVPNPrefix.applyOpenVPNPrefixes(req.dbCon,req.body.fwcloud,req.body.openvpn);
		}

		// Invalidate the compilation of the rules that use a prefix that use this new OpenVPN configuration.
		let rules = await PolicyRuleToOpenVPN.searchOpenvpnInPrefixInRule(req.dbCon,req.body.fwcloud,cfg);
		await policy_cModel.deleteRulesCompilation(req.body.fwcloud,rules);

		// Invalidate the compilation of the rules that use a group that contains a prefix that use this new OpenVPN configuration.
		let groups = await PolicyRuleToOpenVPN.searchOpenvpnInPrefixInGroup(req.dbCon,req.body.fwcloud,cfg);
		await policy_cModel.deleteGroupsInRulesCompilation(req.dbCon,req.body.fwcloud,groups);

		// If we are creaing an OpenVPN server configuration, then create the VPN virtual network interface with its assigned IP.
		if (req.crt.type===2) // 1=Client certificate, 2=Server certificate.
			await openvpnModel.createOpenvpnServerInterface(req,cfg);

		res.status(200).json({insertId: cfg, TreeinsertId: nodeId});
	} catch(error) { res.status(400).json(error) }
});


/**
 * Update configuration options.
 */
router.put('/', async(req, res) => {
	try {
		// Invalidate the compilation of the rules using this OpenVPN configuration.
		let rules = await PolicyRuleToOpenVPN.searchOpenvpnInRule(req.dbCon,req.body.fwcloud,req.body.openvpn);
		// Invalidate the compilation of the rules that use a prefix that use this OpenVPN configuration.
		rules = rules.concat(await PolicyRuleToOpenVPN.searchOpenvpnInPrefixInRule(req.dbCon,req.body.fwcloud,req.body.openvpn));
		await policy_cModel.deleteRulesCompilation(req.body.fwcloud,rules);
		
		// Invalidate the compilation of the rules that use a group that use this OpenVPN configuration.
		let groups = await PolicyRuleToOpenVPN.searchOpenvpnInGroup(req.dbCon,req.body.fwcloud,req.body.openvpn);
		// Invalidate the compilation of the rules that use a group that contains a prefix that use this OpenVPN configuration.
		groups = groups.concat(await PolicyRuleToOpenVPN.searchOpenvpnInPrefixInGroup(req.dbCon,req.body.fwcloud,req.body.openvpn));
		await policy_cModel.deleteGroupsInRulesCompilation(req.dbCon, req.body.fwcloud,groups);

		await openvpnModel.updateCfg(req);

		// First remove all the current configuration options.
		await openvpnModel.delCfgOptAll(req);

		// Now create all the new options for the OpenVPN configuration.
		var order = 1;
		for (let opt of req.body.options) {
			opt.openvpn = req.body.openvpn;
			opt.order = order++;
			await openvpnModel.addCfgOpt(req, opt);
		}

		// Update the status flag for the OpenVPN configuration.
		await openvpnModel.updateOpenvpnStatus(req.dbCon,req.body.openvpn,"|1");

		res.status(204).end();
	} catch(error) { res.status(400).json(error) }
});


/**
 * Get OpenVPN configuration data.
 */
router.put('/get', async(req, res) => {
	try {
		const data = await openvpnModel.getCfg(req);
		res.status(200).json(data);
	} catch(error) { res.status(400).json(error) }
});


/**
 * Get OpenVPN configuration files.
 */
router.put('/file/get', async(req, res) => {
	try {
		const cfgDump = await openvpnModel.dumpCfg(req.dbCon,req.body.fwcloud,req.body.openvpn);
 		res.status(200).json(cfgDump);
	} catch(error) { res.status(400).json(error) }
});


/**
 * Get OpenVPN ipobj data.
 */
router.put('/ipobj/get', async(req, res) => {
	try {
		const cfgData = await openvpnModel.getCfg(req);
		let data = [];
		for (let openvpn_opt of cfgData.options) {
			if (openvpn_opt.ipobj)
				data.push(await ipobjModel.getIpobjInfo(req.dbCon,req.body.fwcloud,openvpn_opt.ipobj));
		}
		res.status(200).json(data);
	} catch(error) { res.status(400).json(error) }
});


/**
 * Get next VPN LAN free IP.
 */
router.put('/ip/get', async(req, res) => {
	try {
		const freeIP = await openvpnModel.freeVpnIP(req);
		res.status(200).json(freeIP);
	} catch(error) { res.status(400).json(error) }
});


/**
 * Get OpenVPN configuration metadata.
 */
router.put('/info/get', async(req, res) => {
	try {
		const data = await openvpnModel.getOpenvpnInfo(req.dbCon,req.body.fwcloud,req.body.openvpn,req.openvpn.type);
		res.status(200).json(data[0]);
	} catch(error) { res.status(400).json(error) }
});



/**
 * Delete OpenVPN configuration.
 */
router.put('/del',
restrictedCheck.openvpn,
async(req, res) => {
	try {
		// Invalidate the compilation of the rules that use a prefix that use this removed OpenVPN configuration.
		let rules = await PolicyRuleToOpenVPN.searchOpenvpnInPrefixInRule(req.dbCon,req.body.fwcloud,req.body.openvpn);
		await policy_cModel.deleteRulesCompilation(req.body.fwcloud,rules);

		// Invalidate the compilation of the rules that use a group that contains a prefix that use this removed OpenVPN configuration.
		let groups = await PolicyRuleToOpenVPN.searchOpenvpnInPrefixInGroup(req.dbCon,req.body.fwcloud,req.body.openvpn);
		await policy_cModel.deleteGroupsInRulesCompilation(req.dbCon,req.body.fwcloud,groups);
		
		// Delete the configuration from de database.
		await openvpnModel.delCfg(req.dbCon, req.body.fwcloud, req.body.openvpn);

		if (req.openvpn.type === 1) { // Client OpenVPN configuration.
			// Regenerate the tree under the OpenVPN server to which the client OpenVPN configuration belongs.
			// This is necesary for avoid empty prefixes if we remove all the OpenVPN client configurations for a prefix.
			await OpenVPNPrefix.applyOpenVPNPrefixes(req.dbCon,req.body.fwcloud,req.openvpn.openvpn);
		} else { // Server OpenVPN configuration.
			// Delete the openvpn node from the tree.
			await fwcTreeModel.deleteObjFromTree(req.body.fwcloud, req.body.openvpn, 312);
		}

		res.status(204).end();
	} catch(error) { res.status(400).json(error) }
});

// API call for check deleting restrictions.
router.put('/restricted', restrictedCheck.openvpn, (req, res) => res.status(204).end());


router.put('/where', async (req, res) => {
	try {
		const data = await openvpnModel.searchOpenvpnUsage(req.dbCon,req.body.fwcloud,req.body.openvpn);
    if (data.result > 0)
      res.status(200).json(data);
    else
			res.status(204).end();
	} catch(error) { res.status(400).json(error) }
});
	

/**
 * Install OpenVPN configuration in the destination firewall.
 */
router.put('/install', async(req, res) => {
	try {
		const cfgDump = await openvpnModel.dumpCfg(req.dbCon,req.body.fwcloud,req.body.openvpn);
		const crt = await Crt.getCRTdata(req.dbCon,req.openvpn.crt);

		// Next we have to activate the OpenVPN configuration in the destination firewall/cluster.
		if (crt.type === 1) { // Client certificate
			// Obtain de configuration directory in the client-config-dir configuration option.
			// req.openvpn.openvpn === ID of the server's OpenVPN configuration to which this OpenVPN client config belongs.
			const openvpn_opt = await openvpnModel.getOptData(req.dbCon,req.openvpn.openvpn,'client-config-dir');
			if (!openvpn_opt) throw fwcError.VPN_NOT_FOUND_CFGDIR;
			await openvpnModel.installCfg(req,cfgDump.ccd,openvpn_opt.arg,crt.cn,1,true);
		}
		else { // Server certificate
			if (!req.openvpn.install_dir || !req.openvpn.install_name)
				throw {'msg': 'Empty install dir or install name'};
			await openvpnModel.installCfg(req,cfgDump.cfg,req.openvpn.install_dir,req.openvpn.install_name,2,true);
		}

		// Update the status flag for the OpenVPN configuration.
		await openvpnModel.updateOpenvpnStatus(req.dbCon,req.body.openvpn,"&~1");

		// Update the install date.
		await openvpnModel.updateOpenvpnInstallDate(req.dbCon, req.body.openvpn);

		res.status(204).end();
	} catch(error) { res.status(400).json(error) }
});


/**
 * Uninstall OpenVPN configuration from the destination firewall.
 */
router.put('/uninstall', async(req, res) => {
	try {
		const crt = await Crt.getCRTdata(req.dbCon,req.openvpn.crt);

		if (crt.type === 1) { // Client certificate
			// Obtain de configuration directory in the client-config-dir configuration option.
			// req.openvpn.openvpn === ID of the server's OpenVPN configuration to which this OpenVPN client config belongs.
			const openvpn_opt = await openvpnModel.getOptData(req.dbCon,req.openvpn.openvpn,'client-config-dir');
			if (!openvpn_opt) throw fwcError.VPN_NOT_FOUND_CFGDIR;
			await openvpnModel.uninstallCfg(req,openvpn_opt.arg,crt.cn);
		}
		else { // Server certificate
			if (!req.openvpn.install_dir || !req.openvpn.install_name)
				throw {'msg': 'Empty install dir or install name'};
			await openvpnModel.uninstallCfg(req,req.openvpn.install_dir,req.openvpn.install_name);
		}

		// Update the status flag for the OpenVPN configuration.
		await openvpnModel.updateOpenvpnStatus(req.dbCon,req.body.openvpn,"|1");

		res.status(204).end();
	} catch(error) { res.status(400).json(error) }
});

/**
 * Sync all CCD file configurations.
 * Remove first all the server CCD files and then install all the CCD files.
 * ROUTE CALL:  /vpn/openvpn/ccdsync
 */
router.put('/ccdsync', async(req, res) => {
	try {
		const crt = await Crt.getCRTdata(req.dbCon,req.openvpn.crt);
		if (crt.type !== 2) // This action only can be done in server OpenVPN configurations.
			throw fwcError.VPN_NOT_SER;

		// Obtain the configuration directory in the client-config-dir configuration option of the OpenVPN
		// server configuration.
		const openvpn_opt = await openvpnModel.getOptData(req.dbCon,req.body.openvpn,'client-config-dir');
		if (!openvpn_opt) throw fwcError.VPN_NOT_FOUND_CFGDIR;
		const client_config_dir = openvpn_opt.arg;

		// Get all client configurations for this OpenVPN server configuration.
		const clients = await openvpnModel.getOpenvpnClients(req.dbCon,req.body.openvpn);

		for (let client of clients) {
			let cfgDump = await openvpnModel.dumpCfg(req.dbCon,req.body.fwcloud,client.id);
			await openvpnModel.installCfg(req,cfgDump.ccd,client_config_dir,client.cn,1,false);

			// Update the status flag for the OpenVPN configuration.
			await openvpnModel.updateOpenvpnStatus(req.dbCon,client.id,"&~1");
		}

		// Get the list of files into the client-config-dir directory.
		// If we have files in the client-config-dir with no corresponding OpenVPN configuration inform the user.
		await openvpnModel.ccdCompare(req,client_config_dir,clients)

		res.status(204).end();
	} catch(error) { res.status(400).json(error) }
});


/**
 * Get the OpenVPN server status log file.
 */
router.put('/status/get', async(req, res) => {
	try {
		const crt = await Crt.getCRTdata(req.dbCon,req.openvpn.crt);
		if (crt.type !== 2) // This action only can be done in server OpenVPN configurations.
			throw fwcError.VPN_NOT_SER;

		// Obtain the status log file option of the OpeVPN server configuration.
		const openvpn_opt = await openvpnModel.getOptData(req.dbCon,req.body.openvpn,'status');
		if (!openvpn_opt) throw fwcError.VPN_NOT_FOUND_STATUS;
		const status_file_path = openvpn_opt.arg;

		const data = await openvpnModel.getStatusFile(req,status_file_path);

		res.status(200).json(data);
	} catch(error) { res.status(400).json(error) }
});


module.exports = router;