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
import { RouteControllerMoveDto } from "./dtos/move.dto";
import { HttpException } from "../../../fonaments/exceptions/http/http-exception";
import { RouteControllerBulkUpdateDto } from "./dtos/bulk-update.dto";
import { RouteControllerBulkRemoveQueryDto } from "./dtos/bulk-remove.dto";
import { RouteControllerCopyDto } from "./dtos/copy.dto";
import { Offset } from "../../../offset";
import { RouteMoveToDto } from "./dtos/move-to.dto";
import { RouteMoveInterfaceDto } from "./dtos/move-interface.dto";

export class RouteController extends Controller {
    protected _routeService: RouteService;
    protected _firewall: Firewall;
    protected _fwCloud: FwCloud;
    protected _route: Route;
    protected _routingTable: RoutingTable;
    protected _routingTableService: RoutingTableService;

    public async make(request: Request): Promise<void> {
        this._routeService = await this._app.getService<RouteService>(RouteService.name);
        this._routingTableService = await this._app.getService<RoutingTableService>(RoutingTableService.name);

        if (request.params.route) {
            this._route = await getRepository(Route).findOneOrFail(parseInt(request.params.route));
        }

        const routingTableQueryBuilder = getRepository(RoutingTable).createQueryBuilder('table')
            .where('table.id = :id', {id: parseInt(request.params.routingTable)});
        if (request.params.route) {
            routingTableQueryBuilder.innerJoin('table.routes', 'route', 'route.id = :routeId', {routeId: parseInt(request.params.route)})
        }
        this._routingTable = await routingTableQueryBuilder.getOneOrFail();

        this._firewall = await getRepository(Firewall).createQueryBuilder('firewall')
            .innerJoin('firewall.routingTables', 'table', 'table.id = :tableId', {tableId: parseInt(request.params.routingTable)})
            .where('firewall.id = :id', {id: parseInt(request.params.firewall)})
            .getOneOrFail();

        this._fwCloud = await getRepository(FwCloud).createQueryBuilder('fwcloud')
            .innerJoin('fwcloud.firewalls', 'firewall', 'firewall.id = :firewallId', {firewallId: parseInt(request.params.firewall)})
            .where('fwcloud.id = :id', {id: parseInt(request.params.fwcloud)})
            .getOneOrFail()    
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

    @Validate(RouteControllerMoveDto)
    async move(request: Request): Promise<ResponseBuilder> {
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

        const result: Route[] = await this._routeService.move(routes.map(item => item.id), request.inputs.get('to'), request.inputs.get<Offset>('offset'));

        return ResponseBuilder.buildResponse().status(200).body(result);
    }

    @Validate()
    async show(request: Request): Promise<ResponseBuilder> {
        (await RoutePolicy.show(this._route, request.session.user)).authorize();

        return ResponseBuilder.buildResponse().status(200).body(this._route);
    }

    @Validate()
    async compile(request: Request): Promise<ResponseBuilder> {
        (await RoutePolicy.show(this._route, request.session.user)).authorize();

        const routes: RouteData<RouteItemForCompiler>[] = await this._routingTableService.getRoutingTableData<RouteItemForCompiler>(
            'compiler',
            this._fwCloud.id,
            this._firewall.id, 
            this._routingTable.id,
            [this._route.id]
        );

        const compilation = new RoutingCompiler().compile('Route', routes);
        
        return ResponseBuilder.buildResponse().status(200).body(compilation);
    }

    @Validate(RouteControllerStoreDto)
    async store(request: Request): Promise<ResponseBuilder> {

        (await RoutePolicy.create(this._routingTable, request.session.user)).authorize();

        //Get the routingTable from the URL
        const data: ICreateRoute = Object.assign(request.inputs.all<RouteControllerStoreDto>(), {routingTableId: this._routingTable.id});
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

        const created: Route[] = await this._routeService.copy(routes.map(item => item.id), request.inputs.get('to'), request.inputs.get<Offset>('offset'));
        
        return ResponseBuilder.buildResponse().status(201).body(created);
    }

    @Validate(RouteControllerUpdateDto)
    async update(request: Request): Promise<ResponseBuilder> {
        (await RoutePolicy.update(this._route, request.session.user)).authorize();

        const result: Route = await this._routeService.update(this._route.id, request.inputs.all<RouteControllerUpdateDto>());

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

    @Validate(RouteMoveToDto)
    async moveTo(request: Request): Promise<ResponseBuilder> {
        (await RoutePolicy.index(this._routingTable, request.session.user)).authorize();

        const fromRule: Route = await getRepository(Route).findOneOrFail({
            join: {
                alias: 'route',
                innerJoin: {
                    table: 'route.routingTable',
                    firewall: 'table.firewall',
                    fwcloud: 'firewall.fwCloud'
                }
            },
            where: (qb: SelectQueryBuilder<Route>) => {
                qb.where('route.id = :id', {id: request.inputs.get('fromId')})
                    .andWhere('table.id = :table', {table: this._routingTable.id})
                    .andWhere('firewall.id = :firewall', {firewall: this._firewall.id})
                    .andWhere('firewall.fwCloudId = :fwcloud', {fwcloud: this._fwCloud.id})
            }
        });

        const toRule: Route = await getRepository(Route).findOneOrFail({
            join: {
                alias: 'route',
                innerJoin: {
                    table: 'route.routingTable',
                    firewall: 'table.firewall',
                    fwcloud: 'firewall.fwCloud'
                }
            },
            where: (qb: SelectQueryBuilder<Route>) => {
                qb.where('route.id = :id', {id: request.inputs.get('toId')})
                    .andWhere('table.id = :table', {table: this._routingTable.id})
                    .andWhere('firewall.id = :firewall', {firewall: this._firewall.id})
                    .andWhere('firewall.fwCloudId = :fwcloud', {fwcloud: this._fwCloud.id})
            }
        });

        const result: Route[] = await this._routeService.moveTo(fromRule.id, toRule.id, request.inputs.all());

        return ResponseBuilder.buildResponse().status(200).body(result);
    }

    @Validate(RouteMoveInterfaceDto)
    async moveInterface(request: Request): Promise<ResponseBuilder> {
        (await RoutePolicy.index(this._routingTable, request.session.user)).authorize();

        const fromRule: Route = await getRepository(Route).findOneOrFail({
            join: {
                alias: 'route',
                innerJoin: {
                    table: 'route.routingTable',
                    firewall: 'table.firewall',
                    fwcloud: 'firewall.fwCloud'
                }
            },
            where: (qb: SelectQueryBuilder<Route>) => {
                qb.where('route.id = :id', {id: request.inputs.get('fromId')})
                    .andWhere('table.id = :table', {table: this._routingTable.id})
                    .andWhere('firewall.id = :firewall', {firewall: this._firewall.id})
                    .andWhere('firewall.fwCloudId = :fwcloud', {fwcloud: this._fwCloud.id})
            }
        });

        const toRule: Route = await getRepository(Route).findOneOrFail({
            join: {
                alias: 'route',
                innerJoin: {
                    table: 'route.routingTable',
                    firewall: 'table.firewall',
                    fwcloud: 'firewall.fwCloud'
                }
            },
            where: (qb: SelectQueryBuilder<Route>) => {
                qb.where('route.id = :id', {id: request.inputs.get('toId')})
                    .andWhere('table.id = :table', {table: this._routingTable.id})
                    .andWhere('firewall.id = :firewall', {firewall: this._firewall.id})
                    .andWhere('firewall.fwCloudId = :fwcloud', {fwcloud: this._fwCloud.id})
            }
        });

        const result: Route[] = await this._routeService.moveInterface(fromRule.id, toRule.id, request.inputs.all());

        return ResponseBuilder.buildResponse().status(200).body(result);
    }
    
    @Validate()
    async remove(request: Request): Promise<ResponseBuilder> {
        (await RoutePolicy.delete(this._route, request.session.user)).authorize();

        await this._routeService.remove({
            fwCloudId: this._fwCloud.id,
            firewallId: this._firewall.id,
            routingTableId: this._routingTable.id,
            id: parseInt(request.params.route)
        });
        return ResponseBuilder.buildResponse().status(200).body(this._route);
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