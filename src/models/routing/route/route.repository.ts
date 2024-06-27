/*!
    Copyright 2022 SOLTECSIS SOLUCIONES TECNOLOGICAS, SLU
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

import { EntityManager, FindManyOptions, FindOneOptions, In, RemoveOptions, SelectQueryBuilder } from "typeorm";
import { Offset } from "../../../offset";
import { RoutingTable } from "../routing-table/routing-table.model";
import { Route } from "./route.model";
import { Repository } from "../../../database/repository";
import db from "../../../database/database-manager";

interface IFindManyRoutePath {
    fwCloudId?: number;
    firewallId?: number;
    routingTableId?: number;
}

interface IFindOneRoutePath extends IFindManyRoutePath {
    id: number;
}

//@EntityRepository(Route)
export class RouteRepository extends Repository<Route> {

    constructor(manager?: EntityManager) {
        super(Route, manager);
    }
    /**
     * Finds routing rules which belongs to the given path
     *
     * @param path 
     * @returns 
     */
     findManyInPath(path: IFindManyRoutePath, options?: FindManyOptions<Route>): Promise<Route[]> {
        return this.getFindInPathOptions(path, options).getMany();
    }

    /**
     * Fins one routing rule which belongs to the given path
     * @param path 
     * @returns 
     */
    findOneInPath(path: IFindOneRoutePath): Promise<Route | undefined> {
        return this.getFindInPathOptions(path).getOne();
    }

    /**
     * Finds one routing rule in a path or throws an exception 
     * @param path 
     * @returns 
     */
    findOneInPathOrFail(path: IFindOneRoutePath): Promise<Route> {
        return this.getFindInPathOptions(path).getOneOrFail();
    }

    async move(ids: number[], toRouteId: number, offset: Offset): Promise<Route[]> {
        const routes: Route[] = await this.find({
            where: {
                id: In(ids)
            },
            order: {
                'route_order': 'ASC'
            },
            relations: ['routingTable', 'routingTable.firewall']
        });

        let affectedRoutes: Route[] = await this.findManyInPath({
            fwCloudId: routes[0].routingTable.firewall.fwCloudId,
            firewallId: routes[0].routingTable.firewall.id,
            routingTableId: routes[0].routingTable.id
        });

        const destRoute: Route = await this.findOneOrFail({
            where: {
                id: toRouteId
            }
        })

        if (offset === Offset.Above) {
            affectedRoutes = await this.moveAbove(routes, affectedRoutes, destRoute);
        } else {
            affectedRoutes = await this.moveBelow(routes, affectedRoutes, destRoute);
        }

        await this.save(affectedRoutes);

        await this.refreshOrders(routes[0].routingTableId);
        
        return await this.find({where: {id: In(ids)}});
    }

    protected async moveAbove(routes: Route[], affectedRoutes: Route[], destRoute: Route): Promise<Route[]> {
        const destPosition: number = destRoute.route_order;
        const movingIds: number[] = routes.map(route => route.id);

        const currentPosition: number = routes[0].route_order;
        const forward: boolean = currentPosition < destRoute.route_order;

        affectedRoutes.forEach((route) => {
            if (movingIds.includes(route.id)) {
                const offset: number = movingIds.indexOf(route.id);
                route.route_order = destPosition + offset;
                route.routeGroupId = destRoute.routeGroupId;
            } else {
                if (forward &&
                    route.route_order >= destRoute.route_order
                ) {
                    route.route_order += routes.length;
                }
                
                if (!forward && 
                    route.route_order >= destRoute.route_order && 
                    route.route_order < routes[0].route_order
                ) {
                    route.route_order += routes.length;
                }
            }
        });

        return affectedRoutes;
    }

    protected async moveBelow(routes: Route[], affectedRoutes: Route[], destRoute: Route): Promise<Route[]> {
        const destPosition: number = destRoute.route_order;
        const movingIds: number[] = routes.map(route => route.id);

        const currentPosition: number = routes[0].route_order;
        const forward: boolean = currentPosition < destRoute.route_order;

        affectedRoutes.forEach((route) => {
            if (movingIds.includes(route.id)) {
                const offset: number = movingIds.indexOf(route.id);
                route.route_order = destPosition + offset + 1;
                route.routeGroupId = destRoute.routeGroupId;
            } else {
                if (forward && route.route_order > destRoute.route_order) {
                    route.route_order += routes.length;
                }
                
                if (!forward && route.route_order > destRoute.route_order &&
                    route.route_order < routes[0].route_order
                ) {
                    route.route_order += routes.length;
                }
            }
        });

        return affectedRoutes;
    }

    async remove(entities: Route[], options?: RemoveOptions): Promise<Route[]>;
    async remove(entity: Route, options?: RemoveOptions): Promise<Route>;
    async remove(entityOrEntities: Route|Route[], options?: RemoveOptions): Promise<Route|Route[]> {
        const affectedTables: {[id: number]: RoutingTable} = {};

        const entityArray: Route[] = Array.isArray(entityOrEntities) ? entityOrEntities: [entityOrEntities];
        const entitiesWithRoutingTable: Route[] = await this.find({
            where: {
                id: In(entityArray.map(item => item.id))
            },
            relations: ['routingTable']
        });

        for(let entity of entitiesWithRoutingTable) {
            if (!Object.prototype.hasOwnProperty.call(affectedTables, entity.routingTableId)) {
                affectedTables[entity.routingTableId] = entity.routingTable;
            }
        }

        // Using Type assertion because TypeScript compiler fails 
        const result = await super.remove(entityOrEntities as Route[], options);

        for(let routingTable of Object.values(affectedTables)) {
            await this.refreshOrders(routingTable.id);
        }

        return result;
    }
    
    async getLastRouteInRoutingTable(routingTableId: number): Promise<Route | undefined> {
        return (await this.find({
            where: {
                routingTableId: routingTableId
            },
            order: {
                route_order: 'DESC'
            },
            take: 1
        }))[0]
    }

    getRoutingTableRoutes(fwcloud: number, firewall: number, routingTable: number, routes?: number[]): Promise<Route[]> {
        let query = this.createQueryBuilder("route")
            .innerJoinAndSelect("route.gateway","gateway")
            .leftJoinAndSelect("route.interface","interface")
            .leftJoinAndSelect("route.routeGroup", "group")
            .leftJoinAndSelect("route.firewallApplyTo", "cluster_node")
            .innerJoinAndSelect("route.routingTable", "table")
            .innerJoin("table.firewall", "firewall")
            .innerJoin("firewall.fwCloud", "fwcloud")
            .where("table.id = :routingTable", {routingTable})
            .andWhere("firewall.id = :firewall", {firewall: firewall})
            .andWhere("fwcloud.id = :fwcloud", {fwcloud: fwcloud});

        if (routes) query = query.andWhere("route.id IN (:...routes)", {routes: routes});
            
        return query.orderBy("route.route_order").getMany();
    }

    /**
     * Some operations might leave an inconsistent route_order. This function refresh the route_order
     * value in order to keep them consecutive
     * 
     * @param routingTableId 
     */
     protected async refreshOrders(routingTableId: number): Promise<void> {
        let affectedRoutes: Route[] = await this.findManyInPath({
            routingTableId: routingTableId
        });

        if (affectedRoutes.length === 0) {
            return;
        }

        await this.query(
            `SET @a:=0; UPDATE ${Route._getTableName()} SET route_order=@a:=@a+1 WHERE id IN (${affectedRoutes.map(item => item.id).join(',')}) ORDER BY route_order`
        )
    }

    protected getFindInPathOptions(path: Partial<IFindOneRoutePath>, options: FindOneOptions<Route> | FindManyOptions <Route> = {}): SelectQueryBuilder<Route> {
        const qb: SelectQueryBuilder<Route> = this.createQueryBuilder('route');
        qb.innerJoinAndSelect('route.routingTable', 'table')
            .innerJoin('table.firewall', 'firewall')
            .innerJoin('firewall.fwCloud', 'fwcloud')

        if (path.firewallId) {
            qb.andWhere('firewall.id = :firewall', { firewall: path.firewallId });
        }

        if (path.fwCloudId) {
            qb.andWhere('firewall.fwCloudId = :fwcloud', { fwcloud: path.fwCloudId });
        }

        if (path.routingTableId) {
            qb.andWhere('table.id = :table', { table: path.routingTableId });
        }

        if (path.id) {
            qb.andWhere('route.id = :id', { id: path.id });
        }

        // Aplica las opciones adicionales que se pasaron a la función
        Object.entries(options).forEach(([key, value]) => {
            switch (key) {
                case 'where':
                    qb.andWhere(value);
                    break;
                case 'relations':
                    qb.leftJoinAndSelect(`route.${value}`, `${value}`);
                    break;
                default:
            }
        });

        return qb;
    }
}