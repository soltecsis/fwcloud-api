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
 * CREATE New customer
 * 
 * 
 * > ROUTE CALL:  __/customer__      
 * > METHOD:  __POST__
 * 
 *
 * @method AddFirewall
 * 
 * @param {Integer} id Firewall identifier (AUTO)
 * @param {Integer} iduser User identifier
 * @param {Integer} cluster Cluster identifier
 * @param {String} name Firewall Name
 * @param {String} [comment] Firewall comment
 * 
 * @return {JSON} Returns Json result
 * @example 
 * #### JSON RESPONSE OK:
 *    
 *       {"data" : [
 *          { 
 *           "insertId : ID,   // New customer identifier           
 *          }
 *         ]
 *       };
 *       
 * #### JSON RESPONSE ERROR:
 *    
 *       {"data" : [
 *          { 
 *           "msg : ERROR,   //Text Error
 *          }
 *         ]
 *       };
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
 * UPDATE customer information
 * 
 * 
 * > ROUTE CALL:  __/customer__      
 * > METHOD:  __PUT__
 * 
 *
 * @method AddFirewall
 * 
 * @param {Integer} customer Customer identifier
 * @param {Integer} iduser User identifier
 * @param {Integer} cluster Cluster identifier
 * @param {String} name Firewall Name
 * @param {String} [comment] Firewall comment
 * 
 * @return {JSON} Returns Json result
 * @example 
 * #### JSON RESPONSE OK:
 *    
 *       {"data" : [
 *          { 
 *           "insertId : ID,   // New customer identifier           
 *          }
 *         ]
 *       };
 *       
 * #### JSON RESPONSE ERROR:
 *    
 *       {"data" : [
 *          { 
 *           "msg : ERROR,   //Text Error
 *          }
 *         ]
 *       };
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