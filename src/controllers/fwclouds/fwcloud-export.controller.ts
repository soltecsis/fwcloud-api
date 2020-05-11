import { Controller } from "../../fonaments/http/controller";
import { FwCloudExportService } from "../../fwcloud-exporter/fwcloud-export.service";
import { Request } from "express";
import { ResponseBuilder } from "../../fonaments/http/response-builder";
import { FwCloud } from "../../models/fwcloud/FwCloud";
import { getRepository } from "typeorm";
import { FwCloudExportPolicy } from "../../policies/fwcloud-export.policy";
import { FwCloudExport, FwCloudExportMetadata } from "../../fwcloud-exporter/fwcloud-export";
import { NotFoundException } from "../../fonaments/exceptions/not-found-exception";
import { FSHelper } from "../../utils/fs-helper";
import * as path from "path";
import * as fs from "fs";
import Busboy from 'busboy';
import { ValidationException } from "../../fonaments/exceptions/validation-exception";

export class FwCloudExportController extends Controller {
    protected _fwCloudExportService: FwCloudExportService;

    public async make(request: Request): Promise<void> {
        this._fwCloudExportService = await this._app.getService<FwCloudExportService>(FwCloudExportService.name);
    }

    public async store(request: Request): Promise<ResponseBuilder> {
        const fwCloud: FwCloud = await getRepository(FwCloud).findOneOrFail(parseInt(request.params.fwcloud));

        (await FwCloudExportPolicy.store(fwCloud, request.session.user)).authorize();

        const fwCloudExport: FwCloudExport = await this._fwCloudExportService.create(fwCloud, request.session.user, 30000);

        return ResponseBuilder.buildResponse().status(201).body(fwCloudExport);
    }

    public async download(request: Request): Promise<ResponseBuilder> {
        const fwCloud: FwCloud = await getRepository(FwCloud).findOneOrFail(parseInt(request.params.fwcloud));

        const metadataPath: string = path.join(this._fwCloudExportService.config.data_dir, request.params.export + '.json');
        const exportFilePath: string = path.join(this._fwCloudExportService.config.data_dir, request.params.export + '.fwcloud');

        if (!FSHelper.fileExistsSync(metadataPath)) {
            throw new NotFoundException();
        }

        const metadata: FwCloudExportMetadata = JSON.parse(fs.readFileSync(metadataPath).toString());

        if (!(await FwCloudExportPolicy.download(metadata, fwCloud, request.session.user)).can()) {
            throw new NotFoundException();
        }

        return ResponseBuilder.buildResponse().download(exportFilePath);
    }

    public async import(request: Request): Promise<ResponseBuilder> {

        (await FwCloudExportPolicy.import(request.session.user)).authorize();

        return new Promise<ResponseBuilder>((resolve, reject) => {
            try {
                var busboy = new Busboy({ headers: request.headers });

                busboy.on('file', async (input: string, file: NodeJS.ReadableStream, filename: string) => {
                    const uploadFile: NodeJS.ReadableStream = file;
                    const destinationPath: string = path.join(this._fwCloudExportService.config.upload_dir, filename);

                    uploadFile.pipe(fs.createWriteStream(destinationPath));

                    const fwCloud: FwCloud = await this._fwCloudExportService.import(destinationPath);

                    return resolve(ResponseBuilder.buildResponse().status(201).body(fwCloud));
                });

                request.pipe(busboy);
            } catch (e) {
                throw new ValidationException();
            }
        });
    }
}