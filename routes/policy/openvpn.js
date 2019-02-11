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
	//Create New objet with data policy_r__openvpn
	var policyOpenvpn = {
		rule: req.body.rule,
		interface: req.body.interface,
		negate: req.body.negate,
		position: req.body.position,
		position_order: req.body.position_order
	};

	try {
		const data = await policyOpenvpnModel.create(req.body.firewall, policyOpenvpn);
			//If saved policy_r__interface Get data
			if (data && data.result) {
				if (data.result) {
					Policy_rModel.compilePolicy_r(policy_r__interfaceData.rule, (error, datac) => {});
					api_resp.getJson(data, api_resp.ACR_INSERTED_OK, 'INSERTED OK', objModel, null, jsonResp => res.status(200).json(jsonResp));
				} else if (!data.allowed)
					api_resp.getJson(data, api_resp.ACR_NOT_ALLOWED, 'OpenVPN not allowed in this position', objModel, error, jsonResp => res.status(200).json(jsonResp));
				else
					api_resp.getJson(data, api_resp.ACR_NOTEXIST, 'OpenVPN not found', objModel, error, jsonResp => res.status(200).json(jsonResp));
			} else
				api_resp.getJson(data, api_resp.ACR_NOT_ALLOWED, 'OpenVPN not allowed in this position', objModel, null, jsonResp => res.status(200).json(jsonResp));
	} catch(error) { return api_resp.getJson(null, api_resp.ACR_ERROR, '', objModel, error, jsonResp => res.status(200).json(jsonResp)) }
});


module.exports = router;