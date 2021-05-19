import { Controller } from "../../fonaments/http/controller";
import { Request } from "express";
import { ResponseBuilder } from "../../fonaments/http/response-builder";
import { FwCloudService } from "../../models/fwcloud/fwcloud.service";
import { FwCloud } from "../../models/fwcloud/FwCloud";
import { colorUsage } from "../../models/fwcloud/FwCloud-colors";
import { Validate } from "../../decorators/validate.decorator";
import { FwCloudPolicy } from "../../policies/fwcloud.policy";
import { FwCloudControllerStoreDto } from "./dtos/store.dto";
import { FwCloudControllerUpdateDto } from "./dtos/update.dto";

export class FwCloudController extends Controller {
    protected _fwCloudService: FwCloudService;

    public async make(request: Request): Promise<void> {
        this._fwCloudService = await this._app.getService<FwCloudService>(FwCloudService.name);
    }

    @Validate(FwCloudControllerStoreDto)
    public async store(request: Request): Promise<ResponseBuilder> {
        
        (await FwCloudPolicy.store(request.session.user)).authorize();

        const fwCloud: FwCloud = await this._fwCloudService.store({
            name: request.body.name,
            image: request.body.image,
            comment: request.body.comment
        });

        return ResponseBuilder.buildResponse().status(201).body(fwCloud);
    }

    @Validate(FwCloudControllerUpdateDto)
    public async update(request: Request): Promise<ResponseBuilder> {

        (await FwCloudPolicy.update(request.session.user)).authorize();
        
        let fwCloud: FwCloud = await FwCloud.findOneOrFail(request.params.fwcloud);

        fwCloud = await this._fwCloudService.update(fwCloud, {
            name: request.body.name,
            image: request.body.image,
            comment: request.body.comment
        });

        return ResponseBuilder.buildResponse().status(200).body(fwCloud);
    }

    @Validate()
    public async colors(request: Request): Promise<ResponseBuilder> {
       
        let fwCloud: FwCloud = await FwCloud.findOneOrFail(request.params.fwcloud);

        (await FwCloudPolicy.colors(request.session.user, fwCloud)).authorize();

        let colors: colorUsage[] = await this._fwCloudService.colors(fwCloud);

        return ResponseBuilder.buildResponse().status(200).body(colors);
    }
}