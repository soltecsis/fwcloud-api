var express = require('express');
var router = express.Router();

const policyOpenvpnModel = require('../../models/policy/openvpn');
const policy_r__interfaceModel = require('../../models/policy/policy_r__interface');
const policy_r__ipobjModel = require('../../models/policy/policy_r__ipobj');
const policy_rModel = require('../../models/policy/policy_r');
const policy_cModel = require('../../models/policy/policy_c');
const api_resp = require('../../utils/api_response');
const utilsModel = require("../../utils/utils.js");

var objModel = "OpenVPN in Rule";

/* Create New policy_r__openvpn */
router.post("/",
utilsModel.disableFirewallCompileStatus,
async (req, res) => {
	try {
		// Verify that the OpenVPN configuration is of client type.
		if (req.openvpn.type!==1)
			throw (new Error('Only OpenVPN client configurations allowed'));

		if (!(await policyOpenvpnModel.checkOpenvpnPosition(req.dbCon,req.body.position)))
			throw (new Error('OpenVPN not allowed in this position'));

		await policyOpenvpnModel.insertInRule(req);
		policy_rModel.compilePolicy_r(req.body.rule, (error, datac) => {});

		api_resp.getJson(null, api_resp.ACR_INSERTED_OK, 'INSERTED OK', objModel, null, jsonResp => res.status(200).json(jsonResp));
	} catch(error) { return api_resp.getJson(error, api_resp.ACR_ERROR, 'ERROR inserting OpenVPN in rule', objModel, error, jsonResp => res.status(200).json(jsonResp)) }
});


/* Update POSITION policy_r__openvpn that exist */
router.put('/move',
utilsModel.disableFirewallCompileStatus,
async (req, res) => {
	try { 
		// Invalidate compilation of the affected rules.
		await policy_cModel.deletePolicy_c(req.body.firewall, req.body.rule);
		await policy_cModel.deletePolicy_c(req.body.firewall, req.body.new_rule);

		if (await policyOpenvpnModel.checkExistsInPosition(req.dbCon,req.body.new_rule,req.body.openvpn,req.body.new_position))
			throw(new Error('OpenVPN configuration already exists in destination rule position'));

		// Get content of positions.
		const content = policy_r__ipobjModel.getPositionsContent(req.dbCon, req.body.position, req.body.new_position);
		if (content.content1!=='O' || content.content2!=='O')
			throw(new Error('Invalid positions content'));

		// Move OpenVPN configuration object to the new position.
		const data = await policyOpenvpnModel.moveToNewPosition(req);

		api_resp.getJson(data, api_resp.ACR_UPDATED_OK, 'UPDATED OK', objModel, null, jsonResp => res.status(200).json(jsonResp));
	} catch(error) { return api_resp.getJson(null, api_resp.ACR_ERROR, 'ERROR', objModel, error, jsonResp => res.status(200).json(jsonResp)) }
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


/* Update NEGATE de policy_r__interface that exist */
router.put('/negate',
utilsModel.disableFirewallCompileStatus,
(req, res) => {
	var rule = req.body.rule;
	var interface = req.body.interface;
	var negate = req.body.negate;
	var position = req.body.position;

	policy_r__interfaceModel.updatePolicy_r__interface_negate(rule, position, negate, function(error, data) {
		if (error)
			api_resp.getJson(data, api_resp.ACR_ERROR, '', objModel, error, function(jsonResp) {
				res.status(200).json(jsonResp);
			});
		else {
			//If saved policy_r__interface saved ok, get data
			if (data && data.result) {
				policy_rModel.compilePolicy_r(rule, function(error, datac) {});
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

	policy_r__interfaceModel.deletePolicy_r__interface(rule, interface, position, old_order, (error, data) => {
		if (data) {
			if (data.msg === "deleted") {
				policy_rModel.compilePolicy_r(rule, function(error, datac) {});
				api_resp.getJson(data, api_resp.ACR_DELETED_OK, 'DELETE OK', objModel, null, jsonResp => res.status(200).json(jsonResp));
			} else if (data.msg === "notExist")
				api_resp.getJson(data, api_resp.ACR_NOTEXIST, '', objModel, null, jsonResp => res.status(200).json(jsonResp));
		} else
			api_resp.getJson(data, api_resp.ACR_DATA_ERROR, 'Error updating', objModel, error, jsonResp => res.status(200).json(jsonResp));
	});
});

module.exports = router;