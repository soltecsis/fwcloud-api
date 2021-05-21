import { Controller } from "../../../fonaments/http/controller";
import { Firewall } from "../../../models/firewall/Firewall";
import { FwCloud } from "../../../models/fwcloud/FwCloud";
import { RoutingGroupService } from "../../../models/routing/routing-group/routing-group.service";
import { Request, response } from 'express';
import { Validate } from "../../../decorators/validate.decorator";
import { RoutingGroupPolicy } from "../../../policies/routing-group.policy";
import { ResponseBuilder } from "../../../fonaments/http/response-builder";
import { RoutingGroup } from "../../../models/routing/routing-group/routing-group.model";
import { RoutingGroupControllerUpdateDto } from "./dtos/update.dto";
import { RoutingGroupControllerCreateDto } from "./dtos/create.dto";

export class RoutingGroupController extends Controller {
    protected _routingGroupService: RoutingGroupService;
    protected _fwCloud: FwCloud;
    protected _firewall: Firewall;
    
    public async make(request: Request): Promise<void> {
        this._routingGroupService = await this._app.getService<RoutingGroupService>(RoutingGroupService.name);
        this._fwCloud = await FwCloud.findOneOrFail(parseInt(request.params.fwcloud));
        this._firewall = await Firewall.findOneOrFail(parseInt(request.params.firewall));
    }

    @Validate()
    async index(request: Request): Promise<ResponseBuilder> {
        (await RoutingGroupPolicy.index(this._firewall, request.session.user)).authorize();
        
        const groups: RoutingGroup[] = await this._routingGroupService.findManyInPath({
            firewallId: this._firewall.id,
            fwCloudId: this._fwCloud.id
        });

        return ResponseBuilder.buildResponse().status(200).body(groups); 
    }

    @Validate()
    async show(request: Request): Promise<ResponseBuilder> {
        const group: RoutingGroup = await this._routingGroupService.findOneInPathOrFail({
            firewallId: this._firewall.id,
            fwCloudId: this._fwCloud.id,
            id: parseInt(request.params.routingGroup)
        });

        (await RoutingGroupPolicy.show(group, request.session.user)).authorize();

        return ResponseBuilder.buildResponse().status(200).body(group);
    }

    @Validate(RoutingGroupControllerCreateDto)
    async create(request: Request): Promise<ResponseBuilder> {
        (await RoutingGroupPolicy.create(this._firewall, request.session.user)).authorize();

        const group: RoutingGroup = await this._routingGroupService.create({
            name: request.inputs.get('name'),
            comment: request.inputs.get('comment'),
            firewallId: this._firewall.id,
            routingRules: request.inputs.get('routingRules').map((id) => ({id}))
        });

        return ResponseBuilder.buildResponse().status(201).body(group);
    }

    @Validate(RoutingGroupControllerUpdateDto)
    async update(request: Request): Promise<ResponseBuilder> {
        const group: RoutingGroup = await this._routingGroupService.findOneInPathOrFail({
            firewallId: this._firewall.id,
            fwCloudId: this._fwCloud.id,
            id: parseInt(request.params.routingGroup)
        });

        (await RoutingGroupPolicy.update(group, request.session.user)).authorize();

        const updated: RoutingGroup = await this._routingGroupService.update(group.id, {
            name: request.inputs.get('name'),
            comment: request.inputs.get('comment'),
            routingRules: request.inputs.get('routingRules').map((id) => ({id}))
        })

        return ResponseBuilder.buildResponse().status(200).body(updated);
    }

    @Validate()
    async remove(request: Request): Promise<ResponseBuilder> {
        const group: RoutingGroup = await this._routingGroupService.findOneInPathOrFail({
            firewallId: this._firewall.id,
            fwCloudId: this._fwCloud.id,
            id: parseInt(request.params.routingGroup)
        });

        (await RoutingGroupPolicy.remove(group, request.session.user)).authorize();

        const removedGroup: RoutingGroup = await this._routingGroupService.remove({
            firewallId: this._firewall.id,
            fwCloudId: this._fwCloud.id,
            id: parseInt(request.params.routingGroup)
        });

        return ResponseBuilder.buildResponse().status(200).body(removedGroup);
    }
}