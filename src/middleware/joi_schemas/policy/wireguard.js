/*
    Copyright 2025 SOLTECSIS SOLUCIONES TECNOLOGICAS, SLU
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

schema.validate = (req) => {
  return new Promise(async (resolve, reject) => {
    var schema = Joi.object().keys({
      fwcloud: sharedSch.id,
      firewall: sharedSch.id,
      wireguard: sharedSch.id,
      rule: sharedSch.id,
    });

    if (req.method === 'POST' || req.method === 'PUT') {
      schema = schema.append({
        position: sharedSch.rule_position,
        position_order: sharedSch.u16bits,
      });
      if (req.method === 'PUT' && req.url === '/policy/wireguard/move')
        schema = schema.append({
          new_rule: sharedSch.id,
          new_position: sharedSch.rule_position,
          new_order: sharedSch.u16bits,
        });
      else if (req.method === 'PUT' && req.url === '/policy/wireguard/order')
        schema = schema.append({ new_order: sharedSch.u16bits });
    } else return reject(fwcError.BAD_API_CALL);

    try {
      await schema.validateAsync(req.body, sharedSch.joiValidationOptions);
      resolve();
    } catch (error) {
      return reject(error);
    }
  });
};
