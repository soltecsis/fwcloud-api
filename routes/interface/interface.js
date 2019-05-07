var express = require('express');
var router = express.Router();
var InterfaceModel = require('../../models/interface/interface');
var fwcTreemodel = require('../../models/tree/tree');
var Interface__ipobjModel = require('../../models/interface/interface__ipobj');
var IpobjModel = require('../../models/ipobj/ipobj');
const restrictedCheck = require('../../middleware/restricted');
const fwcError = require('../../utils/error_table');


/* Get all interfaces by firewall*/
router.put('/fw/all/get', async (req, res) => {
	try {
		let data = await InterfaceModel.getInterfaces(req.dbCon, req.body.fwcloud, req.body.firewall);
		if (data && data.length > 0)
			res.status(200).json(data);
		else
			res.status(400).json(fwcError.NOT_FOUND);
	} catch(error) { res.status(400).json(error) }
});


/* Get all interfaces by firewall and IPOBJ under interfaces*/
router.put('/fw/full/get', (req, res) => {
	InterfaceModel.getInterfacesFull(req.body.firewall, req.body.fwcloud, (error, data) => {
		if (data && data.length > 0)
			res.status(200).json(data);
		else
			res.status(400).json(fwcError.NOT_FOUND);
	});
});

/* Get  interface by id and  by firewall*/
router.put('/fw/get', async (req, res) => {
	try {
		const data = await InterfaceModel.getInterface(req.body.fwcloud, req.body.id);
		if (data && data.length > 0)
			res.status(200).json(data);
		else
			res.status(400).json(fwcError.NOT_FOUND);
	} catch(error) { res.status(400).json(error) }
});


/* Get all interfaces by HOST*/
router.put('/host/all/get', (req, res) => {
	InterfaceModel.getInterfacesHost(req.body.host, req.body.fwcloud, (error, data) => {
		if (data && data.length > 0)
			res.status(200).json(data);
		else
			res.status(400).json(fwcError.NOT_FOUND);
	});
});

/* Get interface by id and HOST*/
router.put('/host/get', (req, res) => {
	InterfaceModel.getInterfaceHost(req.body.host, req.body.fwcloud, req.body.id, (error, data) => {
		if (data && data.length > 0)
			res.status(200).json(data);
		else
			res.status(400).json(fwcError.NOT_FOUND);
	});
});


/* Create New interface */
router.post("/", async (req, res) => {
	var fwcloud = req.body.fwcloud;
	var node_parent = req.body.node_parent;
	var node_order = req.body.node_order;
	var node_type = req.body.node_type;
	var firewall = req.body.firewall;
	var host = req.body.host;

	// Verify that the node tree information is consistent with the information in the request.
	try {
		if (!(await fwcTreemodel.verifyNodeInfo(node_parent, fwcloud, ((host === null || host === undefined) ? firewall : host))))
			return res.status(400).json(fwcError.BAD_TREE_NODE_TYPE);
	
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
		const insertId = await InterfaceModel.insertInterface(req.dbCon, interfaceData);

		//If saved interface Get data
		if (insertId && insertId>0) {
			if (host) {
				//INSERT INTERFACE UNDER IPOBJ HOST
				//Create New objet with data interface__ipobj
				var interface__ipobjData = {
					interface: insertId,
					ipobj: host,
					interface_order: 1
				};

				const id2 = await Interface__ipobjModel.insertInterface__ipobj(req.dbCon, interface__ipobjData);
				//If saved interface__ipobj Get data
				if (id2 && id2>0)
					await Interface__ipobjModel.UpdateHOST(id2);
			}

			//INSERT IN TREE
			interfaceData.id = insertId;
			interfaceData.type = interfaceData.interface_type;
			const node_id = await fwcTreemodel.insertFwc_TreeOBJ(req, node_parent, node_order, node_type, interfaceData);
			res.status(200).json({ "insertId": insertId, "TreeinsertId": node_id });
		} else { return res.status(400).end() }
	} catch (error) { res.status(400).json(error) }	
});

/* Update interface that exist */
router.put('/', (req, res) => {
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
			if (error) return res.status(400).json(error);
			//If saved interface saved ok, get data
			if (data && data.result) {
				try {
					await Interface__ipobjModel.UpdateHOST(interfaceData.id);
					await fwcTreemodel.updateFwc_Tree_OBJ(req, interfaceData);
					res.status(204).end();
				} catch(error) { res.status(400).json(error) }
			} else res.status(400).end();
		});
	} else res.status(400).end();
});


/* Remove firewall interface */
router.put('/fw/del',
restrictedCheck.interface,
async (req, res) => {
	try {
		await IpobjModel.deleteIpobjInterface(req.dbCon, req.body.id);
		await InterfaceModel.deleteInterfaceFW(req.dbCon, req.body.id);
		await fwcTreemodel.deleteObjFromTree(req.body.fwcloud, req.body.id, 10);
		res.status(204).end();
	} catch(error) { res.status(400).json(error) }
});


/* Remove host interface */
router.put("/host/del",
restrictedCheck.interface,
async (req, res) => {
	try {
		await Interface__ipobjModel.deleteHostInterface(req.dbCon, req.body.host, req.body.id);
		await IpobjModel.deleteIpobjInterface(req.dbCon, req.body.id);
		await InterfaceModel.deleteInterfaceHOST(req.dbCon, req.body.id);
		await fwcTreemodel.deleteObjFromTree(req.body.fwcloud, req.body.id, 11);
		res.status(204).end();
	} catch(error) { res.status(400).json(error) }
});


/* Search where is used interface  */
router.put('/where', async (req, res) => {
	try {
		const data = await InterfaceModel.searchInterfaceUsage(req.body.id, req.body.type, req.body.fwcloud, null);
		if (data && data.length > 0)
			res.status(200).json(data);
		else
			res.status(400).json(fwcError.NOT_FOUND);
	} catch(error) { res.status(400).json(error) }
});


// API call for check deleting restrictions.
router.put('/restricted', restrictedCheck.interface, (req, res) => res.status(204).end());

module.exports = router;