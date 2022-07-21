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


var schema = {};
module.exports = schema;

const Joi = require('joi');
const sharedSch = require('./shared');
const fwcError = require('../../utils/error_table');

schema.validate = req => {
	return new Promise(async(resolve, reject) => {
		var schema = {};

		if (req.method === 'POST' && (req.url === '/user/login' || req.url === '/user/logout')) {
			if (req.url === '/user/login') {
				schema = Joi.object().keys({
					customer: sharedSch.id,
					username: sharedSch.username,
					password: sharedSch.password,
					authCode: sharedSch.authCode,
					publicKey: Joi.string()
				});
			}
		} else if (req.url === '/user' && (req.method === 'POST' || req.method === 'PUT')) {
			schema = Joi.object().keys({
				customer: sharedSch.id,
				email: Joi.string().email().optional(),
				username: sharedSch.username,
				enabled: sharedSch._0_1,
				role: sharedSch.role,
				allowed_from: sharedSch.comment
			});

			if (req.method === 'POST')
				schema = schema.append({ name: Joi.string().regex(/^[\x09-\x0D -~\x80-\xFE]{1,254}$/), password: sharedSch.password, });
			else
				schema = schema.append({
					user: sharedSch.id,
					customer: sharedSch.id,
					name: Joi.string().regex(/^[\x09-\x0D -~\x80-\xFE]{1,254}$/).optional(),
					password: sharedSch.password.optional()
				});
		} else if ((req.url === '/user/fwcloud' && req.method === 'POST') || (req.url === '/user/fwcloud/del' && req.method === 'PUT')) {
			schema = Joi.object().keys({ user: sharedSch.id, fwcloud: sharedSch.id });
		} else if (req.method === 'PUT') {
			if (req.url === '/user/get')
				schema = Joi.object().keys({ customer: sharedSch.id, user: sharedSch.id.optional() });
			else if (req.url === '/user/del' || req.url === '/user/restricted')
				schema = Joi.object().keys({ customer: sharedSch.id, user: sharedSch.id });
			else if (req.url === '/user/fwcloud/get')
				schema = Joi.object().keys({ user: sharedSch.id });
			else if (req.url === '/user/changepass')
				schema = Joi.object().keys({ password: sharedSch.password });
			else return reject(fwcError.BAD_API_CALL);
		}else return reject(fwcError.BAD_API_CALL);

		try {
			await Joi.validate(req.body, schema, sharedSch.joiValidationOptions);
			resolve();
		} catch (error) { return reject(error) }
	});
};