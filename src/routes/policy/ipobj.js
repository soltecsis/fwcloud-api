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
import { PolicyCompilation } from '../../models/policy/PolicyCompilation';
import { Firewall } from '../../models/firewall/Firewall';
const fwcError = require('../../utils/error_table');

var logger = require('log4js').getLogger("app");
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

		const data = await PolicyRuleToIPObj.insertPolicy_r__ipobj(policy_r__ipobjData);
		//If saved policy_r__ipobj Get data
		if (data && data.result) {
			if (data.result && data.allowed) {
				var accessData = { sessionID: req.sessionID, iduser: req.session.user_id, fwcloud: req.body.fwcloud, idfirewall: req.body.firewall, rule: policy_r__ipobjData.rule };
				PolicyRule.compilePolicy_r(accessData, (error, datac) =>  {});
				res.status(200).json(data);
			} else if (!data.allowed)
				throw fwcError.NOT_ALLOWED;
			else
				throw fwcError.NOT_FOUND;
		}
	} catch(error) { res.status(400).json(error) }
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

	var content1 = 'O',
		content2 = 'O';

	var accessData = {
		sessionID: req.sessionID,
		iduser: req.session.user_id,
		fwcloud: req.body.fwcloud,
		idfirewall: firewall,
		rule: rule
	};

	logger.debug("POLICY_R-IPOBJS  MOVING FROM POSITION " + position + "  TO POSITION: " + new_position);

	var policy_r__ipobjData = {
		rule: new_rule,
		ipobj: ipobj,
		ipobj_g: ipobj_g,
		interface: interface,
		position: new_position,
		position_order: new_order
	};

	try {
		// Invalidate compilation of the affected rules.
		await PolicyCompilation.deletePolicy_c(rule);
		await PolicyCompilation.deletePolicy_c(new_rule);
		await Firewall.updateFirewallStatus(req.body.fwcloud,firewall,"|3");

		if (await PolicyRuleToIPObj.checkExistsInPosition(policy_r__ipobjData))
			throw fwcError.ALREADY_EXISTS;

		// Get positions content.
		const data = await 	PolicyRuleToIPObj.getPositionsContent(req.dbCon, position, new_position);
		content1 = data.content1;
		content2 = data.content2;	
	} catch(error) { return res.status(400).json(error) }

	if (content1 === content2) { //SAME POSITION
		PolicyRuleToIPObj.updatePolicy_r__ipobj_position(rule, ipobj, ipobj_g, interface, position, position_order, new_rule, new_position, new_order, async (error, data) => {
			//If saved policy_r__ipobj saved ok, get data
			if (data) {
				if (data.result) {
					PolicyRule.compilePolicy_r(accessData, (error, datac) => {});
					if (accessData.rule != new_rule) {
						accessData.rule = new_rule;
						PolicyRule.compilePolicy_r(accessData, (error, datac) => {});
					}

					// If after the move we have empty rule positions, then remove them from the negate position list.
					try {
						await PolicyRule.allowEmptyRulePositions(req);
					} catch(error) { return res.status(400).json(error) }

					res.status(200).json(data);
				} else if (!data.allowed) return res.status(400).json(fwcError.NOT_ALLOWED);
				else return res.status(400).json(fwcError.NOT_FOUND);
			} else return res.status(400).json(error);
		});
	} else { //DIFFERENTS POSITIONS
		if (content1 === 'I' && content2 === 'O') {
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

			var data;
			try {
				data = await PolicyRuleToIPObj.insertPolicy_r__ipobj(policy_r__ipobjData);
			} catch(error) { return res.status(400).json(error) }

			//If saved policy_r__ipobj Get data
			if (data) {
				if (data.result) {
					//Delete position 'I'
					PolicyRuleToInterface.deletePolicy_r__interface(rule, interface, position, position_order, async (error, data) => {
						if (data && data.result) {
							PolicyRule.compilePolicy_r(accessData, (error, datac) => {});
							if (accessData.rule != new_rule) {
								accessData.rule = new_rule;
								PolicyRule.compilePolicy_r(accessData, (error, datac) => {});
							}

							// If after the move we have empty rule positions, then remove them from the negate position list.
							try {
								await PolicyRule.allowEmptyRulePositions(req);
							} catch(error) { return res.status(400).json(error) }

							res.status(200).json(data);
						} else return res.status(400).json(error);
					});
				} else if (!data.allowed) return res.status(400).json(fwcError.NOT_ALLOWED);
				else return res.status(400).json(fwcError.NOT_FOUND);
			} else return res.status(400).json(error);
		} else return res.status(400).json(fwcError.NOT_ALLOWED);
	}
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
			PolicyRule.compilePolicy_r(accessData, (error, datac) => {});
			res.status(200).json(data);
		} else 
			res.status(400).json(fwcError.NOT_FOUND);
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
(req, res) => {
	//Id from policy_r__ipobj to remove
	var rule = req.body.rule;
	var ipobj = req.body.ipobj;
	var ipobj_g = req.body.ipobj_g;
	var interface = req.body.interface;
	var position = req.body.position;
	var position_order = req.body.position_order;

	PolicyRuleToIPObj.deletePolicy_r__ipobj(rule, ipobj, ipobj_g, interface, position, position_order, async (error, data) => {
		if (data && data.result) {
			if (data.msg === "deleted") {
				var accessData = { sessionID: req.sessionID, iduser: req.session.user_id, fwcloud: req.body.fwcloud, idfirewall: req.body.firewall, rule: rule };
				PolicyRule.compilePolicy_r(accessData, (error, datac) => {});

				// If after the delete we have empty rule positions, then remove them from the negate position list.
				try {
					await PolicyRule.allowEmptyRulePositions(req);
				} catch(error) { return res.status(400).json(error) }
				
				res.status(200).json(data);
			} else if (data.msg === "notExist") 
				res.status(400).json(fwcError.NOT_FOUND);
		} else res.status(400).json(error);
	});
});


module.exports = router;