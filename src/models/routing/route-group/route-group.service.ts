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

import { FindOneOptions, getCustomRepository, getRepository, SelectQueryBuilder } from "typeorm";
import { Application } from "../../../Application";
import { Service } from "../../../fonaments/services/service";
import { Route } from "../route/route.model";
import { RouteGroup } from "./route-group.model";
import { RouteGroupRepository } from "./route-group.repository";

export interface IFindManyPath {
    firewallId?: number,
    fwCloudId?: number
}

export interface IFindOnePath extends IFindManyPath {
    id: number
}

export interface ICreateRouteGroup {
    firewallId: number;
    name: string;
    comment?: string;
    routes: Partial<Route>[];
}

export interface IUpdateRouteGroup {
    name: string;
    comment?: string;
    routes: Partial<Route>[];
}

export class RouteGroupService extends Service {
    protected _repository: RouteGroupRepository;

    constructor(app: Application) {
        super(app);
        this._repository = getCustomRepository(RouteGroupRepository);
    }

    findManyInPath(path: IFindManyPath): Promise<RouteGroup[]> {
        return this._repository.find({
            join: {
                alias: 'group',
                innerJoin: {
                    firewall: 'group.firewall',
                    fwcloud: 'firewall.fwCloud'
                }
            },
            where: (qb: SelectQueryBuilder<RouteGroup>) => {
                if (path.firewallId) {
                    qb.andWhere('firewall.id = :firewall', {firewall: path.firewallId})
                }

                if (path.fwCloudId) {
                    qb.andWhere('firewall.fwCloudId = :fwcloud', {fwcloud: path.fwCloudId})
                }
            }
        });
    }

    findOneInPath(path: IFindOnePath): Promise<RouteGroup | undefined> {
        return this._repository.findOne(this.getFindOneOptions(path));
    }

    async findOneInPathOrFail(path: IFindOnePath): Promise<RouteGroup> {
        return this._repository.findOneOrFail(this.getFindOneOptions(path));
    }

    async create(data: ICreateRouteGroup): Promise<RouteGroup> {
        let group: RouteGroup = await this._repository.save(data);
        return this._repository.findOne(group.id);
    }

    async update(id: number, data: IUpdateRouteGroup): Promise<RouteGroup> {
        let group: RouteGroup = await this._repository.preload(Object.assign(data, {id}));

        group.routes = data.routes as Route[];
        group = await this._repository.save(group);

        if (group.routes.length === 0) {
            return this.remove({
                id: group.id,
                firewallId: group.firewallId,
                fwCloudId: group.firewall.fwCloudId
            });
        }

        return group;
    }

    async remove(path: IFindOnePath): Promise<RouteGroup> {
        const group: RouteGroup = await this.findOneInPath(path);
        getRepository(Route).update(group.routes.map(route => route.id), {
            routeGroupId: null
        });
        await this._repository.remove(group);
        return group;
    }

    protected getFindOneOptions(path: IFindOnePath): FindOneOptions<RouteGroup> {
        return {
            join: {
                alias: 'group',
                innerJoin: {
                    firewall: 'group.firewall',
                    fwcloud: 'firewall.fwCloud'
                }
            },
            where: (qb: SelectQueryBuilder<RouteGroup>) => {
                if (path.firewallId) {
                    qb.andWhere('firewall.id = :firewall', {firewall: path.firewallId})
                }

                if (path.fwCloudId) {
                    qb.andWhere('firewall.fwCloudId = :fwcloud', {fwcloud: path.fwCloudId})
                }

                qb.andWhere('group.id = :id', {id: path.id})
            }
        }
    }
}