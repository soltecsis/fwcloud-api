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

schema.validate = (req) => {
  return new Promise(async (resolve, reject) => {
    const item2 = req.url.split('/')[2];
    if (item2 === 'group' || item2 === 'types' || item2 === 'mark') {
      try {
        const item1 = req.url.split('/')[1];
        resolve(await require('./' + item1 + '/' + item2).validate(req));
      } catch (error) {
        return reject(error);
      }
    }

    var schema = Joi.object().keys({ fwcloud: sharedSch.id });

    var valid_types = [1, 2, 3, 4, 5, 6, 7, 8, 9, 20, 21, 23, 24];

    if (req.method === 'POST' || (req.method === 'PUT' && req.url === '/ipobj')) {
      schema = schema.append({
        name: sharedSch.name,
        type: sharedSch.u8bits.valid(...valid_types),
        interface: sharedSch.id.allow(null).optional(),
        diff_serv: Joi.number().port().optional(),
        options: Joi.number().integer().optional(),
        comment: sharedSch.comment.optional(),
        force: sharedSch._0_1.optional(),
      });

      // We will have different schemas depending upon the req.body.type parameter.
      // Verify that this parameters, exists, is number and has the accepted values.
      if (
        req.body.type === undefined ||
        req.body.type === null ||
        typeof req.body.type !== 'number' ||
        valid_types.findIndex((type) => {
          return type == req.body.type;
        }) == -1
      )
        return reject(fwcError.BAD_BODY_TYPE);

      switch (req.body.type) {
        case 1: // IP
          schema = schema.append({
            protocol: sharedSch.u8bits.optional(),
          });
          break;

        case 2: // TCP
          schema = schema.append({
            protocol: Joi.number().valid(6),
            source_port_start: Joi.number().port(),
            source_port_end: Joi.number().port(),
            destination_port_start: Joi.number().port(),
            destination_port_end: Joi.number().port(),
            tcp_flags_mask: sharedSch.u8bits.optional(),
            tcp_flags_settings: sharedSch.u8bits.optional(),
          });
          break;

        case 3: // ICMP
          schema = schema.append({
            protocol: Joi.number().valid(1),
            icmp_code: Joi.number().integer().min(-1).max(255),
            icmp_type: Joi.number().integer().min(-1).max(255),
          });
          break;

        case 4: // UDP
          schema = schema.append({
            protocol: Joi.number().valid(17),
            source_port_start: Joi.number().port(),
            source_port_end: Joi.number().port(),
            destination_port_start: Joi.number().port(),
            destination_port_end: Joi.number().port(),
          });
          break;

        case 5: // ADDRESS
          schema = schema.append({
            ip_version: Joi.number().integer().valid(4, 6),
            address: Joi.alternatives().conditional('ip_version', {
              is: 4,
              then: sharedSch.ipv4,
              otherwise: sharedSch.ipv6,
            }),
            netmask: Joi.alternatives()
              .conditional('ip_version', {
                is: 4,
                then: Joi.alternatives(sharedSch.ipv4_netmask_cidr, sharedSch.ipv4_netmask),
                otherwise: sharedSch.ipv6_netmask,
              })
              .allow('')
              .optional(),
          });
          break;

        case 6: // ADDRESS RANGE
          schema = schema.append({
            ip_version: Joi.number().integer().valid(4, 6),
            range_start: Joi.alternatives().conditional('ip_version', {
              is: 4,
              then: sharedSch.ipv4,
              otherwise: sharedSch.ipv6,
            }),
            range_end: Joi.alternatives().conditional('ip_version', {
              is: 4,
              then: sharedSch.ipv4,
              otherwise: sharedSch.ipv6,
            }),
          });
          break;

        case 7: // NETWORK
          schema = schema.append({
            ip_version: Joi.number().integer().valid(4, 6),
            address: Joi.alternatives()
              .conditional('ip_version', { is: 4, then: sharedSch.ipv4, otherwise: sharedSch.ipv6 })
              .optional(),
            netmask: Joi.alternatives().conditional('ip_version', {
              is: 4,
              then: Joi.alternatives(sharedSch.ipv4_netmask_cidr, sharedSch.ipv4_netmask),
              otherwise: sharedSch.ipv6_netmask,
            }),
          });
          break;

        case 9: // DNS
          schema = schema.append({
            name: sharedSch.dns_name,
          });
          break;

        case 8: // HOST
        case 20: // GROUP
        case 21: // SERVICE GROUP
        case 23: // CONTINENT
        case 24: // COUNTRY
          break;
      }

      if (req.method === 'PUT') schema = schema.append({ id: sharedSch.id });
      else if (req.method === 'POST')
        schema = schema.append({
          node_parent: sharedSch.id.optional(),
          node_order: sharedSch.id,
          node_type: sharedSch.name,
        }); // node_type is an string
    } else if (req.method === 'PUT') {
      if (req.url === '/ipobj/get') schema = schema.append({ id: sharedSch.id });
      else if (
        req.url === '/ipobj/del' ||
        req.url === '/ipobj/where' ||
        req.url === '/ipobj/restricted'
      )
        schema = schema.append({ id: sharedSch.id, type: sharedSch.u8bits.valid(...valid_types) });
    } else return reject(fwcError.BAD_API_CALL);

    try {
      await schema.validateAsync(req.body, sharedSch.joiValidationOptions);

      // Semantic validation.
      if (req.method === 'POST' || (req.method === 'PUT' && req.url === '/ipobj')) {
        if (req.body.source_port_start > req.body.source_port_end) throw fwcError.SCR_PORT_1;
        if (req.body.destination_port_start > req.body.destination_port_end)
          throw fwcError.DST_PORT_1;
      }

      resolve();
    } catch (error) {
      return reject(error);
    }
  });
};
