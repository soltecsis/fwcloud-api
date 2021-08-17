/*!
    Copyright 2021 SOLTECSIS SOLUCIONES TECNOLOGICAS, SLU
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

import { Validate } from "../../../decorators/validate.decorator";
import { Controller } from "../../../fonaments/http/controller";
import { Firewall } from "../../../models/firewall/Firewall";
import { FwCloud } from "../../../models/fwcloud/FwCloud";
import { Request } from 'express';
import { ResponseBuilder } from "../../../fonaments/http/response-builder";
import { RouteGroupPolicy } from "../../../policies/route-group.policy";
import { RouteGroupService } from "../../../models/routing/route-group/route-group.service";
import { RouteGroup } from "../../../models/routing/route-group/route-group.model";
import { RouteGroupControllerCreateDto } from "./dtos/create.dto";
import { RouteGroupControllerUpdateDto } from "./dtos/update.dto";

export class RouteGroupController extends Controller {
    
    protected _routeGroupService: RouteGroupService;
    
    protected _firewall: Firewall;
    protected _fwCloud: FwCloud;
    
    public async make(request: Request): Promise<void> {
        this._routeGroupService = await this._app.getService<RouteGroupService>(RouteGroupService.name);
        this._fwCloud = await FwCloud.findOneOrFail(parseInt(request.params.fwcloud));
        this._firewall = await Firewall.findOneOrFail(parseInt(request.params.firewall));
    }

    @Validate()
    async index(request: Request): Promise<ResponseBuilder> {
        (await RouteGroupPolicy.index(this._firewall, request.session.user)).authorize();
        
        const groups: RouteGroup[] = await this._routeGroupService.findManyInPath({
            firewallId: this._firewall.id,
            fwCloudId: this._fwCloud.id
        });

        return ResponseBuilder.buildResponse().status(200).body(groups); 
    }

    @Validate()
    async show(request: Request): Promise<ResponseBuilder> {
        const group: RouteGroup = await this._routeGroupService.findOneInPathOrFail({
            fwCloudId: this._fwCloud.id,
            firewallId: this._firewall.id,
            id: parseInt(request.params.routeGroup)
        });

        (await RouteGroupPolicy.show(group, request.session.user)).authorize();

        return ResponseBuilder.buildResponse().status(200).body(group);
    }

    @Validate(RouteGroupControllerCreateDto)
    async create(request: Request): Promise<ResponseBuilder> {

        (await RouteGroupPolicy.create(this._firewall, request.session.user)).authorize();

        const group: RouteGroup = await this._routeGroupService.create({
            name: request.inputs.get('name'),
            comment: request.inputs.get('comment'),
            firewallId: this._firewall.id,
            routes: request.inputs.get('routes').map((id) => ({id}))
        });

        return ResponseBuilder.buildResponse().status(201).body(group);
    }

    @Validate(RouteGroupControllerUpdateDto)
    async update(request: Request): Promise<ResponseBuilder> {
        const group: RouteGroup = await this._routeGroupService.findOneInPathOrFail({
            fwCloudId: this._fwCloud.id,
            firewallId: this._firewall.id,
            id: parseInt(request.params.routeGroup)
        });

        (await RouteGroupPolicy.update(group, request.session.user)).authorize();

        const result: RouteGroup = await this._routeGroupService.update(group.id, request.inputs.all());

        return ResponseBuilder.buildResponse().status(200).body(result);
    }
    
    @Validate()
    async remove(request: Request): Promise<ResponseBuilder> {
        const group: RouteGroup = await this._routeGroupService.findOneInPathOrFail({
            fwCloudId: this._fwCloud.id,
            firewallId: this._firewall.id,
            id: parseInt(request.params.routeGroup)
        });
        
        (await RouteGroupPolicy.remove(group, request.session.user)).authorize();

        await this._routeGroupService.remove({
            fwCloudId: this._fwCloud.id,
            firewallId: this._firewall.id,
            id: parseInt(request.params.routeGroup)
        });
        return ResponseBuilder.buildResponse().status(200).body(group);
    }
}