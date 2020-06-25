/*
    Copyright 2019 SOLTECSIS SOLUCIONES TECNOLOGICAS, SLU
    https://soltecsis.com
    info@soltecsis.com


    This file is part of FWCloud (https://fwcloud.net).

    FWCloud is free software: you can redistribute it and/or modify
    it under the terms of the GNU Affero General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    FWCloud is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU General Public License for more details.

    You should have received a copy of the GNU General Public License
    along with FWCloud.  If not, see <https://www.gnu.org/licenses/>.
*/


var express = require('express');
var router = express.Router();
import { Customer } from '../../models/user/Customer';
import { logger } from '../../fonaments/abstract-application';
const restrictedCheck = require('../../middleware/restricted');
const fwcError = require('../../utils/error_table');


/**
 * @api {POST} /customer New customer
 * @apiName NewCustomer
 * @apiGroup CUSTOMER
 * 
 * @apiDescription Create new customer. Customers allow group users.
 *
 * @apiParam {Number} [customer] New customer's id.
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
 *   "customer": 1,
 *   "name": "FWCloud.net",
 *   "addr": "C/Carrasca, 7 - 03590 Altea (Alicante) - Spain",
 *   "phone": "+34 966 446 046",
 *   "email": "info@fwcloud.net",
 *   "web": "https://fwcloud.net"
 * }
 *
 * @apiSuccessExample {json} Success-Response:
 * HTTP/1.1 204 No Content
 *
 * @apiErrorExample {json} Error-Response:
 * HTTP/1.1 400 Bad Request
 * {
 *   "fwcErr": 1004,
 *   "msg": "Already exists with the same id"
 * }
 * 
 * @apiErrorExample {json} Error-Response:
 * HTTP/1.1 400 Bad Request
 * {
 *   "fwcErr": 1005,
 *   "msg": "Already exists with the same name"
 * }
 */
router.post('', async (req, res) => {
	try {
		// Verify that don't already exists a customer with the id or name indicated as a parameter in the body request.
		if (req.body.customer && (await Customer.existsId(req.dbCon,req.body.customer))) 
			throw fwcError.ALREADY_EXISTS_ID;
		
		if (await Customer.existsName(req.dbCon,req.body.name))
			throw fwcError.ALREADY_EXISTS_NAME;
		
		await Customer.insert(req);
		res.status(204).end();
	} catch (error) {
		logger().error('Error creating a customer: ' + JSON.stringify(error));
		res.status(400).json(error);
	}
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
 *   "customer": 2,
 *   "name": "FWCloud.net",
 *   "addr": "C/Carrasca, 7 - 03590 Altea (Alicante) - Spain",
 *   "phone": "+34 966 446 046",
 *   "email": "info@fwcloud.net",
 *   "web": "https://www.fwcloud.net"
 * }
 *
 * @apiSuccessExample {json} Success-Response:
 * HTTP/1.1 204 No Content
 *
 * @apiErrorExample {json} Error-Response:
 * HTTP/1.1 400 Bad Request
 * {
 *   "fwcErr": 1002,
 *   "msg": "Not found"
 * }
 *
 * @apiErrorExample {json} Error-Response:
 * HTTP/1.1 400 Bad Request
 * {
 *   "fwcErr": 1005,
 *   "msg": "Already exists with the same name"
 * }
 */
router.put('', async (req, res) => {
	try {
		if (!(await Customer.existsId(req.dbCon,req.body.customer)))
			throw fwcError.NOT_FOUND;

		// Verify that don't already exists a customer with same name indicated in the body request.
		const customer_id_new_name = await Customer.existsName(req.dbCon,req.body.name);
		if (customer_id_new_name && customer_id_new_name!=req.body.customer)
			throw fwcError.ALREADY_EXISTS_NAME;

		await Customer.update(req);
		res.status(204).end();
	} catch (error) {
		logger().error('Error updating a customer: ' + JSON.stringify(error));
		res.status(400).json(error);
	}
});


/**
 * @api {PUT} /customer/get Get customer data
 * @apiName GetCustomer
 * @apiGroup CUSTOMER
 * 
 * @apiDescription Get customer data. 
 *
 * @apiParam {Number} [customer] Id of the customer.
 * <br>If empty, the API will return an array with the id and name for all the customers.
 * <br>If it is not empty, it will return a json object with all the data for the indicated customer id.
 *
 * @apiParamExample {json} Request-Example:
 * {
 * 	"customer": 2
 * }
 *
 * @apiSuccessExample {json} Success-Response:
 * HTTP/1.1 200 OK
 * {
 *    "id": 2,
 *    "name": "FWCloud.net",
 *    "addr": "C/Carrasca, 7 - 03590 Altea (Alicante) - Spain",
 *    "phone": "+34 966 446 046",
 *    "email": "info@fwcloud.net",
 *    "web": "https://fwcloud.net",
 *    "created_at": "2019-05-13T10:40:36.000Z",
 *    "updated_at": "2019-05-13T10:40:36.000Z",
 *    "created_by": 0,
 *    "updated_by": 0
 * }
 * 
 * @apiParamExample {json} Request-Example:
 * {
 * }
 * 
 * @apiSuccessExample {json} Success-Response:
 * HTTP/1.1 200 OK
 * [
 *    {
 *        "id": 1,
 *        "name": "SOLTECSIS, S.L."
 *    },
 *    {
 *        "id": 2,
 *        "name": "FWCloud.net"
 *    }
 * ]
 * 
 * @apiErrorExample {json} Error-Response:
 * HTTP/1.1 400 Bad Request
 * {
 *   "fwcErr": 1002,
 *   "msg": "Not found"
 * }
 */
router.put('/get', async (req, res) => {
	try {
		if (req.body.customer && !(await Customer.existsId(req.dbCon,req.body.customer)))
			throw fwcError.NOT_FOUND;

		const data = await Customer.get(req);
		res.status(200).json(req.body.customer ? data[0] : data);
	} catch (error) {
		logger().error('Error finding a customer: ' + JSON.stringify(error));
		res.status(400).json(error);
	}
});


/**
 * @api {PUT} /customer/del Delete customer
 * @apiName DelCustomer
 * @apiGroup CUSTOMER
 * 
 * @apiDescription Delete customer from the database. 
 * <br>A middleware is used for verify that the customer has no users before allow the deletion.
 *
 * @apiParam {Number} customer Customer's id.
 * 
 * @apiParamExample {json} Request-Example:
 * {
 *   "customer": 1
 * }
 *
 * @apiSuccessExample {json} Success-Response:
 * HTTP/1.1 204 No Content
 * 
 * @apiErrorExample {json} Error-Response:
 * HTTP/1.1 400 Bad Request
 * {
 *   "fwcErr": 1002,
 *   "msg": "Not found"
 * }
 * 
 * @apiErrorExample {json} Error-Response:
 * HTTP/1.1 403 Forbidden
 * {
 *    "result": true,
 *    "restrictions": {
 *        "CustomerHasUsers": true
 *    }
 * }
*/
router.put('/del', 
restrictedCheck.customer,
async (req, res) => {
	try {
		if (!(await Customer.existsId(req.dbCon,req.body.customer)))
			throw fwcError.NOT_FOUND;

		await Customer.delete(req);
		res.status(204).end();
	} catch (error) {
		logger().error('Error removing a customer: ' + JSON.stringify(error));
		res.status(400).json(error);
	}
});


/**
 * @api {PUT} /customer/restricted Restrictions for customer deletion
 * @apiName DelCustomer
 * @apiGroup CUSTOMER
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
 * HTTP/1.1 204 No Content
 * 
 * @apiErrorExample {json} Error-Response:
 * HTTP/1.1 403 Forbidden
 * {
 *    "result": true,
 *    "restrictions": {
 *        "CustomerHasUsers": true
 *    }
 * }
 */
router.put('/restricted', restrictedCheck.customer, (req, res) => res.status(204).end());

module.exports = router;