var express = require('express');
var router = express.Router();
var Policy_rModel = require('../../models/policy/policy_r');
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
utilsModel.checkFirewallAccess, 
utilsModel.disableFirewallCompileStatus, 
(req, res) => {
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
	Policy_rModel.insertPolicy_r(policy_rData, function (error, data)
	{
		if (error)
			api_resp.getJson(data, api_resp.ACR_ERROR, '', 'POLICY', error, jsonResp => res.status(200).json(jsonResp));
		else {
			//If saved policy_r Get data
			if (data && data.result)
				api_resp.getJson({"insertId": data.insertId}, api_resp.ACR_INSERTED_OK, 'Policy INSERTED OK', 'POLICY', null, jsonResp => res.status(200).json(jsonResp));
			else
				api_resp.getJson(data, api_resp.ACR_DATA_ERROR, 'Error inserting', 'POLICY', error, jsonResp => res.status(200).json(jsonResp));
		}
	});
});

/* Update policy_r that exist */
router.put('/', 
utilsModel.checkFirewallAccess, 
utilsModel.disableFirewallCompileStatus,
(req, res) => {
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
	
	var old_order = req.body.old_order;
	Policy_rModel.updatePolicy_r(old_order, policy_rData, function (error, data)
	{
		if (error)
			api_resp.getJson(data, api_resp.ACR_ERROR, 'SQL ERRROR', 'POLICY', error, jsonResp => res.status(200).json(jsonResp));
		else {
			logger.debug("POLICY UPDATED: ", data);
			//If saved policy_r saved ok, get data
			if (data && data.result) {
				// Recompile rule.
				var accessData = {
					sessionID: req.sessionID, 
					iduser: req.iduser, 
					fwcloud: req.fwcloud, 
					idfirewall: req.params.idfirewall, 
					rule: policy_rData.id
				};
				Policy_rModel.compilePolicy_r(accessData, (error, datac) => {
					if (error) 
						api_resp.getJson(null, api_resp.ACR_ERROR, 'Error compiling rule', 'POLICY', error, jsonResp => res.status(200).json(jsonResp));
					else
						api_resp.getJson(datac, api_resp.ACR_UPDATED_OK, 'UPDATED OK', 'POLICY', null, jsonResp => res.status(200).json(jsonResp));
				});
			} else
				api_resp.getJson(null, api_resp.ACR_NOTEXIST, 'Error updating', 'POLICY', error, jsonResp => res.status(200).json(jsonResp));
		}
	});	
});


/* Get all policy_rs by firewall and type */
router.put('/type/get',
utilsModel.checkFirewallAccess,
(req, res) => {
	Policy_rModel.getPolicy_rs_type(req.bodyfwcloud, req.body.firewall, req.body.type, "", (error, data) => {
		if (error) return api_resp.getJson(null, api_resp.ACR_ERROR, 'Getting policy', 'POLICY', error, jsonResp => res.status(200).json(jsonResp));
		api_resp.getJson(data, api_resp.ACR_OK, '', 'POLICY', null, jsonResp => res.status(200).json(jsonResp));
	});
});


/* Get all policy_rs by firewall and type and Rule */
router.put('/get', 
utilsModel.checkFirewallAccess, 
(req, res) => {
	Policy_rModel.getPolicy_rs_type(req.body.fwcloud, req.body.firewall, req.body.type, req.body.rule, (error, data) => {
		//If exists policy_r get data
		if (data && data.length > 0)
			api_resp.getJson(data, api_resp.ACR_OK, '', 'POLICY', null, jsonResp => res.status(200).json(jsonResp));
		else
			api_resp.getJson(data, api_resp.ACR_NOTEXIST, 'Policy not found', 'POLICY', null, jsonResp => res.status(200).json(jsonResp));
	});
});


/* Get all policy_rs by firewall and type and Rule */
router.put('/full/get', 
utilsModel.checkFirewallAccess, (req, res) => {
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
utilsModel.checkFirewallAccess, 
utilsModel.disableFirewallCompileStatus,  
(req, res) => {
	//Id from policy_r to remove
	removeRules(req.body.firewall, req.body.rulesIds)
	.then(r => api_resp.getJson(null, api_resp.ACR_DELETED_OK, 'DELETED OK', 'POLICY', null, jsonResp => res.status(200).json(jsonResp)))
	.catch(error => api_resp.getJson(null, api_resp.ACR_NOTEXIST, 'not found', 'POLICY', error, jsonResp => res.status(200).json(jsonResp)));
});
async function removeRules(idfirewall, rulesIds)
{
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
utilsModel.checkFirewallAccess, 
utilsModel.disableFirewallCompileStatus, 
(req, res) => {
	//Save data into object
	var idfirewall = req.body.firewall;
	var type = req.body.type;
	var active = req.body.active;
	var rulesIds = req.body.rulesIds;
	if (active !== 1)
		active = 0;
	db.lockTableCon("policy_r", " WHERE firewall=" + idfirewall + " AND type=" + type, function () {
		db.startTXcon(function () {
			for (var rule of rulesIds) {
				Policy_rModel.updatePolicy_r_Active(idfirewall, rule, type, active, function (error, data) {
					if (error)
						logger.debug("ERROR UPDATING ACTIVE STATUS for RULE: " + rule + "  Active: " + active);
					if (data && data.result) {
						logger.debug("UPDATED ACTIVE STATUS for RULE: " + rule + "  Active: " + active);
					} else
						logger.debug("NOT UPDATED ACTIVE STATUS for RULE: " + rule + "  Active: " + active);
				});
			}
			db.endTXcon(function () {});
		});
		api_resp.getJson(null, api_resp.ACR_UPDATED_OK, 'ACTIVE STATUS UPDATED OK', 'POLICY', null, function (jsonResp) {
			res.status(200).json(jsonResp);
		});
	});
});


/* Update Style policy_r  */
router.put('/style', 
utilsModel.checkFirewallAccess, 
utilsModel.disableFirewallCompileStatus, 
(req, res) => {
	var style = req.body.style;
	var rulesIds = req.body.rulesIds;
	db.lockTableCon("policy_r", " WHERE firewall=" + req.body.firewall + " AND type=" + req.body.type, () => {
		db.startTXcon(function () {
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
			db.endTXcon(function () {});
		});
	});
	api_resp.getJson(null, api_resp.ACR_UPDATED_OK, 'STYLE UPDATED OK', 'POLICY', null, function (jsonResp) {
		res.status(200).json(jsonResp);
	});
});


/* Copy or Move RULES */
router.put('/copy', 
utilsModel.checkFirewallAccess,
utilsModel.disableFirewallCompileStatus, 
(req, res) => {
	try {
		//logger.debug("BODY:");
		//logger.debug(req.body);
		var JsonCopyData = req.body;
		var copyData = JsonCopyData.rulesData;
		var idfirewall = copyData.firewall;
		var pasteOnRuleId = copyData.pasteOnRuleId;
		var pasteOffset = copyData.pasteOffset;
		var action = copyData.action; // 1--> Copy rules , 2--> Move rules
		//Buscamos datos de regla Destino

		mainCopyMove(idfirewall, copyData.rulesIds, pasteOnRuleId, pasteOffset, action)
				.then(v => {
					logger.debug("FINAL de BUSQUEDA");
					api_resp.getJson(null, api_resp.ACR_UPDATED_OK, 'ORDER UPDATED OK', 'POLICY', null, function (jsonResp) {
						res.status(200).json(jsonResp);
					});
				})
				.catch(err => {
					logger.debug("ERROR: " + err);
					api_resp.getJson(null, api_resp.ACR_ERROR, 'Error updating Order', 'POLICY', err, function (jsonResp) {
						res.status(200).json(jsonResp);
					});
				});
	} catch (e) {
		api_resp.getJson(null, api_resp.ACR_ERROR, 'Error Parsing Json', 'POLICY', e, function (jsonResp) {
			res.status(200).json(jsonResp);
		});
	}
});

async function mainCopyMove(idfirewall, rulesIds, pasteOnRuleId, pasteOffset, action) {
	if (action === 1) {  // action=1 --> Copy/duplicate  RULE
		var inc = 1;
		for (let rule of rulesIds) {
			await ruleCopy(idfirewall, rule, pasteOnRuleId, pasteOffset, inc);
			inc++;
		}
	} else {  ///  action=2 --> Move Rule
		var inc = 1;
		for (let rule of rulesIds) {
			if (pasteOffset > 0)
				await ruleOrder(idfirewall, rule, pasteOnRuleId, pasteOffset, inc);
			else
				await ruleOrder(idfirewall, rule, rule, pasteOffset, 1);
			inc++;
		}
	}
}

function ruleOrder(idfirewall, ruletoMoveid, pasteOnRuleId, pasteOffset, inc) {
	return new Promise((resolve, reject) => {
		Policy_rModel.getPolicy_r(idfirewall, pasteOnRuleId, function (error, data_dest)
		{
			if (data_dest && data_dest.length > 0)
			{
				logger.debug("---->POLICY DESTINO Id: " + pasteOnRuleId + " GROUP:" + data_dest[0].idgroup + "  ORDER: " + data_dest[0].rule_order + "  MAX ORDER: " + data_dest[0].max_order + "  MIN ORDER: " + data_dest[0].min_order + "  OFFSET: " + pasteOffset);
				if ((data_dest[0].rule_order === data_dest[0].max_order && pasteOffset > 0 && pasteOnRuleId === ruletoMoveid))
				{

					reject("MAX ORDER " + data_dest[0].max_order + " REACHED POLICY Id: " + ruletoMoveid);
				} else if ((data_dest[0].rule_order === data_dest[0].min_order && pasteOffset < 0 && pasteOnRuleId === ruletoMoveid)) {

					reject("MIN ORDER " + data_dest[0].min_order + "  REACHED POLICY Id: " + ruletoMoveid);
				} else {
//Get Group Next Rule                    
					Policy_rModel.getPolicy_r_DestGroup(idfirewall, pasteOffset, data_dest[0].rule_order, data_dest[0].type, function (error, dataG)
					{

						Policy_rModel.getPolicy_r(idfirewall, ruletoMoveid, function (error, data)
						{
//If exists policy_r get data
							if (data && data.length > 0)
							{
								let old_order = data[0].rule_order;
								let new_order = data_dest[0].rule_order + (inc * pasteOffset);
								var idgroupDest = data[0].idgroup;
								//If exists policy_r get data
								if (dataG && dataG.length > 0)
								{
									idgroupDest = dataG[0].idgroup;
								}


								logger.debug("ENCONTRADA POLICY Id: " + ruletoMoveid + "  ORDER: " + data[0].rule_order + " --> NEW ORDER:" + new_order + " NEW Group:" + idgroupDest);
								logger.debug("IDGROUP DEST: " + idgroupDest + "  IDGROUP RULE:" + data[0].idgroup);
								if (idgroupDest === data[0].idgroup) {
									Policy_rModel.updatePolicy_r_order(idfirewall, data[0].type, ruletoMoveid, new_order, data[0].rule_order, idgroupDest, function (error, data)
									{
										if (error)
											reject("Error Orderning");
										else {
											//If saved policy_r saved ok, get data
											if (data && data.result)
											{
												resolve(data);
											} else
											{
												reject("ERROR updating order");
											}
										}
									});
								} else {
									Policy_rModel.updatePolicy_r_Group(idfirewall, null, idgroupDest, ruletoMoveid, function (error, data)
									{
										if (error)
											reject("Error Orderning");
										else {
											//If saved policy_r saved ok, get data
											if (data && data.result)
											{
												resolve(data);
											} else
											{
												reject("ERROR updating Group");
											}
										}
									});
								}
							} else {
								reject("NOT FOUND POLICY Id: " + ruletoMoveid);
							}
						});
					});
				}
			} else
			{
				reject("NOT FOUND POLICY Id: " + ruletoMoveid);
			}
		});
	});
}

function ruleCopy(idfirewall, id, pasteOnRuleId, pasteOffset, inc) {
	return new Promise((resolve, reject) => {
		Policy_rModel.getPolicy_r(idfirewall, pasteOnRuleId, function (error, data_dest)
		{
			if (data_dest && data_dest.length > 0)
			{
				logger.debug("----> POLICY DESTINO Id: " + pasteOnRuleId + "  GROUP:" + data_dest[0].idgroup + "   ORDER: " + data_dest[0].rule_order);
				Policy_rModel.getPolicy_r(idfirewall, id, function (error, data)
				{
					//If exists policy_r get data
					if (data && data.length > 0)
					{
						//Create New rule copy of id
						let old_order = data[0].rule_order;
						let new_order = data_dest[0].rule_order + (inc * pasteOffset);
						if (old_order > new_order && pasteOffset > 0)
							new_order += (inc * pasteOffset);
						else if (old_order > new_order && pasteOffset < 0)
							new_order = data_dest[0].rule_order;
						else if (old_order < new_order && pasteOffset < 0)
							new_order = data_dest[0].rule_order;
						logger.debug("DUPLICANDO POLICY Id: " + id + " NEW GROUP: " + data_dest[0].idgroup + "  ORDER: " + data[0].rule_order + " --> NEW ORDER:" + new_order);
						//Create New objet with data policy_r
						var policy_rData = {
							id: null,
							idgroup: data_dest[0].idgroup,
							firewall: data[0].firewall,
							rule_order: new_order,
							action: data[0].action,
							time_start: data[0].time_start,
							time_end: data[0].time_end,
							active: data[0].active,
							options: data[0].options,
							comment: data[0].comment,
							type: data[0].type
						};
						Policy_rModel.insertPolicy_r(policy_rData, function (error, data)
						{
							if (error)
								reject("Error Creating POLICY from Id: " + id);
							else {
								//If saved policy_r Get data
								if (data && data.result)
								{
									//DUPLICATE RULE POSITONS O OBJECTS
									Policy_r__ipobjModel.duplicatePolicy_r__ipobj(id, data.insertId, function (error, data_dup) {
										if (error)
											reject("Error Creating POLICY O POSITIONS from Id: " + id);
										else {
											//If saved policy_r Get data
											if (data_dup && data_dup.result)
											{
												logger.debug("Policy Positions Duplicated from Id: " + id);
												resolve(data);
											} else
												reject("Error duplicating POLICY O POSITIONS from Id: " + id);
										}
									});
									//DUPLICATE RULE POSITONS I INTERFACES
									Policy_r__interfaceModel.duplicatePolicy_r__interface(id, data.insertId, function (error, data_dup) {
										if (error)
											reject("Error Creating POLICY I POSITIONS from Id: " + id);
										else {
											//If saved policy_r Get data
											if (data_dup && data_dup.result)
											{
												resolve(data);
											}
										}
									});
								} else
								{
									reject(data);
								}
							}
						});
					} else {
						reject(data);
					}
				});
			} else
			{
				logger.debug("NOT FOUND POLICY Id: " + id);
				reject(data_dest);
			}
		});
	});
}







/* Get all policy_rs by firewall and group*/
router.get('/:idfirewall/group/:idgroup', utilsModel.checkFirewallAccess, function (req, res)
{
	var idfirewall = req.params.idfirewall;
	var idgroup = req.params.idgroup;
	var iduser = req.iduser;
	var fwcloud = req.fwcloud;
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
});


/* Get all policy_rs by firewall and type */
router.get('/full/:idfirewall/type/:type', utilsModel.checkFirewallAccess, function (req, res)
{
	var idfirewall = req.params.idfirewall;
	var type = req.params.type;
	var rule = "";
	var iduser = req.iduser;
	var fwcloud = req.fwcloud;
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
});



/* Get  policy_r by id and  by Id */
router.get('/:idfirewall/:id', utilsModel.checkFirewallAccess, function (req, res)
{
	var idfirewall = req.params.idfirewall;
	var id = req.params.id;
	var iduser = req.iduser;
	var fwcloud = req.fwcloud;
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
});

/* Get all policy_rs by nombre and by firewall*/
router.get('/:idfirewall/group/:idgroup/name/:name', utilsModel.checkFirewallAccess, function (req, res)
{
	var idfirewall = req.params.idfirewall;
	var name = req.params.name;
	var idgroup = req.params.idgroup;
	var iduser = req.iduser;
	var fwcloud = req.fwcloud;
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
});



/* Update ORDER of the policy_r that exist */
router.put('/policy-r/order/:idfirewall/:type/:id/:old_order/:new_order', 
utilsModel.checkFirewallAccess, 
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
});

/* Update APPLY_TO de policy_r that exist */
router.put('/policy-r/applyto/:idfirewall/:type/:id/:idcluster/:fwapplyto', 
utilsModel.checkFirewallAccess, 
utilsModel.disableFirewallCompileStatus, 
(req, res) => {
	//Save data into object
	var idfirewall = req.params.idfirewall;
	var type = req.params.type;
	var id = req.params.id;
	var idcluster = req.params.idcluster;
	var fwapplyto = req.params.fwapplyto;

	Policy_rModel.updatePolicy_r_applyto(req.iduser, req.fwcloud, idfirewall, type, id, idcluster, fwapplyto, function (error, data)
	{
		if (error)
			api_resp.getJson(data, api_resp.ACR_ERROR, 'SQL ERRROR', 'POLICY APPLYTO', error, function (jsonResp) {
				res.status(200).json(jsonResp);
			});
		else {
			//If saved policy_r saved ok, get data
			if (data && data.result)
			{
				var accessData = {sessionID: req.sessionID, iduser: req.iduser, fwcloud: req.fwcloud, idfirewall: req.params.idfirewall, rule: id};
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
});




module.exports = router;