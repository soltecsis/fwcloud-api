var express = require('express');
var router = express.Router();
var Policy_r__interfaceModel = require('../../models/policy/policy_r__interface');
var Policy_r__ipobjModel = require('../../models/policy/policy_r__ipobj');
var api_resp = require('../../utils/api_response');
var Policy_rModel = require('../../models/policy/policy_r');
var Policy_cModel = require('../../models/policy/policy_c');

var utilsModel = require("../../utils/utils.js");
var objModel = "Interface in Rule";


/* Create New policy_r__interface */
router.post("/",
utilsModel.disableFirewallCompileStatus,
async (req, res) => {
	//Create New objet with data policy_r__interface
	var policy_r__interfaceData = {
		rule: req.body.rule,
		interface: req.body.interface,
		negate: req.body.negate,
		position: req.body.position,
		position_order: req.body.position_order
	};

	try {
		const data = await Policy_r__interfaceModel.insertPolicy_r__interface(req.body.firewall, policy_r__interfaceData);
		//If saved policy_r__interface Get data
		if (data && data.result) {
			if (data.result) {
				Policy_rModel.compilePolicy_r(policy_r__interfaceData.rule, (error, datac) => {});
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

	//logger.debug("POLICY_R-INTERFACES  MOVING FROM POSITION " + position + "  TO POSITION: " + new_position);

	// Invalidate compilation of the affected rules.
	await Policy_cModel.deletePolicy_c(firewall, rule);
	await Policy_cModel.deletePolicy_c(firewall, new_rule);
	//Get position type
	Policy_r__ipobjModel.getTypePositions(position, new_position, async (error, data) => {
		if (data) {
			content1 = data.content1;
			content2 = data.content2;

			if (content1 === content2) { //SAME POSITION
				Policy_r__interfaceModel.updatePolicy_r__interface_position(firewall, rule, interface, position, position_order, new_rule, new_position, new_order, (error, data) => {
					//If saved policy_r__ipobj saved ok, get data
					if (data) {
						if (data.result) {
							Policy_rModel.compilePolicy_r(rule, function(error, datac) {});
							Policy_rModel.compilePolicy_r(new_rule, function(error, datac) {});
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
						negate: 0,
						position: new_position,
						position_order: new_order
					};

					var data;
					try {
						data = await Policy_r__interfaceModel.insertPolicy_r__interface(firewall, policy_r__interfaceData);
					} catch(error) { return api_resp.getJson(data, api_resp.ACR_DATA_ERROR, 'Error updating', objModel, error, jsonResp => res.status(200).json(jsonResp)) }
					//If saved policy_r__interface Get data
					if (data) {
						if (data.result) {
							//delete Position 'O'
							Policy_r__ipobjModel.deletePolicy_r__ipobj(rule, -1, -1, interface, position, position_order, function(error, data) {
								if (data && data.result) {
									Policy_rModel.compilePolicy_r(rule, function(error, datac) {});
									Policy_rModel.compilePolicy_r(new_rule, function(error, datac) {});
									api_resp.getJson(data, api_resp.ACR_UPDATED_OK, 'UPDATED OK', objModel, null, jsonResp => res.status(200).json(jsonResp));
								} else api_resp.getJson(data, api_resp.ACR_DATA_ERROR, 'Error updating', objModel, error, jsonResp => res.status(200).json(jsonResp));
							});
						} else if (!data.allowed) {
							api_resp.getJson(data, api_resp.ACR_NOT_ALLOWED, 'INTERFACE not allowed in this position', objModel, error, jsonResp => res.status(200).json(jsonResp));
						} else api_resp.getJson(data, api_resp.ACR_NOTEXIST, 'INTERFACE not found', objModel, error, jsonResp => res.status(200).json(jsonResp));
					} else api_resp.getJson(data, api_resp.ACR_DATA_ERROR, 'Error updating', objModel, error, jsonResp => res.status(200).json(jsonResp));
				}
			}
		} else api_resp.getJson(data, api_resp.ACR_NOTEXIST, 'INTERFACE not found', objModel, error, jsonResp => res.status(200).json(jsonResp));
	});
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

	Policy_r__interfaceModel.updatePolicy_r__interface_order(rule, interface, position, old_order, new_order, function(error, data) {
		if (error)
			api_resp.getJson(data, api_resp.ACR_ERROR, '', objModel, error, function(jsonResp) {
				res.status(200).json(jsonResp);
			});
		else {
			//If saved policy_r__interface saved ok, get data
			if (data && data.result) {
				Policy_rModel.compilePolicy_r(rule, function(error, datac) {});
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


/* Update NEGATE de policy_r__interface that exist */
router.put('/negate',
utilsModel.disableFirewallCompileStatus,
(req, res) => {
	var rule = req.body.rule;
	var interface = req.body.interface;
	var negate = req.body.negate;
	var position = req.body.position;

	Policy_r__interfaceModel.updatePolicy_r__interface_negate(rule, position, negate, function(error, data) {
		if (error)
			api_resp.getJson(data, api_resp.ACR_ERROR, '', objModel, error, function(jsonResp) {
				res.status(200).json(jsonResp);
			});
		else {
			//If saved policy_r__interface saved ok, get data
			if (data && data.result) {
				Policy_rModel.compilePolicy_r(rule, function(error, datac) {});
				api_resp.getJson(data, api_resp.ACR_UPDATED_OK, 'SET NEGATED OK', objModel, null, function(jsonResp) {
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

	Policy_r__interfaceModel.deletePolicy_r__interface(rule, interface, position, old_order, (error, data) => {
		if (data) {
			if (data.msg === "deleted") {
				Policy_rModel.compilePolicy_r(rule, function(error, datac) {});
				api_resp.getJson(data, api_resp.ACR_DELETED_OK, 'DELETE OK', objModel, null, jsonResp => res.status(200).json(jsonResp));
			} else if (data.msg === "notExist")
				api_resp.getJson(data, api_resp.ACR_NOTEXIST, '', objModel, null, jsonResp => res.status(200).json(jsonResp));
		} else
			api_resp.getJson(data, api_resp.ACR_DATA_ERROR, 'Error updating', objModel, error, jsonResp => res.status(200).json(jsonResp));
	});
});

module.exports = router;