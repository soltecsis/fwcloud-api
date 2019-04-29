var express = require('express');
var router = express.Router();
const policy_r__ipobjModel = require('../../models/policy/policy_r__ipobj');
const policy_r__interfaceModel = require('../../models/policy/policy_r__interface');
const policy_rModel = require('../../models/policy/policy_r');
const policy_cModel = require('../../models/policy/policy_c');
const firewallModel = require('../../models/firewall/firewall');
const api_resp = require('../../utils/api_response');

var logger = require('log4js').getLogger("app");
var utilsModel = require("../../utils/utils.js");

var objModel = "Ipobj in Rule";


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
		if (await policy_r__ipobjModel.emptyIpobjContainerToObjectPosition(req.dbCon,policy_r__ipobjData))
			return api_resp.getJson(null, api_resp.ACR_EMPTY_CONTAINER, 'It is not possible to put empty object containers into rule positions', objModel, null, jsonResp => res.status(200).json(jsonResp));

		if (await policy_r__ipobjModel.checkExistsInPosition(policy_r__ipobjData))
			return api_resp.getJson(null, api_resp.ACR_ALREADY_EXISTS, 'Object already exists in this rule position.', objModel, null, jsonResp => res.status(200).json(jsonResp));

		// Depending on the IP version of the policy_type of the rule we are working on, verify that we have root objects 
		// of this IP version in the object that we are moving to this rule position.
		if (!(await policy_r__ipobjModel.checkIpVersion(req.dbCon,policy_r__ipobjData)))
			return api_resp.getJson(null, api_resp.ACR_ERROR, 'Bad object IP version.', objModel, null, jsonResp => res.status(200).json(jsonResp));

		const data = await policy_r__ipobjModel.insertPolicy_r__ipobj(policy_r__ipobjData);
		//If saved policy_r__ipobj Get data
		if (data && data.result) {
			if (data.result && data.allowed) {
				var accessData = { sessionID: req.sessionID, iduser: req.session.user_id, fwcloud: req.body.fwcloud, idfirewall: req.body.firewall, rule: policy_r__ipobjData.rule };
				policy_rModel.compilePolicy_r(accessData, function(error, datac) {});
				api_resp.getJson(data, api_resp.ACR_INSERTED_OK, 'INSERTED OK', objModel, null, jsonResp => res.status(200).json(jsonResp));
			} else if (!data.allowed)
				api_resp.getJson(data, api_resp.ACR_NOT_ALLOWED, 'IPOBJ not allowed in this position', objModel, error, jsonResp => res.status(200).json(jsonResp));
			else
				api_resp.getJson(data, api_resp.ACR_NOTEXIST, 'IPOBJ not found', objModel, error, jsonResp => res.status(200).json(jsonResp));
		} else
			api_resp.getJson(data, api_resp.ACR_DATA_ERROR, 'Error inserting', objModel, error, jsonResp => res.status(200).json(jsonResp));
	} catch(error) { api_resp.getJson(null, api_resp.ACR_ERROR, '', '', error, jsonResp => res.status(200).json(jsonResp)) }
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
		await policy_cModel.deletePolicy_c(firewall, rule);
		await policy_cModel.deletePolicy_c(firewall, new_rule);
		await firewallModel.updateFirewallStatus(req.body.fwcloud,firewall,"|3");

		if (await policy_r__ipobjModel.checkExistsInPosition(policy_r__ipobjData))
			return api_resp.getJson(null, api_resp.ACR_ALREADY_EXISTS, 'Object already exists in this rule position.', objModel, null, jsonResp => res.status(200).json(jsonResp));

		// Get positions content.
		const data = await 	policy_r__ipobjModel.getPositionsContent(req.dbCon, position, new_position);
		content1 = data.content1;
		content2 = data.content2;	
	} catch(error) { return api_resp.getJson(null, api_resp.ACR_ERROR, 'ERROR', objModel, error, jsonResp => res.status(200).json(jsonResp)) }

	if (content1 === content2) { //SAME POSITION
		policy_r__ipobjModel.updatePolicy_r__ipobj_position(rule, ipobj, ipobj_g, interface, position, position_order, new_rule, new_position, new_order, async (error, data) => {
			//If saved policy_r__ipobj saved ok, get data
			if (data) {
				if (data.result) {
					policy_rModel.compilePolicy_r(accessData, function(error, datac) {});
					accessData.rule = new_rule;
					policy_rModel.compilePolicy_r(accessData, function(error, datac) {});

					// If after the move we have empty rule positions, then remove them from the negate position list.
					try {
						await policy_rModel.allowEmptyRulePositions(req);
					} catch(error) { return api_resp.getJson(null, api_resp.ACR_ERROR, '', '', error, jsonResp => res.status(200).json(jsonResp)) }

					api_resp.getJson(data, api_resp.ACR_UPDATED_OK, 'UPDATED OK', objModel, null, function(jsonResp) {
						res.status(200).json(jsonResp);
					});
				} else if (!data.allowed) {
					api_resp.getJson(data, api_resp.ACR_NOT_ALLOWED, 'IPOBJ not allowed in this position', objModel, error, function(jsonResp) {
						res.status(200).json(jsonResp);
					});
				} else
					api_resp.getJson(data, api_resp.ACR_NOTEXIST, 'IPOBJ not found', objModel, error, function(jsonResp) {
						res.status(200).json(jsonResp);
					});
			} else {
				api_resp.getJson(data, api_resp.ACR_DATA_ERROR, 'Error updating', objModel, error, function(jsonResp) {
					res.status(200).json(jsonResp);
				});
			}
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
				data = await policy_r__ipobjModel.insertPolicy_r__ipobj(policy_r__ipobjData);
			} catch(error) { return api_resp.getJson(null, api_resp.ACR_ERROR, '', '', error, jsonResp => res.status(200).json(jsonResp)) }

			//If saved policy_r__ipobj Get data
			if (data) {
				if (data.result) {
					//Delete position 'I'
					policy_r__interfaceModel.deletePolicy_r__interface(rule, interface, position, position_order, async (error, data) => {
						if (data && data.result) {
							policy_rModel.compilePolicy_r(accessData, function(error, datac) {});
							accessData.rule = new_rule;
							policy_rModel.compilePolicy_r(accessData, function(error, datac) {});

							// If after the move we have empty rule positions, then remove them from the negate position list.
							try {
								await policy_rModel.allowEmptyRulePositions(req);
							} catch(error) { return api_resp.getJson(null, api_resp.ACR_ERROR, '', '', error, jsonResp => res.status(200).json(jsonResp)) }

							api_resp.getJson(data, api_resp.ACR_UPDATED_OK, 'UPDATED OK', objModel, null, function(jsonResp) {
								res.status(200).json(jsonResp);
							});
						} else {
							api_resp.getJson(data, api_resp.ACR_DATA_ERROR, 'Error updating', objModel, error, function(jsonResp) {
								res.status(200).json(jsonResp);
							});
						}
					});
				} else if (!data.allowed) {
					api_resp.getJson(data, api_resp.ACR_NOT_ALLOWED, 'IPOBJ not allowed in this position', objModel, error, function(jsonResp) {
						res.status(200).json(jsonResp);
					});
				} else
					api_resp.getJson(data, api_resp.ACR_NOTEXIST, 'IPOBJ not found', objModel, error, function(jsonResp) {
						res.status(200).json(jsonResp);
					});

			} else {
				api_resp.getJson(data, api_resp.ACR_DATA_ERROR, 'Error updating', objModel, error, function(jsonResp) {
					res.status(200).json(jsonResp);
				});
			}
		} else {
			api_resp.getJson(data, api_resp.ACR_DATA_ERROR, 'Error updating, content diffetents', objModel, error, function(jsonResp) {
				res.status(200).json(jsonResp);
			});
		}
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

	policy_r__ipobjModel.updatePolicy_r__ipobj_position_order(rule, ipobj, ipobj_g, interface, position, position_order, new_order, function(error, data) {
		if (error)
			api_resp.getJson(data, api_resp.ACR_ERROR, '', objModel, error, function(jsonResp) {
				res.status(200).json(jsonResp);
			});
		else {
			//If saved policy_r__ipobj saved ok, get data
			if (data && data.result) {
				var accessData = { sessionID: req.sessionID, iduser: req.session.user_id, fwcloud: req.body.fwcloud, idfirewall: req.body.firewall, rule: rule };
				policy_rModel.compilePolicy_r(accessData, function(error, datac) {});
				api_resp.getJson(data, api_resp.ACR_UPDATED_OK, 'SET ORDER OK', objModel, null, function(jsonResp) {
					res.status(200).json(jsonResp);
				});
			} else {
				api_resp.getJson(data, api_resp.ACR_DATA_ERROR, 'Error updating', objModel, error, function(jsonResp) {
					res.status(200).json(jsonResp);
				});
			}
		}
	});
});


/* Get all policy_r__ipobjs by rule*/
router.put('/get', (req, res) => {
	policy_r__ipobjModel.getPolicy_r__ipobjs(req.body.rule, (error, data) => {
		//If exists policy_r__ipobj get data
		if (data && data.length > 0)
			api_resp.getJson(data, api_resp.ACR_OK, '', objModel, null, jsonResp => res.status(200).json(jsonResp));
		else
			api_resp.getJson(data, api_resp.ACR_NOTEXIST, ' not found', objModel, null, jsonResp => res.status(200).json(jsonResp));
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

	policy_r__ipobjModel.deletePolicy_r__ipobj(rule, ipobj, ipobj_g, interface, position, position_order, async (error, data) => {
		if (data && data.result) {
			if (data.msg === "deleted") {
				var accessData = { sessionID: req.sessionID, iduser: req.session.user_id, fwcloud: req.body.fwcloud, idfirewall: req.body.firewall, rule: rule };
				policy_rModel.compilePolicy_r(accessData, function(error, datac) {});

				// If after the delete we have empty rule positions, then remove them from the negate position list.
				try {
					await policy_rModel.allowEmptyRulePositions(req);
				} catch(error) { return api_resp.getJson(null, api_resp.ACR_ERROR, '', '', error, jsonResp => res.status(200).json(jsonResp)) }
				
				api_resp.getJson(data, api_resp.ACR_DELETED_OK, 'DELETE OK', objModel, null, function(jsonResp) {
					res.status(200).json(jsonResp);
				});
			} else if (data.msg === "notExist") {
				api_resp.getJson(data, api_resp.ACR_NOTEXIST, '', objModel, null, function(jsonResp) {
					res.status(200).json(jsonResp);
				});
			}
		} else {
			api_resp.getJson(data, api_resp.ACR_DATA_ERROR, 'Error updating', objModel, error, function(jsonResp) {
				res.status(200).json(jsonResp);
			});
		}
	});
});


module.exports = router;