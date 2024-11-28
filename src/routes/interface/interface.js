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
import { Firewall, FirewallInstallCommunication } from '../../models/firewall/Firewall';
import { Interface } from '../../models/interface/Interface';
import { InterfaceIPObj } from '../../models/interface/InterfaceIPObj';
import { Tree } from '../../models/tree/Tree';
import { IPObj } from '../../models/ipobj/IPObj';
import { logger } from '../../fonaments/abstract-application';
import { SSHCommunication } from '../../communications/ssh.communication';
import { AgentCommunication } from '../../communications/agent.communication';
import { HttpException } from '../../fonaments/exceptions/http/http-exception';
const restrictedCheck = require('../../middleware/restricted');

const fwcError = require('../../utils/error_table');


/* Get all interfaces by firewall*/
router.put('/fw/all/get', async (req, res) => {
	try {
		let data = await Interface.getInterfaces(req.dbCon, req.body.fwcloud, req.body.firewall);
		if (data && data.length > 0)
			res.status(200).json(data);
		else
			res.status(204).end();
	} catch (error) {
		logger().error('Error getting all firewall interfaces: ' + JSON.stringify(error));
		res.status(400).json(error);
	}
});


/* Get all interfaces by firewall and IPOBJ under interfaces*/
router.put('/fw/full/get', (req, res) => {
	Interface.getInterfacesFull(req.body.firewall, req.body.fwcloud, (error, data) => {
		if (error) {
			logger().error('Error getting firewall interfaces and its ipobjs: ' + JSON.stringify(error));
			return res.status(400).json(error);
		}

		if (data && data.length > 0)
			res.status(200).json(data);
		else
			res.status(204).end();
	});
});

/* Get  interface by id and  by firewall*/
router.put('/fw/get', async (req, res) => {
	try {
		const data = await Interface.getInterface(req.body.fwcloud, req.body.id);
		if (data && data.length == 1)
			res.status(200).json(data[0]);
		else {
			logger().error('Error getting interface firewall: ' + JSON.stringify(fwcError.NOT_FOUND));
			res.status(400).json(fwcError.NOT_FOUND);
		}
	} catch (error) {
		logger().error('Error getting interface firewall: ' + JSON.stringify(error));
		res.status(400).json(error);
	}
});


/* Get all interfaces by HOST*/
router.put('/host/all/get', (req, res) => {
	Interface.getInterfacesHost(req.body.host, req.body.fwcloud, (error, data) => {
		if (error) {
			logger().error('Error getting host interfaces: ' + JSON.stringify(error));
			return res.status(400).json(error);
		}

		if (data && data.length > 0)
			res.status(200).json(data);
		else
			res.status(204).end();
	});
});

/* Get interface by id and HOST*/
router.put('/host/get', (req, res) => {
	Interface.getInterfaceHost(req.body.host, req.body.fwcloud, req.body.id, (error, data) => {
		if (error) {
			logger().error('Error getting host interface by id: ' + JSON.stringify(error));
			return res.status(400).json(error);
		}

		if (data && data.length == 1)
			res.status(200).json(data[0]);
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
		if (!(await Tree.verifyNodeInfo(node_parent, fwcloud, ((host === null || host === undefined) ? firewall : host)))) {
			logger().error('Error creating new interface: ' + JSON.stringify(fwcError.BAD_TREE_NODE_TYPE));
			return res.status(400).json(fwcError.BAD_TREE_NODE_TYPE);
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
		const insertId = await Interface.insertInterface(req.dbCon, interfaceData);

		//If saved interface Get data
		if (insertId && insertId > 0) {
			if (host) {
				//INSERT INTERFACE UNDER IPOBJ HOST
				//Create New objet with data interface__ipobj
				var interface__ipobjData = {
					interface: insertId,
					ipobj: host,
					interface_order: 1
				};

				const id2 = await InterfaceIPObj.insertInterface__ipobj(req.dbCon, interface__ipobjData);
				//If saved interface__ipobj Get data
				if (id2 && id2 > 0)
					await InterfaceIPObj.UpdateHOST(id2);
			}

			//INSERT IN TREE
			interfaceData.id = insertId;
			interfaceData.type = interfaceData.interface_type;
			const node_id = await Tree.insertFwc_TreeOBJ(req, node_parent, node_order, node_type, interfaceData);
			res.status(200).json({ "insertId": insertId, "TreeinsertId": node_id });
		} else {
			logger().error('Error creating new interface');
			return res.status(400).end();
		}
	} catch (error) {
		logger().error('Error creating new interface: ' + JSON.stringify(error));
		res.status(400).json(error);
	}
});

/* Update interface that exist */
router.put('/', (req, res) => {
	const fwcloud = req.body.fwcloud;
	//Save data into object
	const interfaceData = {
		id: req.body.id,
		name: req.body.name,
		labelName: req.body.labelName,
		type: req.body.type,
		comment: req.body.comment,
		mac: req.body.mac,
		interface_type: req.body.interface_type
	};

	if ((interfaceData.id !== null) && (fwcloud !== null)) {
		Interface.updateInterface(interfaceData, async (error, data) => {
			if (error) {
				logger().error('Error updating interface: ' + JSON.stringify(error));
				return res.status(400).json(error)
			};
			//If saved interface saved ok, get data
			if (data && data.result) {
				try {
					await InterfaceIPObj.UpdateHOST(interfaceData.id);

					await Firewall.updateFirewallStatusInterface(req.body.fwcloud, [interfaceData.id]);

					const data_return = {};
					await Firewall.getFirewallStatusNotZero(req.body.fwcloud, data_return);

					await Tree.updateFwc_Tree_OBJ(req, interfaceData);

					res.status(200).json(data_return);
				} catch (error) {
					res.status(400).json(error)
				}
			} else {
				logger().error('Error updating new interface');
				res.status(400).end();
			};
		});
	} else {
		logger().error('Error updating interface');
		res.status(400).end();
	}
});


/* Remove firewall interface */
router.put('/fw/del',
	restrictedCheck.interface,
	async (req, res) => {
		try {
			await IPObj.deleteIpobjInterface(req.dbCon, req.body.id);
			await Interface.deleteInterfaceFW(req.dbCon, req.body.id);
			await Tree.deleteObjFromTree(req.body.fwcloud, req.body.id, 10);
			res.status(204).end();
		} catch (error) {
			logger().error('Error removing firewall interface: ' + JSON.stringify(error));
			res.status(400).json(error);
		}
	});


/* Remove host interface */
router.put("/host/del",
	restrictedCheck.interface,
	async (req, res) => {
		try {
			await InterfaceIPObj.deleteHostInterface(req.dbCon, req.body.host, req.body.id);
			await IPObj.deleteIpobjInterface(req.dbCon, req.body.id);
			await Interface.deleteInterfaceHOST(req.dbCon, req.body.id);
			await Tree.deleteObjFromTree(req.body.fwcloud, req.body.id, 11);
			res.status(204).end();
		} catch (error) {
			logger().error('Error removing host interface: ' + JSON.stringify(error));
			res.status(400).json(error);
		}
	});


/* Search where is used interface  */
router.put('/where', async (req, res) => {
	try {
		const data = await Interface.searchInterfaceUsage(req.body.id, req.body.type, req.body.fwcloud, null);
		if (data.result > 0)
			res.status(200).json(data);
		else
			res.status(204).end();
	} catch (error) {
		logger().error('Error getting the places where interface is used: ' + JSON.stringify(error));
		res.status(400).json(error);
	}
});


// API call for check deleting restrictions.
router.put('/restricted', restrictedCheck.interface, (req, res) => res.status(204).end());


/* Get all network interface information from a firewall.  */
router.put('/autodiscover', async (req, res, next) => {
	try {
		let communication = null;

		if (req.body.communication === FirewallInstallCommunication.SSH) {
			communication = new SSHCommunication({
				host: req.body.ip,
				port: req.body.port,
				username: req.body.sshuser,
				password: req.body.sshpass,
				options: null
			});
		} else {
			communication = new AgentCommunication({
				host: req.body.ip,
				port: req.body.port,
				protocol: req.body.protocol,
				apikey: req.body.apikey
			});
		}

		const rawData = await communication.getFirewallInterfaces();

		// Process raw interfaces data and convert into a json object.
		const ifsData = await Interface.ifsDataToJson(rawData);

		res.status(200).json(ifsData);
	} catch (error) {
		logger().error('Error getting network interface information: ' + Object.prototype.hasOwnProperty(error, "message") ? error.message : JSON.stringify(error));

		if (error instanceof HttpException) {
			return next(error);
		}

		if (error.message)
			res.status(400).json({ message: error.message });
		else
			res.status(400).json(error);
	}
});

module.exports = router;