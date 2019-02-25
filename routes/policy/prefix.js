var express = require('express');
var router = express.Router();

const openvpnPrefixModel = require('../../models/vpn/openvpn/prefix');
const policyPrefixModel = require('../../models/policy/prefix');
const policy_r__ipobjModel = require('../../models/policy/policy_r__ipobj');
const policy_rModel = require('../../models/policy/policy_r');
const policy_cModel = require('../../models/policy/policy_c');
const api_resp = require('../../utils/api_response');
const utilsModel = require("../../utils/utils.js");

var objModel = "OpenVPN server prefix in Rule";

/* Create New policy_r__openvpn_prefix */
router.post("/",
utilsModel.disableFirewallCompileStatus,
async (req, res) => {
	try {
		if ((await openvpnPrefixModel.getOpenvpnClientesUnderPrefix(req.dbCon,req.prefix.openvpn,req.prefix.name)).length < 1)
			return api_resp.getJson(null, api_resp.ACR_EMPTY_CONTAINER, 'It is not possible to put empty prefixes into rule positions', objModel, null, jsonResp => res.status(200).json(jsonResp));

		if (!(await policyPrefixModel.checkPrefixPosition(req.dbCon,req.body.position)))
			return api_resp.getJson(null, api_resp.ACR_ALREADY_EXISTS, 'OpenVPN server prefix name already exists in this rule position', objModel, null, jsonResp => res.status(200).json(jsonResp));

		await policyPrefixModel.insertInRule(req);
		policy_rModel.compilePolicy_r(req.body.rule, (error, datac) => {});

		api_resp.getJson(null, api_resp.ACR_INSERTED_OK, 'INSERTED OK', objModel, null, jsonResp => res.status(200).json(jsonResp));
	} catch(error) { return api_resp.getJson(error, api_resp.ACR_ERROR, 'ERROR inserting OpenVPN server prefix in rule', objModel, error, jsonResp => res.status(200).json(jsonResp)) }
});


/* Update POSITION policy_r__openvpn_prefix that exist */
router.put('/move',
utilsModel.disableFirewallCompileStatus,
async (req, res) => {
	try {
		if ((await openvpnPrefixModel.getOpenvpnClientesUnderPrefix(req.dbCon,req.prefix.openvpn,req.prefix.name)).length < 1)
			return api_resp.getJson(null, api_resp.ACR_EMPTY_CONTAINER, 'It is not possible to put empty prefixes into rule positions', objModel, null, jsonResp => res.status(200).json(jsonResp));
		
		if (await policyPrefixModel.checkExistsInPosition(req.dbCon,req.body.new_rule,req.body.prefix,req.body.openvpn,req.body.new_position))
			return api_resp.getJson(null, api_resp.ACR_ALREADY_EXISTS, 'OpenVPN server prefix name already exists in this rule position', objModel, null, jsonResp => res.status(200).json(jsonResp));

		// Get content of positions.
		const content = await policy_r__ipobjModel.getPositionsContent(req.dbCon, req.body.position, req.body.new_position);
		if (content.content1!=='O' || content.content2!=='O')
			throw(new Error('Invalid positions content'));

		// Invalidate compilation of the affected rules.
		await policy_cModel.deletePolicy_c(req.body.firewall, req.body.rule);
		await policy_cModel.deletePolicy_c(req.body.firewall, req.body.new_rule);

		// Move OpenVPN configuration object to the new position.
		const data = await policyPrefixModel.moveToNewPosition(req);

		api_resp.getJson(data, api_resp.ACR_UPDATED_OK, 'UPDATED OK', objModel, null, jsonResp => res.status(200).json(jsonResp));
	} catch(error) { return api_resp.getJson(null, api_resp.ACR_ERROR, 'ERROR', objModel, error, jsonResp => res.status(200).json(jsonResp)) }
});


/* Update ORDER de policy_r__interface that exist */
router.put('/order',
utilsModel.disableFirewallCompileStatus,
(req, res) => {
});


/* Remove policy_r__openvpn_prefix */
router.put("/del",
utilsModel.disableFirewallCompileStatus,
async (req, res) => {
	try { 
		await policyPrefixModel.deleteFromRulePosition(req);
		api_resp.getJson(null, api_resp.ACR_DELETED_OK, 'DELETE OK', objModel, null, jsonResp => res.status(200).json(jsonResp));
	} catch(error) { return api_resp.getJson(null, api_resp.ACR_ERROR, 'ERROR', objModel, error, jsonResp => res.status(200).json(jsonResp)) }
});

module.exports = router;