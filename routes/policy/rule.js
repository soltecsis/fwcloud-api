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
var policy_rModel = require('../../models/policy/policy_r');
var Policy_gModel = require('../../models/policy/policy_g');
var policy_r__ipobjModel = require('../../models/policy/policy_r__ipobj');
const policy_r__interfaceModel = require('../../models/policy/policy_r__interface');
const policyOpenvpnModel = require('../../models/policy/openvpn');
const policyPrefixModel = require('../../models/policy/prefix');
const policyPositionModel = require('../../models/policy/position');
var db = require('../../db.js');
var utilsModel = require("../../utils/utils.js");
const fwcError = require('../../utils/error_table');
var logger = require('log4js').getLogger("app");

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
		await policy_rModel.reorderAfterRuleOrder(req.dbCon, req.body.firewall, req.body.type, req.body.rule_order);
		res.status(200).json(await policy_rModel.insertPolicy_r(policy_rData));
	} catch(error) { res.status(400).json(error) }
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

		const rule_data = await policy_rModel.getPolicy_r(req.dbCon, req.body.firewall, req.body.rule);
		// For the catch-all special rule only allow the actions ACCEPT (1), DENY (2) and REJECT (3);
		if (rule_data.special===2 && req.body.action && req.body.action!==1 && req.body.action!==2 && req.body.action!==3)
			throw fwcError.NOT_ALLOWED;

		await policy_rModel.updatePolicy_r(req.dbCon, policy_rData);
	} catch(error) { return res.status(400).json(error) }

	// Recompile rule.
	var accessData = {
		sessionID: req.sessionID,
		iduser: req.session.user_id,
		fwcloud: req.body.fwcloud,
		idfirewall: req.body.firewall,
		rule: policy_rData.id
	};
	policy_rModel.compilePolicy_r(accessData, (error, datac) => {
		if (error) return res.status(400).json(error);
		res.status(200).json(datac);
	});
});


/* Get all policy_rs by firewall and type */
router.put('/type/get', async (req, res) => {
	try {
		const policy = await policy_rModel.getPolicyData(req);
		res.status(200).json(policy);
	} catch(error) { res.status(400).json(error) }
});


/* Get all policy_rs by firewall and type and Rule */
router.put('/get', async (req, res) => {
	try {
		const policy = await policy_rModel.getPolicyData(req);
		//If exists policy_r get data
		if (policy && policy.length > 0) 
			res.status(200).json(policy[0]);
		else
			res.status(204).end();
	} catch(error) { res.status(400).json(error) }
});


/* Get all policy_rs by firewall and type and Rule */
router.put('/full/get', async (req, res) => {
	try { 
		const data = await policy_rModel.getPolicyDataDetailed(req.body.fwcloud, req.body.firewall, req.body.type, req.body.rule);
		if (data && data.length > 0) 
			res.status(200).json(data);
		else
			res.status(204).end();
	} catch(error) { res.status(400).json(error) }
});


/* Remove policy_r */
router.put('/del',
utilsModel.disableFirewallCompileStatus,
async (req, res) => {
	try {
		for (let rule of req.body.rulesIds) {
			await policy_rModel.deletePolicy_r(req.body.firewall, rule);
		}

		res.status(204).end();
	} catch(error) { res.status(400).json(error) }
});


/* Update Active policy_r  */
router.put('/active',
utilsModel.disableFirewallCompileStatus,
(req, res) => {
	//Save data into object
	var idfirewall = req.body.firewall;
	var type = req.body.type;
	var active = req.body.active;
	var rulesIds = req.body.rulesIds;
	if (active !== 1)
		active = 0;
	db.lockTableCon("policy_r", " WHERE firewall=" + idfirewall + " AND type=" + type, function() {
		db.startTXcon(function() {
			for (var rule of rulesIds) {
				policy_rModel.updatePolicy_r_Active(idfirewall, rule, type, active, function(error, data) {
					if (error)
						logger.debug("ERROR UPDATING ACTIVE STATUS for RULE: " + rule + "  Active: " + active);
					if (data && data.result) {
						logger.debug("UPDATED ACTIVE STATUS for RULE: " + rule + "  Active: " + active);
					} else
						logger.debug("NOT UPDATED ACTIVE STATUS for RULE: " + rule + "  Active: " + active);
				});
			}
			db.endTXcon(function() {});
		});
		res.status(204).end();
	});
});


/* Update Style policy_r  */
router.put('/style',
utilsModel.disableFirewallCompileStatus,
(req, res) => {
	var style = req.body.style;
	var rulesIds = req.body.rulesIds;
	db.lockTableCon("policy_r", " WHERE firewall=" + req.body.firewall + " AND type=" + req.body.type, () => {
		db.startTXcon(function() {
			for (var rule of rulesIds) {
				policy_rModel.updatePolicy_r_Style(req.body.firewall, rule, req.body.type, style, (error, data) => {
					if (error)
						logger.debug("ERROR UPDATING STYLE for RULE: " + rule + "  STYLE: " + style);
					if (data && data.result) {
						logger.debug("UPDATED STYLE for RULE: " + rule + "  STYLE: " + style);
					} else
						logger.debug("NOT UPDATED STYLE for RULE: " + rule + "  STYLE: " + style);
				});
			}
			db.endTXcon(function() {});
		});
	});
	res.status(204).end();
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
	} catch(error) { res.status(400).json(error) }
});

/* Move RULES */
router.put('/move',
utilsModel.disableFirewallCompileStatus,
async (req, res) => {
	try {
		let pasteOnRuleId = req.body.pasteOnRuleId;

		// The rule over wich we move cuted rules can not be part of the moved rules.
		for (let rule of req.body.rulesIds)
			if (rule === pasteOnRuleId) throw(fwcError.other('Paste on rule can not be part of the set of pasted rules.'));

		for (let rule of req.body.rulesIds)
			await ruleMove(req.dbCon, req.body.firewall, rule, ((req.body.pasteOffset===1)?pasteOnRuleId:req.body.pasteOnRuleId), req.body.pasteOffset);

		res.status(204).end();
	} catch(error) { res.status(400).json(error) }
});


/* Negate/allow policy rule position */
router.put(['/position/negate','/position/allow'],
utilsModel.disableFirewallCompileStatus,
async (req, res) => {
	try {
		const position = req.body.position;

		// Verify that the route position id is correct for the policy type of the rule.
		if (!(await policyPositionModel.checkPolicyRulePosition(req.dbCon,req.body.rule,position)))
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
			await policy_rModel.negateRulePosition(req.dbCon,req.body.firewall,req.body.rule,position); // Negate the rule position adding the rule position id to the negate list.
		else
			await policy_rModel.allowRulePosition(req.dbCon,req.body.firewall,req.body.rule,position); // Allow the rule position.

		// Recompile the rule.
		var accessData = { sessionID: req.sessionID, iduser: req.session.user_id, fwcloud: req.body.fwcloud, idfirewall: req.body.firewall, rule: req.body.rule };
		policy_rModel.compilePolicy_r(accessData, (error, datac) => {});

		res.status(204).end();
	} catch(error) { res.status(400).json(error) }
});

function ruleCopy(dbCon, firewall, rule, pasteOnRuleId, pasteOffset) {
	return new Promise(async (resolve, reject) => {
		try {
			// Get rule data of rule over which we are running the copy action (up or down of this rule).
			const pasteOnRule = await policy_rModel.getPolicy_r(dbCon, firewall, pasteOnRuleId);
			const copyRule = await policy_rModel.getPolicy_r(dbCon, firewall, rule);
			let new_order, newRuleId;

			// We can not copy the Catch-All special rule.
			if (copyRule.special===2) throw(fwcError.NOT_ALLOWED);
			// It is not possible to copy rules under the Catch-All special rule.
			if (pasteOnRule.special===2 && pasteOffset===1) throw(fwcError.NOT_ALLOWED);

			if (pasteOffset===1)
				new_order = await policy_rModel.makeAfterRuleOrderGap(firewall, copyRule.type, pasteOnRuleId);
			else
				new_order = await policy_rModel.makeBeforeRuleOrderGap(firewall, copyRule.type, pasteOnRuleId);

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
				type: copyRule.type
			};
			newRuleId = await policy_rModel.insertPolicy_r(policy_rData);

			//DUPLICATE RULE POSITONS O (OBJECTS)
			await policy_r__ipobjModel.duplicatePolicy_r__ipobj(dbCon, rule, newRuleId);
			//DUPLICATE RULE POSITONS I (INTERFACES)
			await policy_r__interfaceModel.duplicatePolicy_r__interface(dbCon, rule, newRuleId);
			//DUPLICATE RULE POSITONS FOR OpenVPN OBJECTS
			await policyOpenvpnModel.duplicatePolicy_r__openvpn(dbCon, rule, newRuleId);
			//DUPLICATE RULE POSITONS FOR PREFIX OBJECTS
			await policyPrefixModel.duplicatePolicy_r__prefix(dbCon, rule, newRuleId);

			resolve(newRuleId);
		} catch(error) { return reject(error) }
	});
}

function ruleMove(dbCon, firewall, rule, pasteOnRuleId, pasteOffset) {
	return new Promise(async (resolve, reject) => {
		try {
			// Get rule data of rule over which we are running the move action (up or down of this rule).
			const pasteOnRule = await policy_rModel.getPolicy_r(dbCon, firewall, pasteOnRuleId);
			// Get rule data for the rule we are moving.
			const moveRule = await policy_rModel.getPolicy_r(dbCon, firewall, rule);
			let new_order;

			// We can not move the Catch-All special rule.
			if (moveRule.special===2) throw(fwcError.NOT_ALLOWED);
			// It is not possible to move rules under the Catch-All special rule.
			if (pasteOnRule.special===2 && pasteOffset===1) throw(fwcError.NOT_ALLOWED);

			if (pasteOffset===1)
				new_order = await policy_rModel.makeAfterRuleOrderGap(firewall, moveRule.type, pasteOnRuleId);
			else if (pasteOffset===-1)
				new_order = await policy_rModel.makeBeforeRuleOrderGap(firewall, moveRule.type, pasteOnRuleId);
			else // Move rule into group.
				new_order = moveRule.rule_order;

			//Update the moved rule data
			var policy_rData = {
				id: rule,
				idgroup: pasteOnRule.idgroup,
				rule_order: new_order
			};
			await policy_rModel.updatePolicy_r(dbCon, policy_rData);
			
			// If we have moved rule from a group, if the group is empty remove de rules group from the database.
			if (pasteOffset!=0 && moveRule.idgroup)
				await Policy_gModel.deleteIfEmptyPolicy_g(dbCon, firewall, moveRule.idgroup);

			resolve();
		} catch(error) { return reject(error) }
	});
}

module.exports = router;