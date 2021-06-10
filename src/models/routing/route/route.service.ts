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
import { FwCloud } from "../../fwcloud/FwCloud";
import { Interface } from "../../interface/Interface";
import { IPObj } from "../../ipobj/IPObj";
import { IPObjGroup } from "../../ipobj/IPObjGroup";
import { PolicyRuleToIPObj } from "../../policy/PolicyRuleToIPObj";
import { OpenVPN } from "../../vpn/openvpn/OpenVPN";
import { OpenVPNPrefix } from "../../vpn/openvpn/OpenVPNPrefix";
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
    position?: number;
    style?: string;
}

interface IUpdateRoute {
    active?: boolean;
    comment?: string;
    gatewayId?: number;
    interfaceId?: number;
    position?: number;
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

        route = await this._repository.save(route);

        if (data.position && route.position !== data.position) {
            return await this._repository.move(route.id, data.position);
        }

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

            if (ipObj.ipObjTypeId === 8) { // 8 = HOST
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
                for(const ipObjToIPObjGroups of ipObjGroup.ipObjToIPObjGroups) {
                    if (ipObjToIPObjGroups.ipObj.ipObjTypeId === 8) { // 8 = HOST
                        let addrs: any = await Interface.getHostAddr(db.getQuery(), ipObjToIPObjGroups.ipObj.id);
                        if (addrs.length === 0) {
                            errors[`ipObjGroupIds.${i}`] = ['ipObjGroupId contains invalid ipObjs']
                        }
                    }
                }
            }
        }
        
        
        if (Object.keys(errors).length > 0) {
            throw new ValidationException('The given data was invalid', errors);
        }
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