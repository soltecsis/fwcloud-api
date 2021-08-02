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

import { EntityRepository, FindManyOptions, FindOneOptions, getConnection, QueryBuilder, QueryRunner, RemoveOptions, Repository, SelectQueryBuilder } from "typeorm";
import { Route } from "./route.model";

interface IFindManyRoutePath {
    fwCloudId?: number;
    firewallId?: number;
    routingTableId?: number;
}

interface IFindOneRoutePath extends IFindManyRoutePath {
    id: number;
}

@EntityRepository(Route)
export class RouteRepository extends Repository<Route> {
    /**
     * Finds routing rules which belongs to the given path
     *
     * @param path 
     * @returns 
     */
     findManyInPath(path: IFindManyRoutePath, options?: FindManyOptions<Route>): Promise<Route[]> {
        return this.find(this.getFindInPathOptions(path, options));
    }

    /**
     * Fins one routing rule which belongs to the given path
     * @param path 
     * @returns 
     */
    findOneInPath(path: IFindOneRoutePath): Promise<Route | undefined> {
        return this.findOne(this.getFindInPathOptions(path));
    }

    /**
     * Finds one routing rule in a path or throws an exception 
     * @param path 
     * @returns 
     */
    findOneInPathOrFail(path: IFindOneRoutePath): Promise<Route> {
        return this.findOneOrFail(this.getFindInPathOptions(path));
    }

    /**
     * Moves a RoutingRule into the "to" route_order (updating other RoutingRules route_order affected by this change).
     * 
     * @param id 
     * @param to 
     * @returns 
     */
     async move(id: number, to: number): Promise<Route> {
        const route: Route = await this.findOneOrFail(id, {relations: ['routingTable', 'routingTable.firewall']});
        
        let affectedRules: Route[] = [];
        
        const lastRouteOrder: Route = await this.getLastRouteInRoutingTable(route.routingTableId);
        
        const greaterValidOrder: number = lastRouteOrder ? lastRouteOrder.route_order + 1 : 1;
        
        //Assert route_order is valid
        to = Math.min(Math.max(1, to), greaterValidOrder);

        if (route.route_order > to) {
            affectedRules = await this.createQueryBuilder('route')
                .where("route.route_order >= :greater", {greater: to})
                .andWhere("route.route_order < :lower", {lower: route.route_order})
                .andWhere("route.routingTableId = :table", {table: route.routingTableId}).getMany();
            
            affectedRules.forEach(rule => rule.route_order = rule.route_order + 1);
        }

        if (route.route_order < to) {
            affectedRules = await this.createQueryBuilder('route')
                .where("route.route_order > :greater", {greater: route.route_order})
                .andWhere("route.route_order <= :lower", {lower: to})
                .andWhere("route.routingTableId = :table", {table: route.routingTableId}).getMany();

            affectedRules.forEach(rule => rule.route_order = rule.route_order - 1);
        }

        route.route_order = to;
        affectedRules.push(route);
        
        await this.save(affectedRules);

        return route;
    }

    async remove(entities: Route[], options?: RemoveOptions): Promise<Route[]>;
    async remove(entity: Route, options?: RemoveOptions): Promise<Route>;
    async remove(entityOrEntities: Route|Route[], options?: RemoveOptions): Promise<Route|Route[]> {
        const entities: Route[] = !Array.isArray(entityOrEntities) ? [entityOrEntities] : entityOrEntities;
        
        const queryRunner: QueryRunner = getConnection().createQueryRunner();
        await queryRunner.connect();
        await queryRunner.startTransaction();
        
        try {
            for(const entity of entities) {
                const queryBuilder: QueryBuilder<Route> = this.createQueryBuilder('route', queryRunner);
            
                await super.remove(entity, options);
                await queryBuilder
                        .update()
                        .where('routingTableId = :table', {table: entity.routingTableId})
                        .andWhere('route_order > :lower', {lower: entity.route_order})
                        .set({
                            route_order: () => "route_order - 1"
                        }).execute();
            }
            
            await queryRunner.commitTransaction();
            
            return entityOrEntities;

        } catch(e) {
            await queryRunner.rollbackTransaction();
        } finally {
            await queryRunner.release()
        }
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

    getRoutingTableRoutes(fwcloud: number, firewall: number, routingTable: number, route?: number): Promise<Route[]> {
        let query = this.createQueryBuilder("route")
            .innerJoinAndSelect("route.gateway","gateway")
            .leftJoinAndSelect("route.interface","interface")
            .leftJoinAndSelect("route.routeGroup", "group")
            .innerJoinAndSelect("route.routingTable", "table")
            .innerJoin("table.firewall", "firewall")
            .innerJoin("firewall.fwCloud", "fwcloud")
            .where("table.id = :routingTable", {routingTable})
            .andWhere("firewall.id = :firewall", {firewall: firewall})
            .andWhere("fwcloud.id = :fwcloud", {fwcloud: fwcloud});

        if (route) query = query.andWhere("route.id = :route", {route});
            
        return query.orderBy("route.route_order").getMany();
    }

    protected getFindInPathOptions(path: Partial<IFindOneRoutePath>, options: FindOneOptions<Route> | FindManyOptions<Route> = {}): FindOneOptions<Route> | FindManyOptions<Route> {
        return Object.assign({
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

                if (path.routingTableId) {
                    qb.andWhere('table.id = :table', {table: path.routingTableId})
                }

                if (path.id) {
                    qb.andWhere('rule.id = :id', {id: path.id})
                }
            }
        }, options)
    }
}