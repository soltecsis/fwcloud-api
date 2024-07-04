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
import { FwCloudExportService } from '../../../fwcloud-exporter/fwcloud-export.service';
import { Request } from 'express';
import { ResponseBuilder } from '../../../fonaments/http/response-builder';
import { FwCloud } from '../../../models/fwcloud/FwCloud';
import { FwCloudExportPolicy } from '../../../policies/fwcloud-export.policy';
import { FwCloudExport } from '../../../fwcloud-exporter/fwcloud-export';
import { Validate } from '../../../decorators/validate.decorator';
import { FileInfo } from '../../../fonaments/http/files/file-info';
import moment from 'moment';
import { Channel } from '../../../sockets/channels/channel';
import { FwCloudExportControllerImportDto } from './dtos/import.dto';
import db from '../../../database/database-manager';

const fwcError = require('../../../utils/error_table');

export class FwCloudExportController extends Controller {
  protected _fwCloudExportService: FwCloudExportService;

  public async make(request: Request): Promise<void> {
    this._fwCloudExportService = await this._app.getService<FwCloudExportService>(
      FwCloudExportService.name,
    );
  }

  @Validate()
  public async store(request: Request): Promise<ResponseBuilder> {
    const fwCloud: FwCloud = await db
      .getSource()
      .manager.getRepository(FwCloud)
      .findOneOrFail({ where: { id: parseInt(request.params.fwcloud) } });

    (await FwCloudExportPolicy.store(fwCloud, request.session.user)).authorize();

    const channel: Channel = await Channel.fromRequest(request);

    const fwCloudExport: FwCloudExport = await this._fwCloudExportService.create(
      fwCloud,
      request.session.user,
      30000,
      channel,
    );

    return ResponseBuilder.buildResponse()
      .status(201)
      .download(
        fwCloudExport.exportPath,
        'fwcloud_' + fwCloud.id + '_' + moment().unix() + '.fwcloud',
      );
  }

  @Validate(FwCloudExportControllerImportDto)
  public async import(request: Request): Promise<ResponseBuilder> {
    let errorLimit: boolean = false;

    (await FwCloudExportPolicy.import(request.session.user)).authorize();

    await FwCloud.getFwclouds(request.dbCon, request.session.user_id).then((result: FwCloud[]) => {
      errorLimit =
        this._app.config.get('limits').fwclouds > 0 &&
        result.length >= this._app.config.get('limits').fwclouds;
    });

    if (errorLimit) {
      return ResponseBuilder.buildResponse().status(403).body(fwcError.LIMIT_FWCLOUDS);
    } else {
      const channel: Channel = await Channel.fromRequest(request);

      const fwCloud: FwCloud = await this._fwCloudExportService.import(
        (<FileInfo>(<unknown>request.inputs.get('file'))).filepath,
        request.session.user,
        channel,
      );

      return ResponseBuilder.buildResponse().status(201).body(fwCloud);
    }
  }
}
