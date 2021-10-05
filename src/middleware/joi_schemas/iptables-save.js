/*
    Copyright 2021 SOLTECSIS SOLUCIONES TECNOLOGICAS, SLU
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
		var schema = Joi.object().keys({
            socketid: sharedSch.socketio_id.optional(), 
            fwcloud: sharedSch.id, 
            firewall: sharedSch.id,
            ip_version: Joi.number().integer().valid([4, 6])
         });

        if (req.method==='PUT' && req.path==='/iptables-save/import') {
            if (Object.keys(req.query).length > 1) {
                return reject(fwcError.BAD_API_CALL);
            }
      
            if (Object.keys(req.query).length === 1 && Object.keys(req.query)[0] !== 'channel_id') {
                return reject(fwcError.BAD_API_CALL);
            }
              
            if (!req.body.type) return reject(fwcError.other('iptables-save import type expected'));
            schema = schema.append({ type: Joi.string().valid(['data', 'ssh']) });
      
            if (req.body.type==='data')
                schema = schema.append({ data: Joi.array().items(Joi.string()) });
            else if (req.body.type === 'remote') {
                try {
                    const pgp = new PgpHelper(req.session.pgp);
                    // SSH user and password are encrypted with the PGP session key.
                    if (req.body.sshuser) req.body.sshuser = await pgp.decrypt(req.body.sshuser);
                    if (req.body.sshpass) req.body.sshpass = await pgp.decrypt(req.body.sshpass);
                    if (req.body.apikey) req.body.apikey = await pgp.decrypt(req.body.apikey);

                } catch(error) { return reject(fwcError.other(`PGP decrypt: ${error.message}`)) }

                schema = schema.append({ 
                    ip: sharedSch.ipv4,
                    port: Joi.number().port(), 
                    sshuser: sharedSch.linux_user.optional(),
                    sshpass: sharedSch.linux_pass.optional(),
                    protocol: Joi.string().regex(/http|https/).optional().default('https'),
                    apikey: Joi.string().allow("").allow(null).optional().default(null),
                    communication: Joi.string().regex(/ssh|agent/).default('ssh'),
                });
            }
            else return reject(fwcError.other('Bad iptables-save import type'))
        } 
        else if (req.method==='PUT' && req.url==='/iptables-save/export') {
            try {
                const pgp = new PgpHelper(req.session.pgp);
                // SSH user and password are encrypted with the PGP session key.
                if (req.body.sshuser) req.body.sshuser = await pgp.decrypt(req.body.sshuser);
                if (req.body.sshpass) req.body.sshpass = await pgp.decrypt(req.body.sshpass);
            } catch(error) { return reject(fwcError.other(`PGP decrypt: ${error.message}`)) }

            schema = schema.append({ 
                sshuser: sharedSch.linux_user, 
                sshpass: sharedSch.linux_pass 
            });
        }
        else return reject(fwcError.BAD_API_CALL);

		try {
			await Joi.validate(req.body, schema, sharedSch.joiValidationOptions);
			resolve();
		} catch (error) { return reject(error) }
	});
};