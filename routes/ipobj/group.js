var express = require('express');
var router = express.Router();

var logger = require('log4js').getLogger("app");

var FirewallModel = require('../../models/firewall/firewall');
var IpobjModel = require('../../models/ipobj/ipobj');
var Ipobj_gModel = require('../../models/ipobj/group');
var fwcTreemodel = require('../../models/tree/tree');
var Ipobj__ipobjgModel = require('../../models/ipobj/ipobj__ipobjg');
var api_resp = require('../../utils/api_response');
const restrictedCheck = require('../../middleware/restricted');
var objModel = 'GROUP';

/* Create New ipobj_g */
router.post("/", (req, res) => {
	var iduser = req.session.user_id;
	var fwcloud = req.body.fwcloud;
	var node_parent = req.body.node_parent;
	var node_order = req.body.node_order;
	var node_type = req.body.node_type;

	//Create New objet with data ipobj_g
	var ipobj_gData = {
		id: null,
		name: req.body.name,
		type: req.body.type,
		fwcloud: req.body.fwcloud,
		comment: req.body.comment
	};

	Ipobj_gModel.insertIpobj_g(ipobj_gData, function(error, data) {
		if (error)
			api_resp.getJson(data, api_resp.ACR_ERROR, '', objModel, error, function(jsonResp) {
				res.status(200).json(jsonResp);
			});
		else {
			//If saved ipobj_g Get data
			if (data && data.insertId > 0) {
				var id = data.insertId;
				ipobj_gData.id = id;
				//INSERT IN TREE
				fwcTreemodel.insertFwc_TreeOBJ(iduser, fwcloud, node_parent, node_order, node_type, ipobj_gData, function(error, data) {
					if (data && data.insertId) {
						var dataresp = { "insertId": id, "TreeinsertId": data.insertId };
						api_resp.getJson(dataresp, api_resp.ACR_INSERTED_OK, 'IPOBJ INSERTED OK', objModel, null, function(jsonResp) {
							res.status(200).json(jsonResp);
						});
					} else {
						api_resp.getJson(data, api_resp.ACR_NOTEXIST, 'Error inserting', objModel, error, function(jsonResp) {
							res.status(200).json(jsonResp);
						});
					}
				});

			} else {
				api_resp.getJson(data, api_resp.ACR_NOTEXIST, 'Error inserting', objModel, error, function(jsonResp) {
					res.status(200).json(jsonResp);
				});
			}
		}
	});
});

/* Update ipobj_g that exist */
router.put('/', (req, res) => {
	var iduser = req.session.user_id;
	var fwcloud = req.body.fwcloud;

	//Save data into object
	var ipobj_gData = { id: req.body.id, name: req.body.name, type: req.body.type, comment: req.body.comment, fwcloud: req.body.fwcloud };
	Ipobj_gModel.updateIpobj_g(ipobj_gData, function(error, data) {
		if (error)
			api_resp.getJson(data, api_resp.ACR_ERROR, '', objModel, error, function(jsonResp) {
				res.status(200).json(jsonResp);
			});
		else {
			//If saved ipobj_g saved ok, get data
			if (data && data.result) {
				//UPDATE TREE            
				fwcTreemodel.updateFwc_Tree_OBJ(iduser, fwcloud, ipobj_gData, function(error, data) {
					if (data && data.result) {
						api_resp.getJson(data, api_resp.ACR_UPDATED_OK, 'UPDATED OK', objModel, null, function(jsonResp) {
							res.status(200).json(jsonResp);
						});
					} else {
						api_resp.getJson(data, api_resp.ACR_NOTEXIST, 'Error updating', objModel, error, function(jsonResp) {
							res.status(200).json(jsonResp);
						});
					}
				});
			} else {
				api_resp.getJson(data, api_resp.ACR_ERROR, 'Error updating', objModel, error, function(jsonResp) {
					res.status(200).json(jsonResp);
				});
			}
		}
	});
});


/* Get  ipobj_g by id */
router.put('/get', (req, res) => {
	var fwcloud = req.body.fwcloud;
	var id = req.body.id;
	Ipobj_gModel.getIpobj_g_Full(fwcloud, id, (error, data) => {
		//If exists ipobj_g get data
		if (data && data.length > 0)
			api_resp.getJson(data, api_resp.ACR_OK, '', objModel, null, jsonResp => res.status(200).json(jsonResp));
		else
			api_resp.getJson(data, api_resp.ACR_NOTEXIST, ' not found', objModel, null, jsonResp => res.status(200).json(jsonResp));
	});
});

/* Remove ipobj_g */
router.put("/del",
	restrictedCheck.ipobj_group,
	(req, res) => {
		var iduser = req.session.user_id;
		var fwcloud = req.body.fwcloud;
		var id = req.body.id;
		var type = req.body.type;

		Ipobj_gModel.deleteIpobj_g(fwcloud, id, type, function(error, data) {
			if (data && data.msg === "deleted" || data.msg === "notExist" || data.msg === "Restricted") {
				if (data.msg === "deleted") {
					fwcTreemodel.orderTreeNodeDeleted(fwcloud, id, async (error, data) => {
						//DELETE FROM TREE
						try {
							await fwcTreemodel.deleteObjFromTree(fwcloud, id, type);
							api_resp.getJson(null, api_resp.ACR_DELETED_OK, 'GROUP DELETED OK', objModel, null, jsonResp => res.status(200).json(jsonResp));
						} catch(error) { api_resp.getJson(data, api_resp.ACR_ERROR, 'Error deleting', objModel, error, jsonResp => res.status(200).json(jsonResp)) } 
					});
				} else if (data.msg === "Restricted") {
					api_resp.getJson(data, api_resp.ACR_RESTRICTED, 'GROUP restricted to delete', objModel, null, function(jsonResp) {
						res.status(200).json(jsonResp);
					});
				} else {
					api_resp.getJson(data, api_resp.ACR_NOTEXIST, 'GROUP not found', objModel, null, function(jsonResp) {
						res.status(200).json(jsonResp);
					});
				}
			} else {
				api_resp.getJson(data, api_resp.ACR_ERROR, 'Error inserting', objModel, error, function(jsonResp) {
					res.status(200).json(jsonResp);
				});
			}
		});
	});

/* Search where is used Group  */
router.put('/where', async (req, res) => {
	try {
		const data = await Ipobj_gModel.searchGroup(req.body.id, req.body.fwcloud);
		if (data && data.result)
			api_resp.getJson(data, api_resp.ACR_OK, '', objModel, null, jsonResp => res.status(200).json(jsonResp));
		else
			api_resp.getJson(data, api_resp.ACR_NOTEXIST, '', objModel, error, jsonResp => res.status(200).json(jsonResp));
	} catch(error) { api_resp.getJson(null, api_resp.ACR_ERROR, 'Error', objModel, error, jsonResp => res.status(200).json(jsonResp)) }
});

// API call for check deleting restrictions.
router.put('/restricted',
	restrictedCheck.ipobj_group,
	(req, res) => api_resp.getJson(null, api_resp.ACR_OK, '', objModel, null, jsonResp => res.status(200).json(jsonResp)));


/* Create New ipobj__ipobjg */
router.put("/addto", (req, res) => {
	var iduser = req.session.user_id;
	var fwcloud = req.body.fwcloud;
	var node_parent = req.body.node_parent;
	var node_order = req.body.node_order;
	var node_type = req.body.node_type;

	//Create New object with data ipobj__ipobjg
	var ipobj__ipobjgData = {
		ipobj_g: req.body.ipobj_g,
		ipobj: req.body.ipobj
	};

	// ATENCION: 
	// No existe una tabla que relacione los grupos con las interfaces, por lo tanto, no es posible añadir una
	// interfaz a un grupo de objetos IP, por el momento.
	if (req.params.node_type === "IFF" || req.params.node_type === "IFH") {
		api_resp.getJson(null, api_resp.ACR_ERROR, 'It is not possible to add network interfaces to IP objects groups.', objModel, null, jsonResp => res.status(200).json(jsonResp));
		return;
	}

	Ipobj__ipobjgModel.insertIpobj__ipobjg(ipobj__ipobjgData, function(error, data) {
		if (error)
			api_resp.getJson(data, api_resp.ACR_ERROR, '', objModel, error, function(jsonResp) {
				res.status(200).json(jsonResp);
			});
		else {
			//If saved ipobj__ipobjg Get data
			if (data && data.insertId > 0) {
				logger.debug("NEW IPOBJ IN GROUP: " + ipobj__ipobjgData.ipobj_g + "  IPOBJ:" + ipobj__ipobjgData.ipobj);
				//Search IPOBJ Data
				IpobjModel.getIpobjGroup(fwcloud, ipobj__ipobjgData.ipobj_g, ipobj__ipobjgData.ipobj, function(error, dataIpobj) {
					//If exists ipobj get data
					if (typeof dataIpobj !== 'undefined') {

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
								FirewallModel.updateFirewallStatusIPOBJ(fwcloud, -1, req.body.ipobj_g, -1, -1, "|3")
									.then(() => { return FirewallModel.getFirewallStatusNotZero(fwcloud, null) })
									.then(not_zero_status_fws => api_resp.getJson(not_zero_status_fws, api_resp.ACR_INSERTED_OK, 'INSERTED OK', objModel, null, jsonResp => res.status(200).json(jsonResp)))
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

/* Remove ipobj__ipobjg */
router.put("/delfrom", (req, res) => {
	var iduser = req.session.user_id;
	var fwcloud = req.body.fwcloud;
	var node_parent = req.body.node_parent;

	//Id from ipobj__ipobjg to remove
	var ipobjg = req.body.ipobj_g;
	var ipobj = req.body.ipobj;

	Ipobj__ipobjgModel.deleteIpobj__ipobjg(fwcloud, ipobjg, ipobj, (error, data) => {
		if (error)
			api_resp.getJson(data, api_resp.ACR_ERROR, '', objModel, error, jsonResp => res.status(200).json(jsonResp));
		else {
			if (data && data.msg === "deleted" || data.msg === "notExist" || data.msg === "Restricted") {
				if (data.msg === "deleted") {
					//DELETE FROM TREE
					fwcTreemodel.deleteFwc_TreeGroupChild(iduser, fwcloud, node_parent, ipobjg, ipobj, function(error, data) {
						if (data && data.result) {
							logger.debug("IPOBJ GROUP NODE TREE DELETED. GO TO ORDER");
							fwcTreemodel.orderTreeNode(fwcloud, node_parent, (error, data) => {
								// Update affected firewalls status.
								FirewallModel.updateFirewallStatusIPOBJ(fwcloud, -1, req.params.ipobjg, -1, -1, "|3")
									.then(() => { return FirewallModel.getFirewallStatusNotZero(fwcloud, null) })
									.then(not_zero_status_fws =>
										api_resp.getJson(not_zero_status_fws, api_resp.ACR_INSERTED_OK, 'DELETED OK ' + data.alert, objModel, null, jsonResp => res.status(200).json(jsonResp)))
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