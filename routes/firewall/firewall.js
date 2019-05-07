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

var utilsModel = require("../../utils/utils.js");
var fwcTreemodel = require('../../models/tree/tree');
var InterfaceModel = require('../../models/interface/interface');
var Policy_rModel = require('../../models/policy/policy_r');
var Policy_cModel = require('../../models/policy/policy_c');
const restrictedCheck = require('../../middleware/restricted');
const fwcError = require('../../utils/error_table');


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
router.put('/all/get', (req, res) => {
	FirewallModel.getFirewalls(req.session.user_id, function(error, data) {
		if (data && data.length > 0)
			res.status(200).json(data);
		else
			res.status(400).json(fwcError.NOT_FOUND);
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
router.put('/cloud/get', (req, res) => {
	FirewallModel.getFirewallCloud(req.session.user_id, req.body.fwcloud, (error, data) => {
		if (data && data.length > 0)
			res.status(200).json(data);
		else
			res.status(400).json(fwcError.NOT_FOUND);
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
router.put('/get', async (req, res) => {
	try {
		const data = await FirewallModel.getFirewall(req);
		if (data && data.length > 0)
			res.status(200).json(data);
		else
			res.status(400).json(fwcError.NOT_FOUND);
	} catch(error) { res.status(400).json(error) }
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
router.put('/cluster/get', (req, res) => {
	FirewallModel.getFirewallCluster(req.session.user_id, req.body.cluster, function(error, data) {
		if (data && data.length > 0)
			res.status(200).json(data);
		else
			res.status(400).json(fwcError.NOT_FOUND);
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
router.post('/', async(req, res) => {
	var firewallData = {
		id: null,
		cluster: req.body.cluster,
		name: req.body.name,
		status: 3,
		comment: req.body.comment,
		fwcloud: req.body.fwcloud,
		install_user: req.body.install_user,
		install_pass: req.body.install_pass,
		save_user_pass: req.body.save_user_pass,
		install_interface: req.body.install_interface,
		install_ipobj: req.body.install_ipobj,
		fwmaster: req.body.fwmaster,
		install_port: req.body.install_port,
		by_user: req.session.user_id,
		options: req.body.options
	};

	try {
		// Check that the tree node in which we will create a new node for the firewall is a valid node for it.
		if (!req.body.cluster && req.tree_node.node_type!=='FDF' && req.tree_node.node_type!=='FD') 
			throw fwcError.BAD_TREE_NODE_TYPE;

		firewallData = await FirewallModel.checkBodyFirewall(firewallData, true);

		//encript username and password
		firewallData.install_user = (firewallData.install_user) ? await utilsModel.encrypt(firewallData.install_user) : '';
		firewallData.install_pass = (firewallData.install_pass) ? await utilsModel.encrypt(firewallData.install_pass) : '';

		let data = await FirewallModel.insertFirewall(req.session.user_id, firewallData);
		var dataresp = { "insertId": data.insertId };
		var newFirewallId = data.insertId;

		await FirewallModel.updateFWMaster(req.session.user_id, req.body.fwcloud, firewallData.cluster, newFirewallId, firewallData.fwmaster);

		if ((firewallData.cluster > 0 && firewallData.fwmaster === 1) || firewallData.cluster === null) {
			// Create the loop backup interface.
			const loInterfaceId = await InterfaceModel.createLoInterface(req.body.fwcloud, newFirewallId);
			await Policy_rModel.insertDefaultPolicy(newFirewallId, loInterfaceId, req.body.options);
		}

		if (!firewallData.cluster) // Create firewall tree.
			await fwcTreemodel.insertFwc_Tree_New_firewall(req.body.fwcloud, req.body.node_id, newFirewallId);
		else // Create the new firewall node in the NODES node of the cluster.
			await fwcTreemodel.insertFwc_Tree_New_cluster_firewall(req.body.fwcloud, firewallData.cluster, newFirewallId, firewallData.name);

		// Create the directory used for store firewall data.
		await utilsModel.createFirewallDataDir(req.body.fwcloud, newFirewallId);

		res.status(200).json(dataresp);
	} catch (error) { res.status(400).json(error) }
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
router.put('/', async (req, res) => {
	//Save firewall data into objet    
	var firewallData = {
		id: req.body.firewall,
		cluster: req.body.cluster,
		name: req.body.name,
		comment: req.body.comment,
		fwcloud: req.body.fwcloud, //working cloud      
		install_user: req.body.install_user,
		install_pass: req.body.install_pass,
		save_user_pass: req.body.save_user_pass,
		install_interface: req.body.install_interface,
		install_ipobj: req.body.install_ipobj,
		fwmaster: req.body.fwmaster,
		install_port: req.body.install_port,
		by_user: req.session.user_id, //working user
		options: req.body.options
	};

	try {
		await Policy_cModel.deleteFullFirewallPolicy_c(req.body.firewall);
		await FirewallModel.updateFirewallStatus(req.body.fwcloud, req.body.firewall, "|3");
		await FirewallModel.checkBodyFirewall(firewallData, false);

		//encript username and password
		let data = await utilsModel.encrypt(firewallData.install_user)
		firewallData.install_user = data;
		data = await utilsModel.encrypt(firewallData.install_pass);
		firewallData.install_pass = data;
		if (!firewallData.save_user_pass) {
			firewallData.install_user = '';
			firewallData.install_pass = '';
		}

		data = await FirewallModel.updateFirewall(req.dbCon, req.session.user_id, firewallData);
		await FirewallModel.updateFWMaster(req.session.user_id, req.body.fwcloud, firewallData.cluster, req.body.firewall, firewallData.fwmaster);

		// If this a stateful firewall verify that the stateful special rules exists.
		// Or remove them if this is not a stateful firewall.
		await Policy_rModel.checkStatefulRules(req.dbCon, req.body.firewall, req.body.options);

		//////////////////////////////////
		//UPDATE FIREWALL NODE STRUCTURE                                    
		await	fwcTreemodel.updateFwc_Tree_Firewall(req.dbCon, req.body.fwcloud, firewallData);

		res.status(200).json(data);
	} catch(error) { res.status(400).json(error) }
});


router.put('/clone', async (req, res) => {
	try {
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

		const data = await FirewallModel.cloneFirewall(req.session.user_id, firewallData);
		const idNewFirewall = data.insertId;

		const dataI = await InterfaceModel.cloneFirewallInterfaces(req.session.user_id, req.body.fwcloud, req.body.firewall, idNewFirewall);
		await Policy_rModel.cloneFirewallPolicy(req.dbCon, req.body.firewall, idNewFirewall, dataI);
		await utilsModel.createFirewallDataDir(req.body.fwcloud, idNewFirewall);
		await fwcTreemodel.insertFwc_Tree_New_firewall(req.body.fwcloud, req.body.node_id, idNewFirewall);

		res.status(200).json(data);
	} catch(error) { res.status(400).json(error) }
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
		const data = await FirewallModel.getFirewall(req);
		if (data && data.length > 0) {
			await FwcloudModel.getFwcloudAccess(req.session.user_id, req.body.fwcloud);
			res.status(200).json(resp);
		}
	} catch(error) { res.status(400).json(error) }
});


// API call for check deleting restrictions.
router.put("/restricted",
	restrictedCheck.firewall,
	restrictedCheck.firewallApplyTo,
	(req, res) => res.status(204).end()
);


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
router.put('/del',
	restrictedCheck.firewall,
	async(req, res) => {
		try {
			await FirewallModel.deleteFirewall(req.session.user_id, req.body.fwcloud, req.body.firewall);
			res.status(204).end();
		} catch (error) { res.status(400).json(error) }
	});

//DELETE FIREWALL FROM CLUSTER
router.put('/delfromcluster',
restrictedCheck.firewall,
restrictedCheck.firewallApplyTo,
(req, res) => {
	//CHECK FIREWALL DATA TO DELETE
	FirewallModel.deleteFirewallFromCluster(req.session.user_id, req.body.fwcloud, req.body.firewall, req.body.cluster)
	.then(data => {
		if (data && data.result)
			res.status(200).json(data);
	 	else
			res.status(400).json(data);
	})
	.catch(error => res.status(400).json(error));
});

/**
 * Get firewall export
 * 
 */
router.put('/export/get', (req, res) => {
	FirewallExport.exportFirewall(req.body.firewall)
		.then(data => {
			res.status(200).json(data);
		})
		.catch(error => res.status(400).json(error));
});

module.exports = router;