var express = require('express');
var router = express.Router();
var Ipobj_gModel = require('../../models/ipobj/ipobj_g');
var fwcTreemodel = require('../../models/tree/tree');
var Ipobj__ipobjgModel = require('../../models/ipobj/ipobj__ipobjg');
var api_resp = require('../../utils/api_response');
const restrictedCheck = require('../../middleware/restricted');
var objModel = 'GROUP';


var logger = require('log4js').getLogger("app");

/* Get all ipobj_gs*/
router.get('', function (req, res)
{
	var iduser = req.iduser;
	var fwcloud = req.fwcloud;
	Ipobj_gModel.getIpobj_g_Full(fwcloud, '', function (error, data)
	{
		//If exists ipobj_g get data
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



/* Get  ipobj_g by id */
router.get('/:id', function (req, res)
{
	var id = req.params.id;
	var iduser = req.iduser;
	var fwcloud = req.fwcloud;
	Ipobj_gModel.getIpobj_g_Full(fwcloud, id, function (error, data)
	{
		//If exists ipobj_g get data
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


/* Get all ipobj_gs by nombre */
router.get('/name/:name', function (req, res)
{
	var iduser = req.iduser;
	var name = req.params.name;
	var fwcloud = req.fwcloud;
	Ipobj_gModel.getIpobj_gName(fwcloud, name, function (error, data)
	{
		//If exists ipobj_g get data
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

/* Get all ipobj_gs by tipo */
router.get('/type/:type', function (req, res)
{
	var iduser = req.iduser;
	var type = req.params.type;
	var fwcloud = req.fwcloud;
	Ipobj_gModel.getIpobj_gtype(fwcloud, type, function (error, data)
	{
		//If exists ipobj_g get data
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


/* Search GROUPS AND members in Rules */
router.get("/ipobj_g_search_rules/:idg", function (req, res)
{
	var iduser = req.iduser;
	var fwcloud = req.fwcloud;
	var idg = req.params.idg;


	Ipobj_gModel.searchGroupInRules(idg, fwcloud)
			.then(data =>
			{
				if (data && data.length > 0)
				{
					api_resp.getJson(data, api_resp.ACR_OK, '', objModel, null, function (jsonResp) {
						res.status(200).json(jsonResp);
					});
				} else
				{
					api_resp.getJson(data, api_resp.ACR_NOTEXIST, '', objModel, null, function (jsonResp) {
						res.status(200).json(jsonResp);
					});
				}
			})
			.catch(error => {
				api_resp.getJson(null, api_resp.ACR_ERROR, 'Error', objModel, error, function (jsonResp) {
					res.status(200).json(jsonResp);
				});
			});
});

/* Search where is used Group  */
router.get("/ipobj_g_search_used/:idg", function (req, res)
{

	var iduser = req.iduser;
	var fwcloud = req.fwcloud;
	var idg = req.params.idg;


	Ipobj_gModel.searchGroup(idg, fwcloud, function (error, data)
	{
		if (error)
			api_resp.getJson(data, api_resp.ACR_ERROR, 'Error', objModel, error, function (jsonResp) {
				res.status(200).json(jsonResp);
			});
		else
		if (data && data.length > 0)
		{
			api_resp.getJson(data, api_resp.ACR_OK, '', objModel, null, function (jsonResp) {
				res.status(200).json(jsonResp);
			});
		} else
		{
			api_resp.getJson(data, api_resp.ACR_NOTEXIST, '', objModel, error, function (jsonResp) {
				res.status(200).json(jsonResp);
			});
		}
	});
});




/* Create New ipobj_g */
router.post("/ipobj-g/:node_parent/:node_order/:node_type", function (req, res)
{
	var iduser = req.iduser;
	var fwcloud = req.fwcloud;
	var node_parent = req.params.node_parent;
	var node_order = req.params.node_order;
	var node_type = req.params.node_type;

	//Create New objet with data ipobj_g
	var ipobj_gData = {
		id: null,
		name: req.body.name,
		type: req.body.type,
		fwcloud: req.fwcloud,
		comment: req.body.comment
	};

	Ipobj_gModel.insertIpobj_g(ipobj_gData, function (error, data)
	{
		if (error)
			api_resp.getJson(data, api_resp.ACR_ERROR, '', objModel, error, function (jsonResp) {
				res.status(200).json(jsonResp);
			});
		else {
			//If saved ipobj_g Get data
			if (data && data.insertId > 0)
			{
				var id = data.insertId;
				logger.debug("NEW IPOBJ GROUP id:" + id + "  Type:" + ipobj_gData.type + "  Name:" + ipobj_gData.name);
				ipobj_gData.id = id;
				//INSERT IN TREE
				fwcTreemodel.insertFwc_TreeOBJ(iduser, fwcloud, node_parent, node_order, node_type, ipobj_gData, function (error, data) {
					if (data && data.insertId) {
						var dataresp = {"insertId": id, "TreeinsertId": data.insertId};
						api_resp.getJson(dataresp, api_resp.ACR_INSERTED_OK, 'IPOBJ INSERTED OK', objModel, null, function (jsonResp) {
							res.status(200).json(jsonResp);
						});
					} else {
						logger.debug(error);
						api_resp.getJson(data, api_resp.ACR_NOTEXIST, 'Error inserting', objModel, error, function (jsonResp) {
							res.status(200).json(jsonResp);
						});
					}
				});

			} else
			{
				api_resp.getJson(data, api_resp.ACR_NOTEXIST, 'Error inserting', objModel, error, function (jsonResp) {
					res.status(200).json(jsonResp);
				});
			}
		}
	});
});

/* Update ipobj_g that exist */
router.put('/ipobj-g', function (req, res)
{
	var iduser = req.iduser;
	var fwcloud = req.fwcloud;

	//Save data into object
	var ipobj_gData = {id: req.body.id, name: req.body.name, type: req.body.type, comment: req.body.comment, fwcloud: req.fwcloud};
	Ipobj_gModel.updateIpobj_g(ipobj_gData, function (error, data)
	{
		if (error)
			api_resp.getJson(data, api_resp.ACR_ERROR, '', objModel, error, function (jsonResp) {
				res.status(200).json(jsonResp);
			});
		else {
			//If saved ipobj_g saved ok, get data
			if (data && data.result)
			{
				logger.debug("UPDATE IPOBJ GROUP id:" + ipobj_gData.id + "  Type:" + ipobj_gData.type + "  Name:" + ipobj_gData.name);
				//UPDATE TREE            
				fwcTreemodel.updateFwc_Tree_OBJ(iduser, fwcloud, ipobj_gData, function (error, data) {
					if (data && data.result) {
						api_resp.getJson(data, api_resp.ACR_UPDATED_OK, 'UPDATED OK', objModel, null, function (jsonResp) {
							res.status(200).json(jsonResp);
						});
					} else {
						logger.debug(error);
						api_resp.getJson(data, api_resp.ACR_NOTEXIST, 'Error updating', objModel, error, function (jsonResp) {
							res.status(200).json(jsonResp);
						});
					}
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


// API call for check deleting restrictions.
router.put("/restricted",
restrictedCheck.ipobj_g,
(req, res) => api_resp.getJson(null, api_resp.ACR_OK, '', objModel, null, jsonResp =>res.status(200).json(jsonResp)));


/* Remove ipobj_g */
router.put("/del/ipobj-g/:id/:type", 
restrictedCheck.ipobj_g,
(req, res) => {
	var iduser = req.iduser;
	var fwcloud = req.fwcloud;
	var id = req.params.id;
	var type = req.params.type;

	Ipobj_gModel.deleteIpobj_g(fwcloud, id, type, function (error, data)
	{
		if (data && data.msg === "deleted" || data.msg === "notExist" || data.msg === "Restricted")
		{
			if (data.msg === "deleted") {
				fwcTreemodel.orderTreeNodeDeleted(fwcloud, id, function (error, data) {
					//DELETE FROM TREE
					fwcTreemodel.deleteFwc_Tree(iduser, fwcloud, id, type, function (error, data) {
						if (data && data.result) {
							api_resp.getJson(null, api_resp.ACR_DELETED_OK, 'GROUP DELETED OK', objModel, null, function (jsonResp) {
								res.status(200).json(jsonResp);
							});
						} else {
							api_resp.getJson(data, api_resp.ACR_ERROR, 'Error deleting', objModel, error, function (jsonResp) {
								res.status(200).json(jsonResp);
							});
						}
					});
				});

			} else if (data.msg === "Restricted") {
				api_resp.getJson(data, api_resp.ACR_RESTRICTED, 'GROUP restricted to delete', objModel, null, function (jsonResp) {
					res.status(200).json(jsonResp);
				});
			} else {
				api_resp.getJson(data, api_resp.ACR_NOTEXIST, 'GROUP not found', objModel, null, function (jsonResp) {
					res.status(200).json(jsonResp);
				});
			}
		} else
		{
			api_resp.getJson(data, api_resp.ACR_ERROR, 'Error inserting', objModel, error, function (jsonResp) {
				res.status(200).json(jsonResp);
			});
		}
	});
});

module.exports = router;