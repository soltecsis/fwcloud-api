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


var express = require('express');
var router = express.Router();
import { Tree } from '../../models/tree/Tree';
import { Firewall } from '../../models/firewall/Firewall';
import { Ca } from '../../models/vpn/pki/Ca';
import { OpenVPN } from '../../models/vpn/openvpn/OpenVPN';
import { logger } from '../../fonaments/abstract-application';
var _Tree = require('easy-tree');
var fwc_tree_node = require("../../models/tree/node.js");
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
		const node_data = await Tree.getRootNodeByType(req, 'FDF');
		var root_node = new fwc_tree_node(node_data);
		var tree = new _Tree(root_node);
		await Tree.getTree(req, root_node.id, tree, 1, 1, node_data.order_mode);                    
		await Firewall.getFirewallStatusNotZero(req.body.fwcloud,tree);
		await OpenVPN.getOpenvpnStatusNotZero(req,tree);
		await Ca.storePkiInfo(req,tree);
		res.status(200).json(tree);
	} catch(error) {
		logger().error('Error getting firewall tree: ' + JSON.stringify(error));
		res.status(400).json(error);
	}
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
		const node_data = await Tree.getRootNodeByType(req, 'FDO');
		var root_node = new fwc_tree_node(node_data);
		var tree = new _Tree(root_node);
		await Tree.getTree(req, root_node.id, tree, req.body.objStandard, req.body.objCloud, node_data.order_mode);
		await Tree.stdFoldersFirst(tree);
		res.status(200).json(tree);
	} catch(error) {
		logger().error('Error getting object tree: ' + JSON.stringify(error));
		res.status(400).json(error);
	}
});


/* Get all fwc_tree NODE SERVICES by User*/
//objs -> Standar services (without fwcloud)
//objc -> fwcloud services
router.put('/services/get', async (req, res) => {
	try {
		const node_data = await Tree.getRootNodeByType(req, 'FDS');
		var root_node = new fwc_tree_node(node_data);
		var tree = new _Tree(root_node);
		await Tree.getTree(req, root_node.id, tree, req.body.objStandard, req.body.objCloud, node_data.order_mode);
		await Tree.stdFoldersFirst(tree);
		res.status(200).json(tree);
	} catch(error) {
		logger().error('Error getting service tree: ' + JSON.stringify(error));
		res.status(400).json(error);
	}
});


/* Get nodes for the CA tree */
router.put('/ca/get', async (req, res) => {
	try {
		const node_data = await Tree.getRootNodeByType(req, 'FCA');
		var root_node = new fwc_tree_node(node_data);
		var tree = new _Tree(root_node);
		await Tree.getTree(req, root_node.id, tree, 1, 1, node_data.order_mode);
		await Ca.getCAStatusNotZero(req,tree);
		res.status(200).json(tree);
	} catch(error) {
		logger().error('Error getting CA tree: ' + JSON.stringify(error));
		res.status(400).json(error);
	}
});


// Get objects node information.
router.put('/node/get', async (req, res) => {
	try {
		const data = await Tree.getNodeInfo(req.dbCon,req.body.fwcloud,req.body.node_type,req.body.id_obj);
    if (data && data.length > 0)
      res.status(200).json(data);
    else
			res.status(204).end();
	} catch(error) {
		logger().error('Error getting node tree: ' + JSON.stringify(error));
		res.status(400).json(error);
	}
});

// Get objects node information.
router.get('/node/getByNodeType', async (req, res) => {
	try {
		const data = await Tree.getNodeInfo(req.dbCon,req.body.fwcloud,req.body.node_type);
		if (data && data.length > 0) {
			res.status(200).json(data);
		} else {
			res.status(204).end();
		}
	} catch(error) {
		logger().error('Error getting node tree: ' + JSON.stringify(error));
		res.status(400).json(error);
	}
});


module.exports = router;