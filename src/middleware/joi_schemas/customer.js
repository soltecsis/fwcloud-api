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

		if (req.url==='/customer' && (req.method==='PUT'|| req.method==='POST')) {
			schema = Joi.object().keys({
				addr: sharedSch.comment,
				phone: sharedSch.comment,
				email: Joi.string().email().optional().allow('').allow(null),
				web: sharedSch.comment
			});

			if (req.method === 'POST')
				schema = schema.append({ customer: sharedSch.id.optional(),	name: Joi.string().regex(/^[\x09-\x0D -~\x80-\xFE]{1,254}$/) });
			else
				schema = schema.append({ customer: sharedSch.id, name: Joi.string().regex(/^[\x09-\x0D -~\x80-\xFE]{1,254}$/).optional() });
		} else if (req.method === 'PUT') {
			if (req.url === '/customer/get')
				schema = Joi.object().keys({ customer: sharedSch.id.optional() });
			else if (req.url === '/customer/del' || req.url === '/customer/restricted')
				schema = Joi.object().keys({ customer: sharedSch.id });
			else return reject(fwcError.BAD_API_CALL);
		} else return reject(fwcError.BAD_API_CALL);

		try {
			await schema.validateAsync(req.body, sharedSch.joiValidationOptions);
			resolve();
		} catch (error) { return reject(error) }
	});
};