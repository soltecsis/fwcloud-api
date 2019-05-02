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
		if (req.body.customer && (await customerModel.existsId(req.dbCon,req.body.customer))) 
			return api_resp.getJson(null, api_resp.ACR_ALREADY_EXISTS, 'Customer id already exists', objModel, null, jsonResp => res.status(200).json(jsonResp));
		if (await customerModel.existsName(req.dbcon,req.body.name))
			return api_resp.getJson(null, api_resp.ACR_ALREADY_EXISTS, 'Customer name already exists', objModel, null, jsonResp => res.status(200).json(jsonResp));
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
		if (!(await customerModel.existsId(req.dbCon,req.body.customer)))
			return api_resp.getJson(null, api_resp.ACR_ERROR, 'Customer not found', objModel, null, jsonResp => res.status(200).json(jsonResp));

		// Verify that don't already exists a customer with same name indicated in the body request.
		if (await customerModel.existsName(req.dbCon,req.body.name))
			return api_resp.getJson(null, api_resp.ACR_ALREADY_EXISTS, 'Already exists a customer with the same name', objModel, null, jsonResp => res.status(200).json(jsonResp));

		await customerModel.update(req);
		api_resp.getJson(null, api_resp.ACR_OK, 'Customer updated', objModel, null, jsonResp => res.status(200).json(jsonResp));
	} catch (error) { return api_resp.getJson(null, api_resp.ACR_ERROR, 'Error updating customer', objModel, error, jsonResp => res.status(200).json(jsonResp)) }
});


/**
 * @api {PUT} /customer/get Get customer data
 * @apiName GetCustomer
 * @apiGroup CUSTOMER
 * 
 * @apiDescription Get customer data. 
 *
 * @apiParam {Number} [customer] Id of the customer.
 * <br>If empty, the API will return the id and name for all the customers.
 * <br>If it is not empty, it will return all the data for the indicated customer id.
 * 
 * @apiParamExample {json} Request-Example:
 * {
 *   "customer": 10
 * }
 *
 * @apiSuccessExample {json} Success-Response:
 * HTTP/1.1 200 OK
 * {
 *     "response": {
 *         "respStatus": true,
 *         "respCode": "ACR_OK",
 *         "respCodeMsg": "Ok",
 *         "respMsg": "Customer data sent",
 *         "errorCode": "",
 *         "errorMsg": ""
 *     },
 *     "data": [
 *         {
 *             "id": 1,
 *             "name": "SOLTECSIS, S.L.",
 *             "addr": null,
 *             "phone": null,
 *             "email": "info@soltecsis.com",
 *             "web": "https://soltecsis.com",
 *             "created_at": "2019-05-02T09:13:35.000Z",
 *             "updated_at": "2019-05-02T09:13:35.000Z",
 *             "created_by": 0,
 *             "updated_by": 0
 *         }
 *     ]
 * }
 */
router.put('/get', async (req, res) => {
	try {
		if (req.body.customer && !(await customerModel.existsId(req.dbCon,req.body.customer)))
			return api_resp.getJson(null, api_resp.ACR_ERROR, 'Customer not found', objModel, null, jsonResp => res.status(200).json(jsonResp));

		const data = await customerModel.get(req);
		api_resp.getJson(data, api_resp.ACR_OK, 'Customer data sent', objModel, null, jsonResp => res.status(200).json(jsonResp));
	} catch (error) { return api_resp.getJson(null, api_resp.ACR_ERROR, 'Error getting customer data', objModel, error, jsonResp => res.status(200).json(jsonResp)) }
});


module.exports = router;