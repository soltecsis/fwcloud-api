var express = require('express');
var router = express.Router();
var Policy_rModel = require('../../models/policy/policy_r');
var Policy_gModel = require('../../models/policy/policy_g');
var Policy_r__ipobjModel = require('../../models/policy/policy_r__ipobj');
var Policy_r__interfaceModel = require('../../models/policy/policy_r__interface');
var db = require('../../db.js');
var utilsModel = require("../../utils/utils.js");
var api_resp = require('../../utils/api_response');
//var FirewallModel = require('../../models/firewall/firewall');
//var asyncMod = require('async');
var objModel = 'POLICY';
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
		const insertId = await Policy_rModel.insertPolicy_r(policy_rData);
		api_resp.getJson(insertId, api_resp.ACR_INSERTED_OK, 'ISERT OK', 'POLICY', null, jsonResp => res.status(200).json(jsonResp));
	} catch(error) { api_resp.getJson(null, api_resp.ACR_ERROR, 'Error inserting', 'POLICY', error, jsonResp => res.status(200).json(jsonResp)) }
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
		options: req.body.options
	};

	try {
		await Policy_rModel.updatePolicy_r(req.dbCon, policy_rData);
	} catch(error) { return api_resp.getJson(null, api_resp.ACR_ERROR, 'Error updating rule', 'POLICY', error, jsonResp => res.status(200).json(jsonResp)) }

	// Recompile rule.
	var accessData = {
		sessionID: req.sessionID,
		iduser: req.session.user_id,
		fwcloud: req.body.fwcloud,
		idfirewall: req.body.firewall,
		rule: policy_rData.id
	};
	Policy_rModel.compilePolicy_r(accessData, (error, datac) => {
		if (error)
			api_resp.getJson(null, api_resp.ACR_ERROR, 'Error compiling rule', 'POLICY', error, jsonResp => res.status(200).json(jsonResp));
		else
			api_resp.getJson(datac, api_resp.ACR_UPDATED_OK, 'UPDATED OK', 'POLICY', null, jsonResp => res.status(200).json(jsonResp));
	});
});


/* Get all policy_rs by firewall and type */
router.put('/type/get', (req, res) => {
	Policy_rModel.getPolicy_rs_type(req.body.fwcloud, req.body.firewall, req.body.type, "", (error, data) => {
		if (error) return api_resp.getJson(null, api_resp.ACR_ERROR, 'Getting policy', 'POLICY', error, jsonResp => res.status(200).json(jsonResp));
		api_resp.getJson(data, api_resp.ACR_OK, '', 'POLICY', null, jsonResp => res.status(200).json(jsonResp));
	});
});


/* Get all policy_rs by firewall and type and Rule */
router.put('/get', (req, res) => {
	Policy_rModel.getPolicy_rs_type(req.body.fwcloud, req.body.firewall, req.body.type, req.body.rule, (error, data) => {
		//If exists policy_r get data
		if (data && data.length > 0)
			api_resp.getJson(data, api_resp.ACR_OK, '', 'POLICY', null, jsonResp => res.status(200).json(jsonResp));
		else
			api_resp.getJson(data, api_resp.ACR_NOTEXIST, 'Policy not found', 'POLICY', null, jsonResp => res.status(200).json(jsonResp));
	});
});


/* Get all policy_rs by firewall and type and Rule */
router.put('/full/get', (req, res) => {
	Policy_rModel.getPolicy_rs_type_full(req.body, req.body.firewall, req.body.type, req.body.rule)
		.then(data => {
			//If exists policy_r get data
			if (data && data.length > 0)
				api_resp.getJson(data, api_resp.ACR_OK, '', 'POLICY', null, jsonResp => res.status(200).json(jsonResp));
			else
				api_resp.getJson(data, api_resp.ACR_NOTEXIST, 'Policy not found', 'POLICY', null, jsonResp => res.status(200).json(jsonResp));
		})
		.catch(error => {
			api_resp.getJson(null, api_resp.ACR_ERROR, 'Error getting policy', 'POLICY', error, jsonResp => res.status(200).json(jsonResp));
		});
});


/* Remove policy_r */
router.put("/del",
	utilsModel.disableFirewallCompileStatus,
	(req, res) => {
		//Id from policy_r to remove
		removeRules(req.body.firewall, req.body.rulesIds)
			.then(r => api_resp.getJson(null, api_resp.ACR_DELETED_OK, 'DELETED OK', 'POLICY', null, jsonResp => res.status(200).json(jsonResp)))
			.catch(error => api_resp.getJson(null, api_resp.ACR_NOTEXIST, 'not found', 'POLICY', error, jsonResp => res.status(200).json(jsonResp)));
	});
async function removeRules(idfirewall, rulesIds) {
	for (let rule of rulesIds) {
		await ruleRemove(idfirewall, rule)
			.then(r => logger.debug("OK RESULT DELETE: " + r))
			.catch(err => logger.debug("ERROR Result: " + err));
	}
}

function ruleRemove(idfirewall, rule) {
	return new Promise((resolve, reject) => {
		Policy_rModel.deletePolicy_r(idfirewall, rule)
			.then(data => {
				if (data && data.result)
					resolve(api_resp.ACR_DELETED_OK);
				else
					resolve(api_resp.ACR_NOTEXIST);
			})
			.catch(error => reject(error));
	});
}


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
			api_resp.getJson(null, api_resp.ACR_UPDATED_OK, 'ACTIVE STATUS UPDATED OK', 'POLICY', null, function(jsonResp) {
				res.status(200).json(jsonResp);
			});
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
		api_resp.getJson(null, api_resp.ACR_UPDATED_OK, 'STYLE UPDATED OK', 'POLICY', null, function(jsonResp) {
			res.status(200).json(jsonResp);
		});
	});


/* Copy or Move RULES */
router.put('/copy',
utilsModel.disableFirewallCompileStatus,
async (req, res) => {
	try {
		let pasteOnRuleId = req.body.pasteOnRuleId;
		if (req.body.action === 1) { // action=1 --> Copy/duplicate  RULE
			for (let rule of req.body.rulesIds)
				pasteOnRuleId = await ruleCopy(req.body.firewall, rule, ((req.body.pasteOffset===1)?pasteOnRuleId:req.body.pasteOnRuleId), req.body.pasteOffset);
		} else { ///  action=2 --> Move Rule
			for (let rule of req.body.rulesIds)
				pasteOnRuleId = await ruleMove(req.dbCon, req.body.firewall, rule, ((req.body.pasteOffset===1)?pasteOnRuleId:req.body.pasteOnRuleId), req.body.pasteOffset);
		}

		api_resp.getJson(null, api_resp.ACR_UPDATED_OK, 'RULE COPIED/MOVED OK', 'POLICY', null, jsonResp => res.status(200).json(jsonResp));

	} catch (error) { api_resp.getJson(null, api_resp.ACR_ERROR, 'Error coping/moving rule', 'POLICY', error, jsonResp => res.status(200).json(jsonResp)) }
});

function ruleCopy(firewall, rule, pasteOnRuleId, pasteOffset) {
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
						} catch(error) { return reject(error) }

						if (newRuleId) {
							//DUPLICATE RULE POSITONS O (OBJECTS)
							Policy_r__ipobjModel.duplicatePolicy_r__ipobj(rule, newRuleId, (error, data_dup) => {
								if (error) return reject(new Error("Error Creating POLICY O POSITIONS from Id: " + rule));
								if (data_dup && data_dup.result) {
									//DUPLICATE RULE POSITONS I (INTERFACES)
									Policy_r__interfaceModel.duplicatePolicy_r__interface(rule, newRuleId, (error, data_dup) => {
										if (error) return reject(new Error("Error Creating POLICY I POSITIONS from Id: " + rule));
										resolve(newRuleId);
									});
								} else return reject(new Error("Error duplicating objects from Id: " + rule));
							});
						} else return reject(new Error('Inserting new rule'));
					} else return reject(new Error('Rule not found'));
				});
			} else return reject(new Error('Rule not found'));
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
							else
								new_order = await Policy_rModel.makeBeforeRuleOrderGap(firewall, moveRule[0].type, pasteOnRuleId);

							//Update the moved rule data
							var policy_rData = {
								id: rule,
								idgroup: pasteOnRule[0].idgroup,
								rule_order: new_order
							};
							await Policy_rModel.updatePolicy_r(dbCon, policy_rData);
							
							// If we have moved rule from a group, if the group is empty remove de rules group from the database.
							if (moveRule[0].idgroup)
								await Policy_gModel.deleteIfEmptyPolicy_g(dbCon, firewall, moveRule[0].idgroup);

							resolve(rule);
						} catch(error) { return reject(error) }
					} else return reject(new Error('Rule not found'));
				});
			} else return reject(new Error('Rule not found'));
		});
	});
}

/*function ruleMove(firewall, rule, pasteOnRuleId, pasteOffset, inc) {
	return new Promise((resolve, reject) => {
		Policy_rModel.getPolicy_r(firewall, pasteOnRuleId, (error, pasteOnRule) => {
			if (error) return reject(error);

			if (pasteOnRule && pasteOnRule.length > 0) {
				logger.debug("---->POLICY DESTINO Id: " + pasteOnRuleId + " GROUP:" + pasteOnRule[0].idgroup + "  ORDER: " + pasteOnRule[0].rule_order + "  MAX ORDER: " + pasteOnRule[0].max_order + "  MIN ORDER: " + pasteOnRule[0].min_order + "  OFFSET: " + pasteOffset);
				if ((pasteOnRule[0].rule_order === pasteOnRule[0].max_order && pasteOffset > 0 && pasteOnRuleId === rule)) {

					reject("MAX ORDER " + pasteOnRule[0].max_order + " REACHED POLICY Id: " + rule);
				} else if ((pasteOnRule[0].rule_order === pasteOnRule[0].min_order && pasteOffset < 0 && pasteOnRuleId === rule)) {

					reject("MIN ORDER " + pasteOnRule[0].min_order + "  REACHED POLICY Id: " + rule);
				} else {
					//Get Group Next Rule                    
					Policy_rModel.getPolicy_r_DestGroup(firewall, pasteOffset, pasteOnRule[0].rule_order, pasteOnRule[0].type, (error, dataG) => {
						if (error) return reject(error);

						Policy_rModel.getPolicy_r(firewall, rule, (error, data) => {
							if (error) return reject(error);							

							//If exists policy_r get data
							if (data && data.length > 0) {
								let old_order = data[0].rule_order;
								let new_order = pasteOnRule[0].rule_order + (inc * pasteOffset);
								var idgroupDest = data[0].idgroup;
								//If exists policy_r get data
								if (dataG && dataG.length > 0) {
									idgroupDest = dataG[0].idgroup;
								}

								logger.debug("ENCONTRADA POLICY Id: " + rule + "  ORDER: " + old_order + " --> NEW ORDER:" + new_order + " NEW Group:" + idgroupDest);
								logger.debug("IDGROUP DEST: " + idgroupDest + "  IDGROUP RULE:" + data[0].idgroup);
								if (idgroupDest === data[0].idgroup) {
									Policy_rModel.updatePolicy_r_order(firewall, data[0].type, rule, new_order, old_order, idgroupDest, (error, data) => {
										if (error) return reject(error);
										//If saved policy_r saved ok, get data
										if (data && data.result) {
											resolve(data);
										} else {
											reject("ERROR updating order");
										}
									});
								} else {
									Policy_rModel.updatePolicy_r_Group(firewall, null, idgroupDest, rule, function(error, data) {
										if (error)
											reject("Error Orderning");
										else {
											//If saved policy_r saved ok, get data
											if (data && data.result) {
												resolve(data);
											} else {
												reject("ERROR updating Group");
											}
										}
									});
								}
							} else {
								reject("NOT FOUND POLICY Id: " + rule);
							}
						});
					});
				}
			} else {
				reject("NOT FOUND POLICY Id: " + rule);
			}
		});
	});
}*/



/* Get all policy_rs by firewall and group*/
/*router.get('/:idfirewall/group/:idgroup', function (req, res)
{
	var idfirewall = req.params.idfirewall;
	var idgroup = req.params.idgroup;
	Policy_rModel.getPolicy_rs(idfirewall, idgroup, function (error, data)
	{
		//If exists policy_r get data
		if (data && data.length > 0)
		{
			api_resp.getJson(data, api_resp.ACR_OK, '', 'POLICY', null, function (jsonResp) {
				res.status(200).json(jsonResp);
			});
		}
		//Get Error
		else
		{
			api_resp.getJson(data, api_resp.ACR_NOTEXIST, 'Policy not found', 'POLICY', null, function (jsonResp) {
				res.status(200).json(jsonResp);
			});
		}
	});
});*/


/* Get all policy_rs by firewall and type */
/*router.get('/full/:idfirewall/type/:type', function (req, res)
{
	var idfirewall = req.params.idfirewall;
	var type = req.params.type;
	var rule = "";
	var fwcloud = req.body.fwcloud;
	logger.debug("MOSTRANDO FULL POLICY para firewall: " + idfirewall + "  TYPE:" + type);
	Policy_rModel.getPolicy_rs_type_full(fwcloud, idfirewall, type, rule)
			.then(data =>
			{
				//If exists policy_r get data
				if (data && data.length > 0)
				{
					api_resp.getJson(data, api_resp.ACR_OK, '', 'POLICY', null, function (jsonResp) {
						res.status(200).json(jsonResp);
					});
				}
				//Get Error
				else
				{
					api_resp.getJson(data, api_resp.ACR_NOTEXIST, 'Policy not found', 'POLICY', null, function (jsonResp) {
						res.status(200).json(jsonResp);
					});
				}
			})
			.catch(e => {
				api_resp.getJson(null, api_resp.ACR_NOTEXIST, 'Policy not found', 'POLICY', null, function (jsonResp) {
					res.status(200).json(jsonResp);
				});
			});
});*/



/* Get  policy_r by id and  by Id */
/*router.get('/:idfirewall/:id', function (req, res)
{
	var idfirewall = req.params.idfirewall;
	var id = req.params.id;
	Policy_rModel.getPolicy_r(idfirewall, id, function (error, data)
	{
		//If exists policy_r get data
		if (data && data.length > 0)
		{
			api_resp.getJson(data, api_resp.ACR_OK, '', 'POLICY', null, function (jsonResp) {
				res.status(200).json(jsonResp);
			});
		}
		//Get Error
		else
		{
			api_resp.getJson(data, api_resp.ACR_NOTEXIST, 'Policy not found', 'POLICY', null, function (jsonResp) {
				res.status(200).json(jsonResp);
			});
		}
	});
});*/

/* Get all policy_rs by nombre and by firewall*/
/*router.get('/:idfirewall/group/:idgroup/name/:name', function (req, res)
{
	var idfirewall = req.params.idfirewall;
	var name = req.params.name;
	var idgroup = req.params.idgroup;
	Policy_rModel.getPolicy_rName(idfirewall, idgroup, name, function (error, data)
	{
		//If exists policy_r get data
		if (data && data.length > 0)
		{
			api_resp.getJson(data, api_resp.ACR_OK, '', 'POLICY', null, function (jsonResp) {
				res.status(200).json(jsonResp);
			});
		}
		//Get Error
		else
		{
			api_resp.getJson(data, api_resp.ACR_NOTEXIST, 'Policy not found', 'POLICY', null, function (jsonResp) {
				res.status(200).json(jsonResp);
			});
		}
	});
});*/



/* Update ORDER of the policy_r that exist */
/*router.put('/policy-r/order/:idfirewall/:type/:id/:old_order/:new_order', 
utilsModel.disableFirewallCompileStatus, 
(req, res) => {
	//Save data into object
	var idfirewall = req.params.idfirewall;
	var type = req.params.type;
	var id = req.params.id;
	var new_order = req.params.new_order;
	var old_order = req.params.old_order;
	Policy_rModel.updatePolicy_r_order(idfirewall, type, id, new_order, old_order, function (error, data)
	{
		if (error)
			api_resp.getJson(data, api_resp.ACR_ERROR, 'SQL ERRROR', 'POLICY ORDER', error, function (jsonResp) {
				res.status(200).json(jsonResp);
			});
		else {
			//If saved policy_r saved ok, get data
			if (data && data.result)
			{
				api_resp.getJson(null, api_resp.ACR_UPDATED_OK, 'ORDER UPDATED OK', 'POLICY', null, function (jsonResp) {
					res.status(200).json(jsonResp);
				});
			} else
			{
				api_resp.getJson(null, api_resp.ACR_NOTEXIST, 'Error updating', 'POLICY', error, function (jsonResp) {
					res.status(200).json(jsonResp);
				});
			}
		}
	});
});*/

/* Update APPLY_TO de policy_r that exist */
/*router.put('/policy-r/applyto/:idfirewall/:type/:id/:idcluster/:fwapplyto', 
utilsModel.disableFirewallCompileStatus, 
(req, res) => {
	//Save data into object
	var idfirewall = req.params.idfirewall;
	var type = req.params.type;
	var id = req.params.id;
	var idcluster = req.params.idcluster;
	var fwapplyto = req.params.fwapplyto;

	Policy_rModel.updatePolicy_r_applyto(req.session.user_id, req.body.fwcloud, idfirewall, type, id, idcluster, fwapplyto, function (error, data)
	{
		if (error)
			api_resp.getJson(data, api_resp.ACR_ERROR, 'SQL ERRROR', 'POLICY APPLYTO', error, function (jsonResp) {
				res.status(200).json(jsonResp);
			});
		else {
			//If saved policy_r saved ok, get data
			if (data && data.result)
			{
				var accessData = {sessionID: req.sessionID, iduser: req.session.user_id, fwcloud: req.body.fwcloud, idfirewall: req.params.idfirewall, rule: id};
				Policy_rModel.compilePolicy_r(accessData, function (error, datac) {});
				api_resp.getJson(null, api_resp.ACR_UPDATED_OK, 'APPLYTO UPDATED OK', 'POLICY', null, function (jsonResp) {
					res.status(200).json(jsonResp);
				});
			} else
			{
				api_resp.getJson(null, api_resp.ACR_NOTEXIST, 'Error updating APPLYTO', 'POLICY', error, function (jsonResp) {
					res.status(200).json(jsonResp);
				});
			}
		}
	});
});*/

module.exports = router;