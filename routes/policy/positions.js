var express = require('express');
var router = express.Router();
var policyPositionModel = require('../../models/policy/position');
const fwcError = require('../../utils/error_table');

/* Get all policy_positions by Type*/
router.put('get', async (req, res) => {
	try {
		const data = await policyPositionModel.getPolicyPositionsByType(req.dbCon,req.body.type);
		//If exists policy_position get data
		if (data && data.length > 0)
			api_resp.getJson(data, api_resp.ACR_OK, '', objModel, null, jsonResp => res.status(200).json(jsonResp));
		else
			api_resp.getJson(data, api_resp.ACR_NOTEXIST, 'not found', objModel, null, jsonResp => res.status(200).json(jsonResp));
	} catch(error) { api_resp.getJson(error, api_resp.ACR_ERROR, 'ERROR', objModel, null, jsonResp => res.status(200).json(jsonResp)) }
});

module.exports = router;