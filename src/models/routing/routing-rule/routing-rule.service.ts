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

import { getCustomRepository, getRepository, In, Repository, SelectQueryBuilder } from "typeorm";
import { Application } from "../../../Application";
import db from "../../../database/database-manager";
import { ValidationException } from "../../../fonaments/exceptions/validation-exception";
import { Service } from "../../../fonaments/services/service";
import { ErrorBag } from "../../../fonaments/validation/validator";
import { Firewall } from "../../firewall/Firewall";
import { Interface } from "../../interface/Interface";
import { IPObj } from "../../ipobj/IPObj";
import { IPObjRepository } from "../../ipobj/IPObj.repository";
import { IPObjGroup } from "../../ipobj/IPObjGroup";
import { IPObjGroupRepository } from "../../ipobj/IPObjGroup.repository";
import { Mark } from "../../ipobj/Mark";
import { MarkRepository } from "../../ipobj/Mark.repository";
import { PolicyRuleToIPObj } from "../../policy/PolicyRuleToIPObj";
import { OpenVPN } from "../../vpn/openvpn/OpenVPN";
import { OpenVPNRepository } from "../../vpn/openvpn/openvpn-repository";
import { OpenVPNPrefix } from "../../vpn/openvpn/OpenVPNPrefix";
import { OpenVPNPrefixRepository } from "../../vpn/openvpn/OpenVPNPrefix.repository";
import { RoutingTable } from "../routing-table/routing-table.model";
import { AvailableDestinations, ItemForGrid, RoutingRuleItemForCompiler, RoutingUtils } from "../shared";
import { RoutingRule } from "./routing-rule.model";
import { IFindManyRoutingRulePath, IFindOneRoutingRulePath, RoutingRuleRepository } from "./routing-rule.repository";

interface ICreateRoutingRule {
    routingTableId: number;
    active?: boolean;
    comment?: string;
    rule_order?: number;
    style?: string;
    ipObjIds?: number[];
    ipObjGroupIds?: number[];
    openVPNIds?: number[];
    openVPNPrefixIds?: number[],
    markIds?: number[]
}

interface IUpdateRoutingRule {
    routingTableId?: number;
    active?: boolean;
    comment?: string;
    rule_order?: number;
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
    private _markRepository: MarkRepository;
    private _routingTableRepository: Repository<RoutingTable>;

    constructor(app: Application) {
        super(app);
        this._repository = getCustomRepository(RoutingRuleRepository);
        this._ipobjRepository = getCustomRepository(IPObjRepository);
        this._ipobjGroupRepository = getCustomRepository(IPObjGroupRepository);
        this._openvpnRepository = getCustomRepository(OpenVPNRepository);
        this._openvpnPrefixRepository = getCustomRepository(OpenVPNPrefixRepository);
        this._markRepository = getCustomRepository(MarkRepository);
        this._routingTableRepository = getRepository(RoutingTable);
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
        const routingTable: RoutingTable = await this._routingTableRepository.findOneOrFail(data.routingTableId, {
            relations: ['firewall']
        });
        const firewall: Firewall = routingTable.firewall;

        const routingRuleData: Partial<RoutingRule> = {
            routingTableId: data.routingTableId,
            active: data.active,
            comment: data.comment,
            style: data.style,
        }

        if (data.ipObjIds) {
            await this.validateUpdateIPObjs(firewall, data);
            routingRuleData.ipObjs = data.ipObjIds.map(id => ({id: id} as IPObj));
        }

        if (data.ipObjGroupIds) {
            await this.validateUpdateIPObjGroups(firewall, data);
            routingRuleData.ipObjGroups = data.ipObjGroupIds.map(id => ({id: id} as IPObjGroup));
        }

        if (data.openVPNIds) {
            const openVPNs: OpenVPN[] = await getRepository(OpenVPN).find({
                where: {
                    id: In(data.openVPNIds),
                    firewallId: firewall.id,
                }
            })

            routingRuleData.openVPNs = openVPNs.map(item => ({id: item.id} as OpenVPN));
        }

        if (data.openVPNPrefixIds) {
            const prefixes: OpenVPNPrefix[] = await getRepository(OpenVPNPrefix).find({
                where: {
                    id: In(data.openVPNPrefixIds)
                }
            })

            routingRuleData.openVPNPrefixes = prefixes.map(item => ({id: item.id} as OpenVPNPrefix));
        }

        if(data.markIds) {
            const marks: Mark[] = await getRepository(Mark).find({
                where: {
                    id: In(data.markIds),
                    fwCloudId: firewall.fwCloudId
                }
            });

            routingRuleData.marks = marks.map(item => ({id: item.id}) as Mark);
        }

        const lastRule: RoutingRule = await this._repository.getLastRoutingRuleInRoutingTable(data.routingTableId);
        const rule_order: number = lastRule?.rule_order? lastRule.rule_order + 1 : 1;
        routingRuleData.rule_order = rule_order;
        
        const persisted: RoutingRule = await this._repository.save(routingRuleData);

        return data.rule_order ? (await this._repository.move([persisted.id], data.rule_order))[0] : persisted;
    }

    async update(id: number, data: IUpdateRoutingRule): Promise<RoutingRule> {
        let rule: RoutingRule = await this._repository.preload(Object.assign({
            routingTableId: data.routingTableId,
            active: data.active,
            comment: data.comment,
        }, {id}));

        const firewall: Firewall = (await this._repository.findOne(rule.id, {relations: ['routingTable', 'routingTable.firewall']})).routingTable.firewall;


        if (data.ipObjIds) {
            await this.validateUpdateIPObjs(firewall, data);
            rule.ipObjs = data.ipObjIds.map(id => ({id: id} as IPObj));
        }

        if (data.ipObjGroupIds) {
            await this.validateUpdateIPObjGroups(firewall, data);
            rule.ipObjGroups = data.ipObjGroupIds.map(id => ({id: id} as IPObjGroup));
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
                    fwCloudId: firewall.fwCloudId
                }
            });

            rule.marks = marks.map(item => ({id: item.id}) as Mark);
        }


        rule = await this._repository.save(rule);

        if (data.rule_order && rule.rule_order !== data.rule_order) {
            return (await this._repository.move([rule.id], data.rule_order))[0];
        }
        return rule;
    }

    async bulkMove(ids: number[], to: number): Promise<RoutingRule[]> {
        return this._repository.move(ids, to);
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

    /**
     * Checks IPObj are valid to be attached to the route. It will check:
     *  - IPObj belongs to the same FWCloud
     *  - IPObj contains at least one addres if its type is host
     * 
     */
     protected async validateUpdateIPObjs(firewall: Firewall, data: IUpdateRoutingRule): Promise<void> {
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
    protected async validateUpdateIPObjGroups(firewall: Firewall, data: IUpdateRoutingRule): Promise<void> {
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

    private buildSQLsForCompiler(fwcloud: number, firewall: number, rule?: number): SelectQueryBuilder<IPObj|Mark>[] {
        return [
            this._ipobjRepository.getIpobjsInRouting_excludeHosts('rule', fwcloud, firewall, null, rule),
            this._ipobjRepository.getIpobjsInRouting_onlyHosts('rule', fwcloud, firewall, null, rule),
            this._ipobjRepository.getIpobjsInGroupsInRouting_excludeHosts('rule', fwcloud, firewall, null, rule),
            this._ipobjRepository.getIpobjsInGroupsInRouting_onlyHosts('rule', fwcloud, firewall, null, rule),
            this._ipobjRepository.getIpobjsInOpenVPNInRouting('rule', fwcloud, firewall, null, rule),
            this._ipobjRepository.getIpobjsInOpenVPNInGroupsInRouting('rule', fwcloud, firewall, null, rule),
            this._ipobjRepository.getIpobjsInOpenVPNPrefixesInRouting('rule', fwcloud, firewall, null, rule),
            this._ipobjRepository.getIpobjsInOpenVPNPrefixesInGroupsInRouting('rule', fwcloud, firewall, null, rule),
            this._markRepository.getMarksInRoutingRules(fwcloud, firewall, rule)
        ];
    }

    private buildSQLsForGrid(fwcloud: number, firewall: number): SelectQueryBuilder<IPObj|IPObjGroup|OpenVPN|OpenVPNPrefix|Mark>[] {
        return [
            this._ipobjRepository.getIpobjsInRouting_ForGrid('rule', fwcloud, firewall),
            this._ipobjGroupRepository.getIpobjGroupsInRouting_ForGrid('rule', fwcloud, firewall),
            this._openvpnRepository.getOpenVPNInRouting_ForGrid('rule', fwcloud, firewall),
            this._openvpnPrefixRepository.getOpenVPNPrefixInRouting_ForGrid('rule', fwcloud, firewall),
            this._markRepository.getMarksInRoutingRules_ForGrid(fwcloud, firewall)
        ];
    }

}