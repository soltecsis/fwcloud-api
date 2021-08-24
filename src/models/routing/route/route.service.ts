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

import { FindManyOptions, FindOneOptions, getCustomRepository, getRepository, In, Not, SelectQueryBuilder } from "typeorm";
import { Application } from "../../../Application";
import db from "../../../database/database-manager";
import { ValidationException } from "../../../fonaments/exceptions/validation-exception";
import { Service } from "../../../fonaments/services/service";
import { ErrorBag } from "../../../fonaments/validation/validator";
import { Firewall } from "../../firewall/Firewall";
import { Interface } from "../../interface/Interface";
import { IPObj } from "../../ipobj/IPObj";
import { IPObjGroup } from "../../ipobj/IPObjGroup";
import { PolicyRuleToIPObj } from "../../policy/PolicyRuleToIPObj";
import { OpenVPN } from "../../vpn/openvpn/OpenVPN";
import { OpenVPNPrefix } from "../../vpn/openvpn/OpenVPNPrefix";
import { RoutingTable } from "../routing-table/routing-table.model";
import { RouteToIPObjGroup } from "./route-to-ipobj-group.model";
import { RouteToIPObj } from "./route-to-ipobj.model";
import { RouteToOpenVPNPrefix } from "./route-to-openvpn-prefix.model";
import { RouteToOpenVPN } from "./route-to-openvpn.model";
import { Route } from "./route.model";
import { RouteRepository } from "./route.repository";

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
    gatewayId: number;
    interfaceId?: number;
    active?: boolean;
    comment?: string;
    style?: string;
    ipObjIds?: number[];
    ipObjGroupIds?: number[];
    openVPNIds?: number[];
    openVPNPrefixIds?: number[],
    to?: number; //Reference where create the route
    offset?: 'above' | 'below';
}

interface IUpdateRoute {
    active?: boolean;
    comment?: string;
    gatewayId?: number;
    interfaceId?: number;
    style?: string;
    ipObjIds?: number[];
    ipObjGroupIds?: number[];
    openVPNIds?: number[];
    openVPNPrefixIds?: number[]
}

interface IBulkUpdateRoute {
    style?: string;
    active?: boolean;
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

    findOneInPath(path: IFindOneRoutePath, options?: FindOneOptions<Route>): Promise<Route | undefined> {
        return this._repository.findOne(this.getFindInPathOptions(path, options));
    }

    findOneInPathOrFail(path: IFindOneRoutePath): Promise<Route> {
        return this._repository.findOneOrFail(this.getFindInPathOptions(path));
    }

    async create(data: ICreateRoute): Promise<Route> {
        const routeData: Partial<Route> = {
            routingTableId: data.routingTableId,
            gatewayId: data.gatewayId,
            interfaceId: data.interfaceId,
            active: data.active,
            comment: data.comment,
            style: data.style
        }

        const lastRuoute: Route = await this._repository.getLastRouteInRoutingTable(data.routingTableId);
        const route_order: number = lastRuoute?.route_order? lastRuoute.route_order + 1 : 1;
        routeData.route_order = route_order;
        
        let persisted: Route = await this._repository.save(routeData);

        persisted = await this.update(persisted.id, {
            ipObjIds: data.ipObjIds,
            ipObjGroupIds: data.ipObjGroupIds,
            openVPNIds: data.openVPNIds,
            openVPNPrefixIds: data.openVPNPrefixIds,
            interfaceId: data.interfaceId,
        })

        if (Object.prototype.hasOwnProperty.call(data, 'to') && Object.prototype.hasOwnProperty.call(data, 'offset')) {
            return (await this.move([persisted.id], data.to, data.offset))[0];
        }

        return persisted;
    }

    async update(id: number, data: IUpdateRoute): Promise<Route> {
        let route: Route = await this._repository.preload(Object.assign({
            active: data.active,
            comment: data.comment,
            gatewayId: data.gatewayId,
            style: data.style,
        }, {id}));

        const firewall: Firewall = (await this._repository.findOne(route.id, {relations: ['routingTable', 'routingTable.firewall']})).routingTable.firewall;

        if (data.ipObjIds) {
            await this.validateUpdateIPObjs(firewall, data);
            route.routeToIPObjs = data.ipObjIds.map(item => ({
                routeId: route.id,
                ipObjId: item,
                order: 0
            } as RouteToIPObj));
        }

        if (data.ipObjGroupIds) {
            await this.validateUpdateIPObjGroups(firewall, data);

            route.routeToIPObjGroups = data.ipObjGroupIds.map(item => ({
                routeId: route.id,
                ipObjGroupId: item,
                order: 0
            } as RouteToIPObjGroup));
        }

        if (data.openVPNIds) {
            const openVPNs: OpenVPN[] = await getRepository(OpenVPN).find({
                where: {
                    id: In(data.openVPNIds)
                }
            });

            route.routeToOpenVPNs = openVPNs.map(item => ({
                routeId: route.id,
                openVPNId: item.id,
                order: 0
            } as RouteToOpenVPN));
        }

        if (data.openVPNPrefixIds) {
            const prefixes: OpenVPNPrefix[] = await getRepository(OpenVPNPrefix).find({
                where: {
                    id: In(data.openVPNPrefixIds),
                }
            })

            route.routeToOpenVPNPrefixes = prefixes.map(item => ({
                routeId: route.id,
                openVPNPrefixId: item.id,
                order: 0
            } as RouteToOpenVPNPrefix));
        }

        if (Object.prototype.hasOwnProperty.call(data, "interfaceId")) {
            if (data.interfaceId !== null) {
                await this.validateInterface(firewall, data);
            }

            route.interfaceId = data.interfaceId
        }

        route = await this._repository.save(route);
        
        return route;
    }

    async copy(ids: number[], destRule: number, position: 'above'|'below'): Promise<Route[]> {
        const routes: Route[] = await this._repository.find({
            where: {
                id: In(ids)
            },
            relations: ['routingTable', 'routeToIPObjs', 'routeToIPObjGroups', 'routeToOpenVPNs', 'routeToOpenVPNPrefixes']
        });

        const lastRuoute: Route = await this._repository.getLastRouteInRoutingTable(routes[0].routingTableId);
        routes.map((item, index) => {
            item.id = undefined;
            item.route_order = lastRuoute.route_order + index + 1
        });


        const persisted: Route[] = await this._repository.save(routes);

        return this.move(persisted.map(item => item.id), destRule, position);
    }

    async bulkUpdate(ids: number[], data: IBulkUpdateRoute): Promise<Route[]> {
        await this._repository.update({
            id: In(ids)
        }, data);

        return this._repository.find({
            where: {
                id: In(ids)
            }
        });
    }

    async move(ids: number[], destRule: number, offset: 'above'|'below'): Promise<Route[]> {
        return this._repository.move(ids, destRule, offset);
    }

    async remove(path: IFindOneRoutePath): Promise<Route> {
        const route: Route =  await this.findOneInPath(path, {relations: ['routeToOpenVPNPrefixes']});

        route.routeToOpenVPNPrefixes = [];
        route.routeToOpenVPNs = [];
        route.routeToIPObjGroups = [];
        route.routeToIPObjs = [];
        await this._repository.save(route);

        await this._repository.remove(route);

        return route;
    }

    async bulkRemove(ids: number[]): Promise<Route[]> {
        const routes: Route[] = await this._repository.find({
            where: {
                id: In(ids)
            }
        });

        // For unknown reason, this._repository.remove(routes) is not working
        for (let route of routes) {
            await this.remove({
                id: route.id
            })
        }

        return routes;
    }

    /**
     * Checks IPObj are valid to be attached to the route. It will check:
     *  - IPObj belongs to the same FWCloud
     *  - IPObj contains at least one addres if its type is host
     * 
     */
     protected async validateUpdateIPObjs(firewall: Firewall, data: IUpdateRoute): Promise<void> {
        const errors: ErrorBag = {};

        if (!data.ipObjIds || data.ipObjIds.length === 0) {
            return;
        }
        
        const ipObjs: IPObj[] = await getRepository(IPObj).find({
            where: {
                id: In(data.ipObjIds),
            },
            relations: ['fwCloud']
        });

        for (let i = 0; i < ipObjs.length; i++) {
            const ipObj: IPObj = ipObjs[i];
            
            if (ipObj.fwCloudId && ipObj.fwCloudId !== firewall.fwCloudId) {
                errors[`ipObjIds.${i}`] = ['ipObj id must exist']
            }

            else if (ipObj.ipObjTypeId === 8) { // 8 = HOST
                let addrs: any = await Interface.getHostAddr(db.getQuery(), ipObj.id);
                if (addrs.length === 0) {
                    errors[`ipObjIds.${i}`] = ['ipObj must contain at least one address']
                }
            }
        }
        
        
        if (Object.keys(errors).length > 0) {
            throw new ValidationException('The given data was invalid', errors);
        }
    }

    /**
     * Checks IPObjGroups are valid to be attached to the route. It will check:
     *  - IPObjGroup belongs to the same FWCloud
     *  - IPObjGroup is not empty
     * 
     */
    protected async validateUpdateIPObjGroups(firewall: Firewall, data: IUpdateRoute): Promise<void> {
        const errors: ErrorBag = {};

        if (!data.ipObjGroupIds || data.ipObjGroupIds.length === 0) {
            return;
        }
        
        const ipObjGroups: IPObjGroup[] = await getRepository(IPObjGroup).find({
            where: {
                id: In(data.ipObjGroupIds),
            },
            relations: ['fwCloud', 'ipObjToIPObjGroups', 'ipObjToIPObjGroups.ipObj']
        });

        for (let i = 0; i < ipObjGroups.length; i++) {
            const ipObjGroup: IPObjGroup = ipObjGroups[i];
            
            if (ipObjGroup.fwCloudId !== firewall.fwCloudId) {
                errors[`ipObjGroupIds.${i}`] = ['ipObjGroupId must exist'];
            } else if (await PolicyRuleToIPObj.isGroupEmpty(db.getQuery(), ipObjGroup.id)) {
                errors[`ipObjGroupIds.${i}`] = ['ipObjGroupId must not be empty'];
            } else {
                let valid: boolean = false;
                for(const ipObjToIPObjGroup of ipObjGroup.ipObjToIPObjGroups) {
                    if (ipObjToIPObjGroup.ipObj.ipObjTypeId === 8) { // 8 = HOST
                        let addrs: any = await Interface.getHostAddr(db.getQuery(), ipObjToIPObjGroup.ipObj.id);
                        if (addrs.length > 0 ) {
                            valid = true;
                        }
                    }

                    if (ipObjToIPObjGroup.ipObj.ipObjTypeId === 5 
                        || ipObjToIPObjGroup.ipObj.ipObjTypeId === 6
                        || ipObjToIPObjGroup.ipObj.ipObjTypeId === 7) {
                            valid = true;
                    }
                }

                if (!valid) {
                    errors[`ipObjGroupIds.${i}`] = ['ipObjGroupId is not suitable as it does not contains any valid host']
                }
            }
        }
        
        
        if (Object.keys(errors).length > 0) {
            throw new ValidationException('The given data was invalid', errors);
        }
    }

    protected async validateInterface(firewall: Firewall, data: ICreateRoute | IUpdateRoute): Promise<void> {
        const errors: ErrorBag = {};

        if (!data.interfaceId) {
            return;
        }
        
        const intr: Interface[] = await getRepository(Interface).find({
            where: {
                id: data.interfaceId,
                firewallId: firewall.id
            }
        });

        if (!intr) {
            errors.interfaceId = ['interface is not valid'];
        }
        
        
        if (Object.keys(errors).length > 0) {
            throw new ValidationException('The given data was invalid', errors);
        }
    }

    protected getFindInPathOptions(path: Partial<IFindOneRoutePath>, options: FindOneOptions<Route> | FindManyOptions <Route> = {}): FindOneOptions<Route> | FindManyOptions<Route> {
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

                if(path.routingTableId) {
                    qb.andWhere('table.id = :table', {table: path.routingTableId})
                }

                if (path.id) {
                    qb.andWhere('route.id = :id', {id: path.id})
                }
            }
        }, options)
    }
}