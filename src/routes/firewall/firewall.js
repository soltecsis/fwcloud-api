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
 * Module for routing Firewalls requests
 * <br>BASE ROUTE CALL: <b>/firewalls</b>
 *
 * @module Firewall
 * 
 * 
 */

/**
 * Class to manage firewalls routing
 * 
 * 
 * @class FirewallRouter
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
 * Property  to manage Firewall route
 *
 * @property router
 * @type express.Router 
 */
var router = express.Router();

/**
 * Property Model to manage Firewall Data
 *
 * @property FirewallModel
 * @type ../../models/firewall/firewall
 * 
 * 
 */
import { Firewall, FirewallInstallCommunication, FirewallInstallProtocol } from '../../models/firewall/Firewall';
import { FirewallExport } from '../../export/FirewallExport';

/**
 * Property Model to manage Fwcloud Data
 *
 * @property FwcloudModel
 * @type ../../models/fwcloud
 * 
 * 
 */
import { FwCloud } from '../../models/fwcloud/FwCloud';
import { Interface } from '../../models/interface/Interface';
import { Tree } from '../../models/tree/Tree';
import { PolicyRule } from '../../models/policy/PolicyRule';
import { app, logger } from '../../fonaments/abstract-application';
import { PgpHelper } from '../../utils/pgp';
import { FirewallService } from '../../models/firewall/firewall.service';
import { RoutingTableService } from '../../models/routing/routing-table/routing-table.service';
import { getRepository } from 'typeorm';
import { Cluster } from '../../models/firewall/Cluster';
import { DHCPRule } from '../../models/system/dhcp/dhcp_r/dhcp_r.model';
import { DHCPGroup } from '../../models/system/dhcp/dhcp_g/dhcp_g.model';

var utilsModel = require("../../utils/utils.js");
const restrictedCheck = require('../../middleware/restricted');
const fwcError = require('../../utils/error_table');

/**
 * @api {POST} /firewall New firewall
 * @apiName NewFirewall
 *  * @apiGroup FIREWALL
 * 
 * @apiDescription Create a new firewall.
 *
 * @apiParam {Number} fwcloud FWCloud to which the new firewall will belong.
 * @apiParam {Number} [cluster] If this firewall is part of a firewalls cluster, the cluter's id.
 * @apiParam {Number} [fwmaster] If this firewall is part of a firewalls cluster, this parameters indicates if it is the cluster master.
 * @apiParam {String} name Firewall's name.
 * @apiParam {String} comment Firewall's comment.
 * @apiParam {String} [install_user] SSH user used for firewall access.
 * @apiParam {String} [install_pass] SSH password used for firewall access.
 * @apiParam {Number} save_user_pass Save the SSH user/password in the database.
 * @apiParam {Number} [install_interface] Id of the firewall's network interface used for policy upload.
 * @apiParam {Number} [install_ipobj] Id of the firewall's address used for policy upload.
 * @apiParam {Number} [install_port] TCP port used for the SSH communication.
 * @apiParam {Number} [options] Firewall's flag options.
 * @apiParam {Number} node_id ID of the tree node to wich the new firewall will be added.
 * 
 * @apiParamExample {json} Request-Example:
 * {
 *    "fwcloud": 1,
 *    "name": "Firewall-01",
 *    "save_user_pass": 0,
 *    "install_port": 22,
 *    "fwmaster": 0,
 *    "options": 0,
 *    "node_id": 1
 * }
 *
 * @apiSuccessExample {json} Success-Response:
 * HTTP/1.1 200 OK
 * {
 *   "insertId": 1
 * }
 *
 * @apiErrorExample {json} Error-Response:
 * HTTP/1.1 400 Bad Request
 * {
 *   "fwcErr": 1002,
 * 	 "msg":	"Not found"
 * }
 * 
 * @apiErrorExample {json} Error-Response:
 * HTTP/1.1 400 Bad Request
 * {
 *    "fwcErr": 7002,
 *   "msg": "Tree node access not allowed"
 * }
 */
router.post('/', async(req, res) => {
	var firewallData = {
		id: null,
		cluster: req.body.cluster,
		name: req.body.name,
		status: 3,
		comment: req.body.comment,
		fwcloud: req.body.fwcloud,
		install_communication: req.body.install_communication === 'ssh' ? FirewallInstallCommunication.SSH : FirewallInstallCommunication.Agent,
		install_user: req.body.install_user,
		install_pass: req.body.install_pass,
		save_user_pass: req.body.save_user_pass,
		install_interface: req.body.install_interface,
		install_ipobj: req.body.install_ipobj,
		install_apikey: req.body.install_apikey !== null ? await utilsModel.encrypt(req.body.install_apikey): null,
		install_protocol: req.body.install_protocol,
		fwmaster: req.body.fwmaster,
		install_port: req.body.install_port,
		by_user: req.session.user_id,
		options: req.body.options,
		plugins: req.body.plugins
	};

	try {
		if(!req.body.cluster) {
			let firewalls = await Firewall.getFirewallCloud(req)
			firewalls = firewalls.filter(item => item.cluster==null)

			if(firewalls.length >= app().config.get('limits').firewalls && app().config.get('limits').firewalls>0) {
				throw fwcError.LIMIT_FIREWALLS
			}
		} else {
			let nodes = await Firewall.getFirewallCloud(req)
			let cluster = await Cluster.getCluster(req)
			nodes = nodes.filter(item => item.cluster !=null && item.cluster == cluster.id)
			if(nodes.length >= app().config.get('limits').nodes && app().config.get('limits').nodes > 0) {
				throw fwcError.LIMIT_NODES
			}
		}
		

		// Check that the tree node in which we will create a new node for the firewall is a valid node for it.
		if (!req.body.cluster && req.tree_node.node_type!=='FDF' && req.tree_node.node_type!=='FD') 
			throw fwcError.BAD_TREE_NODE_TYPE;

		firewallData = await Firewall.checkBodyFirewall(firewallData, true);

		//encript username and password
		firewallData.install_user = (firewallData.install_user) ? await utilsModel.encrypt(firewallData.install_user) : '';
		firewallData.install_pass = (firewallData.install_pass) ? await utilsModel.encrypt(firewallData.install_pass) : '';

		const newFirewallId = await Firewall.insertFirewall(firewallData);
		let loData = {};

		await Firewall.updateFWMaster(req.session.user_id, req.body.fwcloud, firewallData.cluster, newFirewallId, firewallData.fwmaster);

		if ((firewallData.cluster > 0 && firewallData.fwmaster === 1) || firewallData.cluster === null) {
			// Create the loop backup interface.
			loData = await Interface.createLoInterface(req.dbCon, req.body.fwcloud, newFirewallId);
			// Create the default policy rules.	
			await PolicyRule.insertDefaultPolicy(newFirewallId, loData.ifId, req.body.options);
			// Create special rules.
			await PolicyRule.checkSpecialRules(req.dbCon, newFirewallId, req.body.options);
		}

		if (!firewallData.cluster) // Create firewall tree.
			await Tree.insertFwc_Tree_New_firewall(req.body.fwcloud, req.body.node_id, newFirewallId);
		else // Create the new firewall node in the NODES node of the cluster.
			await Tree.insertFwc_Tree_New_cluster_firewall(req.body.fwcloud, firewallData.cluster, newFirewallId, firewallData.name);

		// Create the directory used for store firewall data.
		await utilsModel.createFirewallDataDir(req.body.fwcloud, newFirewallId);

		res.status(200).json({ "insertId": newFirewallId, "loData": loData });
	} catch (error) { 
		logger().error('Error creating firewall: ' + JSON.stringify(error));
		res.status(400).json(error);
	}
});


/**
 * @api {PUT} /firewall Update firewall
 * @apiName UpdateFirewall
 *  * @apiGroup FIREWALL
 * 
 * @apiDescription Update firewall information.
 *
 * @apiParam {Number} fwcloud FWCloud to which the firewall belongs.
 * @apiParam {Number} firewall Firewall's id.
 * @apiParam {Number} [cluster] If this firewall is part of a firewalls cluster, the cluter's id.
 * @apiParam {Number} [fwmaster] If this firewall is part of a firewalls cluster, this parameters indicates if it is the cluster master.
 * @apiParam {String} name Firewall's name.
 * @apiParam {String} comment Firewall's comment.
 * @apiParam {String} [install_user] SSH user used for firewall access.
 * @apiParam {String} [install_pass] SSH password used for firewall access.
 * @apiParam {Number} save_user_pass Save the SSH user/password in the database.
 * @apiParam {Number} [install_interface] Id of the firewall's network interface used for policy upload.
 * @apiParam {Number} [install_ipobj] Id of the firewall's address used for policy upload.
 * @apiParam {Number} [install_port] TCP port used for the SSH communication.
 * @apiParam {Number} [options] Firewall's flag options.
 * @apiParam {Number} node_id ID of the tree node to wich the new firewall will be added.
 * 
 * @apiParamExample {json} Request-Example:
 * {
 *    "fwcloud": 1,
 * 		"firewall": 5,
 *    "name": "Firewall-UPDATED",
 * 		"comment": "Comment for the updated firewall.",
 *    "save_user_pass": 0,
 *    "install_port": 22,
 *    "fwmaster": 0,
 *    "options": 3
 * }
 *
 * @apiSuccessExample {json} Success-Response:
 * HTTP/1.1 204 No Content
 *
 * @apiErrorExample {json} Error-Response:
 * HTTP/1.1 400 Bad Request
 * {
 *    "fwcErr": 7001,
 *    "msg": "Firewall access not allowed"
 * }
 */
router.put('/', async (req, res) => {
	//Save firewall data into objet    
	var firewallData = {
		id: req.body.firewall,
		cluster: req.body.cluster,
		name: req.body.name,
		comment: req.body.comment,
		fwcloud: req.body.fwcloud, //working cloud
		install_communication: req.body.install_communication === 'ssh' ? FirewallInstallCommunication.SSH : FirewallInstallCommunication.Agent, 
		install_apikey: req.body.install_apikey !== null ? await utilsModel.encrypt(req.body.install_apikey): null,
		install_protocol: req.body.install_protocol,
		install_user: req.body.install_user,
		install_pass: req.body.install_pass,
		save_user_pass: req.body.save_user_pass,
		install_interface: req.body.install_interface,
		install_ipobj: req.body.install_ipobj,
		fwmaster: req.body.fwmaster,
		install_port: req.body.install_port,
		by_user: req.session.user_id, //working user
		options: req.body.options,
		plugins: req.body.plugins
	};

	try {
		await Firewall.updateFirewallStatus(req.body.fwcloud, req.body.firewall, "|3");
		await Firewall.checkBodyFirewall(firewallData, false);

		//encript username and password
		let data = await utilsModel.encrypt(firewallData.install_user)
		firewallData.install_user = data;
		data = await utilsModel.encrypt(firewallData.install_pass);
		firewallData.install_pass = data;
		if (!firewallData.save_user_pass) {
			firewallData.install_user = '';
			firewallData.install_pass = '';
		}

		await Firewall.updateFirewall(req.dbCon, req.session.user_id, firewallData);
		await Firewall.updateFWMaster(req.session.user_id, req.body.fwcloud, firewallData.cluster, req.body.firewall, firewallData.fwmaster);

		// Verify all special rules.
		await PolicyRule.checkSpecialRules(req.dbCon, req.body.firewall, req.body.options);

		//////////////////////////////////
		//UPDATE FIREWALL NODE STRUCTURE                                    
		await	Tree.updateFwc_Tree_Firewall(req.dbCon, req.body.fwcloud, firewallData);

		res.status(204).end();
	} catch(error) {
		logger().error('Error updating firewall: ' + JSON.stringify(error)); 
		res.status(400).json(error);
	}
});


/**
 * @api {PUT} /firewall/get Get firewall data
 * @apiName GetFirewall
 *  * @apiGroup FIREWALL
 * 
 * @apiDescription Get firewall data. 
 *
 * @apiParam {Number} fwcloud FWCloud's id.
 * @apiParam {Number} firewall Firewall's id.
 * 
 * @apiParamExample {json} Request-Example:
 * {
 *    "fwcloud": 1,
 *   	"firewall": 5
 * }
 *
 * @apiSuccessExample {json} Success-Response:
 * HTTP/1.1 200 OK
 * {
 *   "id": 5,
 *   "cluster": null,
 *   "fwcloud": 1,
 *   "name": "Firewall-05",
 *   "comment": null,
 *   "created_at": "2019-05-15T10:34:46.000Z",
 *   "updated_at": "2019-05-15T10:34:47.000Z",
 *   "compiled_at": null,
 *   "installed_at": null,
 *   "by_user": 1,
 *   "status": 3,
 *   "install_user": "",
 *   "install_pass": "",
 *   "save_user_pass": 0,
 *   "install_interface": null,
 *   "install_ipobj": null,
 *   "fwmaster": 0,
 *   "install_port": 22,
 *   "options": 0,
 *   "interface_name": null,
 *   "ip_name": null,
 *   "ip": null,
 *   "id_fwmaster": null
 * }
 * 
 * @apiErrorExample {json} Error-Response:
 * HTTP/1.1 400 Bad Request
 * {
 *   "fwcErr": 7001,
 *  "msg": "Firewall access not allowed"
 * }
 */
router.put('/get', async (req, res) => {
	try {
		const data = await Firewall.getFirewall(req);
		if (data) {
			if (data.install_user === null) data.install_user = '';
			if (data.install_pass === null) data.install_pass = '';

			const pgp = new PgpHelper({public: req.session.uiPublicKey, private: ""});
			// SSH user and password are encrypted with the PGP session key supplied by fwcloud-ui.
			if (data.install_user) data.install_user = await pgp.encrypt(data.install_user);
			if (data.install_pass) data.install_pass = await pgp.encrypt(data.install_pass);
			if (data.install_apikey !== null) data.install_apikey = await pgp.encrypt(data.install_apikey);

			res.status(200).json(data);
		}
		else
			res.status(204).end();
	} catch(error) {
		logger().error('Error getting firewall data: ' + JSON.stringify(error));
		res.status(400).json(error);
	}
});


/**
 * @api {PUT} /firewall/cloud/get Get firewalls in cloud
 * @apiName GetFirewallsCloud
 *  * @apiGroup FIREWALL
 * 
 * @apiDescription Get firewalls data by fwcloud.
 *
 * @apiParam {Number} fwcloud FWCloud's id.
 * 
 * @apiParamExample {json} Request-Example:
 * {
 *    "fwcloud": 1
 * }
 *
 * @apiSuccessExample {json} Success-Response:
 * HTTP/1.1 200 OK
 * [
 *   {
 *     "id": 1,
 *     "cluster": null,
 *     "fwcloud": 1,
 *     "name": "Firewall-01",
 *     "comment": null,
 *     "created_at": "2019-05-15T10:34:46.000Z",
 *     "updated_at": "2019-05-15T10:34:47.000Z",
 *     "compiled_at": null,
 *     "installed_at": null,
 *     "by_user": 1,
 *     "status": 3,
 *     "install_user": "",
 *     "install_pass": "",
 *     "save_user_pass": 0,
 *     "install_interface": null,
 *     "install_ipobj": null,
 *     "fwmaster": 0,
 *     "install_port": 22,
 *     "options": 0,
 *     "interface_name": null,
 *     "ip_name": null,
 *     "ip": null,
 *     "id_fwmaster": null
 *   },
 *   {
 *     "id": 2,
 *     "cluster": null,
 *     "fwcloud": 1,
 *     "name": "Firewall-02",
 *     "comment": null,
 *     "created_at": "2019-05-15T10:34:46.000Z",
 *     "updated_at": "2019-05-15T10:34:47.000Z",
 *     "compiled_at": null,
 *     "installed_at": null,
 *     "by_user": 1,
 *     "status": 3,
 *     "install_user": "",
 *     "install_pass": "",
 *     "save_user_pass": 0,
 *     "install_interface": null,
 *     "install_ipobj": null,
 *     "fwmaster": 0,
 *     "install_port": 22,
 *     "options": 0,
 *     "interface_name": null,
 *     "ip_name": null,
 *     "ip": null,
 *     "id_fwmaster": null
 *   }
 * ]
 * 
 * @apiErrorExample {json} Error-Response:
 * HTTP/1.1 400 Bad Request
 * {
 *   "fwcErr": 7001,
 *  "msg": "Firewall access not allowed"
 * }
 */
router.put('/cloud/get', async (req, res) => {
	try {
		data = await Firewall.getFirewallCloud(req);
		if (data && data.length > 0) {

			for (let i=0; i<data.length; i++) {
				// Remove ssh data.
				delete data[i].install_user;
				delete data[i].install_pass;
			}
			
			res.status(200).json(data);
		}
		else
			res.status(204).end();
	} catch(error) {
		logger().error('Error getting cloud firewalls: ' + JSON.stringify(error)); 
		res.status(400).json(error);
	}
});



/**
 * @api {PUT} /firewall/cluster/get Get firewalls in cluster
 * @apiName GetFirewallsCluster
 *  * @apiGroup FIREWALL
 * 
 * @apiDescription Get firewalls data by cluster.
 *
 * @apiParam {Number} fwcloud FWCloud id.
 * @apiParam {Number} cluster Cluster id.
 * 
 * @apiParamExample {json} Request-Example:
 * {
 *    "fwcloud": 1,
 * 		"cluster": 2
 * }
 *
 * @apiSuccessExample {json} Success-Response:
 * HTTP/1.1 200 OK
 * [
 *   {
 *     "id": 1,
 *     "cluster": 2,
 *     "fwcloud": 1,
 *     "name": "Firewall-01",
 *     "comment": null,
 *     "created_at": "2019-05-15T10:34:46.000Z",
 *     "updated_at": "2019-05-15T10:34:47.000Z",
 *     "compiled_at": null,
 *     "installed_at": null,
 *     "by_user": 1,
 *     "status": 3,
 *     "install_user": "",
 *     "install_pass": "",
 *     "save_user_pass": 0,
 *     "install_interface": null,
 *     "install_ipobj": null,
 *     "fwmaster": 1,
 *     "install_port": 22,
 *     "options": 0,
 *     "interface_name": null,
 *     "ip_name": null,
 *     "ip": null,
 *     "id_fwmaster": null
 *   },
 *   {
 *     "id": 2,
 *     "cluster": 2,
 *     "fwcloud": 1,
 *     "name": "Firewall-02",
 *     "comment": null,
 *     "created_at": "2019-05-15T10:34:46.000Z",
 *     "updated_at": "2019-05-15T10:34:47.000Z",
 *     "compiled_at": null,
 *     "installed_at": null,
 *     "by_user": 1,
 *     "status": 3,
 *     "install_user": "",
 *     "install_pass": "",
 *     "save_user_pass": 0,
 *     "install_interface": null,
 *     "install_ipobj": null,
 *     "fwmaster": 0,
 *     "install_port": 22,
 *     "options": 0,
 *     "interface_name": null,
 *     "ip_name": null,
 *     "ip": null,
 *     "id_fwmaster": null
 *   }
 * ]
 * 
 * @apiErrorExample {json} Error-Response:
 * HTTP/1.1 400 Bad Request
 * {
 *   "fwcErr": 7001,
 *  "msg": "Firewall access not allowed"
 * }
 */
router.put('/cluster/get', (req, res) => {
	Firewall.getFirewallCluster(req.session.user_id, req.body.cluster, async (error, data) => {
		if (error) {
			logger().error('Error getting cluster firewalls: ' + JSON.stringify(error));
			return res.status(400).json(error);
		}
		
		if (data && data.length > 0) {
			// SSH user and password are encrypted with the PGP session key supplied by fwcloud-ui.
			const pgp = new PgpHelper({public: req.session.uiPublicKey, private: ""});

			for (let i=0; i<data.length; i++) {
				if (data[i].install_user === null) data[i].install_user = '';
				if (data[i].install_pass === null) data[i].install_pass = '';
	
				if (data[i].install_user) data[i].install_user = await pgp.encrypt(data[i].install_user);
				if (data[i].install_pass) data[i].install_pass = await pgp.encrypt(data[i].install_pass);
			}

			res.status(200).json(data);
		}
		else
			res.status(204).end();
	});
});




/**
 * @api {PUT} /firewall/clone Clone firewall
 * @apiName CloneFirewall
 *  * @apiGroup FIREWALL
 * 
 * @apiDescription Create a new firewall cloning the one indicated in the request's parameters.
 *
 * @apiParam {Number} fwcloud FWCloud to which the cloned firewall will belong.
 * @apiParam {Number} firewall Id of the firewall to be cloned.
 * @apiParam {String} name Cloned firewall's name.
 * @apiParam {String} comment Cloned firewall's comment.
 * @apiParam {Number} node_id ID of the tree node to wich the cloned firewall will be added.
 * 
 * @apiParamExample {json} Request-Example:
 * {
 *    "fwcloud": 1,
 * 		"firewall": 5,
 *    "name": "Firewall-CLONED",
 * 		"comment": "Comment for the cloned firewall.",
 *    "node_id": 1
 * }
 *
 * @apiSuccessExample {json} Success-Response:
 * HTTP/1.1 200 OK
 * {
 *    "insertId": 7
 * }
 *
 * @apiErrorExample {json} Error-Response:
 * HTTP/1.1 400 Bad Request
 * {
 *    "fwcErr": 7001,
 *    "msg": "Firewall access not allowed"
 * }
 */
router.put('/clone', async (req, res) => {
	try {
		if(!req.body.cluster) {
			let firewalls = await Firewall.getFirewallCloud(req)
			firewalls = firewalls.filter(item => item.cluster==null)

			if(firewalls.length >= app().config.get('limits').firewalls && app().config.get('limits').firewalls>0) {
				throw fwcError.LIMIT_FIREWALLS
			}
		}
		// Check that the tree node in which we will create a new node for the firewall is a valid node for it.
		if (req.tree_node.node_type!=='FDF' && req.tree_node.node_type!=='FD')
			throw fwcError.BAD_TREE_NODE_TYPE;

		//Save firewall data into objet    
		var firewallData = {
			id: req.body.firewall,
			name: req.body.name,
			comment: req.body.comment,
			fwcloud: req.body.fwcloud, //working cloud      
			by_user: req.session.user_id //working user
		};

		const data = await Firewall.cloneFirewall(req.session.user_id, firewallData);
		const idNewFirewall = data.insertId;

		const dataI = await Interface.cloneFirewallInterfaces(req.session.user_id, req.body.fwcloud, req.body.firewall, idNewFirewall);
		await PolicyRule.cloneFirewallPolicy(req.dbCon, req.body.firewall, idNewFirewall, dataI);
		await utilsModel.createFirewallDataDir(req.body.fwcloud, idNewFirewall);
		await Tree.insertFwc_Tree_New_firewall(req.body.fwcloud, req.body.node_id, idNewFirewall);

		await DHCPRule.cloneFirewallDHCP(req.body.firewall, idNewFirewall);
		
		const firewallService = await app().getService(FirewallService.name);
		await firewallService.clone(req.body.firewall, idNewFirewall, dataI);
		
		res.status(200).json(data);
	} catch(error) { 
		logger().error('Error cloning firewall: ' + JSON.stringify(error));
		res.status(400).json(error);
	}
});



/* Get locked Status of firewall by Id */
/**
 * Get Locked status of Firewall by ID and User
 * 
 * <br>ROUTE CALL:  <b>/firewalls/:iduser/firewall/:id/locked</b>
 * <br>METHOD: <b>GET</b>
 *
 * @method getLockedStatusFirewallByUser_and_ID_V2
 * 
 * @param {Integer} iduser User identifier
 * @param {Integer} id Firewall identifier
 * 
 * @return {JSON} Returns Json Data from Firewall
 */
router.put('/accesslock/get', async (req, res) => {
	try {
		const data = await Firewall.getFirewall(req);
		if (data) {
			await FwCloud.getFwcloudAccess(req.session.user_id, req.body.fwcloud);
			res.status(200).json(resp);
		}
		else res.status(204).end();
	} catch(error) {
		logger().error('Error locked firewall status: ' + JSON.stringify(error));
		res.status(400).json(error);
	}
});


// API call for check deleting restrictions.
router.put("/restricted",
	restrictedCheck.firewall,
	restrictedCheck.firewallApplyTo,
	(req, res) => res.status(204).end()
);


/**
 * @api {PUT} /firewall/del Delete firewall
 * @apiName DelFirewall
 *  * @apiGroup FIREWALL
 * 
 * @apiDescription Delete a firewall.
 *
 * @apiParam {Number} fwcloud FWCloud's id of the firewall to delete.
 * @apiParam {Number} firewall Id of the firewall to be deleted.
 * 
 * @apiParamExample {json} Request-Example:
 * {
 *    "fwcloud": 1,
 * 		"firewall": 7
 * }
 *
 * @apiSuccessExample {json} Success-Response:
 * HTTP/1.1 204 No Content
 *
 * @apiErrorExample {json} Error-Response:
 * HTTP/1.1 400 Bad Request
 * {
 *    "fwcErr": 7001,
 *    "msg": "Firewall access not allowed"
 * }
 */
router.put('/del',
	restrictedCheck.firewall,
	async(req, res) => {
		try {
			const firewallService = await app().getService(FirewallService.name);
			await firewallService.remove(req.body.firewall, req.body.fwcloud, req.session.user_id);

			res.status(204).end();
		} catch (error) {
			logger().error('Error removing firewall: ' + JSON.stringify(error));
			res.status(400).json(error)
		}
	});



//DELETE FIREWALL FROM CLUSTER
router.put('/delfromcluster',
restrictedCheck.firewallApplyTo,
async (req, res) => {
	//CHECK FIREWALL DATA TO DELETE
	try {
		const firewallService = await app().getService(FirewallService.name);
		const data = await firewallService.deleteFirewallFromCluster(req.body.cluster, req.body.firewall, req.body.fwcloud, req.session.user_id);
		if (data && data.result)
			res.status(200).json(data);
	 	else
			res.status(204).end();
	} catch(error) {
		logger().error('Error removing cluster firewall: ' + JSON.stringify(error)); 
		res.status(400).json(error);
	}
});

/**
 * Get firewall export
 * 
 */
router.put('/export/get', async (req, res) => {
	try {
		const data = FirewallExport.exportFirewall(req.body.firewall);
		res.status(200).json(data);
	} catch(error) { 
		logger().error('Error exporting firewall: ' + JSON.stringify(error));
		res.status(400).json(error);
	}
});

module.exports = router;