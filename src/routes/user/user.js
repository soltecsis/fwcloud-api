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


import { createOperationRouter, legacyOperation } from '../../authorization/legacy-operation';
import { createHash } from 'node:crypto';
var router = createOperationRouter();
const restrictedCheck = require('../../middleware/restricted');
import { Customer } from '../../models/user/Customer';
import { User } from '../../models/user/User';
import { UserRole } from '../../models/user/user-role';
import { sessionOperation } from '../../authorization/operation-policy';
import { AuthService } from '../../models/user/auth.service';
import { FwCloud } from '../../models/fwcloud/FwCloud';
import { PgpHelper } from '../../utils/pgp';
import { app, logger } from '../../fonaments/abstract-application';
const speakeasy = require('speakeasy');
const QRCode = require('qrcode');
const fwcError = require('../../utils/error_table');

const config = require('../../config/config');

var bcrypt = require('bcryptjs');

const LOGIN_CHALLENGE_TTL_MS = 5 * 60 * 1000;

const regenerateSession = (req) => new Promise((resolve, reject) => {
	req.session.regenerate((error) => error ? reject(error) : resolve());
});

const passwordFingerprint = (hash) => createHash('sha256').update(hash).digest('hex');

function verifyLoginCode(secret, token) {
	if (!secret || typeof token !== 'string' || !/^[0-9]{6}$/.test(token) ||
		!speakeasy.totp.verify({ secret, encoding: 'base32', token })) {
		throw fwcError.BAD_LOGIN;
	}
}

/**
 * @api {POST} /login Log into the API
 * @apiName LoginUser
 *  * @apiGroup USER
 * 
 * @apiDescription Validate the user credentials and initialize data in the session file.
 * A user with 2FA receives HTTP 401 with `mfaRequired: true` if no code is supplied.
 * Submit `{ "authCode": "..." }` with the same session cookie to complete login.
 *
 * @apiParam {Number} customer Customert's id to which this user belongs to.
 * @apiParam {String} username Username for login into the FWCloud.net web interface.
 * @apiParam {String} password Username's password. 
 * 
 * @apiParamExample {json} Request-Example:
 * {
 *   "customer": 1,
 *   "username": "fwcadmin",
 *   "password": "fwcadmin"
 * }
 *
 * @apiSuccessExample {json} Success-Response:
 * HTTP/1.1 200 OK
 * {
 *   "user": 1,
 * 	 "role": 1
 * } 
 *
 * @apiErrorExample {json} Error-Response:
 * HTTP/1.1 401 Unauthorized
 * {
 *   "fwcErr": 1001,
 *   "msg": "Bad username or password"
 * } 
*/
legacyOperation(router, 'post', '/login', sessionOperation, async (req, res) => {
	try {
		let user;
		let uiPublicKey;

		if (req.body.customer === undefined) {
			const pending = req.session.pendingLogin;
			if (!pending || pending.expiresAt <= Date.now()) throw fwcError.BAD_LOGIN;

			// The challenge session never becomes an authenticated session.
			await regenerateSession(req);
			[user] = await User.getUserName(pending.customer, pending.username);
			if (!user || user.id !== pending.userId ||
				passwordFingerprint(user.password) !== pending.passwordFingerprint) {
				throw fwcError.BAD_LOGIN;
			}
			verifyLoginCode((await AuthService.GetTfa(user.id))?.secret, req.body.authCode);
			uiPublicKey = pending.uiPublicKey;
		} else {
			delete req.session.pendingLogin;
			const { customer, username, password, authCode, publicKey } = req.body;
			[user] = await User.getUserName(customer, username);
			if (!user || !(await bcrypt.compare(customer + username + password, user.password))) {
				throw fwcError.BAD_LOGIN;
			}

			// A setup that has not been verified is not an active second factor.
			const tfa = await AuthService.GetTfa(user.id);
			if (tfa?.secret) {
				const token = req.headers['x-tfa'] || authCode;
				if (token === undefined || token === null || token === '') {
					await regenerateSession(req);
					req.session.pendingLogin = {
						userId: user.id,
						customer: user.customer,
						username: user.username,
						passwordFingerprint: passwordFingerprint(user.password),
						uiPublicKey: publicKey,
						expiresAt: Date.now() + LOGIN_CHALLENGE_TTL_MS,
					};
					await new Promise((resolve, reject) => {
						req.session.save((error) => error ? reject(error) : resolve());
					});
					res.locals.__auditLogLoginChallenge = true;
					return res.status(401).json({ ...fwcError.BAD_LOGIN, mfaRequired: true });
				}
				verifyLoginCode(tfa.secret, token);
			}
			uiPublicKey = publicKey;
		}

		const pgp = new PgpHelper();
		await pgp.init(config.get('session').pgp_rsa_bits);
		req.session.customer_id = user.customer;
		req.session.user_id = user.id;
		req.session.username = user.username;
		req.session.admin_role = await User.isLoggedUserAdmin(req);
		req.session.keepalive_ts = Date.now();

		const xff = req.headers['x-forwarded-for'];
		const first_ip = (Array.isArray(xff) ? xff[0] : xff)?.split(',')[0]?.trim();
		req.session.remote_addr = first_ip || req.socket.remoteAddress || '';
		req.session.pgp = { public: pgp.publicKey, private: pgp.privateKey };
		req.session.uiPublicKey = uiPublicKey;
		res.status(200).json({ user: user.id, role: user.role, publicKey: pgp.publicKey });
	} catch (error) {
		// Failed authentication must also invalidate a previously authenticated cookie.
		if (req.session) await new Promise(resolve => req.session.destroy(() => resolve()));
		logger().error(`Login error${error.message ? `: ${error.message}` : '.'}`);
		res.status(401).json(error);
	}
});

/**
 * @api {POST} /logout Log out the API
 * @apiName LogoutUser
 *  * @apiGroup USER
 * 
 * @apiDescription Close a previous created user session.
 *
 * @apiSuccessExample {json} Success-Response:
 * HTTP/1.1 204 OK
*/
legacyOperation(router, 'post', '/logout', sessionOperation, async (req, res) => {
  if (req.session.user?.role !== UserRole.Viewer) await FwCloud.unlockAllLockedFwclouds(req.sessionID);
	req.session.destroy(err => {});
	res.status(204).end();
	
});



/**
 * @api {POST} /user New user
 * @apiName NewUser
 *  * @apiGroup USER
 * 
 * @apiDescription Create new user.<br>
 *
 * @apiParam {Number} customer Customert id to which this user belongs to.
 * <br>The API will check that exists a customer with this id. If the customer don't exists a not found error will 
 * be generated.
 * @apiParam {String} name Full name of the owner of this user.
 * @apiParam {String} [email] User's e-mail.
 * @apiParam {String} username Username for login into the FWCloud.net web interface.
 * @apiParam {String} password Username's password. 
 * @apiParam {Number} enabled If the user access is enabled or not.
 * @apiParam {Number} role The role assigned to this user.
 * <br>1 = Admin. Full access.
 * <br>2 = Manager. Cand manage the assigned clouds. Clouds are assigned by an user with admin role. 
 * @apiParam {String} allowed_from Comma separated list of IPs from which the user will be allowed to access to the
 * FWCloud.net web interface.
 * 
 * @apiParamExample {json} Request-Example:
 * {
 *   "customer": 2,
 *   "name": "My Personal Name",
 *   "email": "info@fwcloud.net",
 *   "username": "fwcusr",
 *   "password": "mysecret",
 *   "enabled": 1,
 *   "role": 1,
 *   "allowed_from": "10.99.4.10,192.168.1.1"
 * }
 *
 * @apiSuccessExample {json} Success-Response:
 * HTTP/1.1 200 OK
 * {
 *   "user": 5
 * }
 *
 * @apiErrorExample {json} Error-Response:
 * HTTP/1.1 400 Bad Request
 * {
 *   "fwcErr": 1002,
 * 	 "msg":	"Not found"
 * }
 * 
 * @apiErrorExample {json} Error-Response:
 * HTTP/1.1 400 Bad Request
 * {
 *   "fwcErr": 1003,
 * 	 "msg":	"Already exists"
 * }
 */
router.post('', async (req, res) => {
	try {
		// Remember that in the access control middleware we have already verified that the logged user
		// has the admin role. Then, we don't need to check it again.

		// Verify that exists the customer to which the new user will belong.
		if (!(await Customer.existsId(req.dbCon, req.body.customer)))
			throw fwcError.NOT_FOUND;

		// Verify that for the indicated customer we don't have another user with the same username.
		if (await User.existsCustomerUserName(req.dbCon, req.body.customer, req.body.username))
			throw fwcError.ALREADY_EXISTS;

		const new_user_id = await User._insert(req);

		// If the new user has the administrator role, then, allow him/her to see all existing fwclouds.
		if (req.body.role === 1)
			await User.allowAllFwcloudAccess(req.dbCon, new_user_id);

		res.status(200).json({ "user": new_user_id });
	} catch (error) {
		logger().error('Error creating a user: ' + JSON.stringify(error));
		res.status(400).json(error);
	}
});


/**
 * @api {PUT} /user Update user
 * @apiName UpdateUser
 *  * @apiGroup USER
 * 
 * @apiDescription Update user's data.
 *
 * @apiParam {Number} user User's id.
 * @apiParam {Number} customer Customert id to which this user belongs to.
 * <br>The API will check that exists a customer with this id.
 * @apiParam {String} name Full name of the owner of this user.
 * @apiParam {String} [email] User's e-mail.
 * @apiParam {String} username Username for login into the FWCloud.net web interface.
 * @apiParam {String} password Username's password. 
 * @apiParam {Number} enabled If the user access is enabled or not.
 * @apiParam {Number} role The role assigned to this user.
 * <br>1 = Admin. Full access.
 * <br>2 = Manager. Cand manage the assigned clouds. Clouds are assigned by an user with admin role. 
 * @apiParam {String} allowed_from Comma separated list of IPs from which the user will be allowed to access to the
 * FWCloud.net web interface.
 * 
 * @apiParamExample {json} Request-Example:
 * {
 *   "customer": 2,
 *   "name": "My Personal Name",
 *   "email": "info@fwcloud.net",
 *   "username": "fwcloud",
 *   "password": "mysecret",
 *   "enabled": 1,
 *   "role": 1,
 *   "allowed_from": "10.99.4.10,192.168.1.1"
 * }
 *
 * @apiSuccessExample {json} Success-Response:
 * HTTP/1.1 204 No Content
 *
 * @apiErrorExample {json} Error-Response:
 * HTTP/1.1 400 Bad Request
 * {
 *   "fwcErr": 1002,
 * 	 "msg":	"Not found"
 * }
 */
router.put('', async (req, res) => {
	try {
		// Verify that the customer exists.
		if (!(await Customer.existsId(req.dbCon, req.body.customer)))
			throw fwcError.NOT_FOUND;

		// Verify that the user exists and belongs to the indicated customer.
		if (!(await User.existsCustomerUserId(req.dbCon, req.body.customer, req.body.user)))
			throw fwcError.NOT_FOUND;

		// Veriry that don't exists another user with the same username into the same customer.
		if (await User.existsCustomerUserNameOtherId(req.dbCon, req.body.customer, req.body.username, req.body.user))
			throw fwcError.ALREADY_EXISTS_NAME;

		// If there is only on administrator user left and we want to change his role from administrator to manager,
		// don't allow it.
		if (await User.isAdmin(req) && req.body.role !== 1) {
			const data = await User.lastAdminUser(req);
			if (data.result)
				throw fwcError.other('It is not allowed to change the role of the last administrator user');
		}

		// Don't allow to change the role of the current logged user.
		// If we allow it the logged user will lost the power of change customers and users information.
		if (req.body.user === req.session.user_id && req.body.role !== 1)
			throw fwcError.other('It is not allowed to change the role of the logged user');

		await User._update(req);

		// If the modified user has the administrator role, then, allow him/her to see all existing fwclouds.
		if (req.body.role === 1)
			await User.allowAllFwcloudAccess(req.dbCon, req.body.user);

		res.status(204).end();
	} catch (error) {
		logger().error('Error updating a user: ' + JSON.stringify(error));
		res.status(400).json(error);
	}
});



/**
 * @api {PUT} /user/changepass Modify logged user password
 * @apiName ChangePassUser
 *  * @apiGroup USER
 * 
 * @apiDescription Modify the password of the logged user.
 *
 * @apiParam {String} password New user's password. 
 * 
 * @apiParamExample {json} Request-Example:
 * {
 *   "password": "mynewsecrec"
 * }
 *
 * @apiSuccessExample {json} Success-Response:
 * HTTP/1.1 204 No Content
 *
 * @apiErrorExample {json} Error-Response:
 * HTTP/1.1 400 Bad Request
 * {
 *   "fwcErr": 1002,
 * 	 "msg":	"Not found"
 * }
 */
router.put('/changepass', async (req, res) => {
	try {
		await User.changeLoggedUserPass(req);
		res.status(204).end();
	} catch (error) {
		logger().error('Error updating user credentials: ' + JSON.stringify(error));
		res.status(400).json(error);
	}
});


/**
 * @api {PUT} /user/get Get user data
 * @apiName GetUser
 *  * @apiGroup USER
 * 
 * @apiDescription Get user data. 
 *
 * @apiParam {Number} customer Id of the customer the user belongs to.
 * @apiParam {Number} [user] Id of the user.
 * <br>If empty, the API will return the id and name for all the users of this customer..
 * <br>If it is not empty, it will return all the data for the indicated user.
 * 
 * @apiParamExample {json} Request-Example:
 * {
 *   "customer": 2,
 *   "user": 1
 * }
 *
 * @apiSuccessExample {json} Success-Response:
 * HTTP/1.1 200 OK
 * {
 *    "id": 2,
 *    "customer": 2,
 *    "name": "My Personal Name",
 *    "email": "info@fwcloud.net",
 *    "username": "fwcusr",
 *    "password": "mysecret",
 *    "enabled": 1,
 *    "role": 1,
 *    "allowed_from": "10.99.4.10,192.168.1.1",
 *    "last_login": null,
 *    "confirmation_token": null,
 *    "created_at": "2019-05-13T15:11:20.000Z",
 *    "updated_at": "2019-05-13T15:11:20.000Z",
 *    "created_by": 0,
 *    "updated_by": 0
 * }
 * 
 * @apiErrorExample {json} Error-Response:
 * HTTP/1.1 400 Bad Request
 * {
 *   "fwcErr": 1002,
 * 	 "msg":	"Not found"
 * }
 */
router.put('/get', async (req, res) => {
	try {
		// Verify that the customer exists.
		if (!(await Customer.existsId(req.dbCon, req.body.customer)))
			throw fwcError.NOT_FOUND;

		// Check that the user indicated in the requests exists and belongs to the customer send in the request body.
		// req.body.customer is a mandatory parameter in Joi schema.
		if (req.body.user && !(await User.existsCustomerUserId(req.dbCon, req.body.customer, req.body.user)))
			throw fwcError.NOT_FOUND;

		const data = await User.get(req);
		res.status(200).json(req.body.user ? data[0] : data);
	} catch (error) {
		logger().error('Error finding a user: ' + JSON.stringify(error));
		res.status(400).json(error);
	}
});


/**
 * @api {PUT} /user/del Delete user
 * @apiName DelUser
 *  * @apiGroup USER
 * 
 * @apiDescription Delete user from the database. 
 * <br>A middleware is used for verify that this is not the last user with the admin role in the database.
 *
 * @apiParam {Number} customer Id of the customer the user belongs to.
 * @apiParam {Number} user Id of the user.
 * 
 * @apiParamExample {json} Request-Example:
 * {
 *   "customer": 2
 * }
 *
 * @apiSuccessExample {json} Success-Response:
 * HTTP/1.1 204 OK
 * 
 * @apiErrorExample {json} Error-Response:
 * HTTP/1.1 400 Bad Request
 * {
 *   "fwcErr": 1002,
 * 	 "msg":	"Not found"
 * }
 */
router.put('/del',
	restrictedCheck.user,
	async (req, res) => {
		try {
			if (!(await User.existsCustomerUserId(req.dbCon, req.body.customer, req.body.user)))
				throw fwcError.NOT_FOUND;

			if (req.body.user === req.session.user_id)
				throw fwcError.other('It is not allowed to delete the logged user');

			await User._delete(req);
			res.status(204).end();
		} catch (error) {
			logger().error('Error removing user: ' + JSON.stringify(error));
			res.status(400).json(error);
		}
	});


/**
 * @api {PUT} /user/restricted Restrictions for user deletion
 * @apiName RestrictedUser
 *  * @apiGroup USER
 * 
 * @apiDescription Check that there are no restrictions for user deletion.
 *
 * @apiParam {Number} customer Customer's id.
 * @apiParam {Number} user User's id.
 * 
 * @apiParamExample {json} Request-Example:
 * {
 *   "customer": 10,
 *   "user": 5
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
 * @apiSuccessExample {json} Success-Response:
 * HTTP/1.1 204 No Content
 *
 * @apiErrorExample {json} Error-Response:
 * HTTP/1.1 403 Forbidden
 * {
 *   "result": true,
 *   "restrictions": {
 *     "CustomerHasUsers": true
 *   }
 * } 
 */
router.put('/restricted', restrictedCheck.user, (req, res) => res.status(204).end());


/**
 * @api {POST} /user/fwcloud Enable cloud access.
 * @apiName UserAccessFwcloud
 *  * @apiGroup USER
 * 
 * @apiDescription Allow a user the access to a fwcloud.
 *
 * @apiParam {Number} user User's id.
 * @apiParam {Number} fwcloud FWCloud's id.
 * 
 * @apiParamExample {json} Request-Example:
 * {
 *   "user": 5,
 *   "fwcloud": 2
 * }
 *
 * @apiSuccessExample {json} Success-Response:
 * HTTP/1.1 204 No Content
 */
router.post('/fwcloud', async (req, res) => {
	try {
		// Remember that in the access control middleware we have already verified that the logged user
		// has the admin role. Then, we don't have to check it again.

		await User.allowFwcloudAccess(req.dbCon, req.body.user, req.body.fwcloud);
		res.status(204).end();
	} catch (error) {
		logger().error('Error enabling fwcloud access: ' + JSON.stringify(error));
		res.status(400).json(error);
	}
});


/**
 * @api {PUT} /user/fwcloud/del Disable cloud access.
 * @apiName UserDisableFwcloud
 *  * @apiGroup USER
 * 
 * @apiDescription Disable user access to a fwcloud.
 *
 * @apiParam {Number} user User's id.
 * @apiParam {Number} fwcloud FWCloud's id.
 * 
 * @apiParamExample {json} Request-Example:
 * {
 *   "user": 5,
 *   "fwcloud": 2
 * }
 *
 * @apiSuccessExample {json} Success-Response:
 * HTTP/1.1 204 No Content
 */
router.put('/fwcloud/del', async (req, res) => {
	try {
		// Remember that in the access control middleware we have already verified that the logged user
		// has the admin role. Then, we don't have to check it again.

		await User.disableFwcloudAccess(req.dbCon, req.body.user, req.body.fwcloud);
		res.status(204).end();
	} catch (error) {
		logger().error('Error disabling fwcloud access: ' + JSON.stringify(error));
		res.status(400).json(error);
	}
});


/**
 * @api {PUT} /user/fwcloud/get List of fwclouds with access.
 * @apiName ListUserAccessFwcloud
 *  * @apiGroup USER
 * 
 * @apiDescription List of fwclouds to which the indicated user has access to.
 *
 * @apiParam {Number} user User's id.
 * 
 * @apiParamExample {json} Request-Example:
 * {
 *   "user": 5
 * }
 *
 * @apiSuccessExample {json} Success-Response:
 * HTTP/1.1 200 OK
 * [
 *    {
 *        "id": 4,
 *        "name": "FWCloud-02",
 *        "created_at": "2019-05-14T11:37:19.000Z",
 *        "updated_at": "2019-05-14T11:37:19.000Z",
 *        "created_by": 0,
 *        "updated_by": 0,
 *        "locked_at": null,
 *        "locked_by": null,
 *        "locked": 0,
 *        "image": "",
 *        "comment": ""
 *    },
 *    {
 *        "id": 5,
 *        "name": "FWCloud-03",
 *        "created_at": "2019-05-14T11:37:24.000Z",
 *        "updated_at": "2019-05-14T11:57:06.000Z",
 *        "created_by": 0,
 *        "updated_by": 0,
 *        "locked_at": "2019-05-14T11:57:06.000Z",
 *        "locked_by": 1,
 *        "locked": 1,
 *        "image": "",
 *        "comment": ""
 *		}
 *	}
 * ]
 */
router.put('/fwcloud/get', async (req, res) => {
	try {
		const data = await FwCloud.getFwclouds(req.dbCon, req.body.user);
		if (data && data.length > 0)
			res.status(200).json(data);
		else
			res.status(204).end();
	} catch (error) {
		logger().error('Error getting user fwclouds: ' + JSON.stringify(error));
		res.status(400).json(error);
	}
});

module.exports = router;
