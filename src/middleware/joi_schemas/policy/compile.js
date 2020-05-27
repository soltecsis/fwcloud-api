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
  return new Promise(async (resolve, reject) => {
    var schema = Joi.object().keys({ 
      fwcloud: sharedSch.id,
      firewall: sharedSch.id
     });
    
    if (req.method==='PUT') {
      if (req.path==='/policy/compile') {
        if (Object.keys(req.query).length > 1) {
          return reject(fwcError.BAD_API_CALL);
        }

        if (Object.keys(req.query).length === 1 && Object.keys(req.query)[0] !== 'channel_id') {
          return reject(fwcError.BAD_API_CALL);
        }
        
        schema = schema.append({ socketid: sharedSch.socketio_id.optional() });
      }
      else if (req.url==='/policy/compile/rule')
        schema = schema.append({ type: sharedSch.policy_type, rule: sharedSch.id });
      else return reject(fwcError.BAD_API_CALL);
    } else return reject(fwcError.BAD_API_CALL);

    try {
      await Joi.validate(req.body, schema, sharedSch.joiValidationOptions);
      resolve();
    } catch(error) { return reject(error) } 
  });
};