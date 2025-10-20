/*!
    Copyright 2025 SOLTECSIS SOLUCIONES TECNOLOGICAS, SLU
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

import { Request } from 'express';
import { Validate } from '../../decorators/validate.decorator';
import { Controller } from '../../fonaments/http/controller';
import { ResponseBuilder } from '../../fonaments/http/response-builder';
import {
  AuditLogArchiverService,
  AuditLogArchiverUpdateableConfig,
} from '../../models/audit/AuditLogArchiver.service';
import { AuditLogArchiveConfigUpdateDto } from './dtos/audit-log-archive-config-update.dto';

export class AuditLogArchiveConfigController extends Controller {
  protected _auditLogArchiverService: AuditLogArchiverService;

  public async make(): Promise<void> {
    this._auditLogArchiverService = await this._app.getService<AuditLogArchiverService>(
      AuditLogArchiverService.name,
    );
  }

  @Validate()
  public async show(): Promise<ResponseBuilder> {
    const config = this._auditLogArchiverService.getCustomizedConfig();

    return ResponseBuilder.buildResponse().status(200).body({
      archive_days: config.archive_days,
      retention_days: config.retention_days,
    });
  }

  @Validate(AuditLogArchiveConfigUpdateDto)
  public async update(request: Request): Promise<ResponseBuilder> {
    const config = await this._auditLogArchiverService.updateArchiveConfig(
      request.body as AuditLogArchiverUpdateableConfig,
    );

    return ResponseBuilder.buildResponse().status(201).body({
      archive_days: config.archive_days,
      retention_days: config.retention_days,
    });
  }
}
