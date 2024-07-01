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

import { FwCloudError } from '../error';
import { ErrorPayload } from '../../http/response-builder';
import { Responsable } from '../../contracts/responsable';
import { app } from '../../abstract-application';

export class HttpException extends FwCloudError implements Responsable {
  public status: number;

  constructor(message: string = null, status: number = 500, stack?: string) {
    super(message, stack);
    this.status = status;
  }

  public toResponse(): ErrorPayload {
    const response: ErrorPayload = {
      message: this.message,
    };

    if (app().config.get('env') !== 'prod') {
      response.stack = this.stackToArray();
    }

    return response;
  }
}
