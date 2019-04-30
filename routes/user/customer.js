var express = require('express');
var router = express.Router();
var customerModel = require('../../models/user/customers');
var api_resp = require('../../utils/api_response');
var objModel = 'CUSTOMER';




/* New customer */
router.post('', async (req, res) => {
	try {
		await customerModel.insertCustomer(req);
		api_resp.getJson(null, api_resp.ACR_OK, 'Customer created', objModel, null, jsonResp => res.status(200).json(jsonResp));
	} catch (error) { return api_resp.getJson(null, api_resp.ACR_ERROR, 'Error creating customer', objModel, error, jsonResp => res.status(200).json(jsonResp)) }
});

/* update customer */
router.put('/customer/:iduser', function (req, res)
{
	//Save customer data into object
	var customerData = {id: req.param('id'), name: req.param('name'), email: req.param('email'), cif: req.param('cif'), address: req.param('address'), telephone: req.param('telephone'), web: req.param('web')};
	customerModel.updateCustomer(customerData, function (error, data)
	{
		//saved ok
		if (data && data.result)
		{
			api_resp.getJson(null, api_resp.ACR_UPDATED_OK, 'UPDATED OK', objModel, null, function (jsonResp) {
				res.status(200).json(jsonResp);
			});
		} else
		{
			api_resp.getJson(data, api_resp.ACR_ERROR, 'Error', objModel, error, function (jsonResp) {
				res.status(200).json(jsonResp);
			});
		}
	});
});

/* Get customer by Id */
router.get('/customer/:iduser/:id', function (req, res)
{
	var id = req.params.id;

	if (!isNaN(id))
	{
		customerModel.getCustomer(id, function (error, data)
		{
			//Get data
			if (data && data.length > 0)
			{
				api_resp.getJson(data, api_resp.ACR_OK, '', objModel, null, function (jsonResp) {
					res.status(200).json(jsonResp);
				});

			}
			//Get error
			else
			{
				api_resp.getJson(data, api_resp.ACR_NOTEXIST, 'not found', objModel, null, function (jsonResp) {
					res.status(200).json(jsonResp);
				});
			}
		});
	}
	//id must be numeric
	else
	{
		api_resp.getJson(null, api_resp.ACR_DATA_ERROR, '', objModel, null, function (jsonResp) {
			res.status(200).json(jsonResp);
		});
	}
});



/* remove customer */
router.put("/del/customer/:iduser", function (req, res)
{

	var id = req.param('id');
	customerModel.deleteCustomer(id, function (error, data)
	{
		if (data && data.result)
		{
			api_resp.getJson(null, api_resp.ACR_DELETED_OK, 'DELETED OK', objModel, null, function (jsonResp) {
				res.status(200).json(jsonResp);
			});
		} else
		{
			api_resp.getJson(data, api_resp.ACR_ERROR, 'Error', objModel, error, function (jsonResp) {
				res.status(200).json(jsonResp);
			});
		}
	});
});


/* Get all customers */
router.get('/:iduser', function (req, res)
{
	customerModel.getCustomers(function (error, data)
	{
		//Get data
		if (data && data.length > 0)
		{
			api_resp.getJson(data, api_resp.ACR_OK, '', objModel, null, function (jsonResp) {
				res.status(200).json(jsonResp);
			});
		}
		//Get error
		else
		{
			api_resp.getJson(data, api_resp.ACR_NOTEXIST, 'not found', objModel, null, function (jsonResp) {
				res.status(200).json(jsonResp);
			});
		}
	});
});



module.exports = router;