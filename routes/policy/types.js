var express = require('express');
var router = express.Router();
var Policy_typeModel = require('../../models/policy/policy_type');
const fwcError = require('../../utils/error_table');


/* Get all policy_types*/
router.get('', (req, res) => {
	Policy_typeModel.getPolicy_types((error, data) => {
		//If exists policy_type get data
		if (data && data.length > 0)
			api_resp.getJson(data, api_resp.ACR_OK, '', objModel, null, jsonResp => res.status(200).json(jsonResp));
		//Get Error
		else
			api_resp.getJson(data, api_resp.ACR_NOTEXIST, 'not found', objModel, null, jsonResp => res.status(200).json(jsonResp));
	});
});



/* Get  policy_type by type */
router.get('/:type', function (req, res)
{
	var type = req.params.type;
	Policy_typeModel.getPolicy_type(type, function (error, data)
	{
		//If exists policy_type get data
		if (data && data.length > 0)
		{
			api_resp.getJson(data, api_resp.ACR_OK, '', objModel, null, function (jsonResp) {
				res.status(200).json(jsonResp);
			});
		}
		//Get Error
		else
		{
			api_resp.getJson(data, api_resp.ACR_NOTEXIST, 'not found', objModel, null, function (jsonResp) {
				res.status(200).json(jsonResp);
			});
		}
	});
});

/* Get all policy_types by name */
router.get('/name/:name', function (req, res)
{
	var name = req.params.name;
	Policy_typeModel.getPolicy_typeName(name, function (error, data)
	{
		//If exists policy_type get data
		if (data && data.length > 0)
		{
			api_resp.getJson(data, api_resp.ACR_OK, '', objModel, null, function (jsonResp) {
				res.status(200).json(jsonResp);
			});
		}
		//Get Error
		else
		{
			api_resp.getJson(data, api_resp.ACR_NOTEXIST, 'not found', objModel, null, function (jsonResp) {
				res.status(200).json(jsonResp);
			});
		}
	});
});




/* Create New policy_type */
router.post("/policy-type/", function (req, res)
{
	//Create New objet with data policy_type
	var policy_typeData = {
		type: req.body.type,
		name: req.body.comment
	};

	Policy_typeModel.insertPolicy_type(policy_typeData, function (error, data)
	{
		if (error)
			api_resp.getJson(data, api_resp.ACR_ERROR, 'SQL ERRROR', '', error, function (jsonResp) {
				res.status(200).json(jsonResp);
			});
		else {
			//If saved policy_type Get data
			if (data && data.insertId)
			{
				//res.redirect("/policy-types/policy-type/" + data.insertId);
				var dataresp = {"insertId": data.insertId};
				api_resp.getJson(dataresp, api_resp.ACR_INSERTED_OK, 'INSERTED OK', objModel, null, function (jsonResp) {
					res.status(200).json(jsonResp);
				});
			} else
			{
				api_resp.getJson(data, api_resp.ACR_ERROR, 'Error', objModel, error, function (jsonResp) {
					res.status(200).json(jsonResp);
				});
			}
		}
	});
});

/* Update policy_type that exist */
router.put('/policy-type/', function (req, res)
{
	//Save data into object
	var policy_typeData = {type: req.param('type'), name: req.param('name')};
	Policy_typeModel.updatePolicy_type(policy_typeData, function (error, data)
	{
		if (error)
			api_resp.getJson(data, api_resp.ACR_ERROR, 'SQL ERRROR', '', error, function (jsonResp) {
				res.status(200).json(jsonResp);
			});
		else {
			//If saved policy_type saved ok, get data
			if (data && data.result)
			{
				//res.redirect("/policy-types/policy-type/" + req.param('type'));
				api_resp.getJson(null, api_resp.ACR_UPDATED_OK, 'UPDATED OK', objModel, null, function (jsonResp) {
					res.status(200).json(jsonResp);
				});
			} else
			{
				api_resp.getJson(data, api_resp.ACR_ERROR, 'Error', objModel, error, function (jsonResp) {
					res.status(200).json(jsonResp);
				});
			}
		}
	});
});



/* Remove policy_type */
router.put("/del/policy-type/", function (req, res)
{
	//Id from policy_type to remove
	var idfirewall = req.param('idfirewall');
	var type = req.param('type');
	Policy_typeModel.deletePolicy_typeidfirewall(idfirewall, type, function (error, data)
	{
		if (error)
			api_resp.getJson(data, api_resp.ACR_ERROR, 'SQL ERRROR', '', error, function (jsonResp) {
				res.status(200).json(jsonResp);
			});
		else {
			if (data && data.result)
			{
				//res.redirect("/policy-types/");
				api_resp.getJson(null, api_resp.ACR_UPDATED_OK, 'DELETED OK', objModel, null, function (jsonResp) {
					res.status(200).json(jsonResp);
				});
			} else
			{
				api_resp.getJson(data, api_resp.ACR_ERROR, 'Error', objModel, error, function (jsonResp) {
					res.status(200).json(jsonResp);
				});
			}
		}
	});
});

module.exports = router;