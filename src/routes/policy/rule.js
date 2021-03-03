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
import { PolicyRule } from '../../models/policy/PolicyRule';
import { PolicyRuleToIPObj } from '../../models/policy/PolicyRuleToIPObj';
import { PolicyRuleToInterface } from '../../models/policy/PolicyRuleToInterface';
import { PolicyRuleToOpenVPNPrefix } from '../../models/policy/PolicyRuleToOpenVPNPrefix';
import { PolicyPosition } from '../../models/policy/PolicyPosition';
import { PolicyRuleToOpenVPN } from '../../models/policy/PolicyRuleToOpenVPN';
import { In, getCustomRepository } from 'typeorm';
import { logger } from '../../fonaments/abstract-application';
import { PolicyRuleRepository } from '../../models/policy/policy-rule.repository';
import { PolicyGroupRepository } from '../../repositories/PolicyGroupRepository'
const app = require('../../fonaments/abstract-application').app;
var utilsModel = require("../../utils/utils.js");
const fwcError = require('../../utils/error_table');

/* Create New policy_r */
router.post("/",
utilsModel.disableFirewallCompileStatus,
async (req, res) => {
	//Create New objet with data policy_r
	var policy_rData = {
		id: null,
		idgroup: req.body.idgroup,
		firewall: req.body.firewall,
		rule_order: req.body.rule_order,
		action: req.body.action,
		time_start: req.body.time_start,
		time_end: req.body.time_end,
		active: req.body.active,
		options: req.body.options,
		comment: req.body.comment,
		type: req.body.type,
		style: req.body.style,
		fw_apply_to: req.body.fw_apply_to
	};

	try {
		await PolicyRule.reorderAfterRuleOrder(req.dbCon, req.body.firewall, req.body.type, req.body.rule_order);
		res.status(200).json(await PolicyRule.insertPolicy_r(policy_rData));
	} catch(error) {
		logger().error('Error creating a rule: ' + JSON.stringify(error));
		res.status(400).json(error);
	}
});

/* Update policy_r that exist */
router.put('/',
utilsModel.disableFirewallCompileStatus,
async (req, res) => {
	//Save data into object
	var policy_rData = {
		id: req.body.rule,
		idgroup: req.body.idgroup,
		firewall: req.body.firewall,
		rule_order: req.body.rule_order,
		options: req.body.options,
		action: req.body.action,
		time_start: req.body.time_start,
		time_end: req.body.time_end,
		comment: req.body.comment,
		active: req.body.active,
		type: req.body.type,
		style: req.body.style,
		fw_apply_to: req.body.fw_apply_to,
		options: req.body.options,
		mark: (req.body.mark===0) ? null : req.body.mark
	};

	try {
		// Only allow Iptables marks in INPUT, OUTPUT and FORWARD chains for IPv4 and IPv6 filter tables.
		if (policy_rData.mark && policy_rData.type!==1 && policy_rData.type!==2 && policy_rData.type!==3
				&& policy_rData.type!==61 && policy_rData.type!==62 && policy_rData.type!==63)
			throw fwcError.NOT_ALLOWED;

		const rule_data = await PolicyRule.getPolicy_r(req.dbCon, req.body.firewall, req.body.rule);
		// For the catch-all special rule only allow the actions ACCEPT (1), DENY (2) and REJECT (3);
		if (rule_data.special===2 && req.body.action && req.body.action!==1 && req.body.action!==2 && req.body.action!==3)
			throw fwcError.NOT_ALLOWED;

		await PolicyRule.updatePolicy_r(req.dbCon, policy_rData);
	} catch(error) {
		logger().error('Error updating a rule: ' + JSON.stringify(error));
		return res.status(400).json(error);
	}

	res.status(204).end();
});


/* Get all policy_rs by firewall and type */
router.put('/type/get', async (req, res) => {
	try {
		const policy = await PolicyRule.getPolicyData(req);
		res.status(200).json(policy);
	} catch(error) {
		logger().error('Error finding a rule: ' + JSON.stringify(error));
		res.status(400).json(error)
	}
});

/* Get policy rules by firewall type and rules group */
router.put('/type/ingroup/get', async (req, res) => {
	try {
		const policy = await PolicyRule.getPolicyData(req);
		res.status(200).json(policy);
	} catch(error) {
		logger().error('Error finding a rule: ' + JSON.stringify(error));
		res.status(400).json(error)
	}
});

/* Get all policy_rs by firewall and type but don't expand group contents */
router.put('/type/grouped/get', async (req, res) => {
	try {
		const policy = await PolicyRule.getPolicyData(req, true);
		res.status(200).json(policy);
	} catch(error) {
		logger().error('Error finding a rule: ' + JSON.stringify(error));
		res.status(400).json(error)
	}
});


/* Get all policy_rs by firewall and type and Rule */
router.put('/get', async (req, res) => {
	try {
		const policy = await PolicyRule.getPolicyData(req);
		//If exists policy_r get data
		if (policy && policy.length > 0) 
			res.status(200).json(policy[0]);
		else
			res.status(204).end();
	} catch(error) {
		logger().error('Error finding a rule by firewall and type and rule: ' + JSON.stringify(error));
		res.status(400).json(error);
	}
});


/* Get all policy_rs by firewall and type and Rule */
router.put('/full/get', async (req, res) => {
	try { 
		const data = await PolicyRule.getPolicyDataDetailed(req.body.fwcloud, req.body.firewall, req.body.type, req.body.rule);
		if (data && data.length > 0) 
			res.status(200).json(data);
		else
			res.status(204).end();
	} catch(error) {
		logger().error('Error finding a rule by firewall and type and rule: ' + JSON.stringify(error));
		res.status(400).json(error);
	}
});


/* Remove policy_r */
router.put('/del',
utilsModel.disableFirewallCompileStatus,
async (req, res) => {
	try {
		for (let rule of req.body.rulesIds) {
			await PolicyRule.deletePolicy_r(req.body.firewall, rule);
		}

		res.status(204).end();
	} catch(error) {
		logger().error('Error removing a rule: ' + JSON.stringify(error));
		res.status(400).json(error);
	}
});


/* Update Active policy_r  */
router.put('/active',
utilsModel.disableFirewallCompileStatus,
async (req, res) => {
	const policyRuleRepository = getCustomRepository(PolicyRuleRepository);
	rules = await policyRuleRepository.find({
		where: {
			id: In(req.body.rulesIds),
			firewallId: req.body.firewall,
			policyTypeId: req.body.type
		}
	});
	const active = req.body.active !== 1 ? 0 : req.body.active;

	try {
		await policyRuleRepository.updateActive(rules, active)
		res.status(204).end();
	} catch(error) {
		logger().error('Error updating activation rule flag: ' + JSON.stringify(error));
		res.status(400).json(error);
	}
});


/* Update Style policy_r  */
router.put('/style',
utilsModel.disableFirewallCompileStatus,
async (req, res) => {
	const policyRuleRepository = getCustomRepository(PolicyRuleRepository);
	var style = req.body.style;
	var policyRules = await policyRuleRepository.find({where: {id: In(req.body.rulesIds)}});

	try {
		await policyRuleRepository.updateStyle(policyRules, style);
		res.status(204).end();
	} catch(error) {
		logger().error('Error updating rule style: ' + JSON.stringify(error));
		res.status(400).json(error);
	}
});


/* Copy RULES */
router.put('/copy',
utilsModel.disableFirewallCompileStatus,
async (req, res) => {
	try {
		let pasteOnRuleId = req.body.pasteOnRuleId;
		for (let rule of req.body.rulesIds)
			pasteOnRuleId = await ruleCopy(req.dbCon, req.body.firewall, rule, ((req.body.pasteOffset===1)?pasteOnRuleId:req.body.pasteOnRuleId), req.body.pasteOffset);
		res.status(204).end();
	} catch(error) {
		logger().error('Error copying rule: ' + JSON.stringify(error));
		res.status(400).json(error);
	}
});

/* Move RULES */
router.put('/move',
utilsModel.disableFirewallCompileStatus,
async (req, res) => {
	try {
		let pasteOnRuleId = req.body.pasteOnRuleId;

		// The rule over which we move cat rules can not be part of the moved rules.
		for (let rule of req.body.rulesIds)
			if (rule === pasteOnRuleId) throw(fwcError.other('Paste on rule can not be part of the set of pasted rules.'));

		for (let rule of req.body.rulesIds)
			await ruleMove(req.dbCon, req.body.firewall, rule, ((req.body.pasteOffset===1)?pasteOnRuleId:req.body.pasteOnRuleId), req.body.pasteOffset);

		res.status(204).end();
	} catch(error) {
		logger().error('Error moving rule: ' + JSON.stringify(error));
		res.status(400).json(error);
	}
});


/* Negate/allow policy rule position */
router.put(['/position/negate','/position/allow'],
utilsModel.disableFirewallCompileStatus,
async (req, res) => {
	try {
		const position = req.body.position;

		// Verify that the route position id is correct for the policy type of the rule.
		if (!(await PolicyPosition.checkPolicyRulePosition(req.dbCon,req.body.rule,position)))
			throw fwcError.NOT_FOUND;

		/* This kind of position can not be negated:
		| 14 | Translated Source      |
		| 16 | Translated Service     |
		| 34 | Translated Destination |
		| 35 | Translated Service     |
		*/
		if (position===14 || position===16 || position===34 || position===35)
			throw fwcError.NOT_ALLOWED;
		
		if (req.url==='/position/negate')
			await PolicyRule.negateRulePosition(req.dbCon,req.body.firewall,req.body.rule,position); // Negate the rule position adding the rule position id to the negate list.
		else
			await PolicyRule.allowRulePosition(req.dbCon,req.body.firewall,req.body.rule,position); // Allow the rule position.

		// Recompile the rule.
		var accessData = { sessionID: req.sessionID, iduser: req.session.user_id, fwcloud: req.body.fwcloud, idfirewall: req.body.firewall, rule: req.body.rule };

		res.status(204).end();
	} catch(error) { 
		logger().error('Error negating/allowing rule: ' + JSON.stringify(error));
		res.status(400).json(error);
	}
});

function ruleCopy(dbCon, firewall, rule, pasteOnRuleId, pasteOffset) {
	return new Promise(async (resolve, reject) => {
		try {
			// Get rule data of rule over which we are running the copy action (up or down of this rule).
			const pasteOnRule = await PolicyRule.getPolicy_r(dbCon, firewall, pasteOnRuleId);
			const copyRule = await PolicyRule.getPolicy_r(dbCon, firewall, rule);
			let new_order, newRuleId;

			// We can not copy the Catch-All special rule.
			if (copyRule.special===2) throw(fwcError.NOT_ALLOWED);
			// It is not possible to copy rules under the Catch-All special rule.
			if (pasteOnRule.special===2 && pasteOffset===1) throw(fwcError.NOT_ALLOWED);

			if (pasteOffset===1)
				new_order = await PolicyRule.makeAfterRuleOrderGap(firewall, copyRule.type, pasteOnRuleId);
			else
				new_order = await PolicyRule.makeBeforeRuleOrderGap(firewall, copyRule.type, pasteOnRuleId);

			//Create New objet with data policy_r
			var policy_rData = {
				id: null,
				idgroup: pasteOnRule.idgroup,
				firewall: copyRule.firewall,
				rule_order: new_order,
				action: copyRule.action,
				time_start: copyRule.time_start,
				time_end: copyRule.time_end,
				active: copyRule.active,
				options: copyRule.options,
				comment: copyRule.comment,
				type: copyRule.type,
				style: copyRule.style
			};
			newRuleId = await PolicyRule.insertPolicy_r(policy_rData);

			//DUPLICATE RULE POSITONS O (OBJECTS)
			await PolicyRuleToIPObj.duplicatePolicy_r__ipobj(dbCon, rule, newRuleId);
			//DUPLICATE RULE POSITONS I (INTERFACES)
			await PolicyRuleToInterface.duplicatePolicy_r__interface(dbCon, rule, newRuleId);
			//DUPLICATE RULE POSITONS FOR OpenVPN OBJECTS
			await PolicyRuleToOpenVPN.duplicatePolicy_r__openvpn(dbCon, rule, newRuleId);
			//DUPLICATE RULE POSITONS FOR PREFIX OBJECTS
			await PolicyRuleToOpenVPNPrefix.duplicatePolicy_r__prefix(dbCon, rule, newRuleId);

			resolve(newRuleId);
		} catch(error) { return reject(error) }
	});
}

async function ruleMove(dbCon, firewall, rule, pasteOnRuleId, pasteOffset) {
	return new Promise(async (resolve, reject) => {
		try {
			// Get rule data of rule over which we are running the move action (up or down of this rule).
			const pasteOnRule = await PolicyRule.getPolicy_r(dbCon, firewall, pasteOnRuleId);
			// Get rule data for the rule we are moving.
			const moveRule = await PolicyRule.getPolicy_r(dbCon, firewall, rule);
			let new_order;

			// We can not move the Catch-All special rule.
			if (moveRule.special===2) throw(fwcError.NOT_ALLOWED);
			// It is not possible to move rules under the Catch-All special rule.
			if (pasteOnRule.special===2 && pasteOffset===1) throw(fwcError.NOT_ALLOWED);

			if (pasteOffset===1)
				new_order = await PolicyRule.makeAfterRuleOrderGap(firewall, moveRule.type, pasteOnRuleId);
			else if (pasteOffset===-1)
				new_order = await PolicyRule.makeBeforeRuleOrderGap(firewall, moveRule.type, pasteOnRuleId);
			else // Move rule into group.
				new_order = moveRule.rule_order;

			//Update the moved rule data
			var policy_rData = {
				id: rule,
				idgroup: pasteOnRule.idgroup,
				rule_order: new_order
			};
			await PolicyRule.updatePolicy_r(dbCon, policy_rData);
			

			// If we have moved rule from a group, if the group is empty remove de rules group from the database.
			if (pasteOffset!=0 && moveRule.idgroup) {
				const policyGroup = await getCustomRepository(PolicyGroupRepository).findOne(moveRule.idgroup);
				if (policyGroup) {
					await getCustomRepository(PolicyGroupRepository).deleteIfEmpty(policyGroup);
				}
			}

			resolve();
		} catch(error) { return reject(error) }
	});
}

module.exports = router;