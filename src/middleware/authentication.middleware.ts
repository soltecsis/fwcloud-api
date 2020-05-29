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

import { Middleware } from "../fonaments/http/middleware/Middleware";
import fwcError from '../utils/error_table';
import { User } from '../models/user/User';
import { Request, Response, NextFunction } from "express";
import { getRepository } from "typeorm";
import { logger } from "../fonaments/abstract-application";
import { AuthenticationException } from "./exceptions/authentication.exception";

export class AuthenticationMiddleware extends Middleware {
    public async handle(req: Request, res: Response, next: NextFunction) {
        // Exclude the login route.
        if (req.method === 'POST' && req.path === '/user/login') {
            return next();
        }

        /////////////////////////////////////////////////////////////////////////////////
        // WARNING!!!!: If you enable the next two code lines, then you disable
        // the authorization mechanism for access the API and it will be accesible
        // without autorization.
        //req.session.destroy(err => {} );
        //return next();
        /////////////////////////////////////////////////////////////////////////////////

        try {
            if (req.session.cookie.maxAge < 1) { // See if the session has expired.
                req.session.destroy(err => { });
                new AuthenticationException()
            }

            if (!req.session.customer_id || !req.session.user_id || !req.session.username || !req.session.pgp) {
                req.session.destroy(err => { });
                new AuthenticationException()
            }

            const data: any = await User.getUserName(req.session.customer_id, req.session.username);
            if (data.length === 0) {
                req.session.destroy(err => { });
                new AuthenticationException()
            }

            req.session.user = await getRepository(User).findOne(req.session.user_id);
            // If we arrive here, then the session is correct.
            logger().debug("USER AUTHORIZED (customer_id: " + req.session.customer_id + ", user_id: " + req.session.user_id + ", username: " + req.session.username + ")");
            next();
        } catch (e) {
            next(e);
        }
    }

}