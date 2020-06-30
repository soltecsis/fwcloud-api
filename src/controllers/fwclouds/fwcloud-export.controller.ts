import { Controller } from "../../fonaments/http/controller";
import { FwCloudExportService } from "../../fwcloud-exporter/fwcloud-export.service";
import { Request } from "express";
import { ResponseBuilder } from "../../fonaments/http/response-builder";
import { FwCloud } from "../../models/fwcloud/FwCloud";
import { getRepository } from "typeorm";
import { FwCloudExportPolicy } from "../../policies/fwcloud-export.policy";
import { FwCloudExport } from "../../fwcloud-exporter/fwcloud-export";
import { ValidationException } from "../../fonaments/exceptions/validation-exception";
import { Validate } from "../../decorators/validate.decorator";
import { Required } from "../../fonaments/validation/rules/required.rule";
import { File } from "../../fonaments/validation/rules/file.rule";
import { FileInfo } from "../../fonaments/http/files/file-info";

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

        return ResponseBuilder.buildResponse().status(201).download(fwCloudExport.exportPath);
    }

    @Validate({
        file: [new Required(), new File()]
    })
    public async import(request: Request): Promise<ResponseBuilder> {

        (await FwCloudExportPolicy.import(request.session.user)).authorize();

        const fwCloud: FwCloud = await this._fwCloudExportService.import((<FileInfo>request.inputs.get('file')).filepath);

        return ResponseBuilder.buildResponse().status(201).body(fwCloud);
    }
}