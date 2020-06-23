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
import { User } from '../models/user/User';
import StringHelper from "../utils/string.helper";
import { RepositoryService } from "../database/repository.service";
import { Repository } from "typeorm";
import { logger } from "../fonaments/abstract-application";

export class ConfirmationToken extends Middleware {
    public async handle(req: Request, res: Response, next: NextFunction) {
        try {
            
            if (this.app.config.get('confirmation_token') === false) {
                next();
                return;
            }

            if (this.isConfirmationTokenRequired(req) === false) {
                next();
                return;
            }

            if(this.hasValidConfirmationToken(req) === true) {
                next();
                return;
            }

            const newToken: string = await this.generateNewConfirmationToken(req.session.user, req.sessionID);
            res.status(403).json({ "fwc_confirm_token": newToken });
        
        } catch (error) { 
            logger().error('Error during confirmation token middleware: ' + JSON.stringify(error));
            res.status(400).json(error) 
        }
    }

    /**
     * Returns whether a request URL requires confirmation token validation
     * 
     * @param req 
     */
    protected isConfirmationTokenRequired(req: Request): boolean {
        if (req.url.split('/').pop() === 'get' || req.url.split('/').pop() === 'restricted' || req.url.split('/').pop() === 'where'
            || req.method === 'GET' || (req.method === 'POST' && req.path === '/user/login')) {
            return false;
        }

        return true;
    }

    /**
     * Returns whether the request has a validation token attached and is valid
     * 
     * @param req 
     */
    protected hasValidConfirmationToken(req: Request): boolean {
        if (req.session.user && req.session.user.confirmation_token === req.headers['x-fwc-confirm-token']) {
            return true;
        }

        return false;
    }

    /**
     * Generates a new confirmation token and assign it to the user
     * 
     * @param user 
     * @param sessionId 
     */
    protected async generateNewConfirmationToken(user: User, sessionId: string): Promise<string> {
        const userRepository: Repository<User> = (await this.app.getService<RepositoryService>(RepositoryService.name)).for(User);
        
        user.confirmation_token = sessionId + "_" + StringHelper.randomize(20);
        await userRepository.save(user);

        return user.confirmation_token;
    }
}