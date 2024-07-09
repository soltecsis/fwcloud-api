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

import { Controller } from '../fonaments/http/controller';
import { Request } from 'express';
import { app } from '../fonaments/abstract-application';
import { Application } from '../Application';
import { Version } from '../version/version';
import { ResponseBuilder } from '../fonaments/http/response-builder';
import { Validate } from '../decorators/validate.decorator';

export class VersionController extends Controller {
  @Validate()
  public async show(request: Request): Promise<ResponseBuilder> {
    const version: Version = app<Application>().version;

    return ResponseBuilder.buildResponse().status(200).body(version);
  }
}
