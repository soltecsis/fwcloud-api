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

import { Controller } from "../../fonaments/http/controller";
import { FwCloudExportService } from "../../fwcloud-exporter/fwcloud-export.service";
import { Request } from "express";
import { ResponseBuilder } from "../../fonaments/http/response-builder";
import { FwCloud } from "../../models/fwcloud/FwCloud";
import { getRepository } from "typeorm";
import { FwCloudExportPolicy } from "../../policies/fwcloud-export.policy";
import { FwCloudExport } from "../../fwcloud-exporter/fwcloud-export";
import { Validate } from "../../decorators/validate.decorator";
import { Required } from "../../fonaments/validation/rules/required.rule";
import { File } from "../../fonaments/validation/rules/file.rule";
import { FileInfo } from "../../fonaments/http/files/file-info";
import moment from "moment";
import { Extension } from "../../fonaments/validation/rules/extension.rule";

export class FwCloudExportController extends Controller {
    protected _fwCloudExportService: FwCloudExportService;

    public async make(request: Request): Promise<void> {
        this._fwCloudExportService = await this._app.getService<FwCloudExportService>(FwCloudExportService.name);
    }

    @Validate({})
    public async store(request: Request): Promise<ResponseBuilder> {
        const fwCloud: FwCloud = await getRepository(FwCloud).findOneOrFail(parseInt(request.params.fwcloud));

        (await FwCloudExportPolicy.store(fwCloud, request.session.user)).authorize();

        const fwCloudExport: FwCloudExport = await this._fwCloudExportService.create(fwCloud, request.session.user, 30000);

        return ResponseBuilder.buildResponse().status(201).download(fwCloudExport.exportPath, 'fwcloud_' + fwCloud.id + '_' + moment().unix());
    }

    @Validate({
        file: [new Required(), new File(), new Extension('fwcloud')]
    })
    public async import(request: Request): Promise<ResponseBuilder> {

        (await FwCloudExportPolicy.import(request.session.user)).authorize();

        const fwCloud: FwCloud = await this._fwCloudExportService.import((<FileInfo>request.inputs.get('file')).filepath, request.session.user);

        return ResponseBuilder.buildResponse().status(201).body(fwCloud);
    }
}