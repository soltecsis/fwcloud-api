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

import { Request, Response, NextFunction } from 'express';
import { ResponseBuilder } from '../fonaments/http/response-builder';
import { ErrorMiddleware } from '../fonaments/http/middleware/Middleware';
import { NotFoundException } from '../fonaments/exceptions/not-found-exception';

export class ErrorResponse extends ErrorMiddleware {
  public handle(error: Error, req: Request, res: Response, next: NextFunction) {
    const exceptionName: string = error.constructor ? error.constructor.name : 'Error';

    if (error.stack) {
      const stackLine: Array<string> = error.stack.split('\n');

      for (let i = 0; i < stackLine.length; i++) {
        this.app.logger().error(stackLine[i]);
      }
    } else {
      this.app.logger().error(`${exceptionName}: ${error.message}`);
    }

    /**
     * If a response has been already sent, then avoid modify response.
     */
    if (res.headersSent) {
      return;
    }

    // If the exception is EntityNotFoundError, then a 404 is returned.
    if (exceptionName === 'EntityNotFoundError') {
      error = new NotFoundException(error.message);
    }

    return ResponseBuilder.buildResponse().error(error).build(res).send();
  }
}
