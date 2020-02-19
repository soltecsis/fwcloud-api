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
import cors from 'cors';
import { Request, Response, NextFunction } from "express";

export class CORS extends Middleware {
    public handle(req: Request, res: Response, next: NextFunction) {
        const options = {
            credentials: true,
            origin: (origin: string, callback: (error: Error, status?: boolean) => void) => {
                if (this.app.config.get('CORS').whitelist.indexOf(origin) !== -1) {
                    this.app.logger.debug('Origin Allowed: ' + origin);
                    callback(null, true);
                } else {
                    this.app.logger.debug('Origin not allowed by cors: ' + origin);
                    callback(new Error('Origin not allowed by CORS: ' + origin));
                }
            }
        }
        this.app.express.options('*', cors(options));
        
        // CORS error handler
        this.app.express.use((err, req, res, next) => {
            res.status(400).send(fwcError.NOT_ALLOWED_CORS);
        });

        next();
    }

}