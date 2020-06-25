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
import { PolicyCompilation } from '../../models/policy/PolicyCompilation';
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
		const data = await PolicyRuleToInterface.insertPolicy_r__interface(req.body.firewall, policy_r__interfaceData);
		//If saved policy_r__interface Get data
		if (data && data.result) {
			if (data.result) {
				PolicyRule.compilePolicy_r(policy_r__interfaceData.rule, (error, datac) => {});
				res.status(200).json(data);
			} else if (!data.allowed)
				throw fwcError.NOT_ALLOWED;
			else
				throw fwcError.NOT_FOUND;
			} else throw fwcError.NOT_ALLOWED;
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
	var interface = req.body.interface;
	var position = req.body.position;
	var position_order = req.body.position_order;
	var new_rule = req.body.new_rule;
	var new_position = req.body.new_position;
	var new_order = req.body.new_order;
	var firewall = req.body.firewall;

	var content1 = 'O', content2 = 'O';

	try {
		// Invalidate compilation of the affected rules.
		await PolicyCompilation.deletePolicy_c(rule);
		await PolicyCompilation.deletePolicy_c(new_rule);
		await Firewall.updateFirewallStatus(req.body.fwcloud,firewall,"|3");

		// Get positions content.
		const data = await 	PolicyRuleToIPObj.getPositionsContent(req.dbCon, position, new_position);
		content1 = data.content1;
		content2 = data.content2;	
	} catch(error) {
		logger().error('Error updating position: ' + JSON.stringify(error));
		return res.status(400).json(error); 
	}

	if (content1 === content2) { //SAME POSITION
		PolicyRuleToInterface.updatePolicy_r__interface_position(firewall, rule, interface, position, position_order, new_rule, new_position, new_order, async (error, data) => {
			//If saved policy_r__ipobj saved ok, get data
			if (data) {
				if (data.result) {
					PolicyRule.compilePolicy_r(rule, (error, datac) => {});
					if (rule != new_rule) PolicyRule.compilePolicy_r(new_rule, (error, datac) => {});

					// If after the move we have empty rule positions, then remove them from the negate position list.
					try {
						await PolicyRule.allowEmptyRulePositions(req);
					} catch(error) { return res.status(400).json(error) }

					res.status(200).json(data);
				} else if (!data.allowed) {
					logger().error('Error updating position: ' + JSON.stringify(fwcError.NOT_ALLOWED));
					return res.status(400).json(fwcError.NOT_ALLOWED);
				} else {
					logger().error('Error updating position: ' + JSON.stringify(fwcError.NOT_FOUND));
					return res.status(400).json(fwcError.NOT_FOUND);
				}
			} else {
				logger().error('Error updating position: ' + JSON.stringify(error));
				return res.status(400).json(error);
			}
		});
	} else { //DIFFERENTS POSITIONS
		if (content1 === 'O' && content2 === 'I') {
			//Create New Position 'I'
			//Create New objet with data policy_r__interface
			var policy_r__interfaceData = {
				rule: new_rule,
				interface: interface,
				position: new_position,
				position_order: new_order
			};

			var data;
			try {
				data = await PolicyRuleToInterface.insertPolicy_r__interface(firewall, policy_r__interfaceData);
			} catch(error) { 
				logger().error('Error updating position: ' + JSON.stringify(error));
				return res.status(400).json(error);
			}
			//If saved policy_r__interface Get data
			if (data) {
				if (data.result) {
					//delete Position 'O'
					PolicyRuleToIPObj.deletePolicy_r__ipobj(rule, -1, -1, interface, position, position_order, async (error, data) => {
						if (data && data.result) {
							PolicyRule.compilePolicy_r(rule, (error, datac) => {});
							if (rule != new_rule) PolicyRule.compilePolicy_r(new_rule, (error, datac) => {});

							// If after the move we have empty rule positions, then remove them from the negate position list.
							try {
								await PolicyRule.allowEmptyRulePositions(req);
							} catch(error) { return res.status(400).json(error) }

							res.status(200).json(data);
						} else {
							logger().error('Error updating position: ' + JSON.stringify(error));
							return res.status(400).json(error);
						}
					});
				} else if (!data.allowed) {
					logger().error('Error updating position: ' + JSON.stringify(fwcError.NOT_ALLOWED));
					return res.status(400).json(fwcError.NOT_ALLOWED);
				} else {
					logger().error('Error updating position: ' + JSON.stringify(fwcError.NOT_FOUND));
					return res.status(400).json(fwcError.NOT_FOUND);
				}
			} else {
				logger().error('Error updating position: ' + JSON.stringify(error));
				return res.status(400).json(error);
			}
		}
	}
});


/* Update ORDER de policy_r__interface that exist */
router.put('/order',
utilsModel.disableFirewallCompileStatus,
(req, res) => {
	var rule = req.body.rule;
	var interface = req.body.interface;
	var position = req.body.position;
	var old_order = req.body.position_order;
	var new_order = req.body.new_order;

	PolicyRuleToInterface.updatePolicy_r__interface_order(rule, interface, position, old_order, new_order, (error, data) => {
		if (error) {
			logger().error('Error updating order: ' + JSON.stringify(error));
			return res.status(400).json(error);
		}
		//If saved policy_r__interface saved ok, get data
		if (data && data.result) {
			PolicyRule.compilePolicy_r(rule, (error, datac) => {});
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
(req, res) => {
	//Id from policy_r__interface to remove
	var rule = req.body.rule;
	var interface = req.body.interface;
	var position = req.body.position;
	var old_order = req.body.position_order;

	PolicyRuleToInterface.deletePolicy_r__interface(rule, interface, position, old_order, async (error, data) => {
		if (data) {
			if (data.msg === "deleted") {
				PolicyRule.compilePolicy_r(rule, (error, datac) => {});

				// If after the delete we have empty rule positions, then remove them from the negate position list.
				try {
					await PolicyRule.allowEmptyRulePositions(req);
				} catch(error) { 
					logger().error('Error removing policy_r__interface: ' + JSON.stringify(error));
					return res.status(400).json(error);
				}

				res.status(200).json(data);
			} else if (data.msg === "notExist") {
				logger().error('Error removing policy_r__interface: ' + JSON.stringify(fwcError.NOT_FOUND));
				res.status(400).json(fwcError.NOT_FOUND);
			}
			else {
				logger().error('Error removing policy_r__interface: ' + JSON.stringify(error));
				res.status(400).json(error);
			}
		} else {
			logger().error('Error removing policy_r__interface: ' + JSON.stringify(error));
			res.status(400).json(error);
		}
	});
});

module.exports = router;