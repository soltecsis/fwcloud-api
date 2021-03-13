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
  return new Promise(async (resolve, reject) => {
    var schema = Joi.object().keys({
      name: sharedSch.name,
      image: sharedSch.img.optional(),
      comment: sharedSch.comment,
    });
    
    if (req.method==='PUT') {
      if (req.url==='/fwcloud/get' || req.url==='/fwcloud/del' || req.url==='/fwcloud/restricted') {
        schema = Joi.object().keys({ fwcloud: sharedSch.id });
        if (req.url==='/fwcloud/del') schema =  schema.append({ force: Joi.number().integer().valid([0, 1]).optional() });
      }
      else if (req.url==='/fwcloud' || req.url==='/fwcloud/lock' || req.url==='/fwcloud/unlock' || req.url==='/fwcloud/lock/get')
        schema = schema.append({ fwcloud: sharedSch.id });
      else return reject(fwcError.BAD_API_CALL);
    } else if (req.method!=='POST' && req.url!=='/fwcloud') return reject(fwcError.BAD_API_CALL);


    try {
      await Joi.validate(req.body, schema, sharedSch.joiValidationOptions);
      resolve();
    } catch(error) { return reject(error) } 
  });
};
