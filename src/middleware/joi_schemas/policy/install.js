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
import { PgpHelper } from '../../../utils/pgp';
 
schema.validate = req => {
  return new Promise(async (resolve, reject) => {
    try {
      const pgp = new PgpHelper(req.session.pgp);
      // SSH user and password are encrypted with the PGP session key.
      if (req.body.sshuser) req.body.sshuser = await pgp.decrypt(req.body.sshuser);
      if (req.body.sshpass) req.body.sshpass = await pgp.decrypt(req.body.sshpass);
    } catch(error) { return reject(fwcError.other(`PGP decrypt: ${error.message}`)) }
    
    var schema = Joi.object().keys({ 
      fwcloud: sharedSch.id,
      firewall: sharedSch.id,
      sshuser: sharedSch.linux_user.optional(),
      sshpass: sharedSch.linux_pass.optional(),
      socketid: sharedSch.socketio_id.optional()
     });
    
    if (req.method!=='POST' && req.url!=='/policy/install') return reject(fwcError.BAD_API_CALL);

    try {
      await schema.validateAsync(req.body, sharedSch.joiValidationOptions);
      resolve();
    } catch(error) { return reject(error) } 
  });
};