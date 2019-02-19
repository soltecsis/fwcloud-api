/**
 * Module for routing ipobj groups management requests
 * <br>BASE ROUTE CALL: <b>/ipobj/group</b>
 *
 * @module ipobj group
 * 
 * 
 */

var express = require('express');
var router = express.Router();

var FirewallModel = require('../../models/firewall/firewall');
var IpobjModel = require('../../models/ipobj/ipobj');
const openvpnModel = require('../../models/vpn/openvpn/openvpn');
const pkiCAModel = require('../../models/vpn/pki/ca');
var Ipobj_gModel = require('../../models/ipobj/group');
const policy_cModel = require('../../models/policy/policy_c');
var fwcTreeModel = require('../../models/tree/tree');
var Ipobj__ipobjgModel = require('../../models/ipobj/ipobj__ipobjg');
var api_resp = require('../../utils/api_response');
const restrictedCheck = require('../../middleware/restricted');
var objModel = 'GROUP';

/* Create New ipobj_g */
router.post("/", (req, res) => {
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

	Ipobj_gModel.insertIpobj_g(ipobj_gData, async (error, data) => {
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
				try {
					const node_id = await fwcTreeModel.insertFwc_TreeOBJ(req, node_parent, node_order, node_type, ipobj_gData);
					var dataresp = { "insertId": id, "TreeinsertId": node_id };
					api_resp.getJson(dataresp, api_resp.ACR_INSERTED_OK, 'IPOBJ INSERTED OK', objModel, null, jsonResp => res.status(200).json(jsonResp));
				} catch(error) { return api_resp.getJson(data, api_resp.ACR_NOTEXIST, 'Error inserting', objModel, error, jsonResp => res.status(200).json(jsonResp)) }
			} else {
				api_resp.getJson(data, api_resp.ACR_NOTEXIST, 'Error inserting', objModel, error, function(jsonResp) {
					res.status(200).json(jsonResp);
				});
			}
		}
	});
});

/* Update ipobj_g that exist */
router.put('/', async (req, res) => {
	//Save data into object
	var ipobj_gData = { 
		id: req.body.id, 
		name: req.body.name, 
		type: req.body.type, 
		comment: req.body.comment, 
		fwcloud: req.body.fwcloud 
	};

	try {
		await Ipobj_gModel.updateIpobj_g(req, ipobj_gData);
		await fwcTreeModel.updateFwc_Tree_OBJ(req, ipobj_gData);
		api_resp.getJson(null, api_resp.ACR_UPDATED_OK, 'UPDATED OK', objModel, null, jsonResp => res.status(200).json(jsonResp));
	} catch(error) { api_resp.getJson(null, api_resp.ACR_ERROR, 'Error updating', objModel, error, jsonResp => res.status(200).json(jsonResp)) }
});


/* Get  ipobj_g by id */
router.put('/get', async (req, res) => {
	try {
		const data = await Ipobj_gModel.getIpobj_g_Full(req.dbCon, req.body.fwcloud, req.body.id);
		if (data && data.length > 0)
			api_resp.getJson(data, api_resp.ACR_OK, '', objModel, null, jsonResp => res.status(200).json(jsonResp));
		else
			api_resp.getJson(data, api_resp.ACR_NOTEXIST, ' not found', objModel, null, jsonResp => res.status(200).json(jsonResp));
	} catch(error) { api_resp.getJson(null, api_resp.ACR_ERROR, 'ERROR', objModel, error, jsonResp => res.status(200).json(jsonResp)) }
});

/* Remove ipobj_g */
router.put("/del",
	restrictedCheck.ipobj_group,
	(req, res) => {
		var fwcloud = req.body.fwcloud;
		var id = req.body.id;
		var type = req.body.type;

		Ipobj_gModel.deleteIpobj_g(fwcloud, id, type, async (error, data) => {
			if (data && data.msg === "deleted" || data.msg === "notExist" || data.msg === "Restricted") {
				if (data.msg === "deleted") {
					//DELETE FROM TREE
					try {
						await fwcTreeModel.orderTreeNodeDeleted(req.dbCon, fwcloud, id);
						await fwcTreeModel.deleteObjFromTree(fwcloud, id, type);
						api_resp.getJson(null, api_resp.ACR_DELETED_OK, 'GROUP DELETED OK', objModel, null, jsonResp => res.status(200).json(jsonResp));
					} catch(error) { api_resp.getJson(data, api_resp.ACR_ERROR, 'Error deleting', objModel, error, jsonResp => res.status(200).json(jsonResp)) } 
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
router.put("/addto", async (req, res) => {
	try {
		// ATENCION: 
		// No existe una tabla que relacione los grupos con las interfaces, por lo tanto, no es posible añadir una
		// interfaz a un grupo de objetos IP, por el momento.
		if (req.body.node_type === "IFF" || req.body.node_type === "IFH") 
			throw(new Error('It is not possible to add network interfaces to IP objects groups'))

		// Insert object in group.
		let dataIpobj;
		if (req.body.node_type === 'OCL') {
			await openvpnModel.addToGroup(req);
			dataIpobj = await openvpnModel.getOpenvpnInfo(req.dbCon,req.body.fwcloud,req.body.ipobj,1);
			if (!dataIpobj || dataIpobj.length!==1) throw(new Error('OpenVPN configuration not found'))
			dataIpobj[0].name = dataIpobj[0].cn;
			dataIpobj[0].type = 311;
		}
		else if (req.body.node_type === 'PRE') {
			await pkiCAModel.addPrefixToGroup(req);
			dataIpobj = await pkiCAModel.getPrefixInfo(req.dbCon,req.body.fwcloud,req.body.ipobj);
			if (!dataIpobj || dataIpobj.length!==1) throw(new Error('CRT prefix not found'))
			dataIpobj[0].type = 400;
		}
		else {
			await Ipobj__ipobjgModel.insertIpobj__ipobjg(req);
			dataIpobj = await	IpobjModel.getIpobj(req.dbCon,req.body.fwcloud,req.body.ipobj);
			if (!dataIpobj || dataIpobj.length!==1) throw(new Error('Ipobj not found'))
		}

		//INSERT IN TREE
		//(dbCon,fwcloud,name,id_parent,node_type,id_obj,obj_type)
		await fwcTreeModel.newNode(req.dbCon,req.body.fwcloud,dataIpobj[0].name,req.body.node_parent,req.body.node_type,req.body.ipobj,dataIpobj[0].type);

		// Invalidate the policy compilation of all affected rules.
		await policy_cModel.deleteFullGroupPolicy_c(req.dbCon, req.body.ipobj_g);

		// Update affected firewalls status.
		await FirewallModel.updateFirewallStatusIPOBJ(req.body.fwcloud, -1, req.body.ipobj_g, -1, -1, "|3");
		const not_zero_status_fws = await FirewallModel.getFirewallStatusNotZero(req.body.fwcloud, null);
		api_resp.getJson(not_zero_status_fws, api_resp.ACR_INSERTED_OK, 'INSERTED OK', objModel, null, jsonResp => res.status(200).json(jsonResp));
	} catch(error) { api_resp.getJson(null, api_resp.ACR_ERROR, 'ERROR', objModel, error, jsonResp => res.status(200).json(jsonResp)) }
});

/* Remove ipobj__ipobjg */
router.put("/delfrom", async (req, res) => {
	try {
		if (req.body.obj_type===311) // OPENVPN CLI
			await openvpnModel.removeFromGroup(req);
		else if (req.body.obj_type===400) // CRT PREFIX CONTAINER
			await pkiCAModel.removePrefixFromGroup(req);
		else 
			await Ipobj__ipobjgModel.deleteIpobj__ipobjg(req.dbCon, req.body.ipobj_g, req.body.ipobj);
		
		await fwcTreeModel.deleteFwc_TreeGroupChild(req.dbCon, req.body.fwcloud, req.body.ipobj_g, req.body.ipobj);

		// Invalidate the policy compilation of all affected rules.
		await policy_cModel.deleteFullGroupPolicy_c(req.dbCon, req.body.ipobj_g);

		await FirewallModel.updateFirewallStatusIPOBJ(req.body.fwcloud, -1, req.params.ipobjg, -1, -1, "|3");
		const not_zero_status_fws = await FirewallModel.getFirewallStatusNotZero(req.body.fwcloud, null);
		api_resp.getJson(not_zero_status_fws, api_resp.ACR_INSERTED_OK, 'DELETED OK', objModel, null, jsonResp => res.status(200).json(jsonResp));
	} catch(error) { api_resp.getJson(null, api_resp.ACR_ERROR, 'ERROR', objModel, error, jsonResp => res.status(200).json(jsonResp)) }
});


module.exports = router;