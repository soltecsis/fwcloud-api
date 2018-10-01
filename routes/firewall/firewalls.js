/**
 * Module to routing Firewalls requests
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
 * Property Model to manage API RESPONSE data: {{#crossLinkModule "api_response"}}{{/crossLinkModule}}
 *
 * @property api_resp
 * @type api_respModel
 * 
 */
var api_resp = require('../../utils/api_response');

/**
 * Property to identify Data Object
 *
 * @property objModel
 * @type text
 */
var objModel = 'FIREWALL';

/**
 * Property Model to manage Firewall Data
 *
 * @property FirewallModel
 * @type ../../models/firewall/firewall
 * 
 * 
 */
var FirewallModel = require('../../models/firewall/firewall');
var FirewallExport = require('../../models/firewall/export');

/**
 * Property Model to manage Fwcloud Data
 *
 * @property FwcloudModel
 * @type ../../models/fwcloud
 * 
 * 
 */
var FwcloudModel = require('../../models/fwcloud/fwcloud');

/**
 * Property Logger to manage App logs
 *
 * @attribute logger
 * @type log4js/app
 * 
 */
var logger = require('log4js').getLogger("app");


var utilsModel = require("../../utils/utils.js");

var fwcTreemodel = require('../../models/tree/fwc_tree');

var InterfaceModel = require('../../models/interface/interface');

var Policy_rModel = require('../../models/policy/policy_r');
var Policy_cModel = require('../../models/policy/policy_c');


router.param('cluster', function (req, res, next, param) {
	logger.debug("DETECTED PARAM CLUSTER");
	if (param === undefined || param === '' || isNaN(param)) {
		req.params.cluster = null;
		next();
	} else
		next();
});


/**
 * Get Firewalls by User
 * 
 * 
 * > ROUTE CALL:  __/firewalls/:iduser__      
 * > METHOD:  __GET__
 * 
 * @method getFirewallByUser
 * 
 * @param {Integer} iduser User identifier
 * 
 * @return {JSON} Returns `JSON` Data from Firewall
 * @example #### JSON RESPONSE
 *    
 *       {"data" : [
 *          {  //Data Firewall 1       
 *           "id" : ,            //Firewall Identifier
 *           "cluster" : ,       //Cluster
 *           "fwcloud" : ,       //Id Firewall cloud
 *           "name" : ,          //Firewall name
 *           "comment" : ,       //comment
 *           "created_at" : ,    //Date Created
 *           "updated_at" : ,    //Date Updated
 *           "by_user" : ,       //User last update
 *          },
 *          {....}, //Data Firewall 2
 *          {....}  //Data Firewall ...n 
 *         ]
 *       };
 * 
 */
router.get('', function (req, res)
{
	var iduser = req.iduser;
	FirewallModel.getFirewalls(iduser, function (error, data)
	{
		//Get data
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
});

/**
 * Get Firewalls by Cloud
 * 
 * 
 * > ROUTE CALL:  __/firewalls/Cloud/__      
 * > METHOD:  __GET__
 * 
 * @method getFirewallByUser_and_Cloud
 * 
 * @param {Integer} iduser User identifier
 * @param {Number} fwcloud Cloud identifier
 * 
 * @return {JSON} Returns `JSON` Data from Firewall
 * @example #### JSON RESPONSE
 *    
 *       {"data" : [
 *          {  //Data Firewall 1       
 *           "id" : ,            //Firewall Identifier
 *           "cluster" : ,       //Cluster
 *           "fwcloud" : ,       //Id Firewall cloud
 *           "name" : ,          //Firewall name
 *           "comment" : ,       //comment
 *           "created_at" : ,    //Date Created
 *           "updated_at" : ,    //Date Updated
 *           "by_user" : ,       //User last update
 *          },
 *          {....}, //Data Firewall 2
 *          {....}  //Data Firewall ...n 
 *         ]
 *       };
 * 
 */
router.get('/cloud', function (req, res)
{
	var iduser = req.iduser;
	var fwcloud = req.fwcloud;
	FirewallModel.getFirewallCloud(iduser, fwcloud, function (error, data)
	{
		//get data
		if (data && data.length > 0)
		{
			api_resp.getJson(data, api_resp.ACR_OK, '', objModel, null, function (jsonResp) {
				res.status(200).json(jsonResp);
			});
		}
		//Get Error
		else
		{
			api_resp.getJson(data, api_resp.ACR_NOTEXIST, 'not found', objModel, null, function (jsonResp) {
				res.status(200).json(jsonResp);
			});
		}
	});
});


/**
 * Get Firewalls by User and ID
 * 
 * 
 * > ROUTE CALL:  __/firewalls/:iduser/:id__      
 * > METHOD:  __GET__
 * 
 * @method getFirewallByUser_and_Id
 * 
 * @param {Integer} iduser User identifier
 * @param {Integer} id firewall identifier
 * 
 * @return {JSON} Returns `JSON` Data from Firewall
 * @example #### JSON RESPONSE
 *    
 *       {"data" : [
 *          {  //Data Firewall        
 *           "id" : ,            //Firewall Identifier
 *           "cluster" : ,       //Cluster
 *           "fwcloud" : ,       //Id Firewall cloud
 *           "name" : ,          //Firewall name
 *           "comment" : ,       //comment
 *           "created_at" : ,    //Date Created
 *           "updated_at" : ,    //Date Updated
 *           "compiled_at" : ,   //Date Compiled
 *           "installed_at" : ,  //Date Installed
 *           "by_user" : ,       //User last update
 *          }
 *         ]
 *       };
 * 
 */
router.get('/:id', function (req, res)
{
	var iduser = req.iduser;
	var id = req.params.id;
	var fwcloud = req.fwcloud;

	FirewallModel.getFirewall(iduser, fwcloud, id, function (error, data)
	{
		//Get Data
		if (data && data.length > 0)
		{
			api_resp.getJson(data, api_resp.ACR_OK, '', objModel, null, function (jsonResp) {
				res.status(200).json(jsonResp);
			});
		}
		//get Error
		else
		{
			api_resp.getJson(data, api_resp.ACR_NOTEXIST, 'not found', objModel, null, function (jsonResp) {
				res.status(200).json(jsonResp);
			});
		}
	});
});

/* Get firewall by Id */
/**
 * Get Firewalls by ID and User
 * 
 * <br>ROUTE CALL:  <b>/firewalls/:iduser/firewall/:id</b>
 * <br>METHOD: <b>GET</b>
 *
 * @method getFirewallByUser_and_ID_V2
 * 
 * @param {Integer} iduser User identifier
 * @param {Integer} id Firewall identifier
 * 
 * @return {JSON} Returns Json Data from Firewall
 */
router.get('/firewall/:id', function (req, res)
{
	var id = req.params.id;
	var iduser = req.iduser;
	var fwcloud = req.fwcloud;

	if (!isNaN(id))
	{
		FirewallModel.getFirewall(iduser, fwcloud, id, function (error, data)
		{
			//get firewall data
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
	}
	//id must be numeric
	else
	{
		api_resp.getJson(null, api_resp.ACR_NOTEXIST, 'not found', objModel, null, function (jsonResp) {
			res.status(200).json(jsonResp);
		});
	}
});

/**
 * Get Firewalls by User and Name
 * 
 * 
 * > ROUTE CALL:  __/firewalls/:iduser/fwname/:name__      
 * > METHOD:  __GET__
 * 
 * @method getFirewallByUser_and_Name
 * 
 * @param {Integer} iduser User identifier
 * @param {String} name firewall name
 * 
 * @return {JSON} Returns `JSON` Data from Firewall
 * @example #### JSON RESPONSE
 *    
 *       {"data" : [
 *          {  //Data Firewall 1       
 *           "id" : ,            //Firewall Identifier
 *           "cluster" : ,       //Cluster
 *           "fwcloud" : ,       //Id Firewall cloud
 *           "name" : ,          //Firewall name
 *           "comment" : ,       //comment
 *           "created_at" : ,    //Date Created
 *           "updated_at" : ,    //Date Updated
 *           "by_user" : ,       //User last update
 *          },
 *          {....}, //Data Firewall 2
 *          {....}  //Data Firewall ...n 
 *         ]
 *       };
 * 
 */
router.get('/fwname/:name', function (req, res)
{
	var iduser = req.iduser;
	var name = req.params.name;
	FirewallModel.getFirewallName(iduser, name, function (error, data)
	{
		//Get data
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
});


/**
 * Get Firewalls by Cluster
 * 
 * 
 * > ROUTE CALL:  __/firewalls/:iduser/cluster/:idcluster__      
 * > METHOD:  __GET__
 * 
 * @method getFirewallByUser_and_Cluster
 * 
 * @param {Integer} iduser User identifier
 * @param {Number} idcluster Cluster identifier
 * 
 * @return {JSON} Returns `JSON` Data from Firewall
 * @example #### JSON RESPONSE
 *    
 *       {"data" : [
 *          {  //Data Firewall 1       
 *           "id" : ,            //Firewall Identifier
 *           "cluster" : ,       //Cluster
 *           "fwcloud" : ,       //Id Firewall cloud
 *           "name" : ,          //Firewall name
 *           "comment" : ,       //comment
 *           "created_at" : ,    //Date Created
 *           "updated_at" : ,    //Date Updated
 *           "by_user" : ,       //User last update
 *          },
 *          {....}, //Data Firewall 2
 *          {....}  //Data Firewall ...n 
 *         ]
 *       };
 * 
 */
router.get('/cluster/:idcluster', function (req, res)
{
	var iduser = req.iduser;
	var idcluster = req.params.idcluster;
	FirewallModel.getFirewallCluster(iduser, idcluster, function (error, data)
	{
		//get data
		if (data && data.length > 0)
		{
			api_resp.getJson(data, api_resp.ACR_OK, '', objModel, null, function (jsonResp) {
				res.status(200).json(jsonResp);
			});
		}
		//Get Error
		else
		{
			api_resp.getJson(data, api_resp.ACR_NOTEXIST, 'not found', objModel, null, function (jsonResp) {
				res.status(200).json(jsonResp);
			});
		}
	});
});


/**
 * CREATE New firewall
 * 
 * 
 * > ROUTE CALL:  __/firewalls/firewall__      
 * > METHOD:  __POST__
 * 
 *
 * @method AddFirewall
 * 
 * @param {Integer} id Firewall identifier (AUTO)
 * @param {Integer} iduser User identifier
 * @param {Integer} cluster Cluster identifier
 * @param {String} name Firewall Name
 * @param {String} [comment] Firewall comment
 * 
 * @return {JSON} Returns Json result
 * @example 
 * #### JSON RESPONSE OK:
 *    
 *       {"data" : [
 *          { 
 *           "insertId : ID,   //firewall identifier           
 *          }
 *         ]
 *       };
 *       
 * #### JSON RESPONSE ERROR:
 *    
 *       {"data" : [
 *          { 
 *           "msg : ERROR,   //Text Error
 *          }
 *         ]
 *       };
 */
router.post("/firewall", async (req, res) => {
	var firewallData = {
		id: null,
		cluster: req.body.cluster,
		name: req.body.name,
		status: 3,
		comment: req.body.comment,
		fwcloud: req.fwcloud,
		install_user: req.body.install_user,
		install_pass: req.body.install_pass,
		save_user_pass: req.body.save_user_pass,
		install_interface: req.body.install_interface,
		install_ipobj: req.body.install_ipobj,
		fwmaster: req.body.fwmaster,
		install_port: req.body.install_port,
		by_user: req.iduser,
		options: req.body.options
	};


	try {
		firewallData = await FirewallModel.checkBodyFirewall(firewallData, true);
	
		//encript username and password
		firewallData.install_user = (firewallData.install_user) ? await utilsModel.encrypt(firewallData.install_user) : '';
		firewallData.install_pass = (firewallData.install_pass) ? await utilsModel.encrypt(firewallData.install_pass) : '';

		let data = await FirewallModel.insertFirewall(req.iduser, firewallData);
		if (data && data.insertId)
		{
			var dataresp = {"insertId": data.insertId};
			var idfirewall = data.insertId;
	
			await FirewallModel.updateFWMaster(req.iduser, req.fwcloud, firewallData.cluster, idfirewall, firewallData.fwmaster);

			// Create the loop backup interface.
			const loInterfaceId = await InterfaceModel.createLoInterface(idfirewall);
			
			if (!firewallData.cluster) // Create firewall tree.
				await fwcTreemodel.insertFwc_Tree_New_firewall(req.fwcloud, req.body.node_id, idfirewall);
			else // Create the new firewall node in the NODES node of the cluster.
				await fwcTreemodel.insertFwc_Tree_New_cluster_firewall(req.fwcloud, firewallData.cluster, idfirewall, firewallData.name);
			
			if ((firewallData.cluster>0 && firewallData.fwmaster===1) || firewallData.cluster===null)
				await Policy_rModel.insertDefaultPolicy(idfirewall, loInterfaceId);

			api_resp.getJson(dataresp, api_resp.ACR_INSERTED_OK, 'INSERTED OK', objModel, null, jsonResp => res.status(200).json(jsonResp));
		} else api_resp.getJson(data, api_resp.ACR_ERROR, 'Error', objModel, "", jsonResp => res.status(200).json(jsonResp));
	} catch(error) { api_resp.getJson(null, api_resp.ACR_ERROR, 'Creating firewall', objModel, error, jsonResp => res.status(200).json(jsonResp)) }
});


/**
 * UPDATE firewall
 * 
 * 
 * > ROUTE CALL:  __/firewalls/firewall__      
 * > METHOD:  __PUT__
 * 
 *
 * @method UpdateFirewall
 * 
 * @param {Integer} id Firewall identifier
 * @optional
 * @param {Integer} iduser User identifier
 * @param {Integer} cluster Cluster identifier
 * @param {String} name Firewall Name
 * @param {String} comment Firewall comment
 * 
 * @return {JSON} Returns Json result
 * @example 
 * #### JSON RESPONSE OK:
 *    
 *       {"data" : [
 *          { 
 *           "msg : "success",   //result
 *          }
 *         ]
 *       };
 *       
 * #### JSON RESPONSE ERROR:
 *    
 *       {"data" : [
 *          { 
 *           "msg : ERROR,   //Text Error
 *          }
 *         ]
 *       };
 */
router.put('/firewall/:idfirewall',
utilsModel.checkFirewallAccess,
utilsModel.checkConfirmationToken,
(req, res) => {
	var idfirewall = req.params.idfirewall;

	//Save firewall data into objet    
	var firewallData = {
		id: idfirewall,
		cluster: req.body.cluster,
		name: req.body.name,
		comment: req.body.comment,
		fwcloud: req.fwcloud, //working cloud      
		install_user: req.body.install_user,
		install_pass: req.body.install_pass,
		save_user_pass: req.body.save_user_pass,
		install_interface: req.body.install_interface,
		install_ipobj: req.body.install_ipobj,
		fwmaster: req.body.fwmaster,
		install_port: req.body.install_port,
		by_user: req.iduser,  //working user
		options: req.body.options
	};

	//logger.debug(firewallData);
	Policy_cModel.deleteFullFirewallPolicy_c(req.params.idfirewall)
	.then(() => FirewallModel.updateFirewallStatus(req.fwcloud,req.params.idfirewall,"|3"))
	.then(() => FirewallModel.checkBodyFirewall(firewallData, false))
	.then(result => {
		firewallData = result;
		//encript username and password
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

					FirewallModel.updateFirewall(req.iduser, firewallData, function (error, data)
					{
						//Saved ok
						if (data && data.result)
						{
							FirewallModel.updateFWMaster(req.iduser, req.fwcloud, firewallData.cluster, idfirewall, firewallData.fwmaster)
							.then(() => {
								//////////////////////////////////
								//UPDATE FIREWALL NODE STRUCTURE                                    
								fwcTreemodel.updateFwc_Tree_Firewall(req.iduser, req.fwcloud, firewallData, function (error, data) {
									if (error)
										api_resp.getJson(data, api_resp.ACR_ERROR, 'Error', objModel, error, function (jsonResp) {
											res.status(200).json(jsonResp);
										});
									else if (data && data.result)
										api_resp.getJson(data, api_resp.ACR_UPDATED_OK, 'UPDATED OK', objModel, null, function (jsonResp) {
											res.status(200).json(jsonResp);
										});
									else
										api_resp.getJson(data, api_resp.ACR_ERROR, 'Error', objModel, error, function (jsonResp) {
											res.status(200).json(jsonResp);
										});
								});
							})
							.catch(error => api_resp.getJson(data, api_resp.ACR_ERROR, 'Error', objModel, error, jsonResp => res.status(200).json(jsonResp)));
						} else
						{
							api_resp.getJson(data, api_resp.ACR_ERROR, 'Error', objModel, error, function (jsonResp) {
								res.status(200).json(jsonResp);
							});
						}
					});

				})
				.catch(e => {
					logger.debug(e);
					api_resp.getJson(null, api_resp.ACR_ERROR, 'Error', objModel, e, function (jsonResp) {
						res.status(200).json(jsonResp);
					});
				});

	})
	.catch(e => {
		logger.error("ERROR UPDATING FIREWALL: ", e);
		api_resp.getJson(null, api_resp.ACR_ERROR, e, objModel, e, function (jsonResp) {
			res.status(200).json(jsonResp);
		});
	});
});


router.put('/clone/firewall/:idfirewall', utilsModel.checkFirewallAccess, utilsModel.checkConfirmationToken, function (req, res)
{
	var idfirewall = req.params.idfirewall;
	//Save firewall data into objet    
	var firewallData = {
		id: idfirewall,
		name: req.body.name,
		comment: req.body.comment,
		fwcloud: req.fwcloud, //working cloud      
		by_user: req.iduser  //working user
	};

	FirewallModel.cloneFirewall(req.iduser, firewallData)
	.then(data =>
	{
		//Saved ok
		if (data && data.result)
		{
			logger.debug("NUEVO FIREWALL CREADO: " + data.insertId);
			var idNewFirewall = data.insertId;

			//CLONE INTERFACES
			InterfaceModel.cloneFirewallInterfaces(req.iduser, req.fwcloud, idfirewall, idNewFirewall)
			.then(dataI => Policy_rModel.cloneFirewallPolicy(req.iduser, req.fwcloud, idfirewall, idNewFirewall, dataI))	
			.then(dataP => {
				//INSERT FIREWALL NODE STRUCTURE                                                
				fwcTreemodel.insertFwc_Tree_firewalls(req.fwcloud, req.body.node_id, idNewFirewall, (error, dataTree) => {
					if (error)
						api_resp.getJson(data, api_resp.ACR_ERROR, 'Error', objModel, error, jsonResp => res.status(200).json(jsonResp));
					else if (data && data.result)
						api_resp.getJson(data, api_resp.ACR_UPDATED_OK, 'CLONED OK', objModel, null, jsonResp => res.status(200).json(jsonResp));
					else
						api_resp.getJson(data, api_resp.ACR_ERROR, 'Error', objModel, error, jsonResp => res.status(200).json(jsonResp));
				});
			})
			.catch(err => api_resp.getJson(data, api_resp.ACR_ERROR, 'Error', objModel, err, jsonResp => res.status(200).json(jsonResp)));
		} else
			api_resp.getJson(data, api_resp.ACR_ERROR, 'Error', objModel, null, jsonResp =>	res.status(200).json(jsonResp));
	})
	.catch(e => api_resp.getJson(null, api_resp.ACR_ERROR, 'Error', objModel, e, jsonResp => res.status(200).json(jsonResp)));
});


//UPDATE FIREWALL FWMASTER
router.put('/firewall/:idfirewall/fwmaster/:fwmaster', utilsModel.checkFirewallAccess, utilsModel.checkConfirmationToken, function (req, res)
{
	var idfirewall = req.params.idfirewall;
	var fwmaster = req.params.fwmaster;


	if (fwmaster === undefined || fwmaster === '' || isNaN(fwmaster) || fwmaster == null) {
		fwmaster = 0;
	}
	if (fwmaster != 1)
		fwmaster = 0;

	FirewallModel.getFirewall(req.iduser, req.fwcloud, idfirewall, function (error, data) {
		if (error)
			api_resp.getJson(data, api_resp.ACR_ERROR, 'Error', objModel, error, function (jsonResp) {
				res.status(200).json(jsonResp);
			});
		else if (data && data.length > 0) {
			FirewallModel.updateFWMaster(req.iduser, req.fwcloud, data[0].cluster, idfirewall, fwmaster)
			.then(data => {
				if (data && data.result)
					api_resp.getJson(data, api_resp.ACR_UPDATED_OK, 'UPDATED FWMASTER OK', objModel, null, jsonResp => res.status(200).json(jsonResp));
			})
			.catch(error => api_resp.getJson(data, api_resp.ACR_ERROR, 'Error', objModel, error, jsonResp => res.status(200).json(jsonResp)));
		}
	});
});

//UPDATE FIREWALL cluster
//FALTA CAMBIAR de NODO a CLUSTER O FIREWALLS
router.put('/firewall/:idfirewall/cluster/:cluster', utilsModel.checkFirewallAccess, utilsModel.checkConfirmationToken, function (req, res)
{

	var idfirewall = req.params.idfirewall;
	var cluster = req.params.cluster;

	if (cluster === undefined || cluster === '' || isNaN(cluster) || cluster == null) {
		cluster = null;
	}

	var firewallData = {
		id: idfirewall,
		fwcloud: req.fwcloud,
		cluster: cluster,
		iduser: req.iduser
	};


	FirewallModel.getFirewall(req.iduser, req.fwcloud, idfirewall, function (error, data) {
		if (error)
			api_resp.getJson(data, api_resp.ACR_ERROR, 'Error', objModel, error, function (jsonResp) {
				res.status(200).json(jsonResp);
			});
		else if (data && data.length > 0) {
			FirewallModel.updateFirewallCluster(firewallData)
			.then(data => {
				if (data && data.result)
					api_resp.getJson(data, api_resp.ACR_UPDATED_OK, 'UPDATED Firewall CLUSTER OK', objModel, null, jsonResp => res.status(200).json(jsonResp));
			})
			.catch(e => api_resp.getJson(data, api_resp.ACR_ERROR, 'Error', objModel, e, jsonResp => res.status(200).json(jsonResp)));
		}
	});
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
router.get('/accesslock/:id', function (req, res)
{
	var id = req.params.id;
	var iduser = req.iduser;
	var fwcloud = req.fwcloud;


	if (!isNaN(id))
	{
		FirewallModel.getFirewall(iduser, fwcloud, id, function (error, data)
		{
			//get firewall data
			if (data && data.length > 0)
			{
				FwcloudModel.getFwcloudAccess(iduser, fwcloud)
						.then(resp => {
							api_resp.getJson(resp, api_resp.ACR_OK, '', "", null, function (jsonResp) {
								res.status(200).json(jsonResp);
							});
						})
						.catch(err => {
							api_resp.getJson(err, api_resp.ACR_NOTEXIST, 'not found', objModel, null, function (jsonResp) {
								res.status(200).json(jsonResp);
							});
						});
			}
		});
	}
	//id must be numeric
	else
	{
		api_resp.getJson(null, api_resp.ACR_NOTEXIST, 'not found', objModel, null, function (jsonResp) {
			res.status(200).json(jsonResp);
		});
	}
});




/**
 * DELETE firewall
 * 
 * 
 * > ROUTE CALL:  __/firewalls/firewall__      
 * > METHOD:  __DELETE__
 * 
 *
 * @method DeleteFirewall
 * 
 * @param {Integer} id Firewall identifier
 * @optional
 * 
 * @return {JSON} Returns Json result
 * @example 
 * #### JSON RESPONSE OK:
 *    
 *       {"data" : [
 *          { 
 *           "msg : "success",   //result
 *          }
 *         ]
 *       };
 *       
 * #### JSON RESPONSE ERROR:
 *    
 *       {"data" : [
 *          { 
 *           "msg : ERROR,   //Text Error
 *          }
 *         ]
 *       };
 */
router.put("/del/firewall/:idfirewall", utilsModel.checkFirewallAccess, InterfaceModel.checkRestrictionsOtherFirewall, utilsModel.checkConfirmationToken, function (req, res)
{

	var id = req.params.idfirewall;
	var iduser = req.iduser;
	var fwcloud = req.fwcloud;

	//CHECK FIREWALL DATA TO DELETE
	FirewallModel.deleteFirewall(iduser, fwcloud, id)
			.then(data =>
			{
				if (data && data.result)
				{
					api_resp.getJson(data, api_resp.ACR_DELETED_OK, '', objModel, null, function (jsonResp) {
						res.status(200).json(jsonResp);
					});
				} else
				{
					api_resp.getJson(data, api_resp.ACR_RESTRICTED, 'Error', objModel, null, function (jsonResp) {
						res.status(200).json(jsonResp);
					});
				}
			})
			.catch(error => {
				api_resp.getJson(null, api_resp.ACR_ACCESS_ERROR, 'Error', objModel, error, function (jsonResp) {
					res.status(200).json(jsonResp);
				});
			});
});

//DELETE FIREWALL FROM CLUSTER
router.put("/delfromcluster/:idcluster/firewall/:idfirewall",
utilsModel.checkFirewallAccess,
InterfaceModel.checkRestrictionsOtherFirewall,
FirewallModel.checkRestrictionsFirewallApplyTo,
utilsModel.checkConfirmationToken,
(req, res) => {

	var id = req.params.idfirewall;
	var idcluster = req.params.idcluster;
	var iduser = req.iduser;
	var fwcloud = req.fwcloud;

	//CHECK FIREWALL DATA TO DELETE
	FirewallModel.deleteFirewallFromCluster(iduser, fwcloud, id, idcluster)
			.then(data =>
			{
				if (data && data.result)
				{
					api_resp.getJson(data, api_resp.ACR_DELETED_OK, '', objModel, null, function (jsonResp) {
						res.status(200).json(jsonResp);
					});
				} else
				{
					api_resp.getJson(data, api_resp.ACR_RESTRICTED, 'Error', objModel, null, function (jsonResp) {
						res.status(200).json(jsonResp);
					});
				}
			})
			.catch(error => {
				api_resp.getJson(null, api_resp.ACR_ACCESS_ERROR, 'Error', objModel, error, function (jsonResp) {
					res.status(200).json(jsonResp);
				});
			});
});

/**
 * Get firewall export
 * 
 */
router.get('/export/:idfirewall', (req, res) => {	
	FirewallExport.exportFirewall(req.params.idfirewall)
	.then(data => {
		api_resp.getJson(data, api_resp.ACR_OK, '', objModel, null, jsonResp => res.status(200).json(jsonResp));
	})
	.catch(err => api_resp.getJson(null, api_resp.ACR_ERROR, '', objModel, err, jsonResp => res.status(200).json(jsonResp)));
});

module.exports = router;