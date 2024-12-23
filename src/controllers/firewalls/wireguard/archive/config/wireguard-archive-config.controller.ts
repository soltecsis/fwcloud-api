/*!
    Copyright 2022 SOLTECSIS SOLUCIONES TECNOLOGICAS, SLU
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

import { Validate } from '../../../../../decorators/validate.decorator';
import { app } from '../../../../../fonaments/abstract-application';
import { Controller } from '../../../../../fonaments/http/controller';
import { ResponseBuilder } from '../../../../../fonaments/http/response-builder';
import {
  WireGuardService,
  WireGuardUpdateableConfig,
} from '../../../../../models/vpn/wireguard/wireguard.service';
import { Request } from 'express';
import { WireGuardArchiveControllerUpdateDto } from './dtos/wireguard-archive-config-update.dto';

export class WireGuardArchiveConfigController extends Controller {
  protected _wireGuardService: WireGuardService;

  async make() {
    this._wireGuardService = await app().getService<WireGuardService>(WireGuardService.name);
  }

  /**
   * Returns the Wireguard archive config
   *
   * @param request
   * @param response
   */
  @Validate()
  public async show(): Promise<ResponseBuilder> {
    const config: WireGuardUpdateableConfig = this._wireGuardService.getCustomizedConfig();

    return ResponseBuilder.buildResponse().status(200).body({
      archive_days: config.history.archive_days,
      retention_days: config.history.retention_days,
    });
  }

  /**
   * Updates the Wireguard archive config
   *
   * @param request
   * @param response
   */
  @Validate(WireGuardArchiveControllerUpdateDto)
  public async update(request: Request): Promise<ResponseBuilder> {
    await this._wireGuardService.updateArchiveConfig({
      history: request.body as unknown as { archive_days: number; retention_days: number },
    });

    const config: WireGuardUpdateableConfig = this._wireGuardService.getCustomizedConfig();

    return ResponseBuilder.buildResponse().status(201).body({
      archive_days: config.history.archive_days,
      retention_days: config.history.retention_days,
    });
  }
}
