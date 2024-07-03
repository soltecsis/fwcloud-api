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
import { PolicyRuleToInterface } from '../../models/policy/PolicyRuleToInterface';
import { PolicyRuleToIPObj } from '../../models/policy/PolicyRuleToIPObj';
import { PolicyRule } from '../../models/policy/PolicyRule';
import { Firewall } from '../../models/firewall/Firewall';
import { logger } from '../../fonaments/abstract-application';
const fwcError = require('../../utils/error_table');

var utilsModel = require("../../utils/utils.js");

/* Create New policy_r__interface */
router.post("/",
utilsModel.disableFirewallCompileStatus,
async (req, res) => {
	//Create New objet with data policy_r__interface
	var policy_r__interfaceData = {
		rule: req.body.rule,
		interface: req.body.interface,
		position: req.body.position,
		position_order: req.body.position_order
	};

	try {
		await PolicyRuleToInterface.insertPolicy_r__interface(req.body.firewall, policy_r__interfaceData);
		res.status(204).end();
	} catch(error) {
			logger().error('Error creating new policy_r__interface: ' + JSON.stringify(error));
			res.status(400).json(error);
		}
	});


/* Update POSITION policy_r__interface that exist */
router.put('/move',
utilsModel.disableFirewallCompileStatus,
async(req, res) => {
	var rule = req.body.rule;
	var interfaceName = req.body.interface;
	var position = req.body.position;
	var position_order = req.body.position_order;
	var new_rule = req.body.new_rule;
	var new_position = req.body.new_position;
	var new_order = req.body.new_order;
	var firewall = req.body.firewall;

	try {
		await Firewall.updateFirewallStatus(req.body.fwcloud,firewall,"|3");

		// Get positions content.
		const psts = await 	PolicyRuleToIPObj.getPositionsContent(req.dbCon, position, new_position);

		if (psts.content1 === psts.content2) { //SAME POSITION CONTENT TYPE
			await PolicyRuleToInterface.updatePolicy_r__interface_position(req.dbCon, firewall, rule, interfaceName, position, position_order, new_rule, new_position, new_order);
		} else if (psts.content1 === 'O' && psts.content2 === 'I') { //DIFFERENTS POSITIONS CONTENT TYPE
			//Create New Position 'I'
			//Create New objet with data policy_r__interface
			var policy_r__interfaceData = {
				rule: new_rule,
				interface: interfaceName,
				position: new_position,
				position_order: new_order
			};
			await PolicyRuleToInterface.insertPolicy_r__interface(firewall, policy_r__interfaceData);
			await	PolicyRuleToIPObj.deletePolicy_r__ipobj(req.dbCon, rule, -1, -1, interfaceName, position, position_order);
		} else { // NOT ALLOWED TO MOVE BETWEEN THESE POSITIONS BECAUSE THE CONTENT TYPE
			throw fwcError.NOT_ALLOWED;
		}
	
		// If after the move we have empty rule positions, then remove them from the negate position list.
		await PolicyRule.allowEmptyRulePositions(req);

	} catch(error) {
		logger().error('Error updating position: ' + JSON.stringify(error));
		return res.status(400).json(error); 
	}

	res.status(204).end();
});


/* Update ORDER de policy_r__interface that exist */
router.put('/order',
utilsModel.disableFirewallCompileStatus,
(req, res) => {
	var rule = req.body.rule;
	var interfaceName = req.body.interface;
	var position = req.body.position;
	var old_order = req.body.position_order;
	var new_order = req.body.new_order;

	PolicyRuleToInterface.updatePolicy_r__interface_order(rule, interfaceName, position, old_order, new_order, (error, data) => {
		if (error) {
			logger().error('Error updating order: ' + JSON.stringify(error));
			return res.status(400).json(error);
		}
		//If saved policy_r__interface saved ok, get data
		if (data && data.result) {
			res.status(200).json(data);
		} else {
			logger().error('Error updating order: ' + JSON.stringify(error));
			res.status(400).json(error);
		}
	});
});


/* Remove policy_r__interface */
router.put("/del",
utilsModel.disableFirewallCompileStatus,
async (req, res) => {
	//Id from policy_r__interface to remove
	var rule = req.body.rule;
	var interfaceName = req.body.interface;
	var position = req.body.position;
	var old_order = req.body.position_order;

	try {
		await PolicyRuleToInterface.deletePolicy_r__interface(req.dbCon, rule, interfaceName, position, old_order);
		// If after the delete we have empty rule positions, then remove them from the negate position list.
		await PolicyRule.allowEmptyRulePositions(req);
		res.status(204).end();
	} catch(error) { 
		logger().error('Error removing policy_r__interface: ' + JSON.stringify(error));
		return res.status(400).json(error);
	}
});

module.exports = router;