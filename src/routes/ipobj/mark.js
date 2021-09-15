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

import { Mark } from '../../models/ipobj/Mark';
import { Firewall } from '../../models/firewall/Firewall';
import { OpenVPN } from '../../models/vpn/openvpn/OpenVPN';
import { Tree } from '../../models/tree/Tree';
import { app, logger } from '../../fonaments/abstract-application';
import { getRepository } from 'typeorm';
import { FirewallService } from '../../models/firewall/firewall.service';
const restrictedCheck = require('../../middleware/restricted');
const fwcError = require('../../utils/error_table');


/**
 * Create a new iptables mark.
 */
router.post('/', async (req, res) => {
	try {
		if (req.tree_node.node_type !== 'MRK')
			throw fwcError.BAD_TREE_NODE_TYPE;

    // Verify that we are not creating an iptables mark that already exists for this fwcloud.
		if (await Mark.existsMark(req.dbCon,req.body.fwcloud,req.body.code)) 
			throw fwcError.ALREADY_EXISTS;

		// Create the new iptables mark for the indicated fwcloud.
		const id = await Mark.createMark(req);

		// Create the iptables mark node in the ipobj tree.
		let nodeId = await Tree.newNode(req.dbCon, req.body.fwcloud, req.body.name, req.body.node_id, 'MRK', id, 30);

		res.status(200).json({insertId: id, TreeinsertId: nodeId});
	} catch(error) {
		logger().error('Error creating new mark: ' + JSON.stringify(error));
		res.status(400).json(error);
	}
});


/**
 * Modify an iptables mark.
 */
router.put('/', async (req, res) => {
	try {
		// Verify that we the new iptables mark doesn't already exists for this fwcloud.
		const existsId = await Mark.existsMark(req.dbCon,req.body.fwcloud,req.body.code);
		if (existsId && existsId!==req.body.mark) 
			throw fwcError.ALREADY_EXISTS;

   	// Modify the mark data.
		await Mark.modifyMark(req);
		//Update all group nodes which references the mark to set the new name
		await getRepository(Tree).createQueryBuilder('node')
			.update(Tree)
			.set({
				name: req.body.name
			})
			.where('node_type = :type', {type: "MRK"})
			.andWhere('id_obj = :id', {id: req.body.mark})
			.execute();

		const mark = await getRepository(Mark).findOneOrFail(req.body.mark, {
			relations: ['policyRules', 'routingRuleToMarks', 'routingRuleToMarks.routingRule', 'routingRuleToMarks.routingRule.routingTable']
		});

		const firewallService = await app().getService(FirewallService.name);
		const affectedFirewallsIds = [].concat(
			mark.policyRules.map(item => item.firewallId),
			mark.routingRuleToMarks.map(item => item.routingRule.routingTable.firewallId)
		);

		await firewallService.markAsUncompiled(affectedFirewallsIds);

		var data_return = {};
		await Firewall.getFirewallStatusNotZero(req.body.fwcloud, data_return);
		await OpenVPN.getOpenvpnStatusNotZero(req, data_return);

		res.status(200).json(data_return);
	} catch(error) {
		logger().error('Error updating new mark: ' + JSON.stringify(error));
		res.status(400).json(error);
	}
});


/**
 * Get mark data.
 */
router.put('/get', async(req, res) => {
	try {
		const data = await Mark.getMark(req.dbCon,req.body.mark);
		res.status(200).json(data);
	} catch(error) {
		logger().error('Error getting a mark: ' + JSON.stringify(error));
		res.status(400).json(error);
	}
});


/**
 * Delete an iptables mark.
 */
router.put('/del', 
restrictedCheck.mark,
async (req, res) => {
	try {
		// Delete iptables mark.
		await Mark.deleteMark(req.dbCon,req.body.mark);
		await Tree.deleteObjFromTree(req.body.fwcloud,req.body.mark,30);

		res.status(204).end();
	} catch(error) {
		logger().error('Error removing a mark: ' + JSON.stringify(error));
		res.status(400).json(error);
	}
});


// API call for check deleting restrictions.
router.put('/restricted', restrictedCheck.mark, (req, res) => res.status(204).end());


router.put('/where', async (req, res) => {
	try {
		const data = await Mark.searchMarkUsage(req.dbCon,req.body.fwcloud,req.body.mark);
		if (data.result)
			res.status(200).json(data);
		else
			res.status(204).end();
	} catch(error) {
		logger().error('Error locating mark references: ' + JSON.stringify(error));
		res.status(400).json(error);
	}
});

module.exports = router;