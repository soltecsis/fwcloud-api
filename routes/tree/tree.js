var express = require('express');
var router = express.Router();
var fwcTreemodel = require('../../models/tree/tree');
//var Node = require("tree-node");
var Tree = require('easy-tree');
var fwc_tree_node = require("../../models/tree/node.js");
var api_resp = require('../../utils/api_response');
var FirewallModel = require('../../models/firewall/firewall');
var objModel = 'FWC TREE';


/* Get all fwc_tree NODE FIREWALL*/
router.put('/firewalls/get', async (req, res) => {
	try {
		const node_data = await fwcTreemodel.getRootNodeByType(req, 'FDF');
		var root_node = new fwc_tree_node(node_data);
		var tree = new Tree(root_node);
		tree = await fwcTreemodel.getTree(req, root_node.id, tree, 1, 1, node_data.order_mode);                    
		tree = await FirewallModel.getFirewallStatusNotZero(req.body.fwcloud,tree);
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
		tree = await fwcTreemodel.getTree(req, root_node.id, tree, req.body.objStandard, req.body.objCloud, node_data.order_mode);
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
		tree = await fwcTreemodel.getTree(req, root_node.id, tree, req.body.objStandard, req.body.objCloud, node_data.order_mode);
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
		tree = await fwcTreemodel.getTree(req, root_node.id, tree, 1, 1, node_data.order_mode);
		api_resp.getJson(tree, api_resp.ACR_OK, '', objModel, null, jsonResp => res.status(200).json(jsonResp));
	} catch(error) { api_resp.getJson(null, api_resp.ACR_ERROR, '', objModel, error, jsonResp => res.status(200).json(jsonResp)) }	
});


// Get objects node information.
router.put('/node/get', async (req, res) => {
	try {
		const data = await fwcTreemodel.getNodeInfo(req);
		if (data.length>0)
			api_resp.getJson(data, api_resp.ACR_OK, '', objModel, null, jsonResp => res.status(200).json(jsonResp));
		else
			api_resp.getJson(data, api_resp.ACR_NOTEXIST, ' not found', objModel, null, jsonResp => res.status(200).json(jsonResp));
	}	catch(error) { api_resp.getJson(null, api_resp.ACR_ERROR, 'Error', objModel, error, jsonResp => res.status(200).json(jsonResp)) }
});


module.exports = router;