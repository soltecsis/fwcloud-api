/**
 * Module for routing customer requests
 * <br>BASE ROUTE CALL: <b>/customer</b>
 *
 * @module Customer
 * 
 * 
 */

var express = require('express');
var router = express.Router();
var customerModel = require('../../models/user/customers');
var api_resp = require('../../utils/api_response');
var objModel = 'CUSTOMER';


/**
 * @api {POST} /customer New customer
 * @apiName NewCustomer
 * @apiGroup CUSTOMER
 * 
 * @apiDescription Create new customer. Customers allow group users.
 *
 * @apiParam {Number} [customer] New customer id.
 * <br>The API will check that don't exists another customer with this id.
 * @apiParam {String} name Customer's name.
 * <br>The API will check that don't exists another customer with the same name.
 * @apiParam {String} [addr] Customer's address.
 * @apiParam {String} [phone] Customer's telephone.
 * @apiParam {String} [email] Customer's e-mail.
 * @apiParam {String} [web] Customer's website.
 * 
 * @apiParamExample {json} Request-Example:
 * {
 *   "customer": 10,
 *   "name": "SOLTECSIS, S.L.",
 *   "addr": "C/Carrasca,7 - 03590 Altea (Alicante) - Spain",
 *   "phone": "+34 966 446 046",
 *   "email": "info@soltecsis.com",
 *   "web": "https://soltecsis.com"
 * }
 *
 * @apiSuccessExample {json} Success-Response:
 * HTTP/1.1 200 OK
 * {
 *   "response": {
 *     "respStatus": true,
 *     "respCode": "ACR_OK",
 *     "respCodeMsg": "Ok",
 *     "respMsg": "Customer created",
 *     "errorCode": "",
 *     "errorMsg": ""
 *   },
 *   "data": {}
 * }
 *
 * @apiErrorExample {json} Error-Response:
 * HTTP/1.1 200 OK
 * {
 *   "response": {
 *     "respStatus": false,
 *     "respCode": "ACR_ALREADY_EXISTS",
 *     "respCodeMsg": "unknown error",
 *     "respMsg": "Customer already exists",
 *     "errorCode": "",
 *     "errorMsg": ""
 *   },
 *   "data": {}
 * }
 */
router.post('', async (req, res) => {
	try {
		// Verify that don't already exists a customer with the id or name indicated as a parameter in the body request.
		if (await customerModel.exists(req))
			return api_resp.getJson(null, api_resp.ACR_ALREADY_EXISTS, 'Customer already exists', objModel, null, jsonResp => res.status(200).json(jsonResp));
		await customerModel.insert(req);
		api_resp.getJson(null, api_resp.ACR_OK, 'Customer created', objModel, null, jsonResp => res.status(200).json(jsonResp));
	} catch (error) { return api_resp.getJson(null, api_resp.ACR_ERROR, 'Error creating customer', objModel, error, jsonResp => res.status(200).json(jsonResp)) }
});


/**
 * @api {PUT} /customer Update customer
 * @apiName UpdateCustomer
 * @apiGroup CUSTOMER
 * 
 * @apiDescription Update customer's information.
 *
 * @apiParam {Number} [customer] Id of the customer that you want modify.
 * @apiParam {String} name Customer's name.
 * <br>The API will check that don't exists another customer with the same name.
 * @apiParam {String} [addr] Customer's address.
 * @apiParam {String} [phone] Customer's telephone.
 * @apiParam {String} [email] Customer's e-mail.
 * @apiParam {String} [web] Customer's website.
 * 
 * @apiParamExample {json} Request-Example:
 * {
 *   "customer": 10,
 *   "name": "SOLTECSIS, S.L.",
 *   "addr": "C/Carrasca,7 - 03590 Altea (Alicante) - Spain",
 *   "phone": "+34 966 446 046",
 *   "email": "info@soltecsis.com",
 *   "web": "https://soltecsis.com"
 * }
 *
 * @apiSuccessExample {json} Success-Response:
 * HTTP/1.1 200 OK
 * {
 *   "response": {
 *     "respStatus": true,
 *     "respCode": "ACR_OK",
 *     "respCodeMsg": "Ok",
 *     "respMsg": "Customer updated",
 *     "errorCode": "",
 *     "errorMsg": ""
 *   },
 *   "data": {}
 * }
 *
 * @apiErrorExample {json} Error-Response:
 * HTTP/1.1 200 OK
 * {
 *   "response": {
 *     "respStatus": false,
 *     "respCode": "ACR_ALREADY_EXISTS",
 *     "respCodeMsg": "unknown error",
 *     "respMsg": "Already exists a customer with the same name",
 *     "errorCode": "",
 *     "errorMsg": ""
 *   },
 *   "data": {}
 * }
 */
router.put('', async (req, res) => {
	try {
		let customer_id_tmp = req.body.customer;
		req.body.customer=null;
		// Verify that don't already exists a customer with same name indicated in the body request.
		if (await customerModel.exists(req))
			return api_resp.getJson(null, api_resp.ACR_ALREADY_EXISTS, 'Already exists a customer with the same name', objModel, null, jsonResp => res.status(200).json(jsonResp));
		req.body.customer = customer_id_tmp;

		await customerModel.update(req);
		api_resp.getJson(null, api_resp.ACR_OK, 'Customer updated', objModel, null, jsonResp => res.status(200).json(jsonResp));
	} catch (error) { return api_resp.getJson(null, api_resp.ACR_ERROR, 'Error updating customer', objModel, error, jsonResp => res.status(200).json(jsonResp)) }
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