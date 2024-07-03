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
    const item2 = req.path.split('/')[2];
    if (item2==='folder' || item2==='repair' || item2==='prefix')
    try {
      const item1 = req.path.split('/')[1];
      return resolve (await require('./'+item1+'/'+item2).validate(req));
    } catch(error) { return reject(error) }
  
    var schema = Joi.object().keys({ fwcloud: sharedSch.id });

    if (req.method ==='GET') {
      if (req.url === '/tree/node/getByNodeType') {
        schema = schema.append({ node_type: sharedSch.name});
      }
    }
    
    if (req.method==='PUT') {
      if (req.url==='/tree/objects/get' || req.url==='/tree/services/get')
        schema = schema.append({ objStandard: sharedSch._0_1, objCloud: sharedSch._0_1 });
      else if (req.url==='/tree/node/get')
        schema = schema.append({ node_type: sharedSch.name, id_obj: sharedSch.id.allow(null) });
      else if (req.url === '/tree/node/getByNodeType') {
        schema = schema.append({ node_type: sharedSch.name});
      }
      else if (req.url!=='/tree/firewalls/get' & req.url!=='/tree/ca/get')
        return reject(fwcError.BAD_API_CALL);
    } else return reject(fwcError.BAD_API_CALL);

    try {
      await schema.validateAsync(req.body, sharedSch.joiValidationOptions);
      resolve();
    } catch(error) { return reject(error) } 
  });
};
