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
import { PolicyPosition } from '../../models/policy/PolicyPosition';
import { In } from 'typeorm';
import { logger } from '../../fonaments/abstract-application';
import { PolicyRuleRepository } from '../../models/policy/policy-rule.repository';
import db from '../../database/database-manager';
var utilsModel = require("../../utils/utils.js");
const fwcError = require('../../utils/error_table');

/* Create New policy_r */
router.post("/",
utilsModel.disableFirewallCompileStatus,
async (req, res) => {
	//Create New objet with data policy_r
	const policy_rData = {
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
		fw_apply_to: req.body.fw_apply_to,
		run_before: req.body.run_before,
		run_after: req.body.run_after,
		special: req.body.special ? req.body.special : 0
	};

	try {
		const { pasteOnRuleId, pasteOffset } = req.body;
		const position = pasteOnRuleId === undefined ? undefined : { ruleId: pasteOnRuleId, offset: pasteOffset };
		const repository = new PolicyRuleRepository(db.getSource().manager);
		res.status(200).json(await repository.createRule(policy_rData, position));
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
	const policy_rData = {
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
		mark: (req.body.mark===0) ? null : req.body.mark,
		run_before: req.body.run_before,
		run_after: req.body.run_after
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
		const policy = await PolicyRule.getPolicyData('grid', req.dbCon, req.body.fwcloud, req.body.firewall, req.body.type, null, null);
		res.status(200).json(policy);
	} catch(error) {
		logger().error('Error finding a rule: ' + JSON.stringify(error));
		res.status(400).json(error)
	}
});

/* Get policy rules by firewall type and rules group */
router.put('/type/ingroup/get', async (req, res) => {
	try {
		const policy = await PolicyRule.getPolicyData('grid', req.dbCon, req.body.fwcloud, req.body.firewall, req.body.type, null, req.body.idgroup);
		res.status(200).json(policy);
	} catch(error) {
		logger().error('Error finding a rule: ' + JSON.stringify(error));
		res.status(400).json(error)
	}
});

/* Get all policy_rs by firewall and type but don't expand group contents */
router.put('/type/grouped/get', async (req, res) => {
	try {
		const policy = await PolicyRule.getPolicyData('grid', req.dbCon, req.body.fwcloud, req.body.firewall, req.body.type, null, null, true);
		res.status(200).json(policy);
	} catch(error) {
		logger().error('Error finding a rule: ' + JSON.stringify(error));
		res.status(400).json(error)
	}
});


/* Get all policy_rs by firewall and type and Rule */
router.put('/get', async (req, res) => {
	try {
		const policy = await PolicyRule.getPolicyData('grid', req.dbCon, req.body.fwcloud, req.body.firewall, req.body.type, [req.body.rule], null);
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
		const data = await PolicyRule.getPolicyData('grid', req.dbCon, req.body.fwcloud, req.body.firewall, req.body.type, [req.body.rule], null);
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
	const policyRuleRepository = new PolicyRuleRepository(db.getSource().manager);
	const rules = await policyRuleRepository.find({
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
	const policyRuleRepository = new PolicyRuleRepository(db.getSource().manager);
	const style = req.body.style;
	const policyRules = await policyRuleRepository.find({where: {id: In(req.body.rulesIds)}});

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
		const { firewall, rulesIds, pasteOnRuleId, pasteOffset, idgroup } = req.body;
		const repository = new PolicyRuleRepository(db.getSource().manager);
		await repository.copyRules(firewall, rulesIds, pasteOnRuleId, pasteOffset, idgroup);
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
		const { firewall, rulesIds, pasteOnRuleId, pasteOffset, idgroup } = req.body;
		const repository = new PolicyRuleRepository(db.getSource().manager);
		await repository.moveRules(firewall, rulesIds, pasteOnRuleId, pasteOffset, idgroup);
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

module.exports = router;
