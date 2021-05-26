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

import { FindManyOptions, FindOneOptions, getCustomRepository, SelectQueryBuilder } from "typeorm";
import { Application } from "../../../Application";
import { Service } from "../../../fonaments/services/service";
import { Route } from "./route.model";
import { FindOneWithinFwCloud, RouteRepository } from "./route.repository";

interface IFindManyRoutePath {
    firewallId?: number;
    fwCloudId?: number;
    routingTableId?: number;
}

interface IFindOneRoutePath extends IFindManyRoutePath {
    id: number;
}

export interface ICreateRoute {
    routingTableId: number;
    gatewayId?: number;
    interfaceId?: number;
    active?: boolean;
    comment?: string;
    position?: number;
    style?: string;
}

interface IUpdateRoute {
    active?: boolean;
    comment?: string;
    gatewayId?: number;
    interfaceId?: number;
    position?: number;
    style?: string
}

export class RouteService extends Service {
    protected _repository: RouteRepository;

    constructor(app: Application) {
        super(app);
        this._repository = getCustomRepository(RouteRepository);
    }

    findManyInPath(path: IFindManyRoutePath): Promise<Route[]> {
        return this._repository.find(this.getFindInPathOptions(path));
    }

    findOneInPath(path: IFindOneRoutePath): Promise<Route | undefined> {
        return this._repository.findOne(this.getFindInPathOptions(path));
    }

    findOneInPathOrFail(path: IFindOneRoutePath): Promise<Route> {
        return this._repository.findOneOrFail(this.getFindInPathOptions(path));
    }

    async create(data: ICreateRoute): Promise<Route> {
        const route: Route = await this._repository.getLastRouteInRoutingTable(data.routingTableId);
        const position: number = route?.position? route.position + 1 : 1;
        data.position = position;
        return this._repository.save(data);
    }

    async update(id: number, data: IUpdateRoute): Promise<Route> {
        let route: Route = await this._repository.preload(Object.assign({
            active: data.active,
            comment: data.comment,
            gatewayId: data.gatewayId,
            interfaceId: data.interfaceId,
            style: data.style
        }, {id}));

        route = await this._repository.save(route);

        if (data.position && route.position !== data.position) {
            return await this._repository.move(route.id, data.position);
        }
        return route;
    }

    async remove(path: IFindOneRoutePath): Promise<Route> {
        const route: Route =  await this.findOneInPath(path);

        await this._repository.remove(route);

        return route;
    }

    protected getFindInPathOptions(path: Partial<IFindOneRoutePath>): FindOneOptions<Route> | FindManyOptions<Route> {
        return {
            join: {
                alias: 'route',
                innerJoin: {
                    table: 'route.routingTable',
                    firewall: 'table.firewall',
                    fwcloud: 'firewall.fwCloud'
                }
            },
            where: (qb: SelectQueryBuilder<Route>) => {
                if (path.firewallId) {
                    qb.andWhere('firewall.id = :firewall', {firewall: path.firewallId})
                }

                if (path.fwCloudId) {
                    qb.andWhere('firewall.fwCloudId = :fwcloud', {fwcloud: path.fwCloudId})
                }

                if(path.routingTableId) {
                    qb.andWhere('table.id = :table', {table: path.routingTableId})
                }

                if (path.id) {
                    qb.andWhere('route.id = :id', {id: path.id})
                }
            }
        }
    }
}