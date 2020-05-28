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

import { Request, Response, NextFunction } from "express";
import { ResponseBuilder } from "../fonaments/http/response-builder";
import { HttpException } from "../fonaments/exceptions/http/http-exception";
import { ErrorMiddleware } from "../fonaments/http/middleware/Middleware";
import { CorsException } from "./exceptions/cors.exception";
import fwcError from '../utils/error_table';

export class ErrorResponse extends ErrorMiddleware {
    public handle(error: Error, req: Request, res: Response, next: NextFunction) {
        const exceptionName: string = error.constructor ? error.constructor.name : 'Error';

        if(error.stack) {
            const stackLine: Array<string> = error.stack.split('\n');

            for(let i = 0; i < stackLine.length; i++) {
                this.app.logger().error(stackLine[i]);
            }
        } else {
            this.app.logger().error(`${exceptionName}: ${error.message}`);
        }
        
        //TODO
        if (error instanceof CorsException) {
            res.status(400).send(fwcError.NOT_ALLOWED_CORS);
            return;
        }

        return ResponseBuilder.buildResponse().error(error).build(res).send();
    }

}