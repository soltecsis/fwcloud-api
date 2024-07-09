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

import { Service } from '../services/service';
import { Request, Response, NextFunction } from 'express';
import { AuthorizationException } from '../exceptions/authorization-exception';

export class AuthorizationService extends Service {
  protected _policies: Array<any>;

  protected _req: Request;
  protected _res: Response;
  protected _next: NextFunction;

  public async build(): Promise<AuthorizationService> {
    this._next = null;
    this._req = null;
    this._res = null;

    return this;
  }

  public bindExpressContext(req: Request, res: Response, next: NextFunction) {
    this._req = req;
    this._res = res;
    this._next = next;
  }

  public revokeAuthorization(): Promise<void> {
    const exception = new AuthorizationException();
    this._next(exception);
    throw exception;
  }
}
