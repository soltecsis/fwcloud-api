var express = require('express');
var router = express.Router();
var Ipobj_typeModel = require('../../models/ipobj/ipobj_type');
const fwcError = require('../../utils/error_table');

/* Get all ipobj_types */
router.get('/', (req, res) => {
	Ipobj_typeModel.getIpobj_types((error, data) => {
		//If exists ipobj_type get data
		if (data && data.length > 0)
			api_resp.getJson(data, api_resp.ACR_OK, '', objModel, null, jsonResp => res.status(200).json(jsonResp));
		else
			api_resp.getJson(data, api_resp.ACR_NOTEXIST, 'not found', objModel, null, jsonResp => res.status(200).json(jsonResp));
	});
});

/* Get  ipobj_type by id */
router.put('/get', async (req, res) => {
	try {
		const data = await Ipobj_typeModel.getIpobj_type(req, req.body.id);		
		if (data && data.length > 0)
			api_resp.getJson(data, api_resp.ACR_OK, '', objModel, null, jsonResp => res.status(200).json(jsonResp));
		else
			api_resp.getJson(data, api_resp.ACR_NOTEXIST, 'not found', objModel, null, jsonResp => res.status(200).json(jsonResp));
	} catch(error) { api_resp.getJson(null, api_resp.ACR_ERROR, 'ERROR', objModel, error, jsonResp => res.status(200).json(jsonResp)) }
});

module.exports = router;