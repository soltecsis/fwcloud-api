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


/**
 * @api {PUT} /tree/firewalls/get Get firewalls tree
 * @apiName GetFirewallsTree
 *  * @apiGroup TREE
 * 
 * @apiDescription Get the firewalls and clusters tree.
 *
 * @apiParam {Number} fwcloud Fwcloud's id.
 * 
 * @apiParamExample {json} Request-Example:
 * {
 *    "fwcloud": 4
 * }
 *
 * @apiSuccessExample {json} Success-Response:
 * HTTP/1.1 200 OK
 * {
 *    "id": 787,
 *    "text": "FIREWALLS",
 *    "pid": null,
 *    "allowdrag": 0,
 *    "node_type": "FDF",
 *    "obj_type": null,
 *    "id_obj": null,
 *    "fwcloud": 3,
 *    "children": [],
 *    "fw_status": [],
 *    "openvpn_status": [],
 *    "openvpn_info": []
 * }
 * 
 * @apiErrorExample {json} Error-Response:
 * HTTP/1.1 400 Bad Request
 * {
 *    "fwcErr": 7000,
 *    "msg": "FWCloud access not allowed"
 * }
 */

router.put('/firewalls/get', async (req, res) => {
	try {
		const node_data = await fwcTreemodel.getRootNodeByType(req, 'FDF');
		var root_node = new fwc_tree_node(node_data);
		var tree = new Tree(root_node);
		await fwcTreemodel.getTree(req, root_node.id, tree, 1, 1, node_data.order_mode);                    
		await FirewallModel.getFirewallStatusNotZero(req.body.fwcloud,tree);
		await openvpnModel.getOpenvpnStatusNotZero(req,tree);
		await pkiCAModel.storePkiInfo(req,tree);
		res.status(200).json(tree);
	} catch(error) { res.status(400).json(error) }
});


/**
 * @api {PUT} /tree/objects/get Get objects tree
 * @apiName GetObjectsTree
 *  * @apiGroup TREE
 * 
 * @apiDescription Get the IP objects tree.
 *
 * @apiParam {Number} fwcloud Fwcloud's id.
 * @apiParam {Number} objStandard If we want the standard IP objects nodes.
 * @apiParam {Number} objCloud If we want the fwcloud IP objects nodes.
 * 
 * @apiParamExample {json} Request-Example:
 * {
 *    "fwcloud": 4,
 *    "objStandard": 0,
 *    "objCloud": 0
 * }
 *
 * @apiSuccessExample {json} Success-Response:
 * HTTP/1.1 200 OK
 * {
 *    "id": 788,
 *    "text": "OBJECTS",
 *    "pid": null,
 *    "allowdrag": 0,
 *    "node_type": "FDO",
 *    "obj_type": null,
 *    "id_obj": null,
 *    "fwcloud": 3,
 *    "children": [
 *        {
 *            "id": 789,
 *            "text": "Addresses",
 *            "pid": 788,
 *            "allowdrag": 0, 
 *						"node_type": "OIA",
 * ...
 * 
 * @apiErrorExample {json} Error-Response:
 * HTTP/1.1 400 Bad Request
 * {
 *    "fwcErr": 7000,
 *    "msg": "FWCloud access not allowed"
 * }
 */
router.put('/objects/get', async (req, res) => {
	try {
		const node_data = await fwcTreemodel.getRootNodeByType(req, 'FDO');
		var root_node = new fwc_tree_node(node_data);
		var tree = new Tree(root_node);
		await fwcTreemodel.getTree(req, root_node.id, tree, req.body.objStandard, req.body.objCloud, node_data.order_mode);
		await fwcTreemodel.stdFoldersFirst(tree);
		res.status(200).json(tree);
	} catch(error) { res.status(400).json(error) }
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
		res.status(200).json(tree);
	} catch(error) { res.status(400).json(error) }
});


/* Get nodes for the CA tree */
router.put('/ca/get', async (req, res) => {
	try {
		const node_data = await fwcTreemodel.getRootNodeByType(req, 'FCA');
		var root_node = new fwc_tree_node(node_data);
		var tree = new Tree(root_node);
		await fwcTreemodel.getTree(req, root_node.id, tree, 1, 1, node_data.order_mode);
		await pkiCAModel.getCAStatusNotZero(req,tree);
		res.status(200).json(tree);
	} catch(error) { res.status(400).json(error) }
});


// Get objects node information.
router.put('/node/get', async (req, res) => {
	try {
		const data = await fwcTreemodel.getNodeInfo(req.dbCon,req.body.fwcloud,req.body.node_type,req.body.id_obj);
    if (data && data.length > 0)
      res.status(200).json(data);
    else
			res.status(204).end();
	} catch(error) { res.status(400).json(error) }
});


module.exports = router;