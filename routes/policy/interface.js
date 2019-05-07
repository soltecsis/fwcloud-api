var express = require('express');
var router = express.Router();
const policy_r__interfaceModel = require('../../models/policy/policy_r__interface');
const policy_r__ipobjModel = require('../../models/policy/policy_r__ipobj');
const policy_rModel = require('../../models/policy/policy_r');
const policy_cModel = require('../../models/policy/policy_c');
const firewallModel = require('../../models/firewall/firewall');
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
		const data = await policy_r__interfaceModel.insertPolicy_r__interface(req.body.firewall, policy_r__interfaceData);
		//If saved policy_r__interface Get data
		if (data && data.result) {
			if (data.result) {
				policy_rModel.compilePolicy_r(policy_r__interfaceData.rule, (error, datac) => {});
				api_resp.getJson(data, api_resp.ACR_INSERTED_OK, 'INSERTED OK', objModel, null, jsonResp => res.status(200).json(jsonResp));
			} else if (!data.allowed)
				api_resp.getJson(data, api_resp.ACR_NOT_ALLOWED, 'INTERFACE not allowed in this position', objModel, error, jsonResp => res.status(200).json(jsonResp));
			else
				api_resp.getJson(data, api_resp.ACR_NOTEXIST, 'INTERFACE not found', objModel, error, jsonResp => res.status(200).json(jsonResp));
		} else
			api_resp.getJson(data, api_resp.ACR_NOT_ALLOWED, ' INTERFACE not allowed in this position', objModel, null, jsonResp => res.status(200).json(jsonResp));
	} catch(error) { return api_resp.getJson(null, api_resp.ACR_ERROR, '', objModel, error, jsonResp => res.status(200).json(jsonResp)) }
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
		await policy_cModel.deletePolicy_c(firewall, rule);
		await policy_cModel.deletePolicy_c(firewall, new_rule);
		await firewallModel.updateFirewallStatus(req.body.fwcloud,firewall,"|3");

		// Get positions content.
		const data = await 	policy_r__ipobjModel.getPositionsContent(req.dbCon, position, new_position);
		content1 = data.content1;
		content2 = data.content2;	
	} catch(error) { return api_resp.getJson(null, api_resp.ACR_ERROR, 'ERROR', objModel, error, jsonResp => res.status(200).json(jsonResp)) }

	if (content1 === content2) { //SAME POSITION
		policy_r__interfaceModel.updatePolicy_r__interface_position(firewall, rule, interface, position, position_order, new_rule, new_position, new_order, async (error, data) => {
			//If saved policy_r__ipobj saved ok, get data
			if (data) {
				if (data.result) {
					policy_rModel.compilePolicy_r(rule, function(error, datac) {});
					policy_rModel.compilePolicy_r(new_rule, function(error, datac) {});

					// If after the move we have empty rule positions, then remove them from the negate position list.
					try {
						await policy_rModel.allowEmptyRulePositions(req);
					} catch(error) { return api_resp.getJson(null, api_resp.ACR_ERROR, '', '', error, jsonResp => res.status(200).json(jsonResp)) }

					api_resp.getJson(data, api_resp.ACR_UPDATED_OK, 'UPDATED OK', objModel, null, jsonResp => res.status(200).json(jsonResp));
				} else if (!data.allowed) {
					api_resp.getJson(data, api_resp.ACR_NOT_ALLOWED, 'INTERFACE not allowed in this position', objModel, error, jsonResp => res.status(200).json(jsonResp));
				} else api_resp.getJson(data, api_resp.ACR_NOTEXIST, 'INTERFACE not found', objModel, error, jsonResp => res.status(200).json(jsonResp));
			} else api_resp.getJson(data, api_resp.ACR_DATA_ERROR, 'Error updating', objModel, error, jsonResp => res.status(200).json(jsonResp));
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
				data = await policy_r__interfaceModel.insertPolicy_r__interface(firewall, policy_r__interfaceData);
			} catch(error) { return api_resp.getJson(data, api_resp.ACR_DATA_ERROR, 'Error updating', objModel, error, jsonResp => res.status(200).json(jsonResp)) }
			//If saved policy_r__interface Get data
			if (data) {
				if (data.result) {
					//delete Position 'O'
					policy_r__ipobjModel.deletePolicy_r__ipobj(rule, -1, -1, interface, position, position_order, async (error, data) => {
						if (data && data.result) {
							policy_rModel.compilePolicy_r(rule, function(error, datac) {});
							policy_rModel.compilePolicy_r(new_rule, function(error, datac) {});

							// If after the move we have empty rule positions, then remove them from the negate position list.
							try {
								await policy_rModel.allowEmptyRulePositions(req);
							} catch(error) { return api_resp.getJson(null, api_resp.ACR_ERROR, '', '', error, jsonResp => res.status(200).json(jsonResp)) }

							api_resp.getJson(data, api_resp.ACR_UPDATED_OK, 'UPDATED OK', objModel, null, jsonResp => res.status(200).json(jsonResp));
						} else api_resp.getJson(data, api_resp.ACR_DATA_ERROR, 'Error updating', objModel, error, jsonResp => res.status(200).json(jsonResp));
					});
				} else if (!data.allowed) {
					api_resp.getJson(data, api_resp.ACR_NOT_ALLOWED, 'INTERFACE not allowed in this position', objModel, error, jsonResp => res.status(200).json(jsonResp));
				} else api_resp.getJson(data, api_resp.ACR_NOTEXIST, 'INTERFACE not found', objModel, error, jsonResp => res.status(200).json(jsonResp));
			} else api_resp.getJson(data, api_resp.ACR_DATA_ERROR, 'Error updating', objModel, error, jsonResp => res.status(200).json(jsonResp));
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

	policy_r__interfaceModel.updatePolicy_r__interface_order(rule, interface, position, old_order, new_order, function(error, data) {
		if (error)
			api_resp.getJson(data, api_resp.ACR_ERROR, '', objModel, error, function(jsonResp) {
				res.status(200).json(jsonResp);
			});
		else {
			//If saved policy_r__interface saved ok, get data
			if (data && data.result) {
				policy_rModel.compilePolicy_r(rule, function(error, datac) {});
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


/* Remove policy_r__interface */
router.put("/del",
utilsModel.disableFirewallCompileStatus,
(req, res) => {
	//Id from policy_r__interface to remove
	var rule = req.body.rule;
	var interface = req.body.interface;
	var position = req.body.position;
	var old_order = req.body.position_order;

	policy_r__interfaceModel.deletePolicy_r__interface(rule, interface, position, old_order, async (error, data) => {
		if (data) {
			if (data.msg === "deleted") {
				policy_rModel.compilePolicy_r(rule, function(error, datac) {});

				// If after the delete we have empty rule positions, then remove them from the negate position list.
				try {
					await policy_rModel.allowEmptyRulePositions(req);
				} catch(error) { return api_resp.getJson(null, api_resp.ACR_ERROR, '', '', error, jsonResp => res.status(200).json(jsonResp)) }

				api_resp.getJson(data, api_resp.ACR_DELETED_OK, 'DELETE OK', objModel, null, jsonResp => res.status(200).json(jsonResp));
			} else if (data.msg === "notExist")
				api_resp.getJson(data, api_resp.ACR_NOTEXIST, '', objModel, null, jsonResp => res.status(200).json(jsonResp));
		} else
			api_resp.getJson(data, api_resp.ACR_DATA_ERROR, 'Error updating', objModel, error, jsonResp => res.status(200).json(jsonResp));
	});
});

module.exports = router;