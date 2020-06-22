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
const sharedSch = require('../../shared');
const fwcError = require('../../../../utils/error_table');
 
schema.validate = req => {
  return new Promise(async (resolve, reject) => {
    var schema = Joi.object().keys({ fwcloud: sharedSch.id });

    if (req.method==="POST") {
      schema = schema.append({ 
        cn: sharedSch.cn,
        days: sharedSch.days,
        node_id: sharedSch.id,
        comment: sharedSch.comment,
        socketid: sharedSch.socketio_id.optional(),
        type: sharedSch.crt_type,
        ca: sharedSch.id
      });
    }
    else if (req.method==="PUT") {
      if (req.url==='/vpn/pki/crt/exists')
        schema = schema.append({ ca: sharedSch.id, cn: sharedSch.cn });
      else
        schema = schema.append({ crt: sharedSch.id });
    } else return reject(fwcError.BAD_API_CALL);

    try {
      await Joi.validate(req.body, schema, sharedSch.joiValidationOptions);
      resolve();
    } catch(error) { return reject(error) } 
  });
};
