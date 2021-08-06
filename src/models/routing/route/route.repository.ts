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

import { EntityRepository, FindManyOptions, FindOneOptions, getConnection, In, QueryBuilder, QueryRunner, RemoveOptions, Repository, SelectQueryBuilder } from "typeorm";
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

    async move(ids: number[], to: number): Promise<Route[]> {
        const routes: Route[] = await this.find({
            where: {
                id: In(ids)
            },
            order: {
                'route_order': 'ASC'
            },
            relations: ['routingTable', 'routingTable.firewall']
        });

        const forward: boolean = routes[0].route_order < to;
        
        const affectedRoutes: Route[] = await this.findManyInPath({
            fwCloudId: routes[0].routingTable.firewall.fwCloudId,
            firewallId: routes[0].routingTable.firewall.id,
            routingTableId: routes[0].routingTable.id
        });
        const destRoute: Route | undefined = affectedRoutes.filter(item => item.route_order === to)[0];

        affectedRoutes.forEach((route) => {
            if (ids.includes(route.id)) {
                const offset: number = ids.indexOf(route.id);
                route.route_order = to + offset;
                route.routeGroupId = destRoute && destRoute.routeGroupId ? destRoute.routeGroupId : null;
            } else {
                if (forward) {
                    if (route.route_order >= to) {
                        route.route_order += routes.length;
                    }
                }

                if (!forward) {
                    if (route.route_order >= to && route.route_order < routes[0].route_order) {
                        route.route_order += routes.length;
                    }
                }
            }
        });

        await this.save(affectedRoutes);

        await this.query(
            `SET @a:=0; UPDATE ${Route._getTableName()} SET route_order=@a:=@a+1 WHERE id IN (${affectedRoutes.map(item => item.id).join(',')}) ORDER BY route_order`
        )
        
        return this.find({where: {id: In(ids)}});
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