var express = require('express');
var router = express.Router();
var InterfaceModel = require('../../models/interface/interface');
var fwcTreemodel = require('../../models/tree/tree');
var fwc_tree_node = require("../../models/tree/node.js");
var utilsModel = require("../../utils/utils.js");
var Interface__ipobjModel = require('../../models/interface/interface__ipobj');
var IpobjModel = require('../../models/ipobj/ipobj');
var api_resp = require('../../utils/api_response');
const restrictedCheck = require('../../middleware/restricted');
var objModel = 'INTERFACE';


var logger = require('log4js').getLogger("app");


/* Get all interfaces by firewall*/
router.put('/fw/all/get', async (req, res) => {
	try {
		let data = await InterfaceModel.getInterfaces(req.dbCon, req.body.fwcloud, req.body.firewall);
		if (data && data.length > 0)
			api_resp.getJson(data, api_resp.ACR_OK, '', objModel, null, jsonResp => res.status(200).json(jsonResp));
		else //Get Error
			api_resp.getJson(data, api_resp.ACR_NOTEXIST, ' not found', objModel, null, jsonResp => res.status(200).json(jsonResp));
	} catch(error) { api_resp.getJson(null, api_resp.ACR_ERROR, 'ERROR', objModel, error, jsonResp => res.status(200).json(jsonResp)) }
});


/* Get all interfaces by firewall and IPOBJ under interfaces*/
router.put('/fw/full/get', (req, res) => {
	InterfaceModel.getInterfacesFull(req.body.firewall, req.body.fwcloud, (error, data) => {
		//If exists interface get data
		if (data && data.length > 0)
			api_resp.getJson(data, api_resp.ACR_OK, '', objModel, null, jsonResp => res.status(200).json(jsonResp));
		else
			api_resp.getJson(data, api_resp.ACR_NOTEXIST, ' not found', objModel, null, jsonResp => res.status(200).json(jsonResp));
	});
});

/* Get  interface by id and  by firewall*/
router.put('/fw/get', async (req, res) => {
	try {
		const data = await InterfaceModel.getInterface(req.body.fwcloud, req.body.id);
		if (data && data.length > 0)
			api_resp.getJson(data, api_resp.ACR_OK, '', objModel, null, jsonResp => res.status(200).json(jsonResp));
		else
			api_resp.getJson(data, api_resp.ACR_NOTEXIST, ' not found', objModel, null, jsonResp => res.status(200).json(jsonResp));
	} catch(error) { api_resp.getJson(null, api_resp.ACR_ERROR, 'ERROR', objModel, error, jsonResp => res.status(200).json(jsonResp)) }
});


/* Get all interfaces by HOST*/
router.put('/host/all/get', (req, res) => {
	InterfaceModel.getInterfacesHost(req.body.host, req.body.fwcloud, (error, data) => {
		//If exists interface get data
		if (data && data.length > 0)
			api_resp.getJson(data, api_resp.ACR_OK, '', objModel, null, jsonResp => res.status(200).json(jsonResp));
		else
			api_resp.getJson(data, api_resp.ACR_NOTEXIST, ' not found', objModel, null, jsonResp => res.status(200).json(jsonResp));
	});
});

/* Get interface by id and HOST*/
router.put('/host/get', (req, res) => {
	InterfaceModel.getInterfaceHost(req.body.host, req.body.fwcloud, req.body.id, (error, data) => {
		//If exists interface get data
		if (data && data.length > 0)
			api_resp.getJson(data, api_resp.ACR_OK, '', objModel, null, jsonResp => res.status(200).json(jsonResp));
		else
			api_resp.getJson(data, api_resp.ACR_NOTEXIST, ' not found', objModel, null, jsonResp => res.status(200).json(jsonResp));
	});
});


//FALTA COMPROBAR ACCESO FIREWALL
/* Create New interface */
router.post("/", async(req, res) => {
	var fwcloud = req.body.fwcloud;
	var node_parent = req.body.node_parent;
	var node_order = req.body.node_order;
	var node_type = req.body.node_type;
	var firewall = req.body.firewall;
	var host = req.body.host;

	// Verify that the node tree information is consistent with the information in the request.
	try {
		if (!(await fwcTreemodel.verifyNodeInfo(node_parent, fwcloud, ((host === null || host === undefined) ? firewall : host))))
			return api_resp.getJson(null, api_resp.ACR_ERROR, 'Inconsistent data between request and node tree', objModel, null, jsonResp => res.status(200).json(jsonResp));
	} catch (err) {
		return api_resp.getJson(null, api_resp.ACR_ERROR, 'Error verifying consistency between request and node tree', objModel, err, jsonResp => res.status(200).json(jsonResp));
	}

	//Create New objet with data interface
	var interfaceData = {
		id: null,
		firewall: req.body.firewall,
		name: req.body.name,
		labelName: req.body.labelName,
		type: req.body.type,
		interface_type: req.body.interface_type,
		comment: req.body.comment,
		mac: req.body.mac
	};

	InterfaceModel.insertInterface(interfaceData, async (error, data) => {
		if (error) return api_resp.getJson(data, api_resp.ACR_ERROR, 'Error inserting', objModel, error, jsonResp => res.status(200).json(jsonResp));

		//If saved interface Get data
		if (data && data.insertId > 0) {
			if (host !== null) {
				//INSERT INTERFACE UNDER IPOBJ HOST
				//Create New objet with data interface__ipobj
				var interface__ipobjData = {
					interface: data.insertId,
					ipobj: host,
					interface_order: 1
				};

				Interface__ipobjModel.insertInterface__ipobj(interface__ipobjData, function(error, dataH) {
					//If saved interface__ipobj Get data
					if (dataH && dataH.result) {
						Interface__ipobjModel.UpdateHOST(data.insertId)
							.then(() => {});
						logger.debug("NEW Interface:" + data.insertId + " UNDER HOST:" + host);
					} else {
						logger.debug(error);
					}
				});

			}
			var id = data.insertId;
			logger.debug("NEW INTERFACE id:" + id + "  Type:" + interfaceData.interface_type + "  Name:" + interfaceData.name);
			interfaceData.id = id;
			interfaceData.type = interfaceData.interface_type;

			try {
				//INSERT IN TREE
				const node_id = await fwcTreemodel.insertFwc_TreeOBJ(req, node_parent, node_order, node_type, interfaceData);
				var dataresp = { "insertId": id, "TreeinsertId": node_id };
				api_resp.getJson(dataresp, api_resp.ACR_INSERTED_OK, 'IPOBJ INSERTED OK', objModel, null, jsonResp => res.status(200).json(jsonResp));	
			} catch(error) { return api_resp.getJson(data, api_resp.ACR_ERROR, 'Error inserting', objModel, error, jsonResp => res.status(200).json(jsonResp)) }
		} else {
			api_resp.getJson(data, api_resp.ACR_ERROR, 'Error inserting', objModel, error, function(jsonResp) {
				res.status(200).json(jsonResp);
			});
		}
	});
});

//FALTA COMPROBAR ACCESO FIREWALL
/* Update interface that exist */
router.put('/', (req, res) => {
	var iduser = req.session.user_id;
	var fwcloud = req.body.fwcloud;
	//Save data into object
	var interfaceData = {
		id: req.body.id,
		name: req.body.name,
		labelName: req.body.labelName,
		type: req.body.type,
		comment: req.body.comment,
		mac: req.body.mac,
		interface_type: req.body.interface_type
	};

	if ((interfaceData.id !== null) && (fwcloud !== null)) {
		InterfaceModel.updateInterface(interfaceData, async (error, data) => {
			if (error)
				api_resp.getJson(data, api_resp.ACR_ERROR, 'Error Updating', objModel, error, function(jsonResp) {
					res.status(200).json(jsonResp);
				});
			else {
				//If saved interface saved ok, get data
				if (data && data.result) {
					try {
						await Interface__ipobjModel.UpdateHOST(interfaceData.id);
						await fwcTreemodel.updateFwc_Tree_OBJ(req, interfaceData);
						api_resp.getJson(null, api_resp.ACR_UPDATED_OK, 'IPOBJ UPDATED OK', objModel, null, jsonResp => res.status(200).json(jsonResp));
					} catch(error) { return api_resp.getJson(null, api_resp.ACR_DATA_ERROR, 'Error updating', objModel, null, jsonResp => res.status(200).json(jsonResp)) }
				} else {
					api_resp.getJson(data, api_resp.ACR_NOTEXIST, 'Error updating Interface', objModel, error, function(jsonResp) {
						res.status(200).json(jsonResp);
					});
				}
			}
		});
	} else
		api_resp.getJson(null, api_resp.ACR_DATA_ERROR, 'Error updating', objModel, null, function(jsonResp) {
			res.status(200).json(jsonResp);
		});
});


/* Remove firewall interface */
router.put('/fw/del',
restrictedCheck.interface,
(req, res) => {
	//Id from interface to remove
	var fwcloud = req.body.fwcloud;
	var idfirewall = req.body.firewall;
	var idInterface = req.body.id;
	var type = req.body.type;

	InterfaceModel.deleteInterface(fwcloud, idfirewall, idInterface, type, async (error, data) => {
		if (error) return api_resp.getJson(data, api_resp.ACR_ERROR, 'Error deleting', objModel, error, jsonResp => res.status(200).json(jsonResp));

		if (data && data.msg === "deleted" || data.msg === "notExist" || data.msg === "Restricted") {
			if (data.msg === "deleted") {

				//DELETE FROM interface_ipobj (INTERFACE UNDER HOST)
				//DELETE  ALL IPOBJ UNDER INTERFACE
				try {
					await Interface__ipobjModel.UpdateHOST(idInterface);
					Interface__ipobjModel.deleteInterface__ipobj(idInterface, null, (error, data) => {});
					//DELETE FROM TREE
					await fwcTreemodel.deleteObjFromTree(fwcloud, idInterface, 10);
					api_resp.getJson(null, api_resp.ACR_DELETED_OK, 'INTERFACE DELETED OK', objModel, null, jsonResp => res.status(200).json(jsonResp));
				} catch(error) { api_resp.getJson(data, api_resp.ACR_ERROR, 'Error deleting', objModel, error, jsonResp => res.status(200).json(jsonResp)); }
			} else if (data.msg === "Restricted")
				api_resp.getJson(data, api_resp.ACR_RESTRICTED, 'INTERFACE restricted to delete', objModel, null, jsonResp => res.status(200).json(jsonResp));
			else
				api_resp.getJson(data, api_resp.ACR_NOTEXIST, 'INTERFACE not found', objModel, null, jsonResp => res.status(200).json(jsonResp));
		} else
			api_resp.getJson(data, api_resp.ACR_ERROR, '', objModel, error, jsonResp => res.status(200).json(jsonResp));
	});
});


/* Remove host interface */
router.put("/host/del",
restrictedCheck.interface,
(req, res) => {
	Interface__ipobjModel.deleteInterface__ipobj(req.body.id, req.body.host, async (error, data) => {
		if (data) {
			if (data.msg === "deleted") {
				try {
					await IpobjModel.deleteIpobjInterface(req.dbCon, req.body.id);
					await InterfaceModel.deleteInterfaceHOST(req.dbCon, req.body.id);
					await fwcTreemodel.deleteObjFromTree(req.body.fwcloud, req.body.id, 11);
					api_resp.getJson(null, api_resp.ACR_DELETED_OK, 'INTERFACE DELETED OK', objModel, null, jsonResp => res.status(200).json(jsonResp));
				} catch(error) { api_resp.getJson(null, api_resp.ACR_ERROR, '', objModel, error, jsonResp => res.status(200).json(jsonResp)) }
			} else if (data.msg === "notExist")
				api_resp.getJson(data, api_resp.ACR_NOTEXIST, 'INTERFACE not found', objModel, null, jsonResp => res.status(200).json(jsonResp));
		} else
			api_resp.getJson(null, api_resp.ACR_ERROR, '', objModel, error, jsonResp => res.status(200).json(jsonResp));
	});
});


/* Search where is used interface  */
router.put('/where', async (req, res) => {
	try {
		const data = await InterfaceModel.searchInterfaceUsage(req.body.id, req.body.type, req.body.fwcloud, null);
		if (data && data.result)
			api_resp.getJson(data, api_resp.ACR_OK, '', objModel, null, jsonResp => res.status(200).json(jsonResp));
		else
			api_resp.getJson(null, api_resp.ACR_NOTEXIST, '', objModel, error, jsonResp => res.status(200).json(jsonResp));
	} catch(error) { api_resp.getJson(data, api_resp.ACR_ERROR, 'Error', objModel, error, jsonResp => res.status(200).json(jsonResp)) }
});


// API call for check deleting restrictions.
router.put("/restricted",
	restrictedCheck.interface,
	(req, res) => api_resp.getJson(null, api_resp.ACR_OK, '', objModel, null, jsonResp => res.status(200).json(jsonResp)));

module.exports = router;