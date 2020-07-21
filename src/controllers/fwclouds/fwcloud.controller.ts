import { Controller } from "../../fonaments/http/controller";
import { Request } from "express";
import { ResponseBuilder } from "../../fonaments/http/response-builder";
import { FwCloudService } from "../../models/fwcloud/fwcloud.service";
import { FwCloud } from "../../models/fwcloud/FwCloud";
import { Validate } from "../../decorators/validate.decorator";
import { FwCloudPolicy } from "../../policies/fwcloud.policy";
import { Required } from "../../fonaments/validation/rules/required.rule";
import { String } from "../../fonaments/validation/rules/string.rule";

export class FwCloudController extends Controller {
    protected _fwCloudService: FwCloudService;

    public async make(request: Request): Promise<void> {
        this._fwCloudService = await this._app.getService<FwCloudService>(FwCloudService.name);
    }

    @Validate({
        name: [new Required(), new String()],
        image: [new String()],
        comment: [new String()]
    })
    public async store(request: Request): Promise<ResponseBuilder> {
        
        (await FwCloudPolicy.store(request.session.user)).authorize();

        const fwCloud: FwCloud = await this._fwCloudService.store({
            name: request.body.name,
            image: request.body.image,
            comment: request.body.comment
        });

        return ResponseBuilder.buildResponse().status(201).body(fwCloud);
    }
}