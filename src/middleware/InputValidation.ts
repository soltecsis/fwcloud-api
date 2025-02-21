/*!
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

import { Middleware } from '../fonaments/http/middleware/Middleware';
import fwcError from '../utils/error_table';
import { Request, Response, NextFunction } from 'express';
import { logger } from '../fonaments/abstract-application';

export class InputValidation extends Middleware {
  public async handle(req: Request, res: Response, next: NextFunction): Promise<void> {
    // The FWCloud.net API only supports these HTTP methods.
    if (
      req.method !== 'POST' &&
      req.method !== 'GET' &&
      req.method !== 'PUT' &&
      req.method !== 'DELETE'
    ) {
      logger().error(
        'Error during input validation check: ' + JSON.stringify(fwcError.NOT_ACCEPTED_METHOD),
      );
      res.status(400).json(fwcError.NOT_ACCEPTED_METHOD);
      return;
    }

    if ((req.method === 'GET' || req.method === 'DELETE') && Object.keys(req.body).length !== 0) {
      logger().error(
        'Error during input validation check: ' + JSON.stringify(fwcError.BODY_MUST_BE_EMPTY),
      );
      res.status(400).json(fwcError.BODY_MUST_BE_EMPTY);
      return;
    }

    const item1 = req.url.split('/')[1];
    const item1_valid_list = [
      'user',
      'customer',
      'fwcloud',
      'firewall',
      'cluster',
      'policy',
      'interface',
      'ipobj',
      'tree',
      'vpn',
      'config',
    ];

    const item1_new_route_system = [
      'backups',
      'version',
      'fwclouds',
      'updates',
      'iptables-save',
      'ping',
      'profile',
      'openvpnarchives',
      'systemctl',
      'vpn',
    ];

    // Verify that item1 is in the valid list.
    if (
      !item1_valid_list.includes(item1) &&
      !item1_new_route_system.includes(item1.replace(/\?.*/, ''))
    ) {
      logger().error('Unknown route: ' + item1);
      logger().error(
        'Error during input validation check: ' + JSON.stringify(fwcError.BAD_API_CALL),
      );
      res.status(404).json(fwcError.BAD_API_CALL);
      return;
    }

    if (item1_new_route_system.includes(item1.replace(/\?.*/, '')) && item1 != 'iptables-save') {
      return next();
    }

    // URLs excluded of the input data validation process because don't have any data to be validated.
    if (
      (req.method === 'GET' && req.url === '/fwcloud/all/get') ||
      (req.method === 'GET' && req.url === '/firewall/all/get') ||
      (req.method === 'GET' && req.url === '/cluster/all/get') ||
      (req.method === 'GET' && req.url === '/ipobj/types') ||
      (req.method === 'GET' && req.url === '/ipobj/positions/policy') ||
      (req.method === 'GET' && req.url === '/policy/types') ||
      (req.method === 'GET' && req.url === '/stream') ||
      (req.method === 'GET' && req.url === '/config') ||
      (req.method === 'PUT' && req.url.startsWith('/fwcloud/lock')) ||
      (req.method === 'PUT' && req.url.startsWith('/fwcloud/unlock'))
    )
      return next();

    try {
      // Validate input.
      await require(`./joi_schemas/${item1}`).validate(req);

      // If we arrive here then input data has been sucessfully validated.
      next();
    } catch (error) {
      if (Object.prototype.hasOwnProperty.call(error, '_object')) {
        delete error._object;
      }

      logger().error('Error during input validation check: ' + JSON.stringify(error));

      if (error.code === 'MODULE_NOT_FOUND') {
        res.status(400).json(fwcError.MODULE_NOT_FOUND);
      } else {
        res.status(400).json(error);
      }
    }
  }
}
