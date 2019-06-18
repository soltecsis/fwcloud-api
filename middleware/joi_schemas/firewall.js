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

		if (req.method === 'POST' || (req.method === 'PUT' && req.url === '/firewall')) {
			schema = Joi.object().keys({
				fwcloud: sharedSch.id,
				cluster: sharedSch.id.allow(null).optional(),
				name: sharedSch.name,
				comment: sharedSch.comment,
				install_user: sharedSch.linux_user.allow(null).allow('').optional(),
				install_pass: sharedSch.linux_pass.allow(null).allow('').optional(),
				save_user_pass: sharedSch._0_1,
				install_interface: sharedSch.id.allow(null).optional(),
				install_ipobj: sharedSch.id.allow(null).optional(),
				fwmaster: sharedSch._0_1,
				install_port: Joi.number().port(),
				options: sharedSch.u16bits
			});
			if (req.method === 'PUT') schema = schema.append({ firewall: sharedSch.id });
			else if (req.method === 'POST') schema = schema.append({ node_id: sharedSch.id });
		} else if (req.method === 'PUT') {
			schema = Joi.object().keys({ fwcloud: sharedSch.id });

			if (req.url === '/firewall/get' || req.url === '/firewall/del' || req.url === '/firewall/restricted')
				schema = schema.append({ firewall: sharedSch.id });
			else if (req.url === '/firewall/cluster/get')
				schema = schema.append({ cluster: sharedSch.id });
			else if (req.url === '/firewall/clone')
				schema = schema.append({ firewall: sharedSch.id, name: sharedSch.name, comment: sharedSch.comment, node_id: sharedSch.id });
			else if (req.url === '/firewall/delfromcluster')
				schema = schema.append({ firewall: sharedSch.id, cluster: sharedSch.id });
			else if (req.url!=='/firewall/cloud/get')
				return reject(fwcError.BAD_API_CALL);
		} else return reject(fwcError.BAD_API_CALL);

		try {
			await Joi.validate(req.body, schema, sharedSch.joiValidationOptions);
			resolve();
		} catch (error) { return reject(error) }
	});
};