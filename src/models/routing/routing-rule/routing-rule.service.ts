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
import { Offset } from "../../../offset";
import { Firewall } from "../../firewall/Firewall";
import { FirewallService } from "../../firewall/firewall.service";
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
import { RoutingRuleToMark } from "./routing-rule-to-mark.model";
import { RoutingRuleToOpenVPNPrefix } from "./routing-rule-to-openvpn-prefix.model";
import { RoutingRuleToOpenVPN } from "./routing-rule-to-openvpn.model";
import { RoutingRule } from "./routing-rule.model";
import { IFindManyRoutingRulePath, IFindOneRoutingRulePath, RoutingRuleRepository } from "./routing-rule.repository";

export interface ICreateRoutingRule {
    routingTableId: number;
    active?: boolean;
    comment?: string;
    style?: string;
    ipObjIds?: {id: number, order: number}[];
    ipObjGroupIds?: {id: number, order: number}[];
    openVPNIds?: {id: number, order: number}[];
    openVPNPrefixIds?: {id: number, order: number}[],
    markIds?: {id: number, order: number}[],
    to?: number; //Reference where create the rule
    offset?: Offset;
}

interface IUpdateRoutingRule {
    routingTableId?: number;
    active?: boolean;
    comment?: string;
    rule_order?: number;
    style?: string;
    ipObjIds?: {id: number, order: number}[];
    ipObjGroupIds?: {id: number, order: number}[];
    openVPNIds?: {id: number, order: number}[];
    openVPNPrefixIds?: {id: number, order: number}[],
    markIds?: {id: number, order: number}[]
}

interface IBulkUpdateRoutingRule {
    style?: string;
    active?: boolean;
}

export interface RoutingRulesData<T extends ItemForGrid | RoutingRuleItemForCompiler> extends RoutingRule {
    items: (T & { _order: number })[];
}

interface IMoveFromRoutingRule {
    fromId: number;
    toId: number;
    ipObjId?: number;
    ipObjGroupId?: number;
    openVPNId?: number;
    openVPNPrefixId?: number;
    markId?: number;
}

export class RoutingRuleService extends Service {
    protected _repository: RoutingRuleRepository;
    private _ipobjRepository: IPObjRepository;
    private _ipobjGroupRepository: IPObjGroupRepository;   
    private _openvpnRepository: OpenVPNRepository;
    private _openvpnPrefixRepository: OpenVPNPrefixRepository;
    private _markRepository: MarkRepository;
    private _routingTableRepository: Repository<RoutingTable>;
    protected _firewallService: FirewallService;

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

    public async build(): Promise<Service> {
        this._firewallService = await this._app.getService(FirewallService.name);
        return this;
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

        // There is no need to update compilation status as it is done during update()
        //await this._firewallService.markAsUncompiled(firewall.id);

        return persisted;    
    }

    async copy(ids: number[], destRule: number, offset: Offset): Promise<RoutingRule[]> {
        const routes: RoutingRule[] = await this._repository.find({
            where: {
                id: In(ids)
            },
            relations: ['routingTable', 'routingRuleToMarks', 'routingRuleToIPObjs', 'routingRuleToIPObjGroups', 'routingRuleToOpenVPNs', 'routingRuleToOpenVPNPrefixes']
        });

        const lastRule: RoutingRule = await this._repository.getLastRoutingRuleInFirewall(routes[0].routingTable.firewallId);
        routes.map((item, index) => {
            item.id = undefined;
            item.rule_order = lastRule.rule_order + index + 1
        });


        const persisted: RoutingRule[] = await this._repository.save(routes);

        await this._firewallService.markAsUncompiled(persisted.map(route => route.routingTable.firewallId));
        
        return this.move(persisted.map(item => item.id), destRule, offset);
    }

    async update(id: number, data: IUpdateRoutingRule): Promise<RoutingRule> {
        let rule: RoutingRule = await this._repository.preload(Object.assign({
            routingTableId: data.routingTableId,
            active: data.active,
            comment: data.comment,
        }, {id}));

        const firewall: Firewall = (await this._repository.findOne(rule.id, {relations: ['routingTable', 'routingTable.firewall']})).routingTable.firewall;

        await this.validateFromRestriction(rule.id, data);

        if (data.ipObjIds) {
            await this.validateUpdateIPObjs(firewall, data);
            rule.routingRuleToIPObjs = data.ipObjIds.map(item => ({
                ipObjId: item.id,
                routingRuleId: rule.id,
                order: item.order
            } as RoutingRuleToIPObj));
        }

        if (data.ipObjGroupIds) {
            await this.validateUpdateIPObjGroups(firewall, data);
            rule.routingRuleToIPObjGroups = data.ipObjGroupIds.map(item => ({
                routingRuleId: rule.id,
                ipObjGroupId: item.id,
                order: item.order
            } as RoutingRuleToIPObjGroup));
        }

        if (data.openVPNIds) {
            await this.validateOpenVPNs(firewall, data);

            rule.routingRuleToOpenVPNs = data.openVPNIds.map(item => ({
                routingRuleId: rule.id,
                openVPNId: item.id,
                order: item.order
            } as RoutingRuleToOpenVPN));
        }

        if (data.openVPNPrefixIds) {
            await this.validateOpenVPNPrefixes(firewall, data);

            rule.routingRuleToOpenVPNPrefixes = data.openVPNPrefixIds.map(item => ({
                routingRuleId: rule.id,
                openVPNPrefixId: item.id,
                order: item.order
            } as RoutingRuleToOpenVPNPrefix));
        }

        if(data.markIds) {
            await this.validateMarks(firewall, data);

            rule.routingRuleToMarks = data.markIds.map(item => ({
                markId: item.id,
                routingRuleId: rule.id,
                order: item.order
            }) as RoutingRuleToMark);
        }


        rule = await this._repository.save(rule);

        await this.reorderFrom(rule.id);

        await this._firewallService.markAsUncompiled(firewall.id);

        return rule;
    }

    protected async reorderFrom(ruleId: number): Promise<void> {
        const rule: RoutingRule = await this._repository.findOneOrFail(ruleId, {relations: [
            'routingRuleToMarks', 'routingRuleToIPObjs', 'routingRuleToIPObjGroups', 'routingRuleToOpenVPNs', 'routingRuleToOpenVPNPrefixes'
        ]})

        const items: {order: number}[] = [].concat(
            rule.routingRuleToIPObjs,
            rule.routingRuleToIPObjGroups,
            rule.routingRuleToMarks,
            rule.routingRuleToOpenVPNPrefixes,
            rule.routingRuleToOpenVPNs,
        );

        items.sort((a, b) => a.order - b.order).map((item, index) => {
            item.order = index + 1;
            return item;
        });

        await this._repository.save(rule);
    }

    async bulkUpdate(ids: number[], data: IBulkUpdateRoutingRule): Promise<RoutingRule[]> {
        await this._repository.update({
            id: In(ids)
        }, data);

        const firewallIds: number[] = (await this._repository.find({
            where: {
                id: In(ids),
            },
            join: {
                alias: 'rule',
                innerJoinAndSelect: {
                    table: 'rule.routingTable',
                }
            }
        })).map(rule => rule.routingTable.firewallId);

        await this._firewallService.markAsUncompiled(firewallIds);

        return this._repository.find({
            where: {
                id: In(ids)
            }
        });
    }

    async move(ids: number[], destRule: number, offset: Offset): Promise<RoutingRule[]> {
        const rules: RoutingRule[] = await this._repository.move(ids, destRule, offset);
    
        const firewallIds: number[] = (await this._repository.find({
            where: {
                id: In(ids),
            },
            join: {
                alias: 'rule',
                innerJoinAndSelect: {
                    table: 'rule.routingTable',
                }
            }
        })).map(rule => rule.routingTable.firewallId);
        
        await this._firewallService.markAsUncompiled(firewallIds);

        return rules;
    }

    async moveFrom(fromId: number, toId: number, data: IMoveFromRoutingRule): Promise<[RoutingRule, RoutingRule]> {
        const fromRule: RoutingRule = await getRepository(RoutingRule).findOneOrFail(fromId, {
            relations: ['routingRuleToMarks', 'routingRuleToIPObjs', 'routingRuleToIPObjGroups', 'routingRuleToOpenVPNs', 'routingRuleToOpenVPNPrefixes']
        });
        const toRule: RoutingRule = await getRepository(RoutingRule).findOneOrFail(toId, {
            relations: ['routingRuleToMarks', 'routingRuleToIPObjs', 'routingRuleToIPObjGroups', 'routingRuleToOpenVPNs', 'routingRuleToOpenVPNPrefixes']
        });
        
        let lastPosition: number = 0;
        
        [].concat(
            toRule.routingRuleToIPObjs,
            toRule.routingRuleToIPObjGroups,
            toRule.routingRuleToOpenVPNs,
            toRule.routingRuleToOpenVPNPrefixes,
            toRule.routingRuleToMarks
        ).forEach(item => {
            lastPosition < item.order ? lastPosition = item.order : null;
        });

        if (data.ipObjId !== undefined) {
            const index: number = fromRule.routingRuleToIPObjs.findIndex(item => item.ipObjId === data.ipObjId);
            if (index >= 0) {
                fromRule.routingRuleToIPObjs.splice(index, 1);
                toRule.routingRuleToIPObjs.push({
                    routingRuleId: toRule.id,
                    ipObjId: data.ipObjId,
                    order: lastPosition + 1
                } as RoutingRuleToIPObj);
            }
        }

        if (data.ipObjGroupId !== undefined) {
            const index: number = fromRule.routingRuleToIPObjGroups.findIndex(item => item.ipObjGroupId === data.ipObjGroupId);
            if (index >= 0) {
                fromRule.routingRuleToIPObjGroups.splice(index, 1);
                toRule.routingRuleToIPObjGroups.push({
                    routingRuleId: toRule.id,
                    ipObjGroupId: data.ipObjGroupId,
                    order: lastPosition + 1
                } as RoutingRuleToIPObjGroup);

            }
        }

        if (data.openVPNId !== undefined) {
            const index: number = fromRule.routingRuleToOpenVPNs.findIndex(item => item.openVPNId === data.openVPNId);
            if (index >= 0) {
                fromRule.routingRuleToOpenVPNs.splice(index, 1);
                toRule.routingRuleToOpenVPNs.push({
                    routingRuleId: toRule.id,
                    openVPNId: data.openVPNId,
                    order: lastPosition + 1
                } as RoutingRuleToOpenVPN);

            }
        }

        if (data.openVPNPrefixId !== undefined) {
            const index: number = fromRule.routingRuleToOpenVPNPrefixes.findIndex(item => item.openVPNPrefixId === data.openVPNPrefixId);
            if (index >= 0) {
                fromRule.routingRuleToOpenVPNPrefixes.splice(index, 1);
                toRule.routingRuleToOpenVPNPrefixes.push({
                    routingRuleId: toRule.id,
                    openVPNPrefixId: data.openVPNPrefixId,
                    order: lastPosition + 1
                } as RoutingRuleToOpenVPNPrefix);

            }
        }

        if (data.markId !== undefined) {
            const index: number = fromRule.routingRuleToMarks.findIndex(item => item.markId === data.markId);
            if (index >= 0) {
                fromRule.routingRuleToMarks.splice(index, 1);
                toRule.routingRuleToMarks.push({
                    routingRuleId: toRule.id,
                    markId: data.markId,
                    order: lastPosition + 1
                } as RoutingRuleToMark);
            }
        }

        return await this._repository.save([fromRule, toRule]) as [RoutingRule, RoutingRule];
    }

    async remove(path: IFindOneRoutingRulePath): Promise<RoutingRule> {
        const rule: RoutingRule = await this.findOneInPath(path);
        const firewall: Firewall = await getRepository(Firewall)
            .createQueryBuilder('firewall')
            .innerJoin('firewall.routingTables', 'table')
            .innerJoin('table.routingRules', 'rule', 'rule.id = :id', {id: rule.id}).getOne();
        
        rule.routingRuleToOpenVPNs = [];
        rule.routingRuleToOpenVPNPrefixes = [];
        rule.routingRuleToIPObjGroups = [];
        rule.routingRuleToIPObjs = [];
        rule.routingRuleToMarks = [];
        
        await this._repository.save(rule);
        
        
        await this._repository.remove(rule);

        await this._firewallService.markAsUncompiled(firewall.id);

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
            await this.remove({
                id: rule.id
            });
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

        return rulesData.map(data => {
            data.items = data.items.sort((a,b) => a._order - b._order);
            return data;
        });
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
                id: In(data.ipObjIds.map(item => item.id)),
                ipObjTypeId: In([
                    5, // ADDRESS
                    6, // ADDRESS RANGE
                    7, // NETWORK
                    8, // HOST
                    9, // DNS
                ])
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
     * Validates FROM won't be empty after update
     * 
     * @param ruleId 
     * @param data 
     * @returns 
     */
    protected async validateFromRestriction(ruleId: number, data: IUpdateRoutingRule): Promise<void> {
        const rule = await this._repository.findOneOrFail(ruleId, {
            relations: ['routingRuleToMarks', 'routingRuleToIPObjs', 'routingRuleToIPObjGroups', 'routingRuleToOpenVPNs', 'routingRuleToOpenVPNPrefixes']
        });

        const errors: ErrorBag = {};
        const marks: number = data.markIds ? data.markIds.length : rule.routingRuleToMarks.length;
        const ipObjs: number = data.ipObjIds ? data.ipObjIds.length: rule.routingRuleToIPObjs.length;
        const ipObjGroups: number = data.ipObjGroupIds ? data.ipObjGroupIds.length: rule.routingRuleToIPObjGroups.length;
        const openVPNs: number = data.openVPNIds ? data.openVPNIds.length: rule.routingRuleToOpenVPNs.length;
        const openVPNPrefixes: number = data.openVPNPrefixIds ? data.openVPNPrefixIds.length: rule.routingRuleToOpenVPNPrefixes.length;

        if (marks + ipObjs + ipObjGroups + openVPNs + openVPNPrefixes > 0 ) {
            return;
        }

        if (data.markIds && data.markIds.length === 0) {
            errors['markIds'] = ['From should contain at least one item'];
        }

        if (data.ipObjIds && data.ipObjIds.length === 0) {
            errors['ipObjIds'] = ['From should contain at least one item'];
        }

        if (data.openVPNIds && data.openVPNIds.length === 0) {
            errors['ipObjGroupIds'] = ['From should contain at least one item'];
        }

        if (data.openVPNPrefixIds && data.openVPNPrefixIds.length === 0) {
            errors['markIds'] = ['From should contain at least one item'];
        }

        throw new ValidationException('The given data was invalid', errors);
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
                id: In(data.ipObjGroupIds.map(item => item.id)),
                type: 20
            },
            relations: ['fwCloud', 'ipObjToIPObjGroups', 'ipObjToIPObjGroups.ipObj']
        });

        for (let i = 0; i < ipObjGroups.length; i++) {
            const ipObjGroup: IPObjGroup = ipObjGroups[i];
            
            if (ipObjGroup.fwCloudId && ipObjGroup.fwCloudId !== firewall.fwCloudId) {
                errors[`ipObjGroupIds.${i}`] = ['ipObjGroupId must exist'];
            } else if (await PolicyRuleToIPObj.isGroupEmpty(db.getQuery(), ipObjGroup.id)) {
                errors[`ipObjGroupIds.${i}`] = ['ipObjGroupId must not be empty'];
            }
        }
        
        
        if (Object.keys(errors).length > 0) {
            throw new ValidationException('The given data was invalid', errors);
        }
    }

    protected async validateOpenVPNs(firewall: Firewall, data: IUpdateRoutingRule): Promise<void> {
        const errors: ErrorBag = {};

        if (!data.openVPNIds || data.openVPNIds.length === 0) {
            return;
        }
        
        const openvpns: OpenVPN[] = await getRepository(OpenVPN).createQueryBuilder('openvpn')
            .innerJoin('openvpn.crt', 'crt')
            .whereInIds(data.openVPNIds.map(item => item.id))
            .where('openvpn.firewallId = :firewall', {firewall: firewall.id})
            .where('openvpn.parentId IS NOT null')
            .where('crt.type = 1')
            .getMany();

        for (let i = 0; i < data.openVPNIds.length; i++) {
            if (openvpns.findIndex(item => item.id === data.openVPNIds[i].id) < 0) {
                errors[`openVPNIds.${i}.id`] = ['openVPN does not exists or is not a client']
            } 
        }
        
        
        if (Object.keys(errors).length > 0) {
            throw new ValidationException('The given data was invalid', errors);
        }
    }

    protected async validateOpenVPNPrefixes(firewall: Firewall, data: IUpdateRoutingRule): Promise<void> {
        const errors: ErrorBag = {};

        if (!data.openVPNPrefixIds || data.openVPNPrefixIds.length === 0) {
            return;
        }
        
        const openvpnprefixes: OpenVPNPrefix[] = await getRepository(OpenVPNPrefix).createQueryBuilder('prefix')
            .innerJoinAndSelect('prefix.openVPN', 'openvpn')
            .whereInIds(data.openVPNPrefixIds.map(item => item.id))
            .andWhere('openvpn.firewallId = :firewall', {firewall: firewall.id})
            .getMany();

        
        for (let i = 0; i < data.openVPNPrefixIds.length; i++) {
            if (openvpnprefixes.findIndex(item => item.id === data.openVPNPrefixIds[i].id) < 0) {
                errors[`openVPNPrefixIds.${i}.id`] = ['openVPNPrefix does not exists']
            } 
        }
        
        
        if (Object.keys(errors).length > 0) {
            throw new ValidationException('The given data was invalid', errors);
        }
    }

    protected async validateMarks(firewall: Firewall, data: IUpdateRoutingRule): Promise<void> {
        const errors: ErrorBag = {};

        if (!data.markIds || data.markIds.length === 0) {
            return;
        }
        
        const marks: Mark[] = await getRepository(Mark).createQueryBuilder('mark')
            .innerJoin('mark.fwCloud', 'fwcloud')
            .innerJoin('fwcloud.firewalls', 'firewall')
            .whereInIds(data.markIds.map(item => item.id))
            .andWhere('firewall.id = :firewall', {firewall: firewall.id})
            .getMany();

        for (let i = 0; i < data.markIds.length; i++) {
            if (marks.findIndex(item => item.id === data.markIds[i].id) < 0) {
                errors[`markIds.${i}.id`] = ['mark does not exists']
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