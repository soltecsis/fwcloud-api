var express = require('express');
var router = express.Router();
var Ipobj_type__policy_positionModel = require('../../models/ipobj/ipobj_type__policy_position');
var api_resp = require('../../utils/api_response');
var objModel = 'IPOBJ TYPE - POSITION';


/* Get all ipobj_type__policy_positions*/
router.get('/policy', (req, res) => {
	Ipobj_type__policy_positionModel.getIpobj_type__policy_positions((error, data) => {
		//If exists ipobj_type__policy_position get data
		if (data && data.length > 0)
			api_resp.getJson(data, api_resp.ACR_OK, '', objModel, null, jsonResp => res.status(200).json(jsonResp));
		else
			api_resp.getJson(data, api_resp.ACR_NOTEXIST, 'not found', objModel, null, jsonResp => res.status(200).json(jsonResp));
	});
});

module.exports = router;