var express = require('express');
var router = express.Router();
var fwcTreemodel = require('../../models/tree/tree');
//var Node = require("tree-node");
var Tree = require('easy-tree');
var fwc_tree_node = require("../../models/tree/node.js");
var FirewallModel = require('../../models/firewall/firewall');
const pkiCAModel = require('../../models/vpn/pki/ca');
const openvpnModel = require('../../models/vpn/openvpn/openvpn');
const fwcError = require('../../utils/error_table');


/* Get all fwc_tree NODE FIREWALL*/
router.put('/firewalls/get', async (req, res) => {
	try {
		const node_data = await fwcTreemodel.getRootNodeByType(req, 'FDF');
		var root_node = new fwc_tree_node(node_data);
		var tree = new Tree(root_node);
		await fwcTreemodel.getTree(req, root_node.id, tree, 1, 1, node_data.order_mode);                    
		await FirewallModel.getFirewallStatusNotZero(req.body.fwcloud,tree);
		await openvpnModel.getOpenvpnStatusNotZero(req,tree);
		await pkiCAModel.storePkiInfo(req,tree);
		api_resp.getJson(tree, api_resp.ACR_OK, '', objModel, null, jsonResp => res.status(200).json(jsonResp));
	} catch(error) { api_resp.getJson(null, api_resp.ACR_ERROR, '', objModel, error, jsonResp => res.status(200).json(jsonResp)) }
});


/* Get all fwc_tree NODE OBJECTS by User*/
//objs -> Standar objects (without fwcloud)
//objc -> fwcloud objects
router.put('/objects/get', async (req, res) => {
	try {
		const node_data = await fwcTreemodel.getRootNodeByType(req, 'FDO');
		var root_node = new fwc_tree_node(node_data);
		var tree = new Tree(root_node);
		await fwcTreemodel.getTree(req, root_node.id, tree, req.body.objStandard, req.body.objCloud, node_data.order_mode);
		await fwcTreemodel.stdFoldersFirst(tree);
		api_resp.getJson(tree, api_resp.ACR_OK, '', objModel, null, jsonResp => res.status(200).json(jsonResp));
	} catch(error) { api_resp.getJson(null, api_resp.ACR_ERROR, '', objModel, error, jsonResp => res.status(200).json(jsonResp)) }
});


/* Get all fwc_tree NODE SERVICES by User*/
//objs -> Standar services (without fwcloud)
//objc -> fwcloud services
router.put('/services/get', async (req, res) => {
	try {
		const node_data = await fwcTreemodel.getRootNodeByType(req, 'FDS');
		var root_node = new fwc_tree_node(node_data);
		var tree = new Tree(root_node);
		await fwcTreemodel.getTree(req, root_node.id, tree, req.body.objStandard, req.body.objCloud, node_data.order_mode);
		await fwcTreemodel.stdFoldersFirst(tree);
		api_resp.getJson(tree, api_resp.ACR_OK, '', objModel, null, jsonResp => res.status(200).json(jsonResp));
	} catch(error) { api_resp.getJson(null, api_resp.ACR_ERROR, '', objModel, error, jsonResp => res.status(200).json(jsonResp)) }	
});


/* Get nodes for the CA tree */
router.put('/ca/get', async (req, res) => {
	try {
		const node_data = await fwcTreemodel.getRootNodeByType(req, 'FCA');
		var root_node = new fwc_tree_node(node_data);
		var tree = new Tree(root_node);
		await fwcTreemodel.getTree(req, root_node.id, tree, 1, 1, node_data.order_mode);
		await pkiCAModel.getCAStatusNotZero(req,tree);
		api_resp.getJson(tree, api_resp.ACR_OK, '', objModel, null, jsonResp => res.status(200).json(jsonResp));
	} catch(error) { api_resp.getJson(null, api_resp.ACR_ERROR, '', objModel, error, jsonResp => res.status(200).json(jsonResp)) }	
});


// Get objects node information.
router.put('/node/get', async (req, res) => {
	try {
		const data = await fwcTreemodel.getNodeInfo(req.dbCon,req.body.fwcloud,req.body.node_type,req.body.id_obj);
		if (data.length>0)
			api_resp.getJson(data, api_resp.ACR_OK, '', objModel, null, jsonResp => res.status(200).json(jsonResp));
		else
			api_resp.getJson(data, api_resp.ACR_NOTEXIST, ' not found', objModel, null, jsonResp => res.status(200).json(jsonResp));
	}	catch(error) { api_resp.getJson(null, api_resp.ACR_ERROR, 'Error', objModel, error, jsonResp => res.status(200).json(jsonResp)) }
});


module.exports = router;