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
import { BackupService } from '../../backups/backup.service';
import { app } from '../../fonaments/abstract-application';
import { Backup } from '../../backups/backup';
import { ResponseBuilder } from '../../fonaments/http/response-builder';
import { Request } from 'express';
import { Channel } from '../../sockets/channels/channel';
import { Validate } from '../../decorators/validate.decorator';
import { FileInfo } from '../../fonaments/http/files/file-info';
import { HttpException } from '../../fonaments/exceptions/http/http-exception';
import { BackupControllerStoreDto } from './dtos/store.dto';
import { BackupControllerRestoreDto } from './dtos/restore.dto';
import { BackupControllerImportDto } from './dtos/import.dto';

export class BackupController extends Controller {
  protected _backupService: BackupService;

  async make() {
    this._backupService = await app().getService<BackupService>(
      BackupService.name,
    );
  }

  /**
   * Returns all backups
   *
   * @param request
   * @param response
   */
  @Validate()
  public async index(request: Request): Promise<ResponseBuilder> {
    const backups: Array<Backup> = await this._backupService.getAll();

    return ResponseBuilder.buildResponse().status(200).body(backups);
  }

  @Validate()
  public async show(request: Request): Promise<ResponseBuilder> {
    const backup: Backup = await this._backupService.findOneOrFail(
      parseInt(request.params.backup),
    );

    return ResponseBuilder.buildResponse().status(200).body(backup);
  }

  /**
   * Starts a backup
   *
   * @param request
   * @param response
   */
  @Validate(BackupControllerStoreDto)
  public async store(request: Request): Promise<ResponseBuilder> {
    const channel: Channel = await Channel.fromRequest(request);

    const backup: Backup = await this._backupService.create(
      request.inputs.get('comment'),
      channel,
    );
    return ResponseBuilder.buildResponse().status(201).body(backup);
  }

  /**
   * Restores a backup
   *
   * @param request
   * @param response
   */
  @Validate(BackupControllerRestoreDto)
  public async restore(request: Request): Promise<ResponseBuilder> {
    let backup: Backup = await this._backupService.findOne(
      parseInt(request.params.backup),
    );

    const channel: Channel = await Channel.fromRequest(request);

    this._app.config.set('maintenance_mode', true);

    try {
      backup = await this._backupService.restore(backup, channel);
      this._app.config.set('maintenance_mode', false);
      return ResponseBuilder.buildResponse().status(201).body(backup);
    } catch (err) {
      this._app.config.set('maintenance_mode', false);
      throw err;
    }
  }

  /**
   * Destroy a backup
   *
   * @param request
   * @param response
   */
  @Validate()
  public async destroy(request: Request): Promise<ResponseBuilder> {
    let backup: Backup = await this._backupService.findOneOrFail(
      parseInt(request.params.backup),
    );

    backup = await this._backupService.destroy(backup);

    return ResponseBuilder.buildResponse().status(200).body(backup);
  }

  @Validate()
  public async export(request: Request): Promise<ResponseBuilder> {
    const backup: Backup = await this._backupService.findOneOrFail(
      parseInt(request.params.backup),
    );

    const exportFilePath: string = await this._backupService.export(
      backup,
      30000,
    );

    return ResponseBuilder.buildResponse()
      .status(201)
      .download(exportFilePath, `backup_${backup.id}.zip`);
  }

  @Validate(BackupControllerImportDto)
  public async import(request: Request): Promise<ResponseBuilder> {
    try {
      const backup: Backup = await this._backupService.import(
        (<FileInfo>(<unknown>request.inputs.get('file'))).filepath,
      );
      return ResponseBuilder.buildResponse().status(201).body(backup);
    } catch (err) {
      throw new HttpException('Invalid backup file', 400);
    }
  }
}
