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
    gatewayId?: number;
    interfaceId?: number;
    active?: boolean;
    comment?: string;
    route_order?: number;
    style?: string;
    ipObjIds?: number[];
    ipObjGroupIds?: number[];
    openVPNIds?: number[];
    openVPNPrefixIds?: number[]
}

interface IUpdateRoute {
    active?: boolean;
    comment?: string;
    gatewayId?: number;
    interfaceId?: number;
    route_order?: number;
    style?: string;
    ipObjIds?: number[];
    ipObjGroupIds?: number[];
    openVPNIds?: number[];
    openVPNPrefixIds?: number[]
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
        const routingTable: RoutingTable = await getRepository(RoutingTable).findOne(data.routingTableId, {relations: ['firewall']});
        const firewall: Firewall = routingTable.firewall;

        const routeData: Partial<Route> = {
            routingTableId: data.routingTableId,
            gatewayId: data.gatewayId,
            interfaceId: data.interfaceId,
            active: data.active,
            comment: data.comment,
            style: data.style
        }

        if (data.ipObjIds) {
            await this.validateUpdateIPObjs(firewall, data);
            routeData.ipObjs = data.ipObjIds.map(id => ({id: id} as IPObj));
        }

        if (data.ipObjGroupIds) {
            await this.validateUpdateIPObjGroups(firewall, data);
            routeData.ipObjGroups = data.ipObjGroupIds.map(id => ({id: id} as IPObjGroup));
        }

        if (data.openVPNIds) {
            const openVPNs: OpenVPN[] = await getRepository(OpenVPN).find({
                where: {
                    id: In(data.openVPNIds),
                    firewallId: firewall.id,
                }
            })

            routeData.openVPNs = openVPNs.map(item => ({id: item.id} as OpenVPN));
        }

        if (data.openVPNPrefixIds) {
            const prefixes: OpenVPNPrefix[] = await getRepository(OpenVPNPrefix).find({
                where: {
                    id: In(data.openVPNPrefixIds),
                }
            })

            routeData.openVPNPrefixes = prefixes.map(item => ({id: item.id} as OpenVPNPrefix));
        }

        if (data.interfaceId) {
            await this.validateInterface(firewall, data);
            routeData.interfaceId = data.interfaceId
        }

        const lastRuoute: Route = await this._repository.getLastRouteInRoutingTable(data.routingTableId);
        const route_order: number = lastRuoute?.route_order? lastRuoute.route_order + 1 : 1;
        routeData.route_order = route_order;
        
        const persisted: Route = await this._repository.save(routeData);

        return data.route_order ? (await this._repository.move([persisted.id], data.route_order))[0] : persisted;
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
            route.ipObjs = data.ipObjIds.map(id => ({id: id} as IPObj));
        }

        if (data.ipObjGroupIds) {
            await this.validateUpdateIPObjGroups(firewall, data);
            route.ipObjGroups = data.ipObjGroupIds.map(id => ({id: id} as IPObjGroup));
        }

        if (data.openVPNIds) {
            const openVPNs: OpenVPN[] = await getRepository(OpenVPN).find({
                where: {
                    id: In(data.openVPNIds),
                    firewallId: firewall.id,
                }
            })

            route.openVPNs = openVPNs.map(item => ({id: item.id} as OpenVPN));
        }

        if (data.openVPNPrefixIds) {
            const prefixes: OpenVPNPrefix[] = await getRepository(OpenVPNPrefix).find({
                where: {
                    id: In(data.openVPNPrefixIds),
                }
            })

            route.openVPNPrefixes = prefixes.map(item => ({id: item.id} as OpenVPNPrefix));
        }

        if (data.interfaceId) {
            await this.validateInterface(firewall, data);
            route.interfaceId = data.interfaceId
        }

        route = await this._repository.save(route);

        if (data.route_order && route.route_order !== data.route_order) {
            return (await this._repository.move([route.id], data.route_order))[0];
        }

        return route;
    }

    async bulkMove(ids: number[], to: number): Promise<Route[]> {
        return this._repository.move(ids, to);
    }

    async remove(path: IFindOneRoutePath): Promise<Route> {
        const route: Route =  await this.findOneInPath(path);

        await this._repository.remove(route);

        return route;
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
            
            if (ipObj.fwCloudId !== firewall.fwCloudId) {
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