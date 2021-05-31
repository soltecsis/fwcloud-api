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

import { getCustomRepository, getRepository, In, SelectQueryBuilder } from "typeorm";
import { Application } from "../../../Application";
import { Service } from "../../../fonaments/services/service";
import { Firewall } from "../../firewall/Firewall";
import { IPObj } from "../../ipobj/IPObj";
import { IPObjRepository } from "../../ipobj/IPObj.repository";
import { IPObjGroup } from "../../ipobj/IPObjGroup";
import { IPObjGroupRepository } from "../../ipobj/IPObjGroup.repository";
import { Mark } from "../../ipobj/Mark";
import { OpenVPN } from "../../vpn/openvpn/OpenVPN";
import { OpenVPNRepository } from "../../vpn/openvpn/openvpn-repository";
import { OpenVPNPrefix } from "../../vpn/openvpn/OpenVPNPrefix";
import { OpenVPNPrefixRepository } from "../../vpn/openvpn/OpenVPNPrefix.repository";
import { AvailableDestinations, ItemForGrid, RoutingRuleItemForCompiler, RoutingUtils } from "../shared";
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
    openVPNPrefixIds?: number[],
    markIds?: number[]
}

export interface RoutingRulesData<T extends ItemForGrid | RoutingRuleItemForCompiler> extends RoutingRule {
    items: T[];
}

export class RoutingRuleService extends Service {
    protected _repository: RoutingRuleRepository;
    private _ipobjRepository: IPObjRepository;
    private _ipobjGroupRepository: IPObjGroupRepository;   
    private _openvpnRepository: OpenVPNRepository;
    private _openvpnPrefixRepository: OpenVPNPrefixRepository;

    constructor(app: Application) {
        super(app);
        this._repository = getCustomRepository(RoutingRuleRepository);
        this._ipobjRepository = getCustomRepository(IPObjRepository);
        this._ipobjGroupRepository = getCustomRepository(IPObjGroupRepository);
        this._openvpnRepository = getCustomRepository(OpenVPNRepository);
        this._openvpnPrefixRepository = getCustomRepository(OpenVPNPrefixRepository);
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

        if(data.markIds) {
            const marks: Mark[] = await getRepository(Mark).find({
                where: {
                    id: In(data.markIds),
                    fwCloudId: firewall.id
                }
            });

            rule.marks = marks.map(item => ({id: item.id}) as Mark);
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

    /**
     * Returns an array of routing rules and in each rule an array of items containing the information
     * required for compile the routing rules of the indicated firewall or for show the routing rules
     * items in the FWCloud-UI.
     * @param dst 
     * @param fwcloud 
     * @param firewall 
     * @param routingTable 
     * @param route 
     * @returns 
     */
     public async getRoutingRulesData<T extends ItemForGrid | RoutingRuleItemForCompiler>(dst: AvailableDestinations, fwcloud: number, firewall: number, rule?: number): Promise<RoutingRulesData<T>[]> {
        const rules: RoutingRulesData<T>[] = await this._repository.getRoutingRules(fwcloud, firewall, rule) as RoutingRulesData<T>[];
         
        // Init the map for access the objects array for each route.
        let ItemsArrayMap = new Map<number, T[]>();
        for (let i=0; i<rules.length; i++) {
          rules[i].items = [];
    
          // Map each route with it's corresponding items array.
          // These items array will be filled with objects data in the Promise.all()
          ItemsArrayMap.set(rules[i].id, rules[i].items);
        }
    
        const sqls = (dst === 'grid') ? 
            this.buildSQLsForGrid(fwcloud, firewall) : 
            this.buildSQLsForCompiler(fwcloud, firewall, rule);
        await Promise.all(sqls.map(sql => RoutingUtils.mapEntityData<T>(sql,ItemsArrayMap)));
        
        return rules;
    }

    private buildSQLsForCompiler(fwcloud: number, firewall: number, rule?: number): SelectQueryBuilder<IPObj>[] {
        return [
            this._ipobjRepository.getIpobjsInRouting_excludeHosts('rule', fwcloud, firewall, null, rule),
            this._ipobjRepository.getIpobjsInRouting_onlyHosts('rule', fwcloud, firewall, null, rule),
            this._ipobjRepository.getIpobjsInGroupsInRouting_excludeHosts('rule', fwcloud, firewall, null, rule),
            this._ipobjRepository.getIpobjsInGroupsInRouting_onlyHosts('rule', fwcloud, firewall, null, rule),
            this._ipobjRepository.getIpobjsInOpenVPNInRouting('rule', fwcloud, firewall, null, rule),
            this._ipobjRepository.getIpobjsInOpenVPNInGroupsInRouting('rule', fwcloud, firewall, null, rule),
            this._ipobjRepository.getIpobjsInOpenVPNPrefixesInRouting('rule', fwcloud, firewall, null, rule),
            this._ipobjRepository.getIpobjsInOpenVPNPrefixesInGroupsInRouting('rule', fwcloud, firewall, null, rule),
        ];
    }

    private buildSQLsForGrid(fwcloud: number, firewall: number): SelectQueryBuilder<IPObj|IPObjGroup|OpenVPN|OpenVPNPrefix>[] {
        return [
            this._ipobjRepository.getIpobjsInRouting_ForGrid('rule', fwcloud, firewall),
            this._ipobjGroupRepository.getIpobjGroupsInRouting_ForGrid('rule', fwcloud, firewall),
            this._openvpnRepository.getOpenVPNInRouting_ForGrid('rule', fwcloud, firewall),
            this._openvpnPrefixRepository.getOpenVPNPrefixInRouting_ForGrid('rule', fwcloud, firewall),
        ];
    }

}