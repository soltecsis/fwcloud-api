var express = require('express');
var router = express.Router();
var Policy_rModel = require('../../models/policy/policy_r');
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
		await Policy_rModel.reorderAfterRuleOrder(req.dbCon, req.body.firewall, req.body.type, req.body.rule_order);
		res.status(200).json(await Policy_rModel.insertPolicy_r(policy_rData));
	} catch(error) { res.status(400).json(error) }
});

/* Update policy_r that exist */
router.put('/',
utilsModel.disableFirewallCompileStatus,
async (req, res) => {
	//Save data into object
	var policy_rData = {
		id: req.body.id,
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

		await Policy_rModel.updatePolicy_r(req.dbCon, policy_rData);
	} catch(error) { return res.status(400).json(error) }

	// Recompile rule.
	var accessData = {
		sessionID: req.sessionID,
		iduser: req.session.user_id,
		fwcloud: req.body.fwcloud,
		idfirewall: req.body.firewall,
		rule: policy_rData.id
	};
	Policy_rModel.compilePolicy_r(accessData, (error, datac) => {
		if (error) return res.status(400).json(error);
		res.status(200).json(datac);
	});
});


/* Get all policy_rs by firewall and type */
router.put('/type/get', async (req, res) => {
	try {
		const policy = await Policy_rModel.getPolicyData(req);
		res.status(200).json(policy);
	} catch(error) { res.status(400).json(error) }
});


/* Get all policy_rs by firewall and type and Rule */
router.put('/get', async (req, res) => {
	try {
		const policy = await Policy_rModel.getPolicyData(req);
		//If exists policy_r get data
		if (policy && policy.length > 0) 
			res.status(200).json(policy);
		else
			res.status(204).end();
	} catch(error) { res.status(400).json(error) }
});


/* Get all policy_rs by firewall and type and Rule */
router.put('/full/get', async (req, res) => {
	try { 
		const data = await Policy_rModel.getPolicyDataDetailed(req.body.fwcloud, req.body.firewall, req.body.type, req.body.rule);
		if (data && data.length > 0) 
			res.status(200).json(data);
		else
			res.status(204).end();
	} catch(error) { res.status(400).json(error) }
});


/* Remove policy_r */
router.put("/del",
utilsModel.disableFirewallCompileStatus,
async (req, res) => {
	try {
		for (let rule of req.body.rulesIds) {
			await Policy_rModel.deletePolicy_r(req.body.firewall, rule);
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
				Policy_rModel.updatePolicy_r_Active(idfirewall, rule, type, active, function(error, data) {
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
				Policy_rModel.updatePolicy_r_Style(req.body.firewall, rule, req.body.type, style, (error, data) => {
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
			if (rule.id === pasteOnRuleId) throw(new Error('Paste on rule can not be part of the set of pasted rules.'));

		for (let rule of req.body.rulesIds)
			pasteOnRuleId = await ruleMove(req.dbCon, req.body.firewall, rule, ((req.body.pasteOffset===1)?pasteOnRuleId:req.body.pasteOnRuleId), req.body.pasteOffset);

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
			await Policy_rModel.negateRulePosition(req.dbCon,req.body.firewall,req.body.rule,position); // Negate the rule position adding the rule position id to the negate list.
		else
			await Policy_rModel.allowRulePosition(req.dbCon,req.body.firewall,req.body.rule,position); // Allow the rule position.

		// Recompile the rule.
		var accessData = { sessionID: req.sessionID, iduser: req.session.user_id, fwcloud: req.body.fwcloud, idfirewall: req.body.firewall, rule: req.body.rule };
		Policy_rModel.compilePolicy_r(accessData, (error, datac) => {});

		res.status(204).end();
	} catch(error) { res.status(400).json(error) }
});

function ruleCopy(dbCon, firewall, rule, pasteOnRuleId, pasteOffset) {
	return new Promise((resolve, reject) => {
		// Get rule data of rule over which we are running the copy action (up or down of this rule).
		Policy_rModel.getPolicy_r(firewall, pasteOnRuleId, (error, pasteOnRule) => {
			if (error) return reject(error);

			if (pasteOnRule && pasteOnRule.length > 0) {
				// Get rule data for the rule we are copying.
				Policy_rModel.getPolicy_r(firewall, rule, async (error, copyRule) => {
					if (error) return reject(error);

					//If exists policy_r get data
					let new_order, newRuleId;
					if (copyRule && copyRule.length > 0) {
						try {
							if (pasteOffset===1)
								new_order = await Policy_rModel.makeAfterRuleOrderGap(firewall, copyRule[0].type, pasteOnRuleId);
							else
								new_order = await Policy_rModel.makeBeforeRuleOrderGap(firewall, copyRule[0].type, pasteOnRuleId);

							//Create New objet with data policy_r
							var policy_rData = {
								id: null,
								idgroup: pasteOnRule[0].idgroup,
								firewall: copyRule[0].firewall,
								rule_order: new_order,
								action: copyRule[0].action,
								time_start: copyRule[0].time_start,
								time_end: copyRule[0].time_end,
								active: copyRule[0].active,
								options: copyRule[0].options,
								comment: copyRule[0].comment,
								type: copyRule[0].type
							};
							newRuleId = await Policy_rModel.insertPolicy_r(policy_rData);

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
					} else return reject(fwcError.NOT_FOUND);
				});
			} else return reject(fwcError.NOT_FOUND);
		});
	});
}

function ruleMove(dbCon, firewall, rule, pasteOnRuleId, pasteOffset) {
	return new Promise((resolve, reject) => {
		// Get rule data of rule over which we are running the move action (up or down of this rule).
		Policy_rModel.getPolicy_r(firewall, pasteOnRuleId, (error, pasteOnRule) => {
			if (error) return reject(error);

			if (pasteOnRule && pasteOnRule.length > 0) {
				// Get rule data for the rule we are moving.
				Policy_rModel.getPolicy_r(firewall, rule, async (error, moveRule) => {
					if (error) return reject(error);

					let new_order;
					if (moveRule && moveRule.length > 0) {
						try {
							if (pasteOffset===1)
								new_order = await Policy_rModel.makeAfterRuleOrderGap(firewall, moveRule[0].type, pasteOnRuleId);
							else if (pasteOffset===-1)
								new_order = await Policy_rModel.makeBeforeRuleOrderGap(firewall, moveRule[0].type, pasteOnRuleId);
							else // Move rule into group.
								new_order = moveRule[0].rule_order;

							//Update the moved rule data
							var policy_rData = {
								id: rule,
								idgroup: pasteOnRule[0].idgroup,
								rule_order: new_order
							};
							await Policy_rModel.updatePolicy_r(dbCon, policy_rData);
							
							// If we have moved rule from a group, if the group is empty remove de rules group from the database.
							if (pasteOffset!=0 && moveRule[0].idgroup)
								await Policy_gModel.deleteIfEmptyPolicy_g(dbCon, firewall, moveRule[0].idgroup);

							resolve(rule);
						} catch(error) { return reject(error) }
					} else return reject(fwcError.NOT_FOUND);
				});
			} else return reject(fwcError.NOT_FOUND);
		});
	});
}

module.exports = router;