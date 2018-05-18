
var express = require('express');
var router = express.Router();
var Ipobj__ipobjgModel = require('../../models/ipobj/ipobj__ipobjg');
var fwcTreemodel = require('../../models/tree/fwc_tree');
var IpobjModel = require('../../models/ipobj/ipobj');
var api_resp = require('../../utils/api_response');
var objModel = 'IPOBJ GROUP';


var logger = require('log4js').getLogger("app");
var utilsModel = require("../../utils/utils.js");

var FirewallModel = require('../../models/firewall/firewall');



/* Get all ipobj__ipobjgs by group*/
router.get('/:ipobjg',  function (req, res)
{
	var ipobjg = req.params.ipobjg;
	Ipobj__ipobjgModel.getIpobj__ipobjgs(ipobjg, function (error, data)
	{
		//If exists ipobj__ipobjg get data
		if (data && data.length > 0)
		{
			api_resp.getJson(data, api_resp.ACR_OK, '', objModel, null, function (jsonResp) {
				res.status(200).json(jsonResp);
			});
		}
		//Get Error
		else
		{
			api_resp.getJson(data, api_resp.ACR_NOTEXIST, ' not found', objModel, null, function (jsonResp) {
				res.status(200).json(jsonResp);
			});
		}
	});
});



/* Get  ipobj__ipobjg by id */
router.get('/:ipobjg/:ipobj',  function (req, res)
{
	var ipobjg = req.params.ipobjg;
	var ipobj = req.params.ipobj;
	Ipobj__ipobjgModel.getIpobj__ipobjg(ipobjg, ipobj, function (error, data)
	{
		//If exists ipobj__ipobjg get data
		if (data && data.length > 0)
		{
			api_resp.getJson(data, api_resp.ACR_OK, '', objModel, null, function (jsonResp) {
				res.status(200).json(jsonResp);
			});
		}
		//Get Error
		else
		{
			api_resp.getJson(data, api_resp.ACR_NOTEXIST, ' not found', objModel, null, function (jsonResp) {
				res.status(200).json(jsonResp);
			});
		}
	});
});


/* Create New ipobj__ipobjg */
router.post("/ipobj__ipobjg/:node_parent/:node_order/:node_type", utilsModel.checkConfirmationToken, (req, res) => {
	var iduser = req.iduser;
	var fwcloud = req.fwcloud;
	var node_parent = req.params.node_parent;
	var node_order = req.params.node_order;
	var node_type = req.params.node_type;

	//Create New object with data ipobj__ipobjg
	var ipobj__ipobjgData = {
		ipobj_g: req.body.ipobj_g,
		ipobj: req.body.ipobj
	};

	Ipobj__ipobjgModel.insertIpobj__ipobjg(ipobj__ipobjgData, function (error, data)
	{
		if (error)
			api_resp.getJson(data, api_resp.ACR_ERROR, '', objModel, error, function (jsonResp) {
				res.status(200).json(jsonResp);
			});
		else {
			//If saved ipobj__ipobjg Get data
			if (data && data.insertId > 0)
			{
				logger.debug("NEW IPOBJ IN GROUP: " + ipobj__ipobjgData.ipobj_g + "  IPOBJ:" + ipobj__ipobjgData.ipobj);
				//Search IPOBJ Data
				IpobjModel.getIpobjGroup(fwcloud, ipobj__ipobjgData.ipobj_g, ipobj__ipobjgData.ipobj, function (error, dataIpobj)
				{
					//If exists ipobj get data
					if (typeof dataIpobj !== 'undefined')
					{

						var NodeData = {
							id: ipobj__ipobjgData.ipobj,
							name: dataIpobj.name,
							type: dataIpobj.type,
							comment: dataIpobj.comment
						};

						//INSERT IN TREE
						fwcTreemodel.insertFwc_TreeOBJ(iduser, fwcloud, node_parent, node_order, node_type, NodeData, (error, data2) => {
							if (data2 && data2.insertId) {
								// Update affected firewalls status.
								FirewallModel.updateFirewallStatusIPOBJ(fwcloud,-1,req.body.ipobj_g,"& ~3")
								.then(()=>{return FirewallModel.getFirewallStatusNotZero(fwcloud,2,null)})
								.then(not_zero_status_fws => api_resp.getJson(not_zero_status_fws, api_resp.ACR_INSERTED_OK, 'INSERTED OK', objModel, null, jsonResp=> res.status(200).json(jsonResp)))
								.catch(error => api_resp.getJson(null, api_resp.ACR_ERROR, '', objModel, error, jsonResp => res.status(200).json(jsonResp)));
							} else {
								logger.debug(error);
								api_resp.getJson(data, api_resp.ACR_ERROR, 'Error inserting', objModel, error, jsonResp => res.status(200).json(jsonResp));
							}
						});
					}
					//Get Error
					else
						api_resp.getJson(data, api_resp.ACR_NOTEXIST, ' not found', objModel, null, jsonResp => res.status(200).json(jsonResp));
				});

			} else
				api_resp.getJson(data, api_resp.ACR_ERROR, 'Error inserting', objModel, error, jsonResp => res.status(200).json(jsonResp));
		}
	});
});

/* Update ipobj__ipobjg that exist */
router.put('/ipobj__ipobjg/:ipobjg/:ipobj', utilsModel.checkConfirmationToken, function (req, res)
{
	var ipobjg = req.params.ipobjg;
	var ipobj = req.params.ipobj;
	//Save data into object
	var ipobj__ipobjgData = {ipobj_g: req.param('new_ipobj_g'), ipobj: req.param('new_ipobj')};
	Ipobj__ipobjgModel.updateIpobj__ipobjg(ipobjg, ipobj, ipobj__ipobjgData, function (error, data)
	{
		if (error)
			api_resp.getJson(data, api_resp.ACR_ERROR, '', objModel, error, function (jsonResp) {
				res.status(200).json(jsonResp);
			});
		else {
			//If saved ipobj__ipobjg saved ok, get data
			if (data && data.result)
			{
				api_resp.getJson(null, api_resp.ACR_UPDATED_OK, 'UPDATED OK', objModel, null, function (jsonResp) {
					res.status(200).json(jsonResp);
				});
			} else
			{
				api_resp.getJson(data, api_resp.ACR_ERROR, 'Error updating', objModel, error, function (jsonResp) {
					res.status(200).json(jsonResp);
				});
			}
		}
	});
});



/* Remove ipobj__ipobjg */
router.put("/del/ipobj__ipobjg/:node_parent/:ipobjg/:ipobj", 
utilsModel.checkConfirmationToken, 
(req, res) => {
	var iduser = req.iduser;
	var fwcloud = req.fwcloud;
	var node_parent = req.params.node_parent;

	//Id from ipobj__ipobjg to remove
	var ipobjg = req.params.ipobjg;
	var ipobj = req.params.ipobj;

	Ipobj__ipobjgModel.deleteIpobj__ipobjg(fwcloud, ipobjg, ipobj, (error, data) => {
		if (error)
			api_resp.getJson(data, api_resp.ACR_ERROR, '', objModel, error, jsonResp => res.status(200).json(jsonResp));
		else {
			if (data && data.msg === "deleted" || data.msg === "notExist" || data.msg === "Restricted")
			{
				if (data.msg === "deleted") {
					//DELETE FROM TREE
					fwcTreemodel.deleteFwc_TreeGroupChild(iduser, fwcloud, node_parent, ipobjg, ipobj, function (error, data) {
						if (data && data.result) {
							logger.debug("IPOBJ GROUP NODE TREE DELETED. GO TO ORDER");
							fwcTreemodel.orderTreeNode(fwcloud, node_parent, (error, data) => {
								// Update affected firewalls status.
								FirewallModel.updateFirewallStatusIPOBJ(fwcloud,-1,req.params.ipobjg,"& ~3")
								.then(()=>{return FirewallModel.getFirewallStatusNotZero(fwcloud,2,null)})
								.then(not_zero_status_fws => 
									api_resp.getJson(not_zero_status_fws, api_resp.ACR_INSERTED_OK, 'DELETED OK '+data.alert, objModel, null, jsonResp=> res.status(200).json(jsonResp)))
								.catch(error => api_resp.getJson(null, api_resp.ACR_ERROR, '', objModel, error, jsonResp => res.status(200).json(jsonResp)));
							});
						} else
							api_resp.getJson(data, api_resp.ACR_ERROR, 'Error deleting', objModel, error, jsonResp => res.status(200).json(jsonResp));
					});
				} else if (data.msg === "Restricted") 
					api_resp.getJson(data, api_resp.ACR_RESTRICTED, 'restricted to delete', objModel, null, jsonResp => res.status(200).json(jsonResp));
				else 
					api_resp.getJson(data, api_resp.ACR_NOTEXIST, 'not found', objModel, null, jsonResp => res.status(200).json(jsonResp));
			} else
				api_resp.getJson(data, api_resp.ACR_ERROR, 'Error deleting', objModel, error, jsonResp => res.status(200).json(jsonResp));
		}
	});
});

module.exports = router;