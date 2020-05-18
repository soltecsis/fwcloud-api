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
import { Request, Response, NextFunction } from "express";
import { AuthorizationException } from "../fonaments/exceptions/authorization-exception";
import * as fs from "fs";
import * as path from "path";
import { app } from "../fonaments/abstract-application";
import { RepositoryService } from "../database/repository.service";
import { User } from "../models/user/User";
import { getRepository } from "typeorm";

type SessionData = {
    user_id: number,
    username: string,
    customer_id: number
};

export class AuthorizationTest extends Middleware {
    public async handle(req: Request, res: Response, next: NextFunction): Promise<void> {
        //const logger = this.app.logger;

        // Exclude the login route.
        if (req.method === 'POST' && req.path === '/user/login') {
            return next();
        }

        try {
            if (req.headers.cookie) {
                const fwcloudCookie = this.getFwCloudCookie(req.headers.cookie);

                if (!fwcloudCookie) {
                    throw new AuthorizationException();
                }

                const id: string = this.getSessionIdFromCookie(fwcloudCookie);
                const session_path: string = path.join(this.app.config.get('session').files_path, id + '.json'); 
                if (!fs.existsSync(session_path)) {
                    throw new AuthorizationException();
                }

                let session_data: SessionData = JSON.parse(fs.readFileSync(session_path).toString());

                req.session.customer_id = session_data.customer_id;
                req.session.user_id = session_data.user_id;
                req.session.username = session_data.username;
                req.session.user = await (getRepository(User).findOne(session_data.user_id);

                // If we arrive here, then the session is correct.
                //logger.debug("USER AUTHORIZED (customer_id: " + req.session.customer_id + ", user_id: " + req.session.user_id + ", username: " + req.session.username + ")");
                return next();
            }

            throw new AuthorizationException();
        } catch (e) {
            next(e);
        }
    }

    protected getFwCloudCookie(cookie: string): string {
        const cookies = cookie.split(';').map((item) => {
            return item.trim();
        })

        for(let i = 0; i < cookies.length; i++) {
            if (new RegExp('^' + this.app.config.get('session').name + '=').test(cookies[i])) {
                return cookies[i].split(this.app.config.get('session').name + '=')[1];
            }
        }
        
        return null;
    }

    protected getSessionIdFromCookie(cookie: string): string {
        return cookie.split('.')[0];
    }

}