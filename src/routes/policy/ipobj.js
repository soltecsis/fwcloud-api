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
import { PolicyRuleToIPObj } from '../../models/policy/PolicyRuleToIPObj';
import { PolicyRuleToInterface } from '../../models/policy/PolicyRuleToInterface';
import { PolicyRule } from '../../models/policy/PolicyRule';
import { Firewall } from '../../models/firewall/Firewall';
import { logger } from '../../fonaments/abstract-application';
const fwcError = require('../../utils/error_table');

var utilsModel = require("../../utils/utils.js");


/* Create New policy_r__ipobj */
router.post("/",
utilsModel.disableFirewallCompileStatus,
async (req, res) => {
	//Create New objet with data policy_r__ipobj
	var policy_r__ipobjData = {
		rule: req.body.rule,
		ipobj: req.body.ipobj,
		ipobj_g: req.body.ipobj_g,
		interface: req.body.interface,
		position: req.body.position,
		position_order: req.body.position_order
	};

	/* Before inserting the new IP object into the rule, verify that there is no container in the 
	destination position that already contains it. */

	try {
		// Don't allow to put in positions with O content empty object containers (interfaces, hosts, groups, etc.)
		if (await PolicyRuleToIPObj.emptyIpobjContainerToObjectPosition(req))
			throw fwcError.IPOBJ_EMPTY_CONTAINER;

		if (await PolicyRuleToIPObj.checkExistsInPosition(policy_r__ipobjData))
			throw fwcError.ALREADY_EXISTS;

		// Depending on the IP version of the policy_type of the rule we are working on, verify that we have root objects 
		// of this IP version in the object that we are moving to this rule position.
		if (!(await PolicyRuleToIPObj.checkIpVersion(req)))
			throw fwcError.IPOBJ_BAD_IP_VERSION;

		await PolicyRuleToIPObj.insertPolicy_r__ipobj(policy_r__ipobjData);
		res.status(204).end();
	} catch(error) {
		logger().error('Error creating ipobj: ' + JSON.stringify(error));
		res.status(400).json(error);
	}
});


/* Update POSITION policy_r__ipobj that exist */
router.put('/move',
utilsModel.disableFirewallCompileStatus,
async (req, res) => {
	var firewall = req.body.firewall;
	var rule = req.body.rule;
	var ipobj = req.body.ipobj;
	var ipobj_g = req.body.ipobj_g;
	var interface = req.body.interface;
	var position = req.body.position;
	var position_order = req.body.position_order;
	var new_rule = req.body.new_rule;
	var new_position = req.body.new_position;
	var new_order = req.body.new_order;

	var accessData = {
		sessionID: req.sessionID,
		iduser: req.session.user_id,
		fwcloud: req.body.fwcloud,
		idfirewall: firewall,
		rule: rule
	};

	//logger().debug("POLICY_R-IPOBJS MOVING FROM POSITION " + position + "  TO POSITION: " + new_position);

	var policy_r__ipobjData = {
		rule: new_rule,
		ipobj: ipobj,
		ipobj_g: ipobj_g,
		interface: interface,
		position: new_position,
		position_order: new_order
	};

	try {
		await Firewall.updateFirewallStatus(req.body.fwcloud,firewall,"|3");

		if (await PolicyRuleToIPObj.checkExistsInPosition(policy_r__ipobjData))
			throw fwcError.ALREADY_EXISTS;

		// Get positions content.
		const psts = await PolicyRuleToIPObj.getPositionsContent(req.dbCon, position, new_position);

		if (psts.content1 === psts.content2) { // MOVE BETWEEN POSITIONS WITH THE SAME CONTENT TYPE
			await PolicyRuleToIPObj.updatePolicy_r__ipobj_position(req.dbCon,rule, ipobj, ipobj_g, interface, position, position_order, new_rule, new_position, new_order);
		} else if (psts.content1 === 'I' && psts.content2 === 'O') { // MOVE BETWEEN POSITIONS WITH DIFFERENT CONTENT TYPE
			//Create New Position 'O'
			//Create New objet with data policy_r__ipobj
			var policy_r__ipobjData = {
				rule: new_rule,
				ipobj: ipobj,
				ipobj_g: ipobj_g,
				interface: interface,
				position: new_position,
				position_order: new_order
			};

			await PolicyRuleToIPObj.insertPolicy_r__ipobj(policy_r__ipobjData);
			await PolicyRuleToInterface.deletePolicy_r__interface(req.dbCon, rule, interface, position, position_order);
		}	else { // NOT ALLOWED TO MOVE BETWEEN THESE POSITIONS BECAUSE THE CONTENT TYPE
			throw fwcError.NOT_ALLOWED;
		}

		// If after the move we have empty rule positions, then remove them from the negate position list.
		await PolicyRule.allowEmptyRulePositions(req);
	} catch(error) {
		logger().error('Error updating ipobj position: ' + JSON.stringify(error));
		return res.status(400).json(error);
	}

	if (accessData.rule != new_rule) {
		accessData.rule = new_rule;
	}

	res.status(204).end();
});

/* Update ORDER policy_r__ipobj that exist */
router.put('/order',
utilsModel.disableFirewallCompileStatus,
(req, res) => {
	var rule = req.body.rule;
	var ipobj = req.body.ipobj;
	var ipobj_g = req.body.ipobj_g;
	var interface = req.body.interface;
	var position = req.body.position;
	var position_order = req.body.position_order;
	var new_order = req.body.new_order;

	PolicyRuleToIPObj.updatePolicy_r__ipobj_position_order(rule, ipobj, ipobj_g, interface, position, position_order, new_order, (error, data) => {
		if (error) return res.status(400).json(error);
		//If saved policy_r__ipobj saved ok, get data
		if (data && data.result) {
			var accessData = { sessionID: req.sessionID, iduser: req.session.user_id, fwcloud: req.body.fwcloud, idfirewall: req.body.firewall, rule: rule };
			res.status(200).json(data);
		} else {
			logger().error('Error updating ipobj order: ' + JSON.stringify(fwcError.NOT_FOUND));
			res.status(400).json(fwcError.NOT_FOUND);
		}
	});
});


/* Get all policy_r__ipobjs by rule*/
router.put('/get', (req, res) => {
	PolicyRuleToIPObj.getPolicy_r__ipobjs(req.body.rule, (error, data) => {
		//If exists policy_r__ipobj get data
    if (data && data.length > 0)
      res.status(200).json(data);
    else
			res.status(204).end();
	});
});


/* Remove policy_r__ipobj */
router.put("/del",
utilsModel.disableFirewallCompileStatus,
async (req, res) => {
	//Id from policy_r__ipobj to remove
	var rule = req.body.rule;
	var ipobj = req.body.ipobj;
	var ipobj_g = req.body.ipobj_g;
	var interface = req.body.interface;
	var position = req.body.position;
	var position_order = req.body.position_order;

	try {
		await PolicyRuleToIPObj.deletePolicy_r__ipobj(req.dbCon, rule, ipobj, ipobj_g, interface, position, position_order);
		var accessData = { sessionID: req.sessionID, iduser: req.session.user_id, fwcloud: req.body.fwcloud, idfirewall: req.body.firewall, rule: rule };
		// If after the delete we have empty rule positions, then remove them from the negate position list.
		await PolicyRule.allowEmptyRulePositions(req);
		res.status(204).end();
	} catch(error) { 
		logger().error('Error updating removing policy_r__ipobj: ' + JSON.stringify(error));
		return res.status(400).json(error) 
	}
});


module.exports = router;