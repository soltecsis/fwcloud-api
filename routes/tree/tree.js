var express = require('express');
var router = express.Router();
var fwcTreemodel = require('../../models/tree/tree');
//var Node = require("tree-node");
var Tree = require('easy-tree');
var fwc_tree_node = require("../../models/tree/node.js");
var utilsModel = require("../../utils/utils.js");
var api_resp = require('../../utils/api_response');
var FirewallModel = require('../../models/firewall/firewall');
var objModel = 'FWC TREE';


/* Get all fwc_tree NODE FIREWALL*/
router.put('/firewalls/get', (req, res) => {
	var iduser = req.session.user_id;
	var fwcloud = req.body.fwcloud;

	fwcTreemodel.getFwc_TreeUserFolder(iduser, fwcloud, 'FDF', (error, rows) => {
		if (rows.length!=0) {
			var row = rows[0];
			//create object
			var root_node = new fwc_tree_node(row);
			//console.log(root_node);
			var tree = new Tree(root_node);
			fwcTreemodel.getFwc_TreeUserFull(iduser, fwcloud, root_node.id, tree, 1, 1, row.order_mode ,'',(error, data) =>	{                    
				if (!error) {
					// Obtain the firewalls with status!=0 and add them to the data structure.
					FirewallModel.getFirewallStatusNotZero(fwcloud,data)
					.then(data => api_resp.getJson(data, api_resp.ACR_OK, '', objModel, null, jsonResp => res.status(200).json(jsonResp)))
					.catch(error => api_resp.getJson(null, api_resp.ACR_ERROR, '', objModel, error, jsonResp => res.status(200).json(jsonResp)));
					} else //Get Error)
					api_resp.getJson(data, api_resp.ACR_NOTEXIST, ' not found', objModel, null, jsonResp => res.status(200).json(jsonResp));
			});
		} else
			api_resp.getJson(null, api_resp.ACR_NOTEXIST, ' not found', objModel, null, jsonResp => res.status(200).json(jsonResp));
	});
});

/* Get all fwc_tree NODE OBJECTS by User*/
//objs -> Standar objects (without fwcloud)
//objc -> fwcloud objects
router.put('/objects/get', (req, res) => {
	var iduser = req.session.user_id;
	var fwcloud = req.body.fwcloud;
	var objs = req.body.objStandard;
	var objc = req.body.objCloud;

	fwcTreemodel.getFwc_TreeUserFolder(iduser, fwcloud, "FDO", function (error, rows)
	{
		if (typeof rows !== 'undefined')
		{
			var row = rows[0];

			//create object
			var root_node = new fwc_tree_node(row);
			var tree = new Tree(root_node);

			//(iduser, fwcloud, idparent, tree, objStandard, objCloud,node_type, AllDone)
			fwcTreemodel.getFwc_TreeUserFull(iduser, fwcloud, root_node.id, tree, objs, objc, row.order_mode, '', function (error, data)
			{
				//If exists fwc_tree get data
				if (!error)
					api_resp.getJson(data, api_resp.ACR_OK, '', objModel, null, jsonResp => res.status(200).json(jsonResp));
				//Get Error
				else
					api_resp.getJson(data, api_resp.ACR_NOTEXIST, ' not found', objModel, null, jsonResp => res.status(200).json(jsonResp));
			});
		}
		//Get Error
		else
			api_resp.getJson(null, api_resp.ACR_NOTEXIST, ' not found', objModel, null, jsonResp => res.status(200).json(jsonResp));
	});
});

/* Get all fwc_tree NODE SERVICES by User*/
//objs -> Standar services (without fwcloud)
//objc -> fwcloud services
router.put('/services/get', (req, res) => {
	var iduser = req.session.user_id;
	var fwcloud = req.body.fwcloud;
	var objs = req.body.objStandard;
	var objc = req.body.objCloud;

	fwcTreemodel.getFwc_TreeUserFolder(iduser, fwcloud, "FDS", function (error, rows)
	{
		if (typeof rows !== 'undefined')
		{
			var row = rows[0];
			//create object
			var root_node = new fwc_tree_node(row);
			var tree = new Tree(root_node);
			fwcTreemodel.getFwc_TreeUserFull(iduser, fwcloud, root_node.id, tree, objs, objc, row.order_mode, '', function (error, data)
			{
				//If exists fwc_tree get data
				if (!error)
					api_resp.getJson(data, api_resp.ACR_OK, '', objModel, null, jsonResp => res.status(200).json(jsonResp));
				//Get Error
				else
					api_resp.getJson(data, api_resp.ACR_NOTEXIST, ' not found', objModel, null, jsonResp => res.status(200).json(jsonResp));
			});
		}
		//Get Error
		else
			api_resp.getJson(null, api_resp.ACR_NOTEXIST, ' not found', objModel, null, jsonResp => res.status(200).json(jsonResp));
	});
});

/* Get nodes for the CA tree */
router.put('/ca/get', (req, res) => {
	var iduser = req.session.user_id;
	var fwcloud = req.body.fwcloud;

	fwcTreemodel.getFwc_TreeUserFolder(iduser, fwcloud, "FCA", function (error, rows)
	{
		if (typeof rows !== 'undefined')
		{
			var row = rows[0];

			//create object
			var root_node = new fwc_tree_node(row);
			var tree = new Tree(root_node);

			//(iduser, fwcloud, idparent, tree, objStandard, objCloud,node_type, AllDone)
			fwcTreemodel.getFwc_TreeUserFull(iduser, fwcloud, root_node.id, tree, 1, 1, row.order_mode, '', function (error, data)
			{
				//If exists fwc_tree get data
				if (!error)
					api_resp.getJson(data, api_resp.ACR_OK, '', objModel, null, jsonResp => res.status(200).json(jsonResp));
				//Get Error
				else
					api_resp.getJson(data, api_resp.ACR_NOTEXIST, ' not found', objModel, null, jsonResp => res.status(200).json(jsonResp));
			});
		}
		//Get Error
		else
			api_resp.getJson(null, api_resp.ACR_NOTEXIST, ' not found', objModel, null, jsonResp => res.status(200).json(jsonResp));
	});
});

module.exports = router;