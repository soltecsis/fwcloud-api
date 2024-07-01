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

import { Controller } from '../../fonaments/http/controller';
import { UpdateService, Versions, Apps } from '../../updates/updates.service';
import { Validate } from '../../decorators/validate.decorator';
import { Request } from 'express';
import { ResponseBuilder } from '../../fonaments/http/response-builder';
import { app } from '../../fonaments/abstract-application';

interface UpdatesInfo {
  websrv: Versions;
  ui: Versions;
  api: Versions;
  updater: Versions;
}

export class UpdateController extends Controller {
  protected _updateUpdaterService: UpdateService;

  async make() {
    this._updateUpdaterService = await app().getService<UpdateService>(
      UpdateService.name,
    );
  }

  @Validate()
  public async proxy(request: Request): Promise<ResponseBuilder> {
    const data = await this._updateUpdaterService.proxyUpdate(request);

    return data
      ? ResponseBuilder.buildResponse().status(200).body(data)
      : ResponseBuilder.buildResponse().status(200);
  }

  @Validate()
  public async pkgInstallUpdatesData(
    request: Request,
  ): Promise<ResponseBuilder> {
    const updatesInfo: UpdatesInfo = {
      websrv: null,
      ui: await this._updateUpdaterService.compareVersions(Apps.UI),
      api: await this._updateUpdaterService.compareVersions(Apps.API),
      updater: null,
    };

    return updatesInfo
      ? ResponseBuilder.buildResponse().status(200).body(updatesInfo)
      : ResponseBuilder.buildResponse().status(200);
  }

  @Validate()
  public async update(): Promise<ResponseBuilder> {
    await this._updateUpdaterService.runUpdate();

    return ResponseBuilder.buildResponse().status(200);
  }
}
