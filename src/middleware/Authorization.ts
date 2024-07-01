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
import { User } from '../models/user/User';
import { Request, Response, NextFunction } from 'express';
import { getRepository } from 'typeorm';
import { logger } from '../fonaments/abstract-application';
import { timeStamp } from 'console';

export class Authorization extends Middleware {
  public async handle(req: Request, res: Response, next: NextFunction) {
    // Exclude the login route.
    if (req.method === 'POST' && req.path === '/user/login') {
      return next();
    }

    /////////////////////////////////////////////////////////////////////////////////
    // WARNING!!!!: If you enable the next two code lines, then you disable
    // the authorization mechanism for access the API and it will be accessible
    // without authorization.
    //req.session.destroy(err => {} );
    //return next();
    /////////////////////////////////////////////////////////////////////////////////

    try {
      // Session must contain some mandatory data.
      if (
        !req.session.keepalive_ts ||
        !req.session.customer_id ||
        !req.session.user_id ||
        !req.session.username ||
        !req.session.pgp
      ) {
        req.session.destroy((err) => {});
        throw fwcError.SESSION_BAD;
      }

      // Verify that this session has had recent activity.
      const elapsed_ms: number = Date.now() - req.session.keepalive_ts;
      const keepalive_ms: number = this.app.config.get('session').keepalive_ms;
      if (elapsed_ms > keepalive_ms) {
        req.session.destroy((err) => {});
        throw fwcError.SESSION_EXPIRED;
      }
      req.session.keepalive_ts = Date.now(); // Update keepalive timestamp.

      const data: any = await User.getUserName(
        req.session.customer_id,
        req.session.username,
      );
      if (data.length === 0) {
        req.session.destroy((err) => {});
        throw fwcError.SESSION_BAD;
      }

      req.session.user = await getRepository(User).findOne(req.session.user_id);
      // If we arrive here, then the session is correct.
      logger().debug(
        'USER AUTHORIZED (customer_id: ' +
          req.session.customer_id +
          ', user_id: ' +
          req.session.user_id +
          ', username: ' +
          req.session.username +
          ')',
      );

      next();
    } catch (error) {
      logger().error(
        'Error during authorization middleware: ' + JSON.stringify(error),
      );
      res.status(400).json(error);
    }
  }
}
