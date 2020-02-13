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

import { Firewall } from '../../models/firewall/Firewall';
import { IPObjGroup } from '../../models/ipobj/IPObjGroup';
import { IPObjToIPObjGroup } from '../../models/ipobj/IPObjToIPObjGroup';
import { OpenVPNPrefix } from '../../models/vpn/openvpn/OpenVPNPrefix';
import { PolicyCompilation } from '../../models/policy/PolicyCompilation';
import { OpenVPN } from '../../models/vpn/openvpn/OpenVPN';
import { Tree } from '../../models/tree/Tree';
import { PolicyRuleToIPObj } from '../../models/policy/PolicyRuleToIPObj';
import { IPObj } from '../../models/ipobj/IPObj';
const restrictedCheck = require('../../middleware/restricted');
const fwcError = require('../../utils/error_table');

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

	IPObjGroup.insertIpobj_g(ipobj_gData, async(error, data) => {
		if (error) return res.status(400).json(error);
		//If saved ipobj_g Get data
		if (data && data.insertId > 0) {
			var id = data.insertId;
			ipobj_gData.id = id;
			//INSERT IN TREE
			try {
				const node_id = await Tree.insertFwc_TreeOBJ(req, node_parent, node_order, node_type, ipobj_gData);
				var dataresp = { "insertId": id, "TreeinsertId": node_id };
				res.status(200).json(dataresp);
			} catch (error) { res.status(400).json(error) }
		} else res.status(400).json(fwcError.NOT_FOUND);
	});
});

/* Update ipobj_g that exist */
router.put('/', async(req, res) => {
	//Save data into object
	var ipobj_gData = {
		id: req.body.id,
		name: req.body.name,
		type: req.body.type,
		comment: req.body.comment,
		fwcloud: req.body.fwcloud
	};

	try {
		await IPObjGroup.updateIpobj_g(req, ipobj_gData);
		await Tree.updateFwc_Tree_OBJ(req, ipobj_gData);
		res.status(204).end();
	} catch (error) { return res.status(400).json(error) }
});


/* Get  ipobj_g by id */
router.put('/get', async(req, res) => {
	try {
		const data = await IPObjGroup.getIpobj_g_Full(req.dbCon, req.body.fwcloud, req.body.id);
		if (data && data.length == 1)
			res.status(200).json(data[0]);
		else
			res.status(400).json(fwcError.NOT_FOUND);
	} catch (error) { return res.status(400).json(error) }
});

/* Remove ipobj_g */
router.put("/del",
	restrictedCheck.ipobj_group,
	async(req, res) => {
		try {
			await IPObjGroup.deleteIpobj_g(req.dbCon, req.body.fwcloud, req.body.id, req.body.type);
			await Tree.orderTreeNodeDeleted(req.dbCon, req.body.fwcloud, req.body.id);
			await Tree.deleteObjFromTree(req.body.fwcloud, req.body.id, req.body.type);
			res.status(204).end();
		} catch (error) { return res.status(400).json(error) }
	});

/* Search where is used Group  */
router.put('/where', async(req, res) => {
	try {
		const data = await IPObjGroup.searchGroup(req.body.id, req.body.fwcloud);
		if (data.result > 0)
			res.status(200).json(data);
		else
			res.status(204).end();
	} catch (error) { res.status(400).json(error) }
});

// API call for check deleting restrictions.
router.put('/restricted', restrictedCheck.ipobj_group, (req, res) => res.status(204).end());


/* Create New ipobj__ipobjg */
router.put('/addto', async(req, res) => {
	try {
		// It is not possible to add a network interface to a group of IP objects.
		if (req.body.node_type === "IFF" || req.body.node_type === "IFH")
			throw fwcError.IF_TO_IPOBJ_GROUP;

		// Don't allow the mix of IPv4 and IPv6 objects in a group.
		// If the group ins not empty, then we must know what type of IP (IPv4 or IPv6) are the objects contained in it.
		const groupIPv = await IPObjGroup.groupIPVersion(req.dbCon, req.body.ipobj_g);

		// Insert object in group.
		let dataIpobj;
		if (req.body.node_type === 'OCL') {
			if (groupIPv === 6) throw fwcError.IPOBJ_MIX_IP_VERSION;

			await OpenVPN.addToGroup(req);
			dataIpobj = await OpenVPN.getOpenvpnInfo(req.dbCon, req.body.fwcloud, req.body.ipobj, 1);
			if (!dataIpobj || dataIpobj.length !== 1) throw fwcError.NOT_FOUND;
			dataIpobj[0].name = dataIpobj[0].cn;
			dataIpobj[0].type = 311;
		} else if (req.body.node_type === 'PRO') {
			if (groupIPv === 6) throw fwcError.IPOBJ_MIX_IP_VERSION;

			// Don't allow adding an empty OpenVPN server prefix to a group.
			if ((await OpenVPNPrefix.getOpenvpnClientesUnderPrefix(req.dbCon, req.prefix.openvpn, req.prefix.name)).length < 1)
				throw fwcError.IPOBJ_EMPTY_CONTAINER;

			await OpenVPNPrefix.addPrefixToGroup(req);
			dataIpobj = await OpenVPNPrefix.getPrefixOpenvpnInfo(req.dbCon, req.body.fwcloud, req.body.prefix);
			if (!dataIpobj || dataIpobj.length !== 1) throw fwcError.NOT_FOUND;
			dataIpobj[0].type = 401;
		} else {
			dataIpobj = await IPObj.getIpobj(req.dbCon, req.body.fwcloud, req.body.ipobj);
			if (groupIPv!=0 && dataIpobj[0].ip_version!==groupIPv) throw fwcError.IPOBJ_MIX_IP_VERSION;

			await IPObjToIPObjGroup.insertIpobj__ipobjg(req);
			if (!dataIpobj || dataIpobj.length !== 1) throw fwcError.NOT_FOUND;
		}

		//INSERT IN TREE
		await Tree.newNode(req.dbCon, req.body.fwcloud, dataIpobj[0].name, req.body.node_parent, req.body.node_type, req.body.ipobj, dataIpobj[0].type);

		// Invalidate the policy compilation of all affected rules.
		await PolicyCompilation.deleteFullGroupPolicy_c(req.dbCon, req.body.ipobj_g);
		// Update affected firewalls status.
		await Firewall.updateFirewallStatusIPOBJ(req.body.fwcloud, -1, req.body.ipobj_g, -1, -1, "|3");

		const not_zero_status_fws = await Firewall.getFirewallStatusNotZero(req.body.fwcloud, null);
		res.status(200).json(not_zero_status_fws);
	} catch (error) { res.status(400).json(error) }
});


/* Remove ipobj__ipobjg */
router.put('/delfrom', async(req, res) => {
	try {
		// No permitir eliminar de grupo si está siendo utilizado en alguna regla y va a quedar vacío.
		const search = await PolicyRuleToIPObj.searchGroupInRule(req.body.ipobj_g, req.body.fwcloud);
		if (search.length > 0) {
			if ((await IPObjGroup.countGroupItems(req.dbCon, req.body.ipobj_g)) === 1)
				throw fwcError.IPOBJ_EMPTY_CONTAINER;
		}

		if (req.body.obj_type === 311) // OPENVPN CLI
			await OpenVPN.removeFromGroup(req);
		else if (req.body.obj_type === 401) // OpenVPN PREFIX
			await OpenVPNPrefix.removePrefixFromGroup(req);
		else
			await IPObjToIPObjGroup.deleteIpobj__ipobjg(req.dbCon, req.body.ipobj_g, req.body.ipobj);

		await Tree.deleteFwc_TreeGroupChild(req.dbCon, req.body.fwcloud, req.body.ipobj_g, req.body.ipobj);

		// Invalidate the policy compilation of all affected rules.
		await PolicyCompilation.deleteFullGroupPolicy_c(req.dbCon, req.body.ipobj_g);
		await Firewall.updateFirewallStatusIPOBJ(req.body.fwcloud, -1, req.body.ipobj_g, -1, -1, "|3");

		const not_zero_status_fws = await Firewall.getFirewallStatusNotZero(req.body.fwcloud, null);
		res.status(200).json(not_zero_status_fws);
	} catch (error) { res.status(400).json(error) }
});


module.exports = router;