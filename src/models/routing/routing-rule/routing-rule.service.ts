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

import { getCustomRepository, getRepository, In } from "typeorm";
import { Application } from "../../../Application";
import { Service } from "../../../fonaments/services/service";
import { Firewall } from "../../firewall/Firewall";
import { IPObj } from "../../ipobj/IPObj";
import { IPObjGroup } from "../../ipobj/IPObjGroup";
import { OpenVPN } from "../../vpn/openvpn/OpenVPN";
import { OpenVPNPrefix } from "../../vpn/openvpn/OpenVPNPrefix";
import { RoutingRule } from "./routing-rule.model";
import { IFindManyRoutingRulePath, IFindOneRoutingRulePath, RoutingRuleRepository } from "./routing-rule.repository";

interface ICreateRoutingRule {
    routingTableId: number;
    active?: boolean;
    comment?: string;
    position?: number;
    style?: string;
}

interface IUpdateRoutingRule {
    routingTableId?: number;
    active?: boolean;
    comment?: string;
    position?: number;
    style?: string;
    ipObjIds?: number[];
    ipObjGroupIds?: number[];
    openVPNIds?: number[];
    openVPNPrefixIds?: number[]
}

export class RoutingRuleService extends Service {
    protected _repository: RoutingRuleRepository;

    constructor(app: Application) {
        super(app);
        this._repository = getCustomRepository(RoutingRuleRepository);
    }

    findManyInPath(path: IFindManyRoutingRulePath): Promise<RoutingRule[]> {
        return this._repository.findManyInPath(path);
    }

    findOneInPath(path: IFindOneRoutingRulePath): Promise<RoutingRule | undefined> {
        return this._repository.findOneInPath(path);
    }

    findOneInPathOrFail(path: IFindOneRoutingRulePath): Promise<RoutingRule> {
        return this._repository.findOneInPathOrFail(path);
    }

    async create(data: ICreateRoutingRule): Promise<RoutingRule> {
        const rule: RoutingRule = await this._repository.getLastRoutingRuleInRoutingTable(data.routingTableId);
        const position: number = rule?.position? rule.position + 1 : 1;
        data.position = position;
        return this._repository.save(data);
    }

    async update(id: number, data: IUpdateRoutingRule): Promise<RoutingRule> {
        let rule: RoutingRule = await this._repository.preload(Object.assign({
            routingTableId: data.routingTableId,
            active: data.active,
            comment: data.comment,
        }, {id}));

        const firewall: Firewall = (await this._repository.findOne(rule.id, {relations: ['routingTable', 'routingTable.firewall']})).routingTable.firewall;


        if (data.ipObjIds) {
            const ipObjs: IPObj[] = await getRepository(IPObj).find({
                where: {
                    id: In(data.ipObjIds),
                    fwCloudId: firewall.fwCloudId,
                }
            })

            rule.ipObjs = ipObjs.map(item => ({id: item.id} as IPObj));
        }

        if (data.ipObjGroupIds) {
            const groups: IPObjGroup[] = await getRepository(IPObjGroup).find({
                where: {
                    id: In(data.ipObjGroupIds),
                    fwCloudId: firewall.fwCloudId,
                }
            })

            rule.ipObjGroups = groups.map(item => ({id: item.id} as IPObjGroup));
        }

        if (data.openVPNIds) {
            const openVPNs: OpenVPN[] = await getRepository(OpenVPN).find({
                where: {
                    id: In(data.openVPNIds),
                    firewallId: firewall.id,
                }
            })

            rule.openVPNs = openVPNs.map(item => ({id: item.id} as OpenVPN));
        }

        if (data.openVPNPrefixIds) {
            const prefixes: OpenVPNPrefix[] = await getRepository(OpenVPNPrefix).find({
                where: {
                    id: In(data.openVPNPrefixIds)
                }
            })

            rule.openVPNPrefixes = prefixes.map(item => ({id: item.id} as OpenVPNPrefix));
        }


        rule = await this._repository.save(rule);

        if (data.position && rule.position !== data.position) {
            return await this._repository.move(rule.id, data.position);
        }
        return rule;
    }

    async remove(path: IFindOneRoutingRulePath): Promise<RoutingRule> {
        const rule: RoutingRule = await this.findOneInPath(path);
        
        await this._repository.remove(rule);

        return rule;
    }
}