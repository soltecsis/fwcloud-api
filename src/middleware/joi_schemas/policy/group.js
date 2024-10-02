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
const sharedSch = require('../shared');
const fwcError = require('../../../utils/error_table');

schema.validate = req => {
	return new Promise(async(resolve, reject) => {
		var schema = Joi.object().keys({
			fwcloud: sharedSch.id,
			firewall: sharedSch.id,
		});

		if (req.method === 'POST' || (req.method === 'PUT' && req.url === '/policy/group')) {
			schema = schema.append({
				name: sharedSch.name,
				comment: sharedSch.comment
			});
			if (req.method === 'PUT') schema = schema.append({ id: sharedSch.id });
			else schema = schema.append({ rulesIds: Joi.array().items(sharedSch.id) });
		} else if (req.method === 'PUT') {
			if (req.url === '/policy/group/style')
				schema = schema.append({ style: sharedSch.style, groupIds: Joi.array().items(sharedSch.id) });
			else if (req.url === '/policy/group/name')
				schema = schema.append({ id: sharedSch.id, name: sharedSch.name });
			else if (req.url === '/policy/group/del')
				schema = schema.append({ id: sharedSch.id });
			else if (req.url === '/policy/group/rules/del')
				schema = schema.append({ id: sharedSch.id, rulesIds: Joi.array().items(sharedSch.id) });
		} else return reject(fwcError.BAD_API_CALL);

		try {
			await schema.validateAsync(req.body, sharedSch.joiValidationOptions);
			resolve();
		} catch (error) { return reject(error) }
	});
};