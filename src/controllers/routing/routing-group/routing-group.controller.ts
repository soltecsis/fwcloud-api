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

import { Controller } from "../../../fonaments/http/controller";
import { Firewall } from "../../../models/firewall/Firewall";
import { FwCloud } from "../../../models/fwcloud/FwCloud";
import { RoutingGroupService } from "../../../models/routing/routing-group/routing-group.service";
import { Request } from 'express';
import { Validate } from "../../../decorators/validate.decorator";
import { RoutingGroupPolicy } from "../../../policies/routing-group.policy";
import { ResponseBuilder } from "../../../fonaments/http/response-builder";
import { RoutingGroup } from "../../../models/routing/routing-group/routing-group.model";
import { RoutingGroupControllerUpdateDto } from "./dtos/update.dto";
import { RoutingGroupControllerCreateDto } from "./dtos/create.dto";
import { getRepository } from "typeorm";

export class RoutingGroupController extends Controller {
    protected _routingGroupService: RoutingGroupService;

    protected _fwCloud: FwCloud;
    protected _firewall: Firewall;
    protected _routingGroup: RoutingGroup;

    public async make(request: Request): Promise<void> {
        this._routingGroupService = await this._app.getService<RoutingGroupService>(RoutingGroupService.name);
        
        if (request.params.routingGroup) {
            this._routingGroup = await getRepository(RoutingGroup).findOneOrFail(parseInt(request.params.routingGroup));
        }

        //Get the firewall from the URL which contains the routing group 
        const firewallQueryBuilder = getRepository(Firewall).createQueryBuilder('firewall').where('firewall.id = :id', {id: parseInt(request.params.firewall)});
        if (request.params.routingGroup) {
            firewallQueryBuilder.innerJoin('firewall.routingGroups', 'group', 'group.id = :groupId', {groupId: parseInt(request.params.routingGroup)})
        }
        this._firewall = await firewallQueryBuilder.getOneOrFail();

        //Get the fwcloud from the URL which contains the firewall
        this._fwCloud = await getRepository(FwCloud).createQueryBuilder('fwcloud')
            .innerJoin('fwcloud.firewalls', 'firewall', 'firewall.id = :firewallId', {firewallId: this._firewall.id})
            .where('fwcloud.id = :id', {id: parseInt(request.params.fwcloud)}).getOneOrFail();        
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
        (await RoutingGroupPolicy.show(this._routingGroup, request.session.user)).authorize();

        return ResponseBuilder.buildResponse().status(200).body(this._routingGroup);
    }

    @Validate(RoutingGroupControllerCreateDto)
    async create(request: Request): Promise<ResponseBuilder> {
        (await RoutingGroupPolicy.create(this._firewall, request.session.user)).authorize();

        const group: RoutingGroup = await this._routingGroupService.create({
            name: request.inputs.get('name'),
            comment: request.inputs.get('comment'),
            firewallId: this._firewall.id,
            routingRules: request.inputs.get<number[]>('routingRules').map((id) => ({id}))
        });

        return ResponseBuilder.buildResponse().status(201).body(group);
    }

    @Validate(RoutingGroupControllerUpdateDto)
    async update(request: Request): Promise<ResponseBuilder> {
        (await RoutingGroupPolicy.update(this._routingGroup, request.session.user)).authorize();

        const updated: RoutingGroup = await this._routingGroupService.update(this._routingGroup.id, request.inputs.all())

        return ResponseBuilder.buildResponse().status(200).body(updated);
    }

    @Validate()
    async remove(request: Request): Promise<ResponseBuilder> {
        (await RoutingGroupPolicy.remove(this._routingGroup, request.session.user)).authorize();

        const removedGroup: RoutingGroup = await this._routingGroupService.remove({
            firewallId: this._firewall.id,
            fwCloudId: this._fwCloud.id,
            id: parseInt(request.params.routingGroup)
        });

        return ResponseBuilder.buildResponse().status(200).body(removedGroup);
    }
}