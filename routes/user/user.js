var express = require('express');
var router = express.Router();
const userModel = require('../../models/user/user');
const restrictedCheck = require('../../middleware/restricted');
const api_resp = require('../../utils/api_response');
const objModel = 'USER';



var bcrypt = require('bcrypt');
var logger = require('log4js').getLogger("app");


//BLOQUEAR ACCESOS. SOLO ACCESO PARA ADMINISTRACION


/*---------------------------------------------------------------------------*/
/* AUTHENTICATION: Validate the user credentials and initialize data in the session file. */
/*---------------------------------------------------------------------------*/
router.post('/login',async (req, res) => {
  // Verify that we have all the required parameters for autenticate the user.
  if (!req.body.customer || !req.body.username || !req.body.password) {
		req.session.destroy(err => {} );
		api_resp.getJson(null, api_resp.ACR_ERROR, 'Bad data', objModel, null, jsonResp => { res.status(200).json(jsonResp) });
		return;
  }

  logger.debug("LOGIN: customer="+req.body.customer+", user="+req.body.username);

	try {
		const data = await userModel.getUserName(req.body.customer, req.body.username);
		if (data.length===0) {
			req.session.destroy(err => {});
			logger.debug("USER NOT FOUND: customer="+req.body.customer+", user="+req.body.username);
			throw null;
		}
		
		// Validate credentials.
		/* WARNING: As recomended in the bcrypt manual:
		Why is async mode recommended over sync mode?
		If you are using bcrypt on a simple script, using the sync mode is perfectly fine.
		However, if you are using bcrypt on a server, the async mode is recommended.
		This is because the hashing done by bcrypt is CPU intensive, so the sync version
		will block the event loop and prevent your application from servicing any other
		inbound requests or events.
		*/
		if (await bcrypt.compare(req.body.customer+req.body.username+req.body.password, data[0].password)) {
			// Return authorization token.
			req.session.customer_id = data[0].customer;
			req.session.user_id = data[0].id;
			req.session.username = data[0].username;
			api_resp.getJson({user_id: req.session.user_id}, api_resp.ACR_OK, 'User loged in.', objModel, null, jsonResp => res.status(200).json(jsonResp));
		} else {
			req.session.destroy(err => {} );
			logger.debug("INVALID PASSWORD: customer="+req.body.customer+", user="+req.body.username);
			throw null;
		}
	} catch(error) {
		api_resp.getJson(null, api_resp.ACR_ERROR, 'Invalid username or password.', objModel, error, jsonResp => res.status(200).json(jsonResp));
	} 
});
/*---------------------------------------------------------------------------*/

/*---------------------------------------------------------------------------*/
router.post('/logout',(req, res) => {
  logger.debug("DESTROYING SESSION (customer_id: "+req.session.customer_id+", user_id: "+req.session.user_id+", username: "+req.session.username+")");
  req.session.destroy(err => {});
  api_resp.getJson(null, api_resp.ACR_OK, 'Session destroyed.', objModel, null, jsonResp => { res.status(200).json(jsonResp) });
});
/*---------------------------------------------------------------------------*/



/**
 * @api {POST} /user New user
 * @apiName NewUser
 *  * @apiGroup USER
 * 
 * @apiDescription Create new customer. Customers allow group users.
 *
 * @apiParam {Number} [customer] New customer id.
 * <\br>The API will check that don't exists another customer with this id.
 * @apiParam {String} name Customer's name.
 * <\br>The API will check that don't exists another customer with the same name.
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
		if (await customerModel.existsName(req.dbCon,req.body.name))
			return api_resp.getJson(null, api_resp.ACR_ALREADY_EXISTS, 'Customer name already exists', objModel, null, jsonResp => res.status(200).json(jsonResp));
		await customerModel.insert(req);
		api_resp.getJson(null, api_resp.ACR_OK, 'Customer created', objModel, null, jsonResp => res.status(200).json(jsonResp));
	} catch (error) { return api_resp.getJson(null, api_resp.ACR_ERROR, 'Error creating customer', objModel, error, jsonResp => res.status(200).json(jsonResp)) }
});


/**
 * @api {PUT} /customer Update customer
 * @apiName UpdateCustomer
 *  * @apiGroup USER
 * 
 * @apiDescription Update customer's information.
 *
 * @apiParam {Number} [customer] Id of the customer that you want modify.
 * @apiParam {String} name Customer's name.
 * <\br>The API will check that don't exists another customer with the same name.
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
 *  * @apiGroup USER
 * 
 * @apiDescription Get customer data. 
 *
 * @apiParam {Number} [customer] Id of the customer.
 * <\br>If empty, the API will return the id and name for all the customers.
 * <\br>If it is not empty, it will return all the data for the indicated customer id.
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


/**
 * @api {PUT} /customer/del Delete customer
 * @apiName DelCustomer
 *  * @apiGroup USER
 * 
 * @apiDescription Delete customer from the database. 
 * <\br>A middleware is used for verify that the customer has no users before allow the deletion.
 *
 * @apiParam {Number} customer Customer's id.
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
 *         "respMsg": "Customer deleted",
 *         "errorCode": "",
 *         "errorMsg": ""
 *     },
 *     "data": {}
 * }
 */
router.put('/del', 
restrictedCheck.customer,
async (req, res) => {
	try {
		if (!(await customerModel.existsId(req.dbCon,req.body.customer)))
			return api_resp.getJson(null, api_resp.ACR_ERROR, 'Customer not found', objModel, null, jsonResp => res.status(200).json(jsonResp));

		const data = await customerModel.delete(req);
		api_resp.getJson(data, api_resp.ACR_OK, 'Customer deleted', objModel, null, jsonResp => res.status(200).json(jsonResp));
	} catch (error) { return api_resp.getJson(null, api_resp.ACR_ERROR, 'Error deleting customer', objModel, error, jsonResp => res.status(200).json(jsonResp)) }
});


/**
 * @api {PUT} /customer/restricted Restrictions for customer deletion
 * @apiName DelCustomer
 *  * @apiGroup USER
 * 
 * @apiDescription Check that there are no restrictions for customer deletion.
 *
 * @apiParam {Number} customer Customer's id.
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
 *         "respMsg": "",
 *         "errorCode": "",
 *         "errorMsg": ""
 *     },
 *     "data": {}
 * }
 * 
 * @apiErrorExample {json} Error-Response:
 * HTTP/1.1 200 OK
 * {
 *    "response": {
 *        "respStatus": false,
 *        "respCode": "ACR_RESTRICTED",
 *        "respCodeMsg": "null restricted",
 *        "respMsg": "RESTRICTED",
 *        "errorCode": "",
 *        "errorMsg": ""
 *    },
 *    "data": {
 *        "result": true,
 *        "restrictions": {
 *            "CustomerHasUsers": true
 *        }
 *    }
 * }
 */
router.put('/restricted',
	restrictedCheck.customer,
	(req, res) => api_resp.getJson(null, api_resp.ACR_OK, '', objModel, null, jsonResp => res.status(200).json(jsonResp)));

module.exports = router;