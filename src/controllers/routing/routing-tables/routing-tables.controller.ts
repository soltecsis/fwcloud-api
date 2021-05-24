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
import { RoutingTableService } from "../../../models/routing/routing-table/routing-table.service";
import { Request } from "express";
import { RoutingTable } from "../../../models/routing/routing-table/routing-table.model";
import { ResponseBuilder } from "../../../fonaments/http/response-builder";
import { Validate } from "../../../decorators/validate.decorator";
import { RoutingTablePolicy } from "../../../policies/routing-table.policy";
import { RoutingTableControllerCreateDto } from "./dtos/create.dto";
import { RoutingTableControllerUpdateDto } from "./dtos/update.dto";

export class RoutingTableController extends Controller {
    
    protected routingTableService: RoutingTableService;
    protected _firewall: Firewall;

    public async make(request: Request): Promise<void> {
        this.routingTableService = await this._app.getService<RoutingTableService>(RoutingTableService.name);
        this._firewall = await Firewall.findOneOrFail(parseInt(request.params.firewall));
    }

    @Validate()
    async index(request: Request): Promise<ResponseBuilder> {
        (await RoutingTablePolicy.index(this._firewall, request.session.user)).authorize();
        
        const tables: RoutingTable[] = await this.routingTableService.find({where: { firewallId: this._firewall.id}});
        return ResponseBuilder.buildResponse().status(200).body(tables); 
    }

    @Validate()
    async show(request: Request): Promise<ResponseBuilder> {
        const routingTable: RoutingTable = await this.routingTableService.findOneWithinFwCloudOrFail(
            parseInt(request.params.routingTable),
            parseInt(request.params.firewall),
            parseInt(request.params.fwcloud)
        );

        (await RoutingTablePolicy.show(routingTable, request.session.user)).authorize();

        return ResponseBuilder.buildResponse().status(200).body(routingTable);
    }

    @Validate(RoutingTableControllerCreateDto)
    async create(request: Request): Promise<ResponseBuilder> {

        (await RoutingTablePolicy.create(this._firewall, request.session.user)).authorize();

        const routingTable: RoutingTable = await this.routingTableService.create({
            firewallId: this._firewall.id,
            name: request.inputs.get('name'),
            number: parseInt(request.inputs.get('number')),
            comment: request.inputs.get('comment') 
        });

        return ResponseBuilder.buildResponse().status(201).body(routingTable);
    }

    @Validate(RoutingTableControllerUpdateDto)
    async update(request: Request): Promise<ResponseBuilder> {
        const routingTable: RoutingTable = await this.routingTableService.findOneWithinFwCloudOrFail(
            parseInt(request.params.routingTable),
            parseInt(request.params.firewall),
            parseInt(request.params.fwcloud)
        );
        
        (await RoutingTablePolicy.update(routingTable, request.session.user)).authorize();

        const result: RoutingTable = await this.routingTableService.update(routingTable, request.inputs.all());

        return ResponseBuilder.buildResponse().status(200).body(result);
    }
    
    @Validate()
    async remove(request: Request): Promise<ResponseBuilder> {
        const routingTable: RoutingTable = await this.routingTableService.findOneWithinFwCloudOrFail(
            parseInt(request.params.routingTable),
            parseInt(request.params.firewall),
            parseInt(request.params.fwcloud)
        );
        
        (await RoutingTablePolicy.delete(routingTable, request.session.user)).authorize();

        await this.routingTableService.delete(parseInt(request.params.routingTable));
        return ResponseBuilder.buildResponse().status(200).body(routingTable);
    }
}