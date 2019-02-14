var express = require('express');
var router = express.Router();

const policyOpenvpnModel = require('../../models/policy/openvpn');
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
		const content = await policy_r__ipobjModel.getPositionsContent(req.dbCon, req.body.position, req.body.new_position);
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
});


/* Remove policy_r__openvpn */
router.put("/del",
utilsModel.disableFirewallCompileStatus,
async (req, res) => {
	try { 
		await policyOpenvpnModel.deleteFromRule(req);
		api_resp.getJson(null, api_resp.ACR_DELETED_OK, 'DELETE OK', objModel, null, jsonResp => res.status(200).json(jsonResp));
	} catch(error) { return api_resp.getJson(null, api_resp.ACR_ERROR, 'ERROR', objModel, error, jsonResp => res.status(200).json(jsonResp)) }
});

module.exports = router;