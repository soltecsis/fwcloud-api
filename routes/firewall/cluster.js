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
 * Property Model to manage API RESPONSE data
 *
 * @property api_resp
 * @type ../../models/api_response
 * 
 */
var api_resp = require('../../utils/api_response');

/**
 * Property to identify Data Object
 *
 * @property objModel
 * @type text
 */
var objModel = 'CLUSTER';

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
router.put('/all', (req, res) => {
	ClusterModel.getClusters(function (error, data)
	{
		//Get data
		if (data && data.length > 0)
		{
			api_resp.getJson(data, api_resp.ACR_OK, '', objModel, null, function (jsonResp) {
				res.status(200).json(jsonResp);
			});
		}
		//get error
		else
		{
			api_resp.getJson(data, api_resp.ACR_NOTEXIST, 'not found', objModel, null, function (jsonResp) {
				res.status(200).json(jsonResp);
			});
		}
	});
});


/* Get FULL cluster by Id */
router.put('/get', (req, res) => {
	ClusterModel.getClusterFullPro(req.session.user_id, req.body.fwcloud, req.body.cluster)
	.then(data =>
	{
		//cluster ok
		if (data)
			api_resp.getJson(data, api_resp.ACR_OK, '', objModel, null, jsonResp => res.status(200).json(jsonResp));
		//Get error
		else
			api_resp.getJson(data, api_resp.ACR_NOTEXIST, 'not found', objModel, null, jsonResp => res.status(200).json(jsonResp));
	})
	.catch(error =>	api_resp.getJson(null, api_resp.ACR_ERROR, 'Error', objModel, error, jsonResp => res.status(200).json(jsonResp)));
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
	ClusterModel.insertCluster(clusterData, async (error, dataNewCluster) => {
		//get cluster info
		if (dataNewCluster && dataNewCluster.insertId)
		{
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

					let data = await FirewallModel.insertFirewall(req.session.user_id, firewallData);
					if (data && data.insertId)
					{
						var idfirewall = data.insertId;

						await FirewallModel.updateFWMaster(req.session.user_id, req.body.fwcloud, idcluster, idfirewall, firewallData.fwmaster);

						if (firewallData.fwmaster === 1) {
							// Create the loop backup interface.
							const loInterfaceId = await InterfaceModel.createLoInterface(req.body.fwcloud, idfirewall);
							// Create the default policy rules.							
							await Policy_rModel.insertDefaultPolicy(idfirewall, loInterfaceId);
							// Create the directory used for store firewall data.
							await utilsModel.createFirewallDataDir(req.body.fwcloud, idfirewall);
						}
					}			
				}
				await fwcTreemodel.insertFwc_Tree_New_cluster(req.body.fwcloud, req.body.clusterData.node_id, idcluster);
				api_resp.getJson(dataNewCluster, api_resp.ACR_INSERTED_OK, 'INSERTED OK', objModel, null, jsonResp => res.status(200).json(jsonResp));
			} catch(error) { api_resp.getJson(dataNewCluster, api_resp.ACR_ERROR, 'Error creating new cluster', objModel, error, jsonResp => res.status(200).json(jsonResp)) }
		} else api_resp.getJson(dataNewCluster, api_resp.ACR_ERROR, 'Error creating new cluster', objModel, error, jsonResp => res.status(200).json(jsonResp));
	});
});

/* New cluster FROM FIREWALL */
router.put("/fwtocluster", 
utilsModel.checkFirewallAccess, 
(req, res) => {
	var iduser = req.session.user_id;
	var fwcloud = req.body.fwcloud;
	var firewall = req.body.firewall;

	FirewallModel.getFirewall(iduser, fwcloud, firewall, function (error, firewallDataArry)
	{
		//Get Data
		if (firewallDataArry && firewallDataArry.length > 0)
		{
			var firewallData = firewallDataArry[0];
			//new objet with Cluster data
			var clusterData = {
				name: "Cluster " + firewallData.name,
				comment: "New cluster from Firewall : " + firewallData.name,
				fwcloud: fwcloud
			};

			ClusterModel.insertCluster(clusterData, function (error, data)
			{
				//get cluster info
				if (data && data.insertId)
				{
					var dataresp = {"insertId": data.insertId};
					var idcluster = data.insertId;
					//////////////////////////////////
					//INSERT AND UPDATE CLUSTER NODE STRUCTURE
					fwcTreemodel.updateFwc_Tree_convert_firewall_cluster(fwcloud, req.body.node_id, idcluster, firewall, function (error, dataTree) {
						if (error)
							api_resp.getJson(dataTree, api_resp.ACR_ERROR, 'Error', objModel, error, function (jsonResp) {
								res.status(200).json(jsonResp);
							});
						else if (dataTree && dataTree.result) {

							//UPDATE CLUSTERS FIREWALL
							//-------------------------------------------
							firewallData.cluster = idcluster;
							firewallData.fwcloud = fwcloud;
							firewallData.by_user = iduser;

							FirewallModel.updateFirewallCluster(firewallData)
							.then(() => FirewallModel.updateFWMaster(iduser, fwcloud, idcluster, idfirewall, 1))
							.then(() => api_resp.getJson(data, api_resp.ACR_INSERTED_OK, 'INSERTED OK', objModel, null, jsonResp => res.status(200).json(jsonResp)))
							.catch(error => api_resp.getJson(data, api_resp.ACR_NOTEXIST, 'Error', objModel, error, jsonResp => res.status(200).json(jsonResp)));
						} else
						{
							api_resp.getJson(data, api_resp.ACR_ERROR, 'Error inserting', objModel, error, function (jsonResp) {
								res.status(200).json(jsonResp);
							});
						}
					});
				} else {
					api_resp.getJson(data, api_resp.ACR_NOTEXIST, 'Error', objModel, error, function (jsonResp) {
						res.status(200).json(jsonResp);
					});
				}
			});
		}
	});
});

/* New FIREWALL FROM CLUSTER */
router.put("/clustertofw", (req, res) => {
	var iduser = req.session.user_id;
	var fwcloud = req.body.fwcloud;
	var idCluster = req.body.id;

	FirewallModel.getFirewallClusterMaster(iduser, idCluster, function (error, firewallDataArry)
	{
		//Get Data
		if (firewallDataArry && firewallDataArry.length > 0)
		{
			var firewallData = firewallDataArry[0];

			//////////////////////////////////
			//UPDATE CLUSTER NODE STRUCTURE
			fwcTreemodel.updateFwc_Tree_convert_cluster_firewall(fwcloud, req.body.node_id, idCluster, firewallData.id, function (error, dataTree) {
				logger.debug("DATATREE: ", dataTree);
				if (error)
					api_resp.getJson(dataTree, api_resp.ACR_ERROR, 'Error', objModel, error, function (jsonResp) {
						res.status(200).json(jsonResp);
					});
				else if (dataTree && dataTree.result) {

					//UPDATE CLUSTERS FIREWALL
					//-------------------------------------------
					firewallData.cluster = null;
					firewallData.fwcloud = fwcloud;
					firewallData.by_user = iduser;
					//logger.debug("firewallData: ", firewallData);
					FirewallModel.updateFirewallCluster(firewallData)
					.then(() => {
						FirewallModel.removeFirewallClusterSlaves(idCluster, fwcloud, function (error, dataFC) {
							ClusterModel.deleteClusterSimple(idCluster, iduser, fwcloud, function (error, data) {
								Policy_rModel.cleanApplyTo(firewallData.id, (error, data) => {});
							});
						});
					});
					var resp = {"result": true, "insertId": firewallData.id};
					api_resp.getJson(resp, api_resp.ACR_INSERTED_OK, 'CONVERT OK', objModel, null, function (jsonResp) {
						res.status(200).json(jsonResp);
					});

				} else
				{
					api_resp.getJson(null, api_resp.ACR_ERROR, 'Error inserting', objModel, error, function (jsonResp) {
						res.status(200).json(jsonResp);
					});
				}
			});

		} else {
			api_resp.getJson(null, api_resp.ACR_NOTEXIST, 'Error', objModel, error, function (jsonResp) {
				res.status(200).json(jsonResp);
			});
		}
	});
});

/* CLONE CLUSTER */
router.put("/clone", (req, res) => {
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

	logger.debug(clusterData);

	FirewallModel.getFirewallCluster(iduser, idCluster, (error, firewallDataArry) => {
		if (error) return api_resp.getJson(null, api_resp.ACR_ERROR, 'Error', objModel, error, jsonResp => res.status(200).json(jsonResp));
		
		//Get Data
		if (firewallDataArry && firewallDataArry.length > 0) {
			ClusterModel.insertCluster(clusterData, async (error, data) => {
				if (error) return api_resp.getJson(null, api_resp.ACR_ERROR, 'Error', objModel, error, jsonResp => res.status(200).json(jsonResp));

				//get cluster info
				if (data && data.insertId) {
					try {
						var dataresp = {"insertId": data.insertId};
						var newidcluster = data.insertId;
						// Clone cluster nodes.
						for (let firewallData of firewallDataArry) {
							firewallData.cluster = newidcluster;
							firewallData.fwcloud = fwcloud;
							firewallData.by_user = iduser;
	
							//CLONE FWMASTER
							let data = await FirewallModel.cloneFirewall(iduser, firewallData);
							if (!data || !data.result) return api_resp.getJson(null, api_resp.ACR_ERROR, 'Error', objModel, error, jsonResp => res.status(200).json(jsonResp));
						
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
								await Policy_rModel.cloneFirewallPolicy(iduser, fwcloud, oldFirewall, idNewFirewall,dataI);
								await utilsModel.createFirewallDataDir(fwcloud, idNewFirewall);
							}
						}
	
						//INSERT FIREWALL NODE STRUCTURE
						await fwcTreemodel.insertFwc_Tree_New_cluster(fwcloud, req.body.node_id, newidcluster);
	
						// Update aaply_to fields of rules in the master firewall for point to nodes in the cloned cluster.
						await Policy_rModel.updateApplyToRules(newidcluster, fwNewMaster);
	
						// If we arrive here all has gone fine.
						api_resp.getJson(dataresp, api_resp.ACR_UPDATED_OK, 'CLONED OK', objModel, null, jsonResp => res.status(200).json(jsonResp))	
					} catch(error) { api_resp.getJson(null, api_resp.ACR_ERROR, 'Error', objModel, error, jsonResp => res.status(200).json(jsonResp)) }
				}
			});
		}
	});
});


/* cluster update */
router.put('/', (req, res) => {
	var fwcloud = req.body.fwcloud;
	
	var JsonData = req.body;
	logger.debug("JSON RECIBIDO: ", JsonData);
	//new objet with Cluster data
	var clusterData = {
		id: JsonData.clusterData.id,
		name: JsonData.clusterData.name,
		comment: JsonData.clusterData.comment,
		fwcloud: fwcloud,
		options: JsonData.clusterData.options
	};
	
	FirewallModel.getMasterFirewallId(clusterData.fwcloud,clusterData.id)
	.then(masterFirewallID => Policy_cModel.deleteFullFirewallPolicy_c(masterFirewallID))
	.then(() => ClusterModel.updateCluster(fwcloud, clusterData))
	.then(() => {
		fwcTreemodel.updateFwc_Tree_Cluster(req.session.user_id, req.body.fwcloud, clusterData, (error, dataT) => {
			api_resp.getJson(null,api_resp.ACR_UPDATED_OK, 'CLUSTER UPDATED OK', objModel, null, jsonResp => res.status(200).json(jsonResp));
		});
	})
	.catch(error => api_resp.getJson(data, api_resp.ACR_ERROR, 'Error updating cluster', objModel, error,jsonResp => res.status(200).json(jsonResp)));
});

// API call for check deleting restrictions.
router.put("/restricted",
restrictedCheck.otherFirewall,
(req, res) => api_resp.getJson(null, api_resp.ACR_OK, '', objModel, null, jsonResp =>res.status(200).json(jsonResp)));

/* Remove cluster */
router.put("/del", 
restrictedCheck.otherFirewall,
(req, res) => {
	ClusterModel.deleteCluster(req.body.cluster, req.session.user_id, req.body.fwcloud, (error, data) => {
		if (data && data.result)
			api_resp.getJson(data, api_resp.ACR_DELETED_OK, '', objModel, null, jsonResp =>	res.status(200).json(jsonResp));
		else
			api_resp.getJson(data, api_resp.ACR_ERROR, 'Error deleting', objModel, error, jsonResp =>	res.status(200).json(jsonResp));
	});
});

module.exports = router;