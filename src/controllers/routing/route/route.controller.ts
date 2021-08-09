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

import { Validate, ValidateQuery } from "../../../decorators/validate.decorator";
import { Controller } from "../../../fonaments/http/controller";
import { Firewall } from "../../../models/firewall/Firewall";
import { FwCloud } from "../../../models/fwcloud/FwCloud";
import { ICreateRoute, RouteService } from "../../../models/routing/route/route.service";
import { RoutingTable } from "../../../models/routing/routing-table/routing-table.model";
import { Request } from 'express';
import { ResponseBuilder } from "../../../fonaments/http/response-builder";
import { RoutePolicy } from "../../../policies/route.policy";
import { Route } from "../../../models/routing/route/route.model";
import { RouteControllerStoreDto } from "./dtos/store.dto";
import { RouteControllerUpdateDto } from "./dtos/update.dto";
import { RouteData, RoutingTableService } from "../../../models/routing/routing-table/routing-table.service";
import { RouteItemForCompiler } from "../../../models/routing/shared";
import { RoutingCompiler } from "../../../compiler/routing/RoutingCompiler";
import { getRepository, SelectQueryBuilder } from "typeorm";
import { RouteControllerBulkMoveDto } from "./dtos/bulk-move.dto";
import { ValidationException } from "../../../fonaments/exceptions/validation-exception";
import { HttpException } from "../../../fonaments/exceptions/http/http-exception";
import { RouteControllerBulkUpdateDto } from "./dtos/bulk-update.dto";
import { RouteControllerBulkRemoveQueryDto } from "./dtos/bulk-remove.dto";
import { RouteControllerCopyDto } from "./dtos/copy.dto";

export class RouteController extends Controller {
    protected _routeService: RouteService;
    protected _firewall: Firewall;
    protected _fwCloud: FwCloud;
    protected _routingTable: RoutingTable;
    protected _routingTableService: RoutingTableService;

    public async make(request: Request): Promise<void> {
        this._routeService = await this._app.getService<RouteService>(RouteService.name);
        this._routingTableService = await this._app.getService<RoutingTableService>(RoutingTableService.name);
        this._fwCloud = await FwCloud.findOneOrFail(parseInt(request.params.fwcloud));
        this._firewall = await Firewall.findOneOrFail(parseInt(request.params.firewall));
        this._routingTable = await RoutingTable.findOneOrFail(parseInt(request.params.routingTable));
    }

    @Validate()
    async index(request: Request): Promise<ResponseBuilder> {
        (await RoutePolicy.index(this._routingTable, request.session.user)).authorize();
        
        const routes: Route[] = await this._routeService.findManyInPath({
            fwCloudId: this._fwCloud.id,
            firewallId: this._firewall.id,
            routingTableId: this._routingTable.id,
        });

        return ResponseBuilder.buildResponse().status(200).body(routes); 
    }

    @Validate(RouteControllerBulkMoveDto)
    async bulkMove(request: Request): Promise<ResponseBuilder> {
        (await RoutePolicy.index(this._routingTable, request.session.user)).authorize();
        
        const routes: Route[] = await getRepository(Route).find({
            join: {
                alias: 'route',
                innerJoin: {
                    table: 'route.routingTable',
                    firewall: 'table.firewall',
                    fwcloud: 'firewall.fwCloud'
                }
            },
            where: (qb: SelectQueryBuilder<Route>) => {
                qb.whereInIds(request.inputs.get('routes'))
                    .andWhere('table.id = :table', {table: this._routingTable.id})
                    .andWhere('firewall.id = :firewall', {firewall: this._firewall.id})
                    .andWhere('firewall.fwCloudId = :fwcloud', {fwcloud: this._fwCloud.id})
            }
        });

        const direction: 'above' | 'below' = request.inputs.get('direction') >= 0 ? 'below': 'above'
        
        const result: Route[] = await this._routeService.bulkMove(routes.map(item => item.id), request.inputs.get('to'), direction);

        return ResponseBuilder.buildResponse().status(200).body(result);
    }

    @Validate()
    async show(request: Request): Promise<ResponseBuilder> {
        const route: Route = await this._routeService.findOneInPathOrFail({
            fwCloudId: this._fwCloud.id,
            firewallId: this._firewall.id,
            routingTableId: this._routingTable.id,
            id: parseInt(request.params.route)
        });

        (await RoutePolicy.show(route, request.session.user)).authorize();

        return ResponseBuilder.buildResponse().status(200).body(route);
    }

    @Validate()
    async compile(request: Request): Promise<ResponseBuilder> {
        const route: Route = await this._routeService.findOneInPathOrFail({
            fwCloudId: this._fwCloud.id,
            firewallId: this._firewall.id,
            routingTableId: this._routingTable.id,
            id: parseInt(request.params.route)
        });

        (await RoutePolicy.show(route, request.session.user)).authorize();

        const routes: RouteData<RouteItemForCompiler>[] = await this._routingTableService.getRoutingTableData<RouteItemForCompiler>(
            'compiler',
            this._fwCloud.id,
            this._firewall.id, 
            this._routingTable.id,
            route.id
        );

        const compilation = new RoutingCompiler().compile('Route', routes);
        
        return ResponseBuilder.buildResponse().status(200).body(compilation);
    }

    @Validate(RouteControllerStoreDto)
    async store(request: Request): Promise<ResponseBuilder> {

        (await RoutePolicy.create(this._routingTable, request.session.user)).authorize();

        //Get the routingTable from the URL
        const data: ICreateRoute = Object.assign({}, request.inputs.all<ICreateRoute>(), {routingTableId: this._routingTable.id});
        
        const route: Route = await this._routeService.create(data);

        return ResponseBuilder.buildResponse().status(201).body(route);
    }

    @Validate(RouteControllerCopyDto)
    async copy(request: Request): Promise<ResponseBuilder> {

        const routes: Route[] = [];

        const ids: string[] = request.inputs.get('routes');
        
        for(let id of ids) {
            const route: Route = await this._routeService.findOneInPathOrFail({
                fwCloudId: this._fwCloud.id,
                firewallId: this._firewall.id,
                routingTableId: this._routingTable.id,
                id: parseInt(id)
            });

            (await RoutePolicy.delete(route, request.session.user)).authorize();    
        
            routes.push(route);
        }

        const direction: 'above' | 'below' = request.inputs.get('direction') > 0 ? 'below': 'above';
        const created: Route[] = await this._routeService.copy(routes.map(item => item.id), request.inputs.get('to'), direction);
        
        return ResponseBuilder.buildResponse().status(201).body(created);
    }

    @Validate(RouteControllerUpdateDto)
    async update(request: Request): Promise<ResponseBuilder> {
        const route: Route = await this._routeService.findOneInPathOrFail({
            fwCloudId: this._fwCloud.id,
            firewallId: this._firewall.id,
            routingTableId: this._routingTable.id,
            id: parseInt(request.params.route)
        });
        
        (await RoutePolicy.update(route, request.session.user)).authorize();

        const result: Route = await this._routeService.update(route.id, request.inputs.all());

        return ResponseBuilder.buildResponse().status(200).body(result);
    }

    @Validate(RouteControllerBulkUpdateDto)
    async bulkUpdate(request: Request): Promise<ResponseBuilder> {
        const routes: Route[] = [];

        const ids: string[] = request.query.routes as string[] || [];
        
        for(let id of ids) {
            const route: Route = await this._routeService.findOneInPathOrFail({
                fwCloudId: this._fwCloud.id,
                firewallId: this._firewall.id,
                routingTableId: this._routingTable.id,
                id: parseInt(id)
            });

            (await RoutePolicy.delete(route, request.session.user)).authorize();    
        
            routes.push(route);
        }

        if (routes.length === 0) {
            throw new HttpException(`Missing routes ids to be removed`, 400);
        }

        const result: Route[] = await this._routeService.bulkUpdate(routes.map(item => item.id), request.inputs.all());

        return ResponseBuilder.buildResponse().status(200).body(result);
    }
    
    @Validate()
    async remove(request: Request): Promise<ResponseBuilder> {
        const route: Route = await this._routeService.findOneInPathOrFail({
            fwCloudId: this._fwCloud.id,
            firewallId: this._firewall.id,
            routingTableId: this._routingTable.id,
            id: parseInt(request.params.route)
        });
        
        (await RoutePolicy.delete(route, request.session.user)).authorize();

        await this._routeService.remove({
            fwCloudId: this._fwCloud.id,
            firewallId: this._firewall.id,
            routingTableId: this._routingTable.id,
            id: parseInt(request.params.route)
        });
        return ResponseBuilder.buildResponse().status(200).body(route);
    }

    @Validate()
    @ValidateQuery(RouteControllerBulkRemoveQueryDto)
    async bulkRemove(request: Request): Promise<ResponseBuilder> {
        const routes: Route[] = [];

        const ids: string[] = request.query.routes as string[] || [];
        
        for(let id of ids) {
            const route: Route = await this._routeService.findOneInPathOrFail({
                fwCloudId: this._fwCloud.id,
                firewallId: this._firewall.id,
                routingTableId: this._routingTable.id,
                id: parseInt(id)
            });

            (await RoutePolicy.delete(route, request.session.user)).authorize();    
        
            routes.push(route);
        }

        if (routes.length === 0) {
            throw new HttpException(`Missing routes ids to be removed`, 400);
        }

        const returned: Route[] = await this._routeService.bulkRemove(routes.map(item => item.id));

        return ResponseBuilder.buildResponse().status(200).body(returned);

    }
}