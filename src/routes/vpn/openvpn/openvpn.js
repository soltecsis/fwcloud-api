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

import { Crt } from '../../../models/vpn/pki/Crt';
import { OpenVPNPrefix } from '../../../models/vpn/openvpn/OpenVPNPrefix';
import { OpenVPN } from '../../../models/vpn/openvpn/OpenVPN';
import { Tree } from '../../../models/tree/Tree';
const restrictedCheck = require('../../../middleware/restricted');
import { IPObj } from '../../../models/ipobj/IPObj';
import { Channel } from '../../../sockets/channels/channel';
import { ProgressPayload } from '../../../sockets/messages/socket-message';
import { logger } from '../../../fonaments/abstract-application';
import { Firewall } from '../../../models/firewall/Firewall';
import { Cluster } from '../../../models/firewall/Cluster';
import { getRepository } from 'typeorm';
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

		const newOpenvpn = await OpenVPN.addCfg(req);

		// Now create all the options for the OpenVPN configuration.
		var order = 1;
		for (let opt of req.body.options) {
			opt.openvpn = newOpenvpn;
			opt.order = order++;
			await OpenVPN.addCfgOpt(req, opt);
		}

		// Create the OpenVPN configuration node in the tree.
		let nodeId;
		if (req.tree_node.node_type === 'OPN') // This will be an OpenVPN server configuration.
			nodeId = await Tree.newNode(req.dbCon, req.body.fwcloud, req.crt.cn, req.body.node_id, 'OSR', newOpenvpn, 312);
		else if (req.tree_node.node_type === 'OSR') { // This will be an OpenVPN client configuration.
			//nodeId = await fwc_treeModel.newNode(req.dbCon, req.body.fwcloud, req.crt.cn, req.body.node_id, 'OCL', cfg, 311);
			await OpenVPNPrefix.applyOpenVPNPrefixes(req.dbCon,req.body.fwcloud,req.body.openvpn);

			// Update the compilation status of all the firewalls that use the VPN Prefixes to which this new OpenVPN
			// connection will belong.
			await OpenVPNPrefix.updateOpenvpnClientPrefixesFWStatus(req.dbCon, req.body.fwcloud, newOpenvpn);
		}

		// If we are creaing an OpenVPN server configuration, then create the VPN virtual network interface with its assigned IP.
		if (req.crt.type===2) // 1=Client certificate, 2=Server certificate.
			await OpenVPN.createOpenvpnServerInterface(req,newOpenvpn);

		res.status(200).json({insertId: newOpenvpn, TreeinsertId: nodeId});
	} catch(error) {
		logger().error('Error creating a new openvpn: ' + JSON.stringify(error));
		res.status(400).json(error);
	}
});


/**
 * Update configuration options.
 */
router.put('/', async(req, res) => {
	try {
		await OpenVPN.updateCfg(req);

		// First remove all the current configuration options.
		await OpenVPN.delCfgOptAll(req);

		// Now create all the new options for the OpenVPN configuration.
		var order = 1;
		for (let opt of req.body.options) {
			opt.openvpn = req.body.openvpn;
			opt.order = order++;
			await OpenVPN.addCfgOpt(req, opt);
		}

		// Update the status flag for the OpenVPN configuration.
		await OpenVPN.updateOpenvpnStatus(req.dbCon,req.body.openvpn,"|1");

		res.status(204).end();
	} catch(error) {
		logger().error('Error updating an openvpn: ' + JSON.stringify(error));
		res.status(400).json(error);
	}
});


/**
 * Get OpenVPN configuration data.
 */
router.put('/get', async(req, res) => {
	try {
		const data = await OpenVPN.getCfg(req);
		res.status(200).json(data);
	} catch(error) {
		logger().error('Error getting an openvpn: ' + JSON.stringify(error));
		res.status(400).json(error);
	}
});


/**
 * Get OpenVPN configuration files.
 */
router.put('/file/get', async(req, res) => {
	try {
		const cfgDump = await OpenVPN.dumpCfg(req.dbCon,req.body.fwcloud,req.body.openvpn);
 		res.status(200).json(cfgDump);
	} catch(error) {
		logger().error('Error getting openvpn configuration: ' + JSON.stringify(error));
		res.status(400).json(error);
	}
});


/**
 * Get OpenVPN ipobj data.
 */
router.put('/ipobj/get', async(req, res) => {
	try {
		const cfgData = await OpenVPN.getCfg(req);
		let data = [];
		for (let openvpn_opt of cfgData.options) {
			if (openvpn_opt.ipobj)
				data.push(await IPObj.getIpobjInfo(req.dbCon,req.body.fwcloud,openvpn_opt.ipobj));
		}
		res.status(200).json(data);
	} catch(error) {
		logger().error('Error getting openvpn ipobj: ' + JSON.stringify(error));
		res.status(400).json(error);
	}
});


/**
 * Get next VPN LAN free IP.
 */
router.put('/ip/get', async(req, res) => {
	try {
		const freeIP = await OpenVPN.freeVpnIP(req);
		res.status(200).json(freeIP);
	} catch(error) {
		logger().error('Error getting openvpn free ip: ' + JSON.stringify(error));
		res.status(400).json(error);
	}
});


/**
 * Get OpenVPN configuration metadata.
 */
router.put('/info/get', async(req, res) => {
	try {
		const data = await OpenVPN.getOpenvpnInfo(req.dbCon,req.body.fwcloud,req.body.openvpn,req.openvpn.type);
		res.status(200).json(data[0]);
	} catch(error) { 
		logger().error('Error getting openvpn metadata: ' + JSON.stringify(error));
		res.status(400).json(error);
	}
});


/**
 * Get OpenVPN server's data under given firewall.
 */
router.put('/firewall/get', async(req, res) => {
	try {
		const data = await OpenVPN.getOpenvpnServersByFirewall(req.dbCon,req.body.firewall);
		res.status(200).json(data);
	} catch(error) {
		logger().error('Error getting openvpn firewall data: ' + JSON.stringify(error));
		res.status(400).json(error);
	}
});


/**
 * Delete OpenVPN configuration.
 */
router.put('/del',
restrictedCheck.openvpn,
async(req, res) => {
	try {
		// Update the compilation status of all the firewalls that use the VPN Prefixes to which this OpenVPN
		// connection belongs. It must be done before the OpenVPN deletion.
		if (req.openvpn.type === 1) await OpenVPNPrefix.updateOpenvpnClientPrefixesFWStatus(req.dbCon, req.body.fwcloud, req.body.openvpn);
		
		// Delete the configuration from de database.
		await OpenVPN.delCfg(req.dbCon, req.body.fwcloud, req.body.openvpn);

		if (req.openvpn.type === 1) { // Client OpenVPN configuration.
			// Regenerate the tree under the OpenVPN server to which the client OpenVPN configuration belongs.
			// This is necesary for avoid empty prefixes if we remove all the OpenVPN client configurations for a prefix.
			await OpenVPNPrefix.applyOpenVPNPrefixes(req.dbCon,req.body.fwcloud,req.openvpn.openvpn);

		} else { // Server OpenVPN configuration.
			// Delete the openvpn node from the tree.
			await Tree.deleteObjFromTree(req.body.fwcloud, req.body.openvpn, 312);
		}

		res.status(204).end();
	} catch(error) {
		logger().error('Error removing openvpn: ' + JSON.stringify(error));
		res.status(400).json(error);
	}
});

// API call for check deleting restrictions.
router.put('/restricted', restrictedCheck.openvpn, (req, res) => res.status(204).end());


router.put('/where', async (req, res) => {
	try {
		const data = await OpenVPN.searchOpenvpnUsage(req.dbCon, req.body.fwcloud, req.body.openvpn, true);
    if (data.result > 0)
      res.status(200).json(data);
    else
			res.status(204).end();
	} catch(error) {
		logger().error('Error getting openvpn references: ' + JSON.stringify(error));
		res.status(400).json(error);
	}
});
	

/**
 * Install OpenVPN configuration in the destination firewall.
 */
router.put('/install', async(req, res) => {
	try {
		const channel = await Channel.fromRequest(req);
		const cfgDump = await OpenVPN.dumpCfg(req.dbCon,req.body.fwcloud,req.body.openvpn);
		const crt = await Crt.getCRTdata(req.dbCon,req.openvpn.crt);
		const firewall = await getRepository(Firewall).findOneOrFail(req.body.firewall);
		const communication = await firewall.getCommunication();
		
		channel.emit('message', new ProgressPayload('start', false, 'Installing OpenVPN'));

		// Next we have to activate the OpenVPN configuration in the destination firewall/cluster.
		if (crt.type === 1) { // Client certificate
			// Obtain de configuration directory in the client-config-dir configuration option.
			// req.openvpn.openvpn === ID of the server's OpenVPN configuration to which this OpenVPN client config belongs.
			const openvpn_opt = await OpenVPN.getOptData(req.dbCon,req.openvpn.openvpn,'client-config-dir');
			if (!openvpn_opt) throw fwcError.VPN_NOT_FOUND_CFGDIR;
			await communication.installOpenVPNConfig(cfgDump.ccd, openvpn_opt.arg, crt.cn, 1, channel);
		}
		else { // Server certificate
			if (!req.openvpn.install_dir || !req.openvpn.install_name)
				throw {'msg': 'Empty install dir or install name'};
				await communication.installOpenVPNConfig(req, cfgDump.cfg, req.openvpn.install_dir, req.openvpn.install_name, 2, channel);
		}

		// Update the status flag for the OpenVPN configuration.
		await OpenVPN.updateOpenvpnStatus(req.dbCon,req.body.openvpn,"&~1");

		// Update the install date.
		await OpenVPN.updateOpenvpnInstallDate(req.dbCon, req.body.openvpn);

		channel.emit('message', new ProgressPayload('end', false, 'Installing OpenVPN'));
		res.status(200).send();
	} catch(error) { 
		logger().error('Error installing openvpn: ' + JSON.stringify(error));
		if (error.message)
			res.status(400).json({message: error.message});
		else
			res.status(400).json(error);
	}
});


/**
 * Uninstall OpenVPN configuration from the destination firewall.
 */
router.put('/uninstall', async(req, res) => {
	try {
		const firewall = await getRepository(Firewall).findOneOrFail(req.body.firewall);
		const channel = await Channel.fromRequest(req);
		const crt = await Crt.getCRTdata(req.dbCon,req.openvpn.crt);
		const communication = await firewall.getCommunication();

		channel.emit('message', new ProgressPayload('start', false, 'Uninstalling OpenVPN'));

		if (crt.type === 1) { // Client certificate
			// Obtain de configuration directory in the client-config-dir configuration option.
			// req.openvpn.openvpn === ID of the server's OpenVPN configuration to which this OpenVPN client config belongs.
			const openvpn_opt = await OpenVPN.getOptData(req.dbCon,req.openvpn.openvpn,'client-config-dir');
			if (!openvpn_opt) throw fwcError.VPN_NOT_FOUND_CFGDIR;
			await communication.uninstallOpenVPNConfig(openvpn_opt.arg,crt.cn, channel);
		}
		else { // Server certificate
			if (!req.openvpn.install_dir || !req.openvpn.install_name)
				throw {'msg': 'Empty install dir or install name'};
			await communication.uninstallOpenVPNConfig(req.openvpn.install_dir,req.openvpn.install_name, channel);
		}

		// Update the status flag for the OpenVPN configuration.
		await OpenVPN.updateOpenvpnStatus(req.dbCon,req.body.openvpn,"|1");

		channel.emit('message', new ProgressPayload('end', false, 'Uninstalling OpenVPN'));

		res.status(200).send().end();
	} catch(error) { 
		logger().error('Error uninstalling openvpn: ' + JSON.stringify(error));
		if (error.message)
			res.status(400).json({message: error.message});
		else
			res.status(400).json(error);
	}
});

/**
 * Sync all CCD file configurations.
 * Remove first all the server CCD files and then install all the CCD files.
 * ROUTE CALL:  /vpn/openvpn/ccdsync
 */
router.put('/ccdsync', async(req, res) => {
	try {
		const channel = await Channel.fromRequest(req);
		const crt = await Crt.getCRTdata(req.dbCon,req.openvpn.crt);
		const firewall = await getRepository(Firewall).findOneOrFail(req.body.firewall);
		const communication = await firewall.getCommunication();

		channel.emit('message', new ProgressPayload('start', false, 'Sync OpenVPN CCD'));

		if (crt.type !== 2) // This action only can be done in server OpenVPN configurations.
			throw fwcError.VPN_NOT_SER;

		// Obtain the configuration directory in the client-config-dir configuration option of the OpenVPN
		// server configuration.
		const openvpn_opt = await OpenVPN.getOptData(req.dbCon,req.body.openvpn,'client-config-dir');
		if (!openvpn_opt) throw fwcError.VPN_NOT_FOUND_CFGDIR;
		const client_config_dir = openvpn_opt.arg;

		// Get all client configurations for this OpenVPN server configuration.
		const clients = await OpenVPN.getOpenvpnClients(req.dbCon,req.body.openvpn);

		const cluster = await Firewall.getClusterId(req.dbCon, req.body.firewall);
		let lastClusterNodeId = cluster ? await Firewall.getLastClusterNodeId(req.dbCon, cluster) : null;

		for (let client of clients) {
			if (req.body.onlyPending && client.status===0) continue; // Only synchronize CCD files of pending OpenVPN client configs.

			let cfgDump = await OpenVPN.dumpCfg(req.dbCon,req.body.fwcloud,client.id);
			await communication.installOpenVPNConfig(cfgDump.ccd,client_config_dir,client.cn,1, channel);

			// Update the status flag for the OpenVPN configuration.
			if (!cluster || req.body.firewall===lastClusterNodeId) // In a cluster update only if this is the last cluster node.
				await OpenVPN.updateOpenvpnStatus(req.dbCon,client.id,"&~1");
		}

		// Get the list of files into the client-config-dir directory.
		// If we have files in the client-config-dir with no corresponding OpenVPN configuration inform the user.
		await communication.ccdCompare(req,client_config_dir,clients, channel)

		channel.emit('message', new ProgressPayload('end', false, 'Sync OpenVPN CCD'));

		res.status(200).send().end();
	} catch(error) {
		logger().error('Error sync openvpn: ' + JSON.stringify(error));
		if (error.message)
			res.status(400).json({message: error.message});
		else
			res.status(400).json(error);
	}
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
		const openvpn_opt = await OpenVPN.getOptData(req.dbCon,req.body.openvpn,'status');
		if (!openvpn_opt) throw fwcError.VPN_NOT_FOUND_STATUS;
		const status_file_path = openvpn_opt.arg;

		const data = await OpenVPN.getStatusFile(req,status_file_path);

		res.status(200).json(data);
	} catch(error) { 
		logger().error('Error getting openvpn log file: ' + JSON.stringify(error));
		if (error.message)
			res.status(400).json({message: error.message});
		else
			res.status(400).json(error);
	}
});


module.exports = router;