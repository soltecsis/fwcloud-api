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

var fwcTreemodel = require('../../models/tree/fwc_tree');
var Policy_rModel = require('../../models/policy/policy_r');
var FirewallModel = require('../../models/firewall/firewall');
var InterfaceModel = require('../../models/interface/interface');




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
router.get('', function (req, res)
{
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
router.get('/full/:id', function (req, res)
{
	var id = req.params.id;
	var iduser = req.iduser;
	var fwcloud = req.fwcloud;


	if (!isNaN(id))
	{
		ClusterModel.getClusterFullPro(iduser, fwcloud, id)
				.then(data =>
				{
					//cluster ok
					if (data)
					{
						api_resp.getJson(data, api_resp.ACR_OK, '', objModel, null, function (jsonResp) {
							res.status(200).json(jsonResp);
						});

					}
					//Get error
					else
					{
						api_resp.getJson(data, api_resp.ACR_NOTEXIST, 'not found', objModel, null, function (jsonResp) {
							res.status(200).json(jsonResp);
						});
					}
				})
				.catch(e => {

				});
	} else
	{
		api_resp.getJson(null, api_resp.ACR_NOTEXIST, 'not found', objModel, null, function (jsonResp) {
			res.status(200).json(jsonResp);
		});
	}
});

/* Get cluster by Id */
router.get('/:id', function (req, res)
{
	var id = req.params.id;

	if (!isNaN(id))
	{
		ClusterModel.getCluster(id, function (error, data)
		{
			//cluster ok
			if (data && data.length > 0)
			{
				api_resp.getJson(data, api_resp.ACR_OK, '', objModel, null, function (jsonResp) {
					res.status(200).json(jsonResp);
				});

			}
			//Get error
			else
			{
				api_resp.getJson(data, api_resp.ACR_NOTEXIST, 'not found', objModel, null, function (jsonResp) {
					res.status(200).json(jsonResp);
				});
			}
		});
	} else
	{
		api_resp.getJson(null, api_resp.ACR_NOTEXIST, 'not found', objModel, null, function (jsonResp) {
			res.status(200).json(jsonResp);
		});
	}
});


/* New cluster */
router.post("/cluster", utilsModel.checkConfirmationToken, function (req, res)
{
	var iduser = req.iduser;
	var fwcloud = req.fwcloud;

	var JsonData = req.body;
	var fwnodes = JsonData.clusterData.fwnodes;
	logger.debug("JSON RECIBIDO: ", JsonData);
	//new objet with Cluster data
	var clusterData = {
		name: JsonData.clusterData.name,
		comment: JsonData.clusterData.comment,
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
			//INSERT CLUSTER NODE STRUCTURE
			fwcTreemodel.insertFwc_Tree_New_cluster(fwcloud, "FDC", idcluster, function (error, dataTree) {
				if (error)
					api_resp.getJson(dataTree, api_resp.ACR_ERROR, 'Error', objModel, error, function (jsonResp) {
						res.status(200).json(jsonResp);
					});
				else if (dataTree && dataTree.result) {
					logger.debug("FWNODES: ", fwnodes);
					//BUCLE INSERT CLUSTERS FIREWALLS
					//-------------------------------------------
					for (let firewallData of fwnodes) {
						firewallData.cluster = idcluster;
						firewallData.fwcloud = fwcloud;
						firewallData.by_user = iduser;
						FirewallModel.checkBodyFirewall(firewallData, true)
								.then(result => {
									firewallData = result;
									logger.debug("NODE FIREWALL:  ", firewallData);

									utilsModel.encrypt(firewallData.install_user)
											.then(data => {
												logger.debug("SSHUSER: " + firewallData.install_user + "   ENCRYPTED: " + data);
												firewallData.install_user = data;
											})
											.then(utilsModel.encrypt(firewallData.install_pass)
													.then(data => {
														logger.debug("SSPASS: " + firewallData.install_pass + "   ENCRYPTED: " + data);
														firewallData.install_pass = data;
													}))
											.then(() => {
												logger.debug("SAVING DATA NODE CLUSTER. SAVE USER_PASS:", firewallData.save_user_pass);
												if (!firewallData.save_user_pass) {
													firewallData.install_user = '';
													firewallData.install_pass = '';
												}
												FirewallModel.insertFirewall(iduser, firewallData)
														.then(data => {
															var idfirewall = data.insertId;
															logger.debug("FIREWALL CLUSTER INSERTED OK: ", idfirewall);

															FirewallModel.updateFWMaster(iduser, fwcloud, idcluster, idfirewall, firewallData.fwmaster, function (error, dataFM) {
																//INSERT FIREWALL NODE STRUCTURE
																fwcTreemodel.insertFwc_Tree_New_firewall(fwcloud, idfirewall, idcluster, firewallData.fwmaster, function (error, dataTree) {
																	if (dataTree && dataTree.result && firewallData.fwmaster == 1) {
																		///CREATE CATCHING ALL RULES
																		Policy_rModel.insertPolicy_r_CatchingAllRules(iduser, fwcloud, idfirewall)
																				.then(() => {
																					logger.debug("CATCHING RULES CREATED FOR FIREWALL: ", idfirewall, "  FWMASTER: ", firewallData.fwmaster);
																				});

																	}
																});
															});
														})
														.catch(error => {
															logger.debug("ERROR CREATING FIREWALL NODE: ", firewallData);
															logger.debug("ERROR: ", error);
														});
											});
								})
								.catch(e => {
									logger.error("ERROR CHECK PARAMS FIREWALL: ", e);
								});
					}
					//----------------------------------------------
					api_resp.getJson(data, api_resp.ACR_INSERTED_OK, 'INSERTED OK', objModel, null, function (jsonResp) {
						res.status(200).json(jsonResp);
					});

				} else
					api_resp.getJson(data, api_resp.ACR_ERROR, 'Error', objModel, error, function (jsonResp) {
						res.status(200).json(jsonResp);
					});
			});

		} else
		{
			api_resp.getJson(data, api_resp.ACR_ERROR, 'Error inserting', objModel, error, function (jsonResp) {
				res.status(200).json(jsonResp);
			});
		}
	});
});

/* New cluster FROM FIREWALL */
router.post("/cluster/convertfirewall/:idfirewall", utilsModel.checkFirewallAccess, utilsModel.checkConfirmationToken, function (req, res)
{
	var iduser = req.iduser;
	var fwcloud = req.fwcloud;
	var idfirewall = req.params.idfirewall;


	FirewallModel.getFirewall(iduser, fwcloud, idfirewall, function (error, firewallDataArry)
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
					fwcTreemodel.updateFwc_Tree_convert_firewall_cluster(fwcloud, "FDC", idcluster, idfirewall, function (error, dataTree) {
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

							FirewallModel.updateFirewallCluster(firewallData, function (error, dataFC) {
								FirewallModel.updateFWMaster(iduser, fwcloud, idcluster, idfirewall, 1, function (error, data) {

								});
							});
							api_resp.getJson(data, api_resp.ACR_INSERTED_OK, 'INSERTED OK', objModel, null, function (jsonResp) {
								res.status(200).json(jsonResp);
							});

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
router.post("/cluster/convertcluster/:idcluster", utilsModel.checkConfirmationToken, function (req, res)
{
	var iduser = req.iduser;
	var fwcloud = req.fwcloud;
	var idCluster = req.params.idcluster;


	FirewallModel.getFirewallClusterMaster(iduser, idCluster, function (error, firewallDataArry)
	{
		//Get Data
		if (firewallDataArry && firewallDataArry.length > 0)
		{
			var firewallData = firewallDataArry[0];

			//////////////////////////////////
			//UPDATE CLUSTER NODE STRUCTURE
			fwcTreemodel.updateFwc_Tree_convert_cluster_firewall(fwcloud, "FDC", idCluster, firewallData.id, function (error, dataTree) {
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
					FirewallModel.updateFirewallCluster(firewallData, function (error, dataFC) {
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
router.put("/clone/cluster/:idcluster", utilsModel.checkConfirmationToken, function (req, res)
{
	var iduser = req.iduser;
	var fwcloud = req.fwcloud;
	var idCluster = req.params.idcluster;

	//Save firewall data into objet    
	var clusterData = {
		name: req.body.name,
		comment: req.body.comment,
		fwcloud: req.fwcloud //working cloud              
	};

	logger.debug(clusterData);

	FirewallModel.getFirewallClusterMaster(iduser, idCluster, function (error, firewallDataArry)
	{
		//Get Data
		if (firewallDataArry && firewallDataArry.length > 0)
		{
			var firewallData = firewallDataArry[0];
			logger.debug("firewallData: ", firewallData);

			ClusterModel.insertCluster(clusterData, function (error, data)
			{
				//get cluster info
				if (data && data.insertId)
				{
					var dataresp = {"insertId": data.insertId};
					var newidcluster = data.insertId;
					//////////////////////////////////
					//INSERT AND UPDATE CLUSTER NODE STRUCTURE
					fwcTreemodel.insertFwc_Tree_New_cluster(fwcloud, "FDC", newidcluster, function (error, dataTree) {
						if (error)
							api_resp.getJson(dataTree, api_resp.ACR_ERROR, 'Error', objModel, error, function (jsonResp) {
								res.status(200).json(jsonResp);
							});
						else if (dataTree && dataTree.result) {

							//CLONE FWMASTER
							FirewallModel.cloneFirewall(req.iduser, firewallData)
									.then(data =>
									{
										//Saved ok
										if (data && data.result)
										{
											logger.debug("NUEVO FIREWALL CREADO: " + data.insertId);
											var idNewFirewall = data.insertId;
											var oldFirewall = firewallData.id;

											//-------------------------------------------
											firewallData.cluster = newidcluster;
											firewallData.fwcloud = fwcloud;
											firewallData.by_user = iduser;

											FirewallModel.updateFirewallCluster(firewallData, function (error, dataFC) {
												FirewallModel.updateFWMaster(iduser, fwcloud, newidcluster, idNewFirewall, 1, function (error, data) {

												});
											});

											//CLONE INTERFACES
											InterfaceModel.cloneFirewallInterfaces(req.iduser, req.fwcloud, oldFirewall, idNewFirewall)
													.then(dataI =>
													{
														//CLONE RULES
														Policy_rModel.cloneFirewallPolicy(req.iduser, req.fwcloud, oldFirewall, idNewFirewall)
																.then(dataP => {
																	//INSERT FIREWALL NODE STRUCTURE UNDER CLUSTER  NODES PARENT
																	//fwcTreemodel.insertFwc_Tree_New_firewall(req.fwcloud, idNewFirewall, null, 1, function (error, dataTree) {
																	fwcTreemodel.insertFwc_Tree_New_firewall(req.fwcloud, idNewFirewall,newidcluster,1, function (error, dataTree) {

																		if (error)
																			api_resp.getJson(data, api_resp.ACR_ERROR, 'Error', objModel, error, function (jsonResp) {
																				res.status(200).json(jsonResp);
																			});
																		else if (data && data.result)
																			api_resp.getJson(data, api_resp.ACR_UPDATED_OK, 'CLONED OK', objModel, null, function (jsonResp) {
																				res.status(200).json(jsonResp);
																			});
																		else
																			api_resp.getJson(data, api_resp.ACR_ERROR, 'Error', objModel, error, function (jsonResp) {
																				res.status(200).json(jsonResp);
																			});
																	});
																})
																.catch(err => {
																	api_resp.getJson(data, api_resp.ACR_ERROR, 'Error', objModel, err, function (jsonResp) {
																		res.status(200).json(jsonResp);
																	});
																});
													})
													.catch(err => {
														api_resp.getJson(data, api_resp.ACR_ERROR, 'Error', objModel, err, function (jsonResp) {
															res.status(200).json(jsonResp);
														});
													});


										} else
										{
											api_resp.getJson(data, api_resp.ACR_ERROR, 'Error', objModel, null, function (jsonResp) {
												res.status(200).json(jsonResp);
											});
										}
									})
									.catch(e => {
										api_resp.getJson(null, api_resp.ACR_ERROR, 'Error', objModel, e, function (jsonResp) {
											res.status(200).json(jsonResp);
										});
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


/* cluster update */
router.put('/cluster', utilsModel.checkConfirmationToken, function (req, res)
{
	var fwcloud = req.fwcloud;
	
	var JsonData = req.body;
	logger.debug("JSON RECIBIDO: ", JsonData);
	//new objet with Cluster data
	var clusterData = {
		id: JsonData.clusterData.id,
		name: JsonData.clusterData.name,
		comment: JsonData.clusterData.comment,
		fwcloud: fwcloud
	};
	
	ClusterModel.updateCluster(fwcloud, clusterData, function (error, data)
	{
		//cluster ok
		if (data && data.result)
		{
			//UPDATE TREE
			fwcTreemodel.updateFwc_Tree_Cluster(req.iduser, req.fwcloud, clusterData, function (error, dataT) {
				api_resp.getJson(data,api_resp.ACR_UPDATED_OK, 'UPDATED OK', objModel, null, function (jsonResp) {
					res.status(200).json(jsonResp);
				});
			});
		} else
		{
			api_resp.getJson(data, api_resp.ACR_ERROR, 'Error updating', objModel, error, function (jsonResp) {
				res.status(200).json(jsonResp);
			});
		}
	});
});

/* Remove cluster */
router.put("/del/cluster/:id", utilsModel.checkConfirmationToken, function (req, res)
{
	var iduser = req.iduser;
	var fwcloud = req.fwcloud;
	var id = req.params.id;
	ClusterModel.deleteCluster(id, iduser, fwcloud, function (error, data)
	{
		if (data && data.result)
		{
			api_resp.getJson(data, api_resp.ACR_DELETED_OK, '', objModel, null, function (jsonResp) {
				res.status(200).json(jsonResp);
			});
		} else
		{
			api_resp.getJson(data, api_resp.ACR_ERROR, 'Error deleting', objModel, error, function (jsonResp) {
				res.status(200).json(jsonResp);
			});
		}
	});
});
module.exports = router;
