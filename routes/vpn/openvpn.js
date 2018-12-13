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
var objModel = 'OpenVPN';

/**
 * Property Model to manage OpenVPN Data
 *
 * @property ClusterModel
 * @type ../../models/vpn/openvpn
 */
const openvpnModel = require('../../models/vpn/openvpn');

const fwc_treeModel = require('../../models/tree/tree');
const restrictedCheck = require('../../middleware/restricted');


/**
 * Create a new OpenVPN configuration in firewall.
 */
router.post('/', async(req, res) => {
	try {
		// Verify that the node tree type is correct.
		if (req.tree_node.node_type !== 'OPN' && req.tree_node.node_type !== 'VSR')
			throw (new Error('Bad node tree type'));

		// Verify that the OpenVPN configuration is the same indicated in the tree node.
		if (req.body.openvpn && req.body.openvpn!=req.tree_node.id_obj)
			throw (new Error('Information in node tree and in API request don\'t match'));

		// Verify that we are using the correct type of certificate.
		// 1=Client certificate, 2=Server certificate.
		if (!req.body.openvpn && req.crt.type!=2)
			throw (new Error('You can not use client certificates for OpenVPN server configuration'));
		if (req.body.openvpn && req.crt.type!=1)
			throw (new Error('You can not use server certificates for OpenVPN client configuration'));

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
			nodeId = await fwc_treeModel.newNode(req.dbCon, req.body.fwcloud, req.crt.cn, req.body.node_id, 'VSR', cfg, 312);
		else if (req.tree_node.node_type === 'VSR') // This will be an OpenVPN client configuration.
			nodeId = await fwc_treeModel.newNode(req.dbCon, req.body.fwcloud, req.crt.cn, req.body.node_id, 'VCL', cfg, 311);

		api_resp.getJson({insertId: cfg, TreeinsertId: nodeId}, api_resp.ACR_OK, 'OpenVPN configuration created', objModel, null, jsonResp => res.status(200).json(jsonResp));
	} catch (error) { return api_resp.getJson(null, api_resp.ACR_ERROR, 'Error creating OpenVPN configuration', objModel, error, jsonResp => res.status(200).json(jsonResp)) }
});


/**
 * Update configuration options.
 */
router.put('/', async(req, res) => {
	try {
		// First remove all the current configuration options.
		await openvpnModel.removeCfgOptAll(req);

		// Now create all the new options for the OpenVPN configuration.
		const cfg = await openvpnModel.getCfgId(req);
		var order = 1;
		for (let opt of req.body.options) {
			opt.cfg = cfg;
			opt.order = order++;
			await openvpnModel.addCfgOpt(req, opt);
		}

		api_resp.getJson(null, api_resp.ACR_OK, 'OpenVPN configuration updated', objModel, null, jsonResp => res.status(200).json(jsonResp));
	} catch (error) { return api_resp.getJson(null, api_resp.ACR_ERROR, 'Error updating OpenVPN configuration', objModel, error, jsonResp => res.status(200).json(jsonResp)) }
});


/**
 * Get OpenVPN configuration data.
 */
router.put('/get', async(req, res) => {
	try {
		const data = await openvpnModel.getCfg(req);
		api_resp.getJson(data, api_resp.ACR_OK, 'OpenVPN configuration sent', objModel, null, jsonResp => res.status(200).json(jsonResp));
	} catch (error) { return api_resp.getJson(null, api_resp.ACR_ERROR, 'Error getting OpenVPN configuration', objModel, error, jsonResp => res.status(200).json(jsonResp)) }
});


/**
 * Get OpenVPN configuration files.
 */
router.put('/file/get', async(req, res) => {
	try {
		const cfgDump = await openvpnModel.dumpCfg(req);
		api_resp.getJson(cfgDump, api_resp.ACR_OK, 'OpenVPN configuration file sent', objModel, null, jsonResp => res.status(200).json(jsonResp));
	} catch (error) { return api_resp.getJson(null, api_resp.ACR_ERROR, 'Error getting OpenVPN file configuration', objModel, error, jsonResp => res.status(200).json(jsonResp)) }
});


/**
 * Get next VPN LAN free IP.
 */
router.put('/ip/get', async(req, res) => {
	try {
		const freeIP = await openvpnModel.freeVpnIP(req);
		api_resp.getJson(freeIP, api_resp.ACR_OK, 'OpenVPN free IP sent', objModel, null, jsonResp => res.status(200).json(jsonResp));
	} catch (error) { return api_resp.getJson(null, api_resp.ACR_ERROR, 'Error getting free OpenVPN IP', objModel, error, jsonResp => res.status(200).json(jsonResp)) }
});


/**
 * Delete OpenVPN configuration.
 */
router.put('/del', 
restrictedCheck.openvpn,  
async (req, res) => {
	try {
		// Delete the configuration from de database.
		await openvpnModel.removeCfg(req);
		
		// Delete the openvpn node from the tree.
		await fwcTreemodel.deleteObjFromTree(req.body.fwcloud, req.body.openvpn, req.tree_node.obj_type);
		
		api_resp.getJson(null, api_resp.ACR_OK, 'OpenVPN configuration deleted', objModel, null, jsonResp => res.status(200).json(jsonResp));
	} catch (error) { return api_resp.getJson(null, api_resp.ACR_ERROR, 'Error deleting OpenVPN configuration', objModel, error, jsonResp => res.status(200).json(jsonResp)) }
});

// API call for check deleting restrictions.
router.put('/restricted',
restrictedCheck.openvpn,
(req, res) => api_resp.getJson(null, api_resp.ACR_OK, '', objModel, null, jsonResp =>res.status(200).json(jsonResp)));


/**
 * Install OpenVPN configuration in the destination firewall.
 */
router.put('/install', async(req, res) => {
	try {
		const cfgDump = await openvpnModel.dumpCfg(req);

		// Next we have to activate the OpenVPN configuration in the destination firewall/cluster.
		if (req.crt.type === 1) // Client certificate
			openvpnModel.installCfg(req, cfgDump.ccd);
		else // Server certificate
			openvpnModel.installCfg(req, cfgDump.cfg);

		api_resp.getJson(null, api_resp.ACR_OK, 'OpenVPN configuration installed', objModel, null, jsonResp => res.status(200).json(jsonResp));
	} catch (error) { return api_resp.getJson(null, api_resp.ACR_ERROR, 'Error installing OpenVPN configuration', objModel, error, jsonResp => res.status(200).json(jsonResp)) }
});

module.exports = router;