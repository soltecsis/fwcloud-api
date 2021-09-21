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
 * Module to routing CLUSTER requests
 * <br>BASE ROUTE CALL: <b>/clusters</b>
 *
 * @module Cluster
 * 
 * @requires express
 * @requires Clustermodel
 * 
 */


/**
 * Clase to manage CLUSTER DATA
 *
 * @class ClusterRouter
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
 * Property Model to manage Cluster Data
 *
 * @property ClusterModel
 * @type ../../models/cluster
 */
import { Cluster } from '../../models/firewall/Cluster';


var utilsModel = require("../../utils/utils.js");

import { Tree } from '../../models/tree/Tree';
import { PolicyRule } from '../../models/policy/PolicyRule';
import { Firewall } from '../../models/firewall/Firewall';
import { Interface } from '../../models/interface/Interface';
import { app, logger } from '../../fonaments/abstract-application';
import { PgpHelper } from '../../utils/pgp';
import { FirewallService } from '../../models/firewall/firewall.service';
import { ClusterService } from '../../models/firewall/cluster.service';

const restrictedCheck = require('../../middleware/restricted');
const fwcError = require('../../utils/error_table');

/**
 * @api {POST} /cluster New cluster
 * @apiName NewCluster
 *  * @apiGroup CLUSTER
 * 
 * @apiDescription Create a new cluster of firewalls.
 *
 * @apiParam {Number} fwcloud FWCloud to which the new cluster of firewalls will belong.
 * @apiParam {Number} node_id Id of the tree node to wich the new cluster will be added.
 * @apiParam {Object} clusterData Json object with the cluster data.
 * 
 * @apiParam (clusterData) {String} name Cluster's name.
 * @apiParam (clusterData) {String} [comment] Cluster's comment.
 * @apiParam (clusterData) {Number} options Options flags.
 * @apiParam (clusterData) {Object[]} fwnodes Array of json objects with the information of the firewalls that are
 * part of the cluster.
 * 
 * @apiParam (fwnodes) {String} name Firewall's name.
 * @apiParam (fwnodes) {String} [comment] Firewall's comment.
 * @apiParam (fwnodes) {String} [install_user] SSH user used for firewall access.
 * @apiParam (fwnodes) {String} [install_pass] SSH password used for firewall access.
 * @apiParam (fwnodes) {Number} save_user_pass Save the SSH user/password in the database.
 * @apiParam (fwnodes) {Number} [install_interface] Id of the firewall's network interface used for policy upload.
 * @apiParam (fwnodes) {Number} [install_ipobj] Id of the firewall's address used for policy upload.
 * @apiParam (fwnodes) {Number} [install_port] TCP port used for the SSH communication.
 * @apiParam (fwnodes) {Number} [fwmaster] If this firewall is part of a firewalls cluster, this parameters indicates if it is the cluster master.
 * @apiParam (fwnodes) {Number} [options] Firewall's flag options.

 * 
 * @apiParamExample {json} Request-Example:
 * {
 *    "fwcloud": 3,
 *    "node_id": 391,
 *    "clusterData": {
 *        "name": "Cluster-01",
 *        "options": 3,
 *        "fwnodes": [
 *            {
 *                "name": "node1",
 *                "comment": null,
 *                "install_user": null,
 *                "install_pass": null,
 *                "save_user_pass": 1,
 *                "install_interface": null,
 *                "install_ipobj": null,
 *                "fwmaster": 1,
 *                "install_port": 22
 *            },
 *            {
 *                "name": "node2",
 *                "comment": null,
 *                "install_user": null,
 *                "install_pass": null,
 *                "save_user_pass": 1,
 *                "install_interface": null,
 *                "install_ipobj": null,
 *                "fwmaster": 0,
 *                "install_port": 22
 *            },
 *            {
 *                "name": "node3",
 *                "comment": null,
 *                "install_user": null,
 *                "install_pass": null,
 *                "save_user_pass": 1,
 *                "install_interface": null,
 *                "install_ipobj": null,
 *                "fwmaster": 0,
 *                "install_port": 22
 *            }
 *        ]
 *    }
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
router.post('/', async (req, res) => {
	var JsonData = req.body;
	var fwnodes = JsonData.clusterData.fwnodes;
	logger().debug("JSON RECIBIDO: ", JsonData);
	//new objet with Cluster data
	var clusterData = {
		name: JsonData.clusterData.name,
		comment: JsonData.clusterData.comment,
		fwcloud: req.body.fwcloud
	};

	// Check that the tree node in which we will create a new node for the cluster is a valid node for it.
	if (req.tree_node.node_type !== 'FDF' && req.tree_node.node_type !== 'FD') {
		logger().error('Error creating a new node: ' + JSON.stringify(fwcError.BAD_TREE_NODE_TYPE));
		return res.status(400).json(fwcError.BAD_TREE_NODE_TYPE);
	}

	try {
		const clusterId = await Cluster.insertCluster(clusterData);
		let loData = {};

		for (let firewallData of fwnodes) {
			firewallData.cluster = clusterId;
			firewallData.fwcloud = req.body.fwcloud;
			firewallData.by_user = req.session.user_id;
			firewallData.status = 3;
			firewallData.options = JsonData.clusterData.options;

			firewallData = await Firewall.checkBodyFirewall(firewallData, true);

			firewallData.install_user = (firewallData.install_user) ? await utilsModel.encrypt(firewallData.install_user) : '';
			firewallData.install_pass = (firewallData.install_pass) ? await utilsModel.encrypt(firewallData.install_pass) : '';

			const idfirewall = await Firewall.insertFirewall(firewallData);

			await Firewall.updateFWMaster(req.session.user_id, req.body.fwcloud, clusterId, idfirewall, firewallData.fwmaster);

			if (firewallData.fwmaster === 1) {
				// Create the loop backup interface.
				loData = await Interface.createLoInterface(req.body.fwcloud, idfirewall);
				// Create the default policy rules.							
				await PolicyRule.insertDefaultPolicy(idfirewall, loData.ifId, firewallData.options);
				// Create the directory used for store firewall data.
				await utilsModel.createFirewallDataDir(req.body.fwcloud, idfirewall);
			}
		}
		await Tree.insertFwc_Tree_New_cluster(req.body.fwcloud, req.body.node_id, clusterId);
		res.status(200).json({ "insertId": clusterId, "loData": loData });
	} catch (error) { 
		logger().error('Error creating a new cluster: ' + JSON.stringify(error));
		res.status(400).json(error);
	}
});


/**
 * @api {PUT} /cluster/get Get cluster data
 * @apiName GetCluster
 *  * @apiGroup CLUSTER
 * 
 * @apiDescription Get cluster data. 
 *
 * @apiParam {Number} fwcloud FWCloud's id.
 * @apiParam {Number} cluster Cluster's id.
 * 
 * @apiParamExample {json} Request-Example:
 * {
 *    "fwcloud": 2,
 *   	"cluster": 5
 * }
 *
 * @apiSuccessExample {json} Success-Response:
 * HTTP/1.1 200 OK
 * {
 *    "id": 2,
 *    "fwcloud": 2,
 *    "name": "Cluster-02",
 *    "comment": null,
 *    "created_at": "2019-05-17T11:47:00.000Z",
 *    "updated_at": "2019-05-17T11:47:00.000Z",
 *    "created_by": 0,
 *    "updated_by": 0,
 *    "nodes": [
 *        {
 *            "id": 10,
 *            "cluster": 2,
 *            "name": "node1",
 *            "comment": null,
 *            "status": 3,
 *            "install_user": "",
 *            "install_pass": "",
 *            "save_user_pass": 1,
 *            "install_interface": null,
 *            "install_ipobj": null,
 *            "fwmaster": 1,
 *            "install_port": 22,
 *            "interface_name": null,
 *            "ip_name": null,
 *            "ip": null,
 *            "options": 3
 *        }
 *     ]
 *  }
 * 
 * @apiErrorExample {json} Error-Response:
 * HTTP/1.1 400 Bad Request
 * {
 *    "fwcErr": 7002,
 *    "msg": "Cluster access not allowed"
 * }
 */
router.put('/get', async (req, res) => {
	try {
		const data = await Cluster.getCluster(req);
		if (data) {
			let nodes = data.nodes;
			const pgp = new PgpHelper({public: req.session.uiPublicKey, private: ""});

			for (let i=0; i<nodes.length; i++) {
				if (nodes[i].install_user === null) nodes[i].install_user = '';
				if (nodes[i].install_pass === null) nodes[i].install_pass = '';
	
				// SSH user and password are encrypted with the PGP session key supplied by fwcloud-ui.
				if (nodes[i].install_user) nodes[i].install_user = await pgp.encrypt(nodes[i].install_user);
				if (nodes[i].install_pass) nodes[i].install_pass = await pgp.encrypt(nodes[i].install_pass);
			}

			res.status(200).json(data);
		}
		else
			res.status(400).json(fwcError.NOT_FOUND);
	} catch(error) {
		logger().error('Error getting all cluster: ' + JSON.stringify(error));
		res.status(400).json(error);
	}
});


/**
 * @api {PUT} /cluster/cloud/get Get cloud's clusters
 * @apiName GetCloudCluster
 *  * @apiGroup CLUSTER
 * 
 * @apiDescription Get all the cluster data for the indicated fwcloud. 
 *
 * @apiParam {Number} fwcloud FWCloud's id.
 * 
 * @apiParamExample {json} Request-Example:
 * {
 *    "fwcloud": 2
 * }
 *
 * @apiSuccessExample {json} Success-Response:
 * HTTP/1.1 200 OK
 * [
 *    {
 *        "id": 1,
 *        "fwcloud": 2,
 *        "name": "Cluster-01",
 *        "comment": null,
 *        "created_at": "2019-05-17T11:46:57.000Z",
 *        "updated_at": "2019-05-17T11:46:57.000Z",
 *        "created_by": 0,
 *        "updated_by": 0
 *    },
 *    {
 *        "id": 2,
 *        "fwcloud": 2,
 *        "name": "Cluster-02",
 *        "comment": null,
 *        "created_at": "2019-05-17T11:47:00.000Z",
 *        "updated_at": "2019-05-17T11:47:00.000Z",
 *        "created_by": 0,
 *        "updated_by": 0
 *		}
 *	]
 * 
 * @apiErrorExample {json} Error-Response:
 * HTTP/1.1 400 Bad Request
 * {
 *    "fwcErr": 7002,
 *    "msg": "Cluster access not allowed"
 * }
 */
router.put('/cloud/get', async (req, res) => {
	try {
		const data = await Cluster.getClusterCloud(req);
		if (data) {
			res.status(200).json(data);
		} else {
			logger().error('Error getting a cluster: ' + JSON.stringify(fwcError.NOT_FOUND));
			res.status(400).json(fwcError.NOT_FOUND);
		}
	} catch(error) {
		logger().error('Error getting a cluster: ' + JSON.stringify(error));
		res.status(400).json(error);
	}
});


/**
 * @api {POST} /cluster Update Cluster
 * @apiName UpdateCluster
 *  * @apiGroup CLUSTER
 * 
 * @apiDescription Update cluster data.
 *
 * @apiParam {Number} fwcloud FWCloud to which the new cluster of firewalls belongs.
 * @apiParam {Object} clusterData Json object with the cluster data.
 * 
 * @apiParam (clusterData) {Number} cluster Cluster's id.
 * @apiParam (clusterData) {String} name Cluster's name.
 * @apiParam (clusterData) {String} [comment] Cluster's comment.
 * @apiParam (clusterData) {Number} options Options flags.
 * 
 * @apiParamExample {json} Request-Example:
 * {
    "fwcloud": 2,
    "clusterData": {
        "cluster": 5,
        "name": "Cluster-UPDATED",
        "options": 3
    }
}
 *
 * @apiSuccessExample {json} Success-Response:
 * HTTP/1.1 204 No Content
 *
 * @apiErrorExample {json} Error-Response:
 * HTTP/1.1 400 Bad Request
 * {
 *   "fwcErr": 1002,
 * 	 "msg":	"Not found"
 * } 
 */
router.put('/', async (req, res) => {
	var JsonData = req.body;
	//new objet with Cluster data
	var clusterData = {
		id: JsonData.clusterData.cluster,
		name: JsonData.clusterData.name,
		comment: JsonData.clusterData.comment,
		fwcloud: req.body.fwcloud,
		options: JsonData.clusterData.options
	};

	try {
		const masterFirewallID = await Firewall.getMasterFirewallId(clusterData.fwcloud, clusterData.id);
		await Cluster.updateCluster(req.dbCon, req.body.fwcloud, clusterData);

		// If this a stateful cluster verify that the stateful special rules exists.
		// Or remove them if this is not a stateful firewall cluster.
		await PolicyRule.checkStatefulRules(req.dbCon, masterFirewallID, clusterData.options);

		await Tree.updateFwc_Tree_Cluster(req.dbCon, req.body.fwcloud, clusterData);
		res.status(204).end();
	} catch(error) {
		logger().error('Error updating a cluster: ' + JSON.stringify(error));
		res.status(400).json(error);
	}
});


/* New cluster FROM FIREWALL */
router.put('/fwtocluster', async(req, res) => {
	var iduser = req.session.user_id;
	var fwcloud = req.body.fwcloud;
	var firewall = req.body.firewall;
	var firewallData;
	var clusterData;
	var clusterId;

	try {
		firewallData = await Firewall.getFirewall(req);
		clusterData = {
			name: "Cluster " + firewallData.name,
			comment: "New cluster from Firewall : " + firewallData.name,
			fwcloud: fwcloud
		};
	
		clusterId = await Cluster.insertCluster(clusterData);
	} catch (error) {
		logger().error('Error during firewall convert to cluster: ' + JSON.stringify(error));
		return res.status(400).json(error);
	}

	//////////////////////////////////
	//INSERT AND UPDATE CLUSTER NODE STRUCTURE
	Tree.updateFwc_Tree_convert_firewall_cluster(fwcloud, req.body.node_id, clusterId, firewall, async (error, dataTree) => {
		if (error) {
			logger().error('Error updating tree during firewall export to cluster: ' + JSON.stringify(error));
			return res.status(400).json(error);
		}
		else if (dataTree && dataTree.result) {

			//UPDATE CLUSTERS FIREWALL
			//-------------------------------------------
			firewallData.cluster = clusterId;
			firewallData.fwcloud = fwcloud;
			firewallData.by_user = iduser;

			try {
				await Firewall.updateFirewallCluster(firewallData);
				await Firewall.updateFWMaster(iduser, fwcloud, clusterId, firewall, 1);
				res.status(200).json(data);
			} catch(error) { return res.status(400).json(error);} 
		} else {
			logger().error('Error updating firewall cluster: ' + JSON.stringify(error));
			res.status(400).json(error);
		}
	});
});

/* New FIREWALL FROM CLUSTER */
router.put('/clustertofw', (req, res) => {
	var iduser = req.session.user_id;
	var fwcloud = req.body.fwcloud;
	var idCluster = req.body.cluster;

	Firewall.getFirewallClusterMaster(iduser, idCluster, (error, firewallDataArry) => {
		//Get Data
		if (firewallDataArry && firewallDataArry.length > 0) {
			var firewallData = firewallDataArry[0];

			//////////////////////////////////
			//UPDATE CLUSTER NODE STRUCTURE
			Tree.updateFwc_Tree_convert_cluster_firewall(fwcloud, req.body.node_id, idCluster, firewallData.id, (error, dataTree) => {
				logger().debug("DATATREE: ", dataTree);
				if (error) {
					logger().error('Error creating firewall from cluster: ' + JSON.stringify(error));
					return res.status(400).json(error);
				}
				else if (dataTree && dataTree.result) {

					//UPDATE CLUSTERS FIREWALL
					//-------------------------------------------
					firewallData.cluster = null;
					firewallData.fwcloud = fwcloud;
					firewallData.by_user = iduser;
					//logger().debug("firewallData: ", firewallData);
					Firewall.updateFirewallCluster(firewallData)
						.then(() => {
							Firewall.removeFirewallClusterSlaves(idCluster, fwcloud, (error, dataFC) => {
								Cluster.deleteClusterSimple(idCluster, iduser, fwcloud, (error, data) => {
									PolicyRule.cleanApplyTo(firewallData.id, (error, data) => {});
								});
							});
						});
					var resp = { "result": true, "insertId": firewallData.id };
					res.status(200).json(resp);
				} else {
					logger().error('Error creating firewall from cluster: ' + JSON.stringify(error));
					res.status(400).json(fwcError.NOT_FOUND);
				}
			});

		} else {
			logger().error('Error creating firewall from cluster: ' + JSON.stringify(fwcError.NOT_FOUND));
			res.status(400).json(fwcError.NOT_FOUND);
		}
	});
});

/* CLONE CLUSTER */
router.put('/clone', (req, res) => {
	var iduser = req.session.user_id;
	var fwcloud = req.body.fwcloud;
	var idCluster = req.body.cluster;
	var idNewFirewall, oldFirewall, fwNewMaster;

	//Save firewall data into objet    
	var clusterData = {
		name: req.body.name,
		comment: req.body.comment,
		fwcloud: fwcloud //working cloud              
	};

	// Check that the tree node in which we will create a new node for the cluster is a valid node for it.
	if (req.tree_node.node_type !== 'FDF' && req.tree_node.node_type !== 'FD') {
		logger().error('Error cloning cluster: ' + JSON.stringify(fwcError.BAD_TREE_NODE_TYPE));
		return res.status(400).json(fwcError.BAD_TREE_NODE_TYPE);
	}

	Firewall.getFirewallCluster(iduser, idCluster, async(error, firewallDataArry) => {
		if (error) {
			logger().error('Error getting firewall cluster: ' + JSON.stringify(fwcError.BAD_TREE_NODE_TYPE));
			return res.status(400).json(error);
		}

		//Get Data
		if (firewallDataArry && firewallDataArry.length > 0) {
			try {
				var newClusterId = await Cluster.insertCluster(clusterData);

				// Clone cluster nodes.
				for (let firewallData of firewallDataArry) {
					firewallData.cluster = newClusterId;
					firewallData.fwcloud = fwcloud;
					firewallData.by_user = iduser;

					//CLONE FWMASTER
					let data = await Firewall.cloneFirewall(iduser, firewallData);

					idNewFirewall = data.insertId;
					oldFirewall = firewallData.id;
					// This function will update the cluster id of the new firewall.
					firewallData.id = idNewFirewall;
					await Firewall.updateFirewallCluster(firewallData);

					// If we are cloning the master firewall, then clone interfaces, policy, etc.
					if (firewallData.fwmaster) {
						fwNewMaster = idNewFirewall;
						await Firewall.updateFWMaster(iduser, fwcloud, newClusterId, idNewFirewall, 1);
						//CLONE INTERFACES
						let dataI = await Interface.cloneFirewallInterfaces(iduser, fwcloud, oldFirewall, idNewFirewall);
						await PolicyRule.cloneFirewallPolicy(req.dbCon, oldFirewall, idNewFirewall, dataI);
						await utilsModel.createFirewallDataDir(fwcloud, idNewFirewall);
						const firewallService = await app().getService(FirewallService.name);
						await firewallService.clone(oldFirewall, fwNewMaster, dataI);
					}
				}

				//INSERT FIREWALL NODE STRUCTURE
				await Tree.insertFwc_Tree_New_cluster(fwcloud, req.body.node_id, newClusterId);

				// Update aaply_to fields of rules in the master firewall for point to nodes in the cloned cluster.
				await PolicyRule.updateApplyToRules(newClusterId, fwNewMaster);

				// If we arrive here all has gone fine.
				res.status(200).json({ "insertId": newClusterId });
			} catch (error) {
				logger().error('Error creating cluster: ' + JSON.stringify(error));
				res.status(400).json(error);
			}
		}
	});
});



// API call for check deleting restrictions.
router.put('/restricted', restrictedCheck.firewall, (req, res) => res.status(204).end());

/* Remove cluster */
router.put("/del",
restrictedCheck.firewall,
async (req, res) => {
	try {
		const clusterService = await app().getService(ClusterService.name);
		await clusterService.remove(req.body.cluster, req.body.fwcloud, req.session.user_id);

		res.status(204).end();
	} catch(error) {
		logger().error('Error deleting cluster: ' + JSON.stringify(error));
		res.status(400).json(error);
	}
});

module.exports = router;