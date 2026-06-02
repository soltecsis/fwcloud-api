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
import { PgpHelper } from '../../utils/pgp';

schema.validate = async req => {
	let schema;

	if (req.method === 'POST' && req.url === '/user/login') {
		schema = Joi.object().keys({
			customer: sharedSch.id,
			username: sharedSch.username,
			password: sharedSch.password,
			authCode: sharedSch.authCode,
			publicKey: Joi.string()
		});
	} else if (req.method === 'POST' && req.url === '/user/logout') {
		return;
	} else if (req.url === '/user' && (req.method === 'POST' || req.method === 'PUT')) {
		const isPost = req.method === 'POST';

		if (typeof req.body.password === 'string' && req.body.password !== '') {
			try {
				const pgp = new PgpHelper(req.session ? req.session.pgp : undefined);
				req.body.password = await pgp.decrypt(req.body.password);
			} catch (error) {
				throw fwcError.other(`PGP decrypt: ${error.message}`);
			}
		}

		const baseSchema = Joi.object().keys({
			customer: sharedSch.id,
			email: Joi.string().email().optional(),
			username: sharedSch.username,
			enabled: sharedSch._0_1,
			role: sharedSch.role,
			allowed_from: sharedSch.comment
		});

		schema = baseSchema.append(isPost ? {
			name: Joi.string().regex(/^[\x09-\x0D -~\x80-\xFE]{1,254}$/),
			password: sharedSch.password
		} : {
			user: sharedSch.id,
			customer: sharedSch.id,
			name: Joi.string().regex(/^[\x09-\x0D -~\x80-\xFE]{1,254}$/).optional(),
			password: sharedSch.password.optional()
		});
	} else if ((req.url === '/user/fwcloud' && req.method === 'POST') || (req.url === '/user/fwcloud/del' && req.method === 'PUT')) {
		schema = Joi.object().keys({ user: sharedSch.id, fwcloud: sharedSch.id });
	} else if (req.method === 'PUT') {
		switch (req.url) {
			case '/user/get':
				schema = Joi.object().keys({ customer: sharedSch.id, user: sharedSch.id.optional() });
				break;
			case '/user/del':
			case '/user/restricted':
				schema = Joi.object().keys({ customer: sharedSch.id, user: sharedSch.id });
				break;
			case '/user/fwcloud/get':
				schema = Joi.object().keys({ user: sharedSch.id });
				break;
			case '/user/changepass':
				schema = Joi.object().keys({ password: sharedSch.password });
				break;
			default:
				throw fwcError.BAD_API_CALL;
		}
	} else {
		throw fwcError.BAD_API_CALL;
	}

	await schema.validateAsync(req.body, sharedSch.joiValidationOptions);
};
