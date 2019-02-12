var express = require('express');
var router = express.Router();

const policyOpenvpnModel = require('../../models/policy/openvpn');
const api_resp = require('../../utils/api_response');
const utilsModel = require("../../utils/utils.js");


var objModel = "OpenVPN in Rule";


/* Create New policy_r__openvpn */
router.post("/",
utilsModel.disableFirewallCompileStatus,
async (req, res) => {
	try {
		// Verify that the OpenVPN configuration is of client type.
		if (req.body.type!==1)
			throw (new Error('Only OpenVPN client configurations allowed'));

		if (!(await checkOpenvpnPosition(req.dbCon,req.body.position)))
			throw (new Error('OpenVPN not allowed in this position'));

		await policyOpenvpnModel.insertInRule(req);
		Policy_rModel.compilePolicy_r(req.body.rule, (error, datac) => {});

		api_resp.getJson(null, api_resp.ACR_INSERTED_OK, 'INSERTED OK', objModel, null, jsonResp => res.status(200).json(jsonResp));
	} catch(error) { return api_resp.getJson(error, api_resp.ACR_ERROR, 'ERROR inserting OpenVPN in rule', objModel, error, jsonResp => res.status(200).json(jsonResp)) }
});

module.exports = router;