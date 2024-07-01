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

import { Controller } from '../../../fonaments/http/controller';
import {
  BackupService,
  BackupUpdateableConfig,
} from '../../../backups/backup.service';
import { ResponseBuilder } from '../../../fonaments/http/response-builder';
import { Request } from 'express';
import { Validate } from '../../../decorators/validate.decorator';
import { BackupConfigControllerUpdateDto } from './dtos/update.dto';

export class BackupConfigController extends Controller {
  protected _backupService: BackupService;

  public async make(): Promise<void> {
    this._backupService = await this._app.getService<BackupService>(
      BackupService.name,
    );
  }
  /**
   * Returns the backup config
   *
   * @param request
   * @param response
   */
  @Validate()
  public async show(request: Request): Promise<ResponseBuilder> {
    const config: BackupUpdateableConfig =
      this._backupService.getCustomizedConfig();

    return ResponseBuilder.buildResponse().status(200).body(config);
  }

  /**
   * Updates the backup config
   *
   * @param request
   * @param response
   */
  @Validate(BackupConfigControllerUpdateDto)
  public async update(request: Request): Promise<ResponseBuilder> {
    await this._backupService.updateConfig(request.body);
    const config = this._backupService.config;

    return ResponseBuilder.buildResponse().status(201).body(config);
  }
}
