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
var ClusterModel = require('../../models/firewall/cluster');

var logger = require('log4js').getLogger("app");

var utilsModel = require("../../utils/utils.js");

var fwcTreemodel = require('../../models/tree/tree');
var Policy_rModel = require('../../models/policy/policy_r');
var Policy_cModel = require('../../models/policy/policy_c');
var FirewallModel = require('../../models/firewall/firewall');
var InterfaceModel = require('../../models/interface/interface');
const restrictedCheck = require('../../middleware/restricted');
const fwcError = require('../../utils/error_table');


/**
 * My method description.  Like other pieces of your comment blocks, 
 * this can span multiple lines.
 * ROUTE CALL:  /
 *
 * @method getclusters
 * 
 * @param {String} foo Argument 1
 * @param {Object} config A config object
 * @param {String} config.name The name on the config object
 * @param {Function} config.callback A callback function on the config object
 * @param {Boolean} [extra=false] Do extra, optional work
 * @return {Boolean} Returns true on success
 */
router.put('/all/get', (req, res) => {
	ClusterModel.getClusters((error, data) => {
		if (error) return res.status(400).json(error);
		
		if (data && data.length > 0)
			res.status(200).json(data);
		else
			res.status(204).end();
	});
});


/* Get FULL cluster by Id */
router.put('/get', async (req, res) => {
	try {
		const data = await ClusterModel.getClusterFullPro(req.session.user_id, req.body.fwcloud, req.body.cluster);
		if (data && data.length > 0)
			res.status(200).json(data);
		else
			res.status(400).json(fwcError.NOT_FOUND);
	} catch(error) { res.status(400).json(error) }
});


/* New cluster */
router.post('/', (req, res) => {
	var JsonData = req.body;
	var fwnodes = JsonData.clusterData.fwnodes;
	logger.debug("JSON RECIBIDO: ", JsonData);
	//new objet with Cluster data
	var clusterData = {
		name: JsonData.clusterData.name,
		comment: JsonData.clusterData.comment,
		fwcloud: req.body.fwcloud
	};

	// Check that the tree node in which we will create a new node for the cluster is a valid node for it.
	if (req.tree_node.node_type !== 'FDF' && req.tree_node.node_type !== 'FD')
		return res.status(400).json(fwcError.BAD_TREE_NODE_TYPE);

	ClusterModel.insertCluster(clusterData, async(error, dataNewCluster) => {
		//get cluster info
		if (dataNewCluster && dataNewCluster.insertId) {
			var idcluster = dataNewCluster.insertId;

			try {
				for (let firewallData of fwnodes) {
					firewallData.cluster = idcluster;
					firewallData.fwcloud = req.body.fwcloud;
					firewallData.by_user = req.session.user_id;
					firewallData.status = 3;
					firewallData.options = JsonData.clusterData.options;

					firewallData = await FirewallModel.checkBodyFirewall(firewallData, true);

					firewallData.install_user = (firewallData.install_user) ? await utilsModel.encrypt(firewallData.install_user) : '';
					firewallData.install_pass = (firewallData.install_pass) ? await utilsModel.encrypt(firewallData.install_pass) : '';

					let idfirewall = await FirewallModel.insertFirewall(firewallData);
					await FirewallModel.updateFWMaster(req.session.user_id, req.body.fwcloud, idcluster, idfirewall, firewallData.fwmaster);

					if (firewallData.fwmaster === 1) {
						// Create the loop backup interface.
						const loInterfaceId = await InterfaceModel.createLoInterface(req.body.fwcloud, idfirewall);
						// Create the default policy rules.							
						await Policy_rModel.insertDefaultPolicy(idfirewall, loInterfaceId, firewallData.options);
						// Create the directory used for store firewall data.
						await utilsModel.createFirewallDataDir(req.body.fwcloud, idfirewall);
					}
				}
				await fwcTreemodel.insertFwc_Tree_New_cluster(req.body.fwcloud, req.body.node_id, idcluster);
				res.status(200).json(dataNewCluster);
			} catch (error) { res.status(400).json(error) }
		} else res.status(400).json(error);
	});
});

/* New cluster FROM FIREWALL */
router.put('/fwtocluster', async(req, res) => {
	var iduser = req.session.user_id;
	var fwcloud = req.body.fwcloud;
	var firewall = req.body.firewall;
	var firewallDataArry;

	try {
		firewallDataArry = await FirewallModel.getFirewall(req);
	} catch (error) { return res.status(400).json(error) }

	if (firewallDataArry && firewallDataArry.length > 0) {
		var firewallData = firewallDataArry[0];
		//new objet with Cluster data
		var clusterData = {
			name: "Cluster " + firewallData.name,
			comment: "New cluster from Firewall : " + firewallData.name,
			fwcloud: fwcloud
		};

		ClusterModel.insertCluster(clusterData, function(error, data) {
			//get cluster info
			if (data && data.insertId) {
				var idcluster = data.insertId;
				//////////////////////////////////
				//INSERT AND UPDATE CLUSTER NODE STRUCTURE
				fwcTreemodel.updateFwc_Tree_convert_firewall_cluster(fwcloud, req.body.node_id, idcluster, firewall, function(error, dataTree) {
					if (error)
						return res.status(400).json(error);
					else if (dataTree && dataTree.result) {

						//UPDATE CLUSTERS FIREWALL
						//-------------------------------------------
						firewallData.cluster = idcluster;
						firewallData.fwcloud = fwcloud;
						firewallData.by_user = iduser;

						FirewallModel.updateFirewallCluster(firewallData)
							.then(() => FirewallModel.updateFWMaster(iduser, fwcloud, idcluster, firewall, 1))
							.then(() => res.status(200).json(data))
							.catch(error => res.status(400).json(error));
					} else {
						res.status(400).json(error);
					}
				});
			} else {
				res.status(400).json(error);
			}
		});
	}
});

/* New FIREWALL FROM CLUSTER */
router.put('/clustertofw', (req, res) => {
	var iduser = req.session.user_id;
	var fwcloud = req.body.fwcloud;
	var idCluster = req.body.cluster;

	FirewallModel.getFirewallClusterMaster(iduser, idCluster, function(error, firewallDataArry) {
		//Get Data
		if (firewallDataArry && firewallDataArry.length > 0) {
			var firewallData = firewallDataArry[0];

			//////////////////////////////////
			//UPDATE CLUSTER NODE STRUCTURE
			fwcTreemodel.updateFwc_Tree_convert_cluster_firewall(fwcloud, req.body.node_id, idCluster, firewallData.id, function(error, dataTree) {
				logger.debug("DATATREE: ", dataTree);
				if (error)
					return res.status(400).json(error);
				else if (dataTree && dataTree.result) {

					//UPDATE CLUSTERS FIREWALL
					//-------------------------------------------
					firewallData.cluster = null;
					firewallData.fwcloud = fwcloud;
					firewallData.by_user = iduser;
					//logger.debug("firewallData: ", firewallData);
					FirewallModel.updateFirewallCluster(firewallData)
						.then(() => {
							FirewallModel.removeFirewallClusterSlaves(idCluster, fwcloud, function(error, dataFC) {
								ClusterModel.deleteClusterSimple(idCluster, iduser, fwcloud, function(error, data) {
									Policy_rModel.cleanApplyTo(firewallData.id, (error, data) => {});
								});
							});
						});
					var resp = { "result": true, "insertId": firewallData.id };
					res.status(200).json(resp);
				} else {
					res.status(400).json(fwcError.NOT_FOUND);
				}
			});

		} else {
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
	if (req.tree_node.node_type !== 'FDF' && req.tree_node.node_type !== 'FD')
		return res.status(400).json(fwcError.BAD_TREE_NODE_TYPE);

	FirewallModel.getFirewallCluster(iduser, idCluster, (error, firewallDataArry) => {
		if (error) return res.status(400).json(error);

		//Get Data
		if (firewallDataArry && firewallDataArry.length > 0) {
			ClusterModel.insertCluster(clusterData, async(error, data) => {
				if (error) return res.status(400).json(error);

				//get cluster info
				if (data && data.insertId) {
					try {
						var dataresp = { "insertId": data.insertId };
						var newidcluster = data.insertId;
						// Clone cluster nodes.
						for (let firewallData of firewallDataArry) {
							firewallData.cluster = newidcluster;
							firewallData.fwcloud = fwcloud;
							firewallData.by_user = iduser;

							//CLONE FWMASTER
							let data = await FirewallModel.cloneFirewall(iduser, firewallData);

							idNewFirewall = data.insertId;
							oldFirewall = firewallData.id;
							// This function will update the cluster id of the new firewall.
							firewallData.id = idNewFirewall;
							await FirewallModel.updateFirewallCluster(firewallData);

							// If we are cloning the master firewall, then clone interfaces, policy, etc.
							if (firewallData.fwmaster) {
								fwNewMaster = idNewFirewall;
								await FirewallModel.updateFWMaster(iduser, fwcloud, newidcluster, idNewFirewall, 1);
								//CLONE INTERFACES
								let dataI = await InterfaceModel.cloneFirewallInterfaces(iduser, fwcloud, oldFirewall, idNewFirewall);
								await Policy_rModel.cloneFirewallPolicy(req.dbCon, oldFirewall, idNewFirewall, dataI);
								await utilsModel.createFirewallDataDir(fwcloud, idNewFirewall);
							}
						}

						//INSERT FIREWALL NODE STRUCTURE
						await fwcTreemodel.insertFwc_Tree_New_cluster(fwcloud, req.body.node_id, newidcluster);

						// Update aaply_to fields of rules in the master firewall for point to nodes in the cloned cluster.
						await Policy_rModel.updateApplyToRules(newidcluster, fwNewMaster);

						// If we arrive here all has gone fine.
						res.status(200).json(dataresp);
					} catch (error) { res.status(400).json(error) }
				}
			});
		}
	});
});


/* cluster update */
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
		const masterFirewallID = await FirewallModel.getMasterFirewallId(clusterData.fwcloud, clusterData.id);
		await Policy_cModel.deleteFullFirewallPolicy_c(masterFirewallID);
		await ClusterModel.updateCluster(req.dbCon, req.body.fwcloud, clusterData);

		// If this a stateful cluster verify that the stateful special rules exists.
		// Or remove them if this is not a stateful firewall cluster.
		await Policy_rModel.checkStatefulRules(req.dbCon, masterFirewallID, clusterData.options);

		await fwcTreemodel.updateFwc_Tree_Cluster(req.dbCon, req.body.fwcloud, clusterData);
		res.status(204).end();
	} catch(error) { res.status(400).json(error) }
});

// API call for check deleting restrictions.
router.put('/restricted', restrictedCheck.firewall, (req, res) => res.status(204).end());

/* Remove cluster */
router.put("/del",
restrictedCheck.firewall,
async (req, res) => {
	try {
		await ClusterModel.deleteCluster(req.dbCon, req.body.cluster, req.session.user_id, req.body.fwcloud);
		res.status(204).end();
	}	catch(error) { res.status(400).json(error) }
});

module.exports = router;