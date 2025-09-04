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

schema.validate = req => {
	return new Promise(async(resolve, reject) => {
		var schema = {};

		if ((req.method==='POST' && req.url==='/cluster') || (req.method==='PUT' && req.url==='/cluster')) {
			try {
				if (req.body.clusterData.fwnodes) {
					let nodes = req.body.clusterData.fwnodes;
					const pgp = new PgpHelper(req.session.pgp);

					for (let i=0; i<nodes.length; i++) {
						// SSH user and password are encrypted with the PGP session key.
						if (nodes[i].install_user) nodes[i].install_user = await pgp.decrypt(nodes[i].install_user);
						if (nodes[i].install_pass) nodes[i].install_pass = await pgp.decrypt(nodes[i].install_pass);
						if (nodes[i].install_apikey) nodes[i].install_apikey = await pgp.decrypt(nodes[i].install_apikey);
					}
				}
			} catch(error) { return reject(fwcError.other(`PGP decrypt: ${error.message}`)) }
			
			var schemaItem = Joi.object().keys({
				name: sharedSch.name,
				comment: sharedSch.comment,
				save_user_pass: sharedSch._0_1,
				install_communication: Joi.string().regex(/ssh|agent/).default('ssh'),
				install_interface: sharedSch.id.allow(null).optional(),
				install_ipobj: sharedSch.id.allow(null).optional(),
				install_user: sharedSch.linux_user.allow(null).allow('').optional(),
				install_pass: sharedSch.linux_pass.allow(null).allow('').optional(),
				install_protocol: Joi.string().regex(/http|https/).allow(null),
				install_apikey: Joi.string().allow("").allow(null),
				install_port: Joi.number().port(),
				fwmaster: sharedSch._0_1,
			});

			var schemaClusterData = Joi.object().keys({
				name: sharedSch.name,
				comment: sharedSch.comment,
				options: sharedSch.u16bits,
				plugins: sharedSch.u32bits
			});

			schema = Joi.object().keys({ fwcloud: sharedSch.id });

			if (req.method === 'PUT')
				schemaClusterData = schemaClusterData.append({ cluster: sharedSch.id });
			else if (req.method === 'POST') {
				schemaClusterData = schemaClusterData.append({ fwnodes: Joi.array().items(schemaItem) });
				schema = schema.append({ node_id: sharedSch.id });
			}

			schema = schema.append({ clusterData: schemaClusterData });
		} else if (req.method === 'PUT') {
			schema = Joi.object().keys({ fwcloud: sharedSch.id });

			if (req.url === '/cluster/get' || req.url === '/cluster/del')
				schema = schema.append({ cluster: sharedSch.id });
			else if (req.url === '/cluster/clone')
				schema = schema.append({ cluster: sharedSch.id, node_id: sharedSch.id, name: sharedSch.name, comment: sharedSch.comment.optional() });
			else if (req.url === '/cluster/fwtocluster')
				schema = schema.append({ firewall: sharedSch.id, node_id: sharedSch.id });
			else if (req.url === '/cluster/clustertofw')
				schema = schema.append({ cluster: sharedSch.id, node_id: sharedSch.id });
			else if (req.url === '/cluster/restricted')
				schema = schema.append({ firewall: sharedSch.id });
			else if (req.url!=='/cluster/cloud/get')
				return reject(fwcError.BAD_API_CALL);
		} else return reject(fwcError.BAD_API_CALL);

		try {
			await schema.validateAsync(req.body, sharedSch.joiValidationOptions);
			resolve();
		} catch (error) { return reject(error) }
	});
};