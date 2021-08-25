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
import { RoutingRuleToIPObjGroup } from "./routing-rule-to-ipobj-group.model";
import { RoutingRuleToIPObj } from "./routing-rule-to-ipobj.model";
import { RoutingRuleToOpenVPNPrefix } from "./routing-rule-to-openvpn-prefix.model";
import { RoutingRuleToOpenVPN } from "./routing-rule-to-openvpn.model";
import { RoutingRule } from "./routing-rule.model";
import { IFindManyRoutingRulePath, IFindOneRoutingRulePath, RoutingRuleRepository } from "./routing-rule.repository";

export interface ICreateRoutingRule {
    routingTableId: number;
    active?: boolean;
    comment?: string;
    style?: string;
    ipObjIds?: number[];
    ipObjGroupIds?: number[];
    openVPNIds?: number[];
    openVPNPrefixIds?: number[],
    markIds?: number[],
    to?: number; //Reference where create the rule
    offset?: 'above' | 'below';
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

interface IBulkUpdateRoutingRule {
    style?: string;
    active?: boolean;
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

        const lastRule: RoutingRule = await this._repository.getLastRoutingRuleInFirewall(routingTable.firewallId);
        const rule_order: number = lastRule?.rule_order? lastRule.rule_order + 1 : 1;
        routingRuleData.rule_order = rule_order;
        
        let persisted: RoutingRule = await this._repository.save(routingRuleData);

        persisted = await this.update(persisted.id, {
            ipObjIds: data.ipObjIds,
            ipObjGroupIds: data.ipObjGroupIds,
            openVPNIds: data.openVPNIds,
            openVPNPrefixIds: data.openVPNPrefixIds,
            markIds: data.markIds
        })

        if (Object.prototype.hasOwnProperty.call(data, 'to') && Object.prototype.hasOwnProperty.call(data, 'offset')) {
            return (await this.move([persisted.id], data.to, data.offset))[0];
        }

        return persisted;    
    }

    async copy(ids: number[], destRule: number, offset: 'above' | 'below'): Promise<RoutingRule[]> {
        const routes: RoutingRule[] = await this._repository.find({
            where: {
                id: In(ids)
            },
            relations: ['routingTable', 'marks', 'routingRuleToIPObjs', 'routingRuleToIPObjGroups', 'routingRuleToOpenVPNs', 'routingRuleToOpenVPNPrefixes']
        });

        const lastRule: RoutingRule = await this._repository.getLastRoutingRuleInFirewall(routes[0].routingTable.firewallId);
        routes.map((item, index) => {
            item.id = undefined;
            item.rule_order = lastRule.rule_order + index + 1
        });


        const persisted: RoutingRule[] = await this._repository.save(routes);

        return this.move(persisted.map(item => item.id), destRule, offset);
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
            rule.routingRuleToIPObjs = data.ipObjIds.map(id => ({
                ipObjId: id,
                routingRuleId: rule.id,
                order: 0
            } as RoutingRuleToIPObj));
        }

        if (data.ipObjGroupIds) {
            await this.validateUpdateIPObjGroups(firewall, data);
            rule.routingRuleToIPObjGroups = data.ipObjGroupIds.map(id => ({
                routingRuleId: rule.id,
                ipObjGroupId: id,
                order: 0
            } as RoutingRuleToIPObjGroup));
        }

        if (data.openVPNIds) {
            const openVPNs: OpenVPN[] = await getRepository(OpenVPN).find({
                where: {
                    id: In(data.openVPNIds)
                }
            })

            rule.routingRuleToOpenVPNs = openVPNs.map(item => ({
                routingRuleId: rule.id,
                openVPNId: item.id,
                order: 0
            } as RoutingRuleToOpenVPN));
        }

        if (data.openVPNPrefixIds) {
            const prefixes: OpenVPNPrefix[] = await getRepository(OpenVPNPrefix).find({
                where: {
                    id: In(data.openVPNPrefixIds)
                }
            })

            rule.routingRuleToOpenVPNPrefixes = prefixes.map(item => ({
                routingRuleId: rule.id,
                openVPNPrefixId: item.id,
                order: 0
            } as RoutingRuleToOpenVPNPrefix));
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

        return rule;
    }

    async bulkUpdate(ids: number[], data: IBulkUpdateRoutingRule): Promise<RoutingRule[]> {
        await this._repository.update({
            id: In(ids)
        }, data);

        return this._repository.find({
            where: {
                id: In(ids)
            }
        });
    }

    async move(ids: number[], destRule: number, offset: 'above'|'below'): Promise<RoutingRule[]> {
        return this._repository.move(ids, destRule, offset);
    }

    async remove(path: IFindOneRoutingRulePath): Promise<RoutingRule> {
        const rule: RoutingRule = await this.findOneInPath(path);
        
        await this._repository.remove(rule);

        return rule;
    }

    async bulkRemove(ids: number[]): Promise<RoutingRule[]> {
        const rules: RoutingRule[] = await this._repository.find({
            where: {
                id: In(ids)
            }
        });

        // For unknown reason, this._repository.remove(routes) is not working
        for (let rule of rules) {
            await this._repository.remove(rule);
        }

        return rules;
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
     public async getRoutingRulesData<T extends ItemForGrid | RoutingRuleItemForCompiler>(dst: AvailableDestinations, fwcloud: number, firewall: number, rules?: number[]): Promise<RoutingRulesData<T>[]> {
        const rulesData: RoutingRulesData<T>[] = await this._repository.getRoutingRules(fwcloud, firewall, rules) as RoutingRulesData<T>[];
         
        // Init the map for access the objects array for each route.
        let ItemsArrayMap = new Map<number, T[]>();
        for (let i=0; i<rulesData.length; i++) {
          rulesData[i].items = [];
    
          // Map each route with it's corresponding items array.
          // These items array will be filled with objects data in the Promise.all()
          ItemsArrayMap.set(rulesData[i].id, rulesData[i].items);
        }
    
        const sqls = (dst === 'grid') ? 
            this.buildSQLsForGrid(fwcloud, firewall) : 
            this.buildSQLsForCompiler(fwcloud, firewall, rules);
        await Promise.all(sqls.map(sql => RoutingUtils.mapEntityData<T>(sql,ItemsArrayMap)));
        
        return rulesData;
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
            
            if (ipObj.fwCloudId && ipObj.fwCloudId !== firewall.fwCloudId) {
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
            
            if (ipObjGroup.fwCloudId && ipObjGroup.fwCloudId !== firewall.fwCloudId) {
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

    private buildSQLsForCompiler(fwcloud: number, firewall: number, rules?: number[]): SelectQueryBuilder<IPObj|Mark>[] {
        return [
            this._ipobjRepository.getIpobjsInRouting_excludeHosts('rule', fwcloud, firewall, null, rules),
            this._ipobjRepository.getIpobjsInRouting_onlyHosts('rule', fwcloud, firewall, null, rules),
            this._ipobjRepository.getIpobjsInGroupsInRouting_excludeHosts('rule', fwcloud, firewall, null, rules),
            this._ipobjRepository.getIpobjsInGroupsInRouting_onlyHosts('rule', fwcloud, firewall, null, rules),
            this._ipobjRepository.getIpobjsInOpenVPNInRouting('rule', fwcloud, firewall, null, rules),
            this._ipobjRepository.getIpobjsInOpenVPNInGroupsInRouting('rule', fwcloud, firewall, null, rules),
            this._ipobjRepository.getIpobjsInOpenVPNPrefixesInRouting('rule', fwcloud, firewall, null, rules),
            this._ipobjRepository.getIpobjsInOpenVPNPrefixesInGroupsInRouting('rule', fwcloud, firewall, null, rules),
            this._markRepository.getMarksInRoutingRules(fwcloud, firewall, rules)
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