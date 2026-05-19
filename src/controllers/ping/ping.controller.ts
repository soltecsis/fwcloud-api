/*!
    Copyright 2021 SOLTECSIS SOLUCIONES TECNOLOGICAS, SLU
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

import { Controller } from '../../fonaments/http/controller';
import { Request as ExpressRequest } from 'express';
import { ResponseBuilder } from '../../fonaments/http/response-builder';
import { Validate } from '../../decorators/validate.decorator';
import {
  Example,
  OperationId,
  Put,
  Request,
  Response,
  Route,
  Security,
  SuccessResponse,
  Tags,
} from 'tsoa';

interface PingApiEnvelopeResponse {
  status: number;
  response: string;
  message: string;
  data: null;
}

@Route('ping')
@Tags('ping')
@Security('sessionCookie')
export class PingController extends Controller {
  /**
   * Keep current authenticated session alive.
   * @summary Session keepalive ping.
   */
  @Validate()
  @OperationId('Ping session keepalive.')
  @Put('')
  @SuccessResponse('200', 'Ping processed')
  @Example<PingApiEnvelopeResponse>({
    status: 200,
    response: 'OK',
    message: '',
    data: null,
  })
  @Response<{ message: string }>('default', 'Unexpected error')
  public async ping(@Request() request: ExpressRequest): Promise<ResponseBuilder> {
    return ResponseBuilder.buildResponse().status(200);
  }
}
