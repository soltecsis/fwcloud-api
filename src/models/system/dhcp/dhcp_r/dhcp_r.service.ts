/*!
    Copyright 2023 SOLTECSIS SOLUCIONES TECNOLOGICAS, SLU
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
import { FindOneOptions, In, SelectQueryBuilder, getCustomRepository, getRepository } from "typeorm";
import { DHCPRule } from "./dhcp_r.model";
import { DHCPRepository } from "./dhcp.repository";
import { IPObj } from "../../../ipobj/IPObj";
import { DHCPGroup } from "../dhcp_g/dhcp_g.model";
import { Interface } from "../../../interface/Interface";
import { Offset } from "../../../../offset";
import { Application } from "../../../../Application";
import { Service } from "../../../../fonaments/services/service";
import { IPObjRepository } from "../../../ipobj/IPObj.repository";
import { IPObjGroup } from "../../../ipobj/IPObjGroup";
import { AvailableDestinations, DHCPRuleItemForCompiler, DHCPUtils, ItemForGrid } from "../../shared";
import { Firewall } from "../../../firewall/Firewall";
import { DHCPRuleToIPObj } from "./dhcp_r-to-ipobj.model";
import { ErrorBag } from "../../../../fonaments/validation/validator";
import { ValidationException } from "../../../../fonaments/exceptions/validation-exception";
import { QueryDeepPartialEntity } from "typeorm/query-builder/QueryPartialEntity";
import { DHCPGroupService } from "../dhcp_g/dhcp_g.service";

interface IFindManyDHCPRulePath {
    fwcloudId?: number;
    firewallId?: number;
}

interface IFindOneDHCPRulePath extends IFindManyDHCPRulePath {
    id: number;
}

export interface ICreateDHCPRule {
    active?: boolean;
    group?: number;
    style?: string;
    ipObjIds?: { id: number, order: number }[];
    rule_type?: number;
    firewallId?: number;
    networkId?: number;
    rangeId?: number;
    routerId?: number;
    interfaceId?: number;
    max_lease?: number;
    cfg_text?: string;
    comment?: string;
    rule_order?: number;
    to?: number;
    offset?: Offset;
}

export interface IUpdateDHCPRule {
    active?: boolean;
    style?: string;
    ipObjIds?: { id: number, order: number }[];
    networkId?: number;
    rangeId?: number;
    routerId?: number;
    interfaceId?: number;
    max_lease?: number;
    cfg_text?: string;
    comment?: string;
    rule_order?: number;
    group?: number;
}

export interface DHCPRulesData<T extends ItemForGrid | DHCPRuleItemForCompiler> extends DHCPRule {
    items: (T & { _order: number })[];
}

interface IMoveFromDHCPRule {
    fromId: number;
    toId: number;
    ipObjId?: number;
}

export class DHCPRuleService extends Service {
    private _repository: DHCPRepository;
    private _ipobjRepository: IPObjRepository;
    private _groupService: DHCPGroupService;

    constructor(app: Application) {
        super(app)
        this._repository = getCustomRepository(DHCPRepository);
        this._ipobjRepository = getCustomRepository(IPObjRepository);
        this._groupService = new DHCPGroupService(app);
    }

    async store(data: ICreateDHCPRule): Promise<DHCPRule> {
        const dhcpRuleData: Partial<DHCPRule> = {
            active: data.active,
            style: data.style,
            max_lease: data.max_lease,
            cfg_text: data.cfg_text,
            comment: data.comment,
            rule_type: data.rule_type,
        };

        if (data.group) {
            dhcpRuleData.group = await getRepository(DHCPGroup).findOneOrFail(data.group) as DHCPGroup;
        }
        if (data.networkId) {
            dhcpRuleData.network = await getRepository(IPObj).findOneOrFail(data.networkId) as IPObj;
        }
        if (data.rangeId) {
            dhcpRuleData.range = await getRepository(IPObj).findOneOrFail(data.rangeId) as IPObj;
        }
        if (data.routerId) {
            dhcpRuleData.router = await getRepository(IPObj).findOneOrFail(data.routerId) as IPObj;
        }
        if (data.interfaceId) {
            let interfaceData: Interface = await getRepository(Interface).findOneOrFail(data.interfaceId) as Interface;
            if (!interfaceData.mac || interfaceData.mac === '') {
                throw new Error('Interface mac is not defined');
            }
            dhcpRuleData.interface = interfaceData;
        }
        if (data.firewallId) {
            dhcpRuleData.firewall = await getRepository(Firewall).findOneOrFail(data.firewallId) as Firewall;
        }

        if (
            dhcpRuleData.rule_type === 1 && (
                dhcpRuleData.network?.ip_version !== dhcpRuleData.range?.ip_version ||
                dhcpRuleData.network?.ip_version !== dhcpRuleData.router?.ip_version ||
                dhcpRuleData.range?.ip_version !== dhcpRuleData.router?.ip_version)
        ) {
            throw new Error('IP version mismatch');
        }

        const lastDHCPRule: DHCPRule = await this._repository.getLastDHCPRuleInFirewall(data.firewallId) as DHCPRule;
        dhcpRuleData.rule_order = lastDHCPRule?.rule_order ? lastDHCPRule.rule_order + 1 : 1;
        const persisted: Partial<DHCPRule> & DHCPRule = await this._repository.save(dhcpRuleData);

        if (Object.prototype.hasOwnProperty.call(data, 'to') && Object.prototype.hasOwnProperty.call(data, 'offset')) {
            return (await this.move([persisted.id], data.to, data.offset))[0]
        }

        return persisted;
    }

    async copy(ids: number[], destRule: number, offset: Offset): Promise<DHCPRule[]> {
        const dhcp_rs: DHCPRule[] = await this._repository.find({
            where: {
                id: In(ids),
            },
            relations: ['group', 'firewall', 'firewall.fwCloud', 'network', 'range', 'router', 'interface', 'dhcpRuleToIPObjs'],
        });

        const lastRule: DHCPRule = await this._repository.getLastDHCPRuleInFirewall(dhcp_rs[0].firewallId);
        
        dhcp_rs.map((item, index) => {
            item.id = undefined;
            item.rule_order = lastRule.rule_order + index + 1;
        });

        const persisted: DHCPRule[] = await this._repository.save(dhcp_rs);
        const persistedArray = Array.isArray(persisted) ? persisted : [persisted];

        return this.move(persistedArray.map(item => item.id), destRule, offset);
    }

    async move(ids: number[], destRule: number, offset: Offset): Promise<DHCPRule[]> {
        const destinationRule: DHCPRule = await this._repository.findOneOrFail(destRule, {
            relations: ['group']
        });

        const sourceRules: DHCPRule[] = await this._repository.findByIds(ids, {
            relations: ['group']
        });

        const movedRules = await this._repository.move(ids, destRule, offset);

        if (!destinationRule.group && sourceRules[0].group && (sourceRules[0].group.rules.length - ids.length) < 1) {
            await this._groupService.remove({ id: sourceRules[0].group.id });
        }

        return movedRules;
    }

    async moveFrom(fromId: number, toId: number, data: IMoveFromDHCPRule): Promise<[DHCPRule, DHCPRule]> {
        const fromRule: DHCPRule = await this._repository.findOneOrFail(fromId, {
            relations: ['firewall', 'firewall.fwCloud', 'dhcpRuleToIPObjs']
        });
        const toRule: DHCPRule = await this._repository.findOneOrFail(toId, {
            relations: ['firewall', 'firewall.fwCloud', 'dhcpRuleToIPObjs']
        });

        let lastPosition = 0;

        [].concat(toRule.dhcpRuleToIPObjs).forEach(item => {
            lastPosition < item.order ? lastPosition = item.order : null;
        });

        if (data.ipObjId !== undefined) {
            const index: number = fromRule.dhcpRuleToIPObjs.findIndex(item => item.ipObjId === data.ipObjId);
            if (index >= 0) {
                fromRule.dhcpRuleToIPObjs.splice(index, 1);
                toRule.dhcpRuleToIPObjs.push({
                    dhcpRuleId: toRule.id,
                    ipObjId: data.ipObjId,
                    order: lastPosition + 1
                } as DHCPRuleToIPObj);
            }
        }

        return await this._repository.save([fromRule, toRule]) as [DHCPRule, DHCPRule];

    }

    async update(id: number, data: Partial<ICreateDHCPRule>): Promise<DHCPRule> {
        let dhcpRule: DHCPRule | undefined = await this._repository.findOne(id, { relations: ['group', 'firewall', 'network', 'range', 'router'] });
        if (!dhcpRule) {
            throw new Error('DHCPRule not found');
        }

        Object.assign(dhcpRule, {
            active: data.active !== undefined ? data.active : dhcpRule.active,
            comment: data.comment !== undefined ? data.comment : dhcpRule.comment,
            style: data.style !== undefined ? data.style : dhcpRule.style,
            max_lease: data.max_lease !== undefined ? data.max_lease : dhcpRule.max_lease,
            cfg_text: data.cfg_text !== undefined ? data.cfg_text : dhcpRule.cfg_text,
            rule_order: data.rule_order !== undefined ? data.rule_order : dhcpRule.rule_order
        });

        if (data.group !== undefined) {
            if (dhcpRule.group && !data.group && dhcpRule.group.rules.length === 1) {
                await this._groupService.remove({ id: dhcpRule.group.id });
            }
            dhcpRule.group = data.group ? await getRepository(DHCPGroup).findOne(data.group) : null;
        } else if (data.ipObjIds) {
            await this.validateUpdateIpObjIds(dhcpRule.firewall, data);
            dhcpRule.dhcpRuleToIPObjs = data.ipObjIds.map(item => ({
                dhcpRuleId: dhcpRule.id,
                ipObjId: item.id,
                order: item.order
            } as DHCPRuleToIPObj));
        } else {
            const fieldsToUpdate: string[] = ['networkId', 'rangeId', 'routerId', 'interfaceId', 'firewallId'];

            for (const field of fieldsToUpdate) {
                if (data[field]) {
                    if (field === 'interfaceId') {
                        let interfaceData = await getRepository(Interface).findOneOrFail(data[field]) as Interface;
                        if (interfaceData.mac === '' || !interfaceData.mac) {
                            throw new Error('Interface mac is not defined');
                        }
                        dhcpRule[field.slice(0, -2)] = interfaceData;
                    } else {
                        dhcpRule[field.slice(0, -2)] = await getRepository(field === 'firewallId' ? Firewall : IPObj).findOneOrFail(data[field]) as Firewall | IPObj;
                    }
                }
            }
        }

        if (
            dhcpRule.rule_type === 1 && (
                dhcpRule.network?.ip_version !== dhcpRule.range?.ip_version ||
                dhcpRule.network?.ip_version !== dhcpRule.router?.ip_version ||
                dhcpRule.range?.ip_version !== dhcpRule.router?.ip_version)
        ) {
            throw new Error('IP version mismatch');
        }

        dhcpRule = await this._repository.save(dhcpRule);

        return dhcpRule;
    }

    async remove(path: IFindOneDHCPRulePath): Promise<DHCPRule> {
        const dhcpRule: DHCPRule = await this._repository.findOne(path.id, { relations: ['group', 'firewall'] });

        dhcpRule.dhcpRuleToIPObjs = [];

        await this._repository.save(dhcpRule);

        if (dhcpRule.group && dhcpRule.group.rules.length === 1) {
            await this._groupService.remove({ id: dhcpRule.group.id });
        }

        await this._repository.remove(dhcpRule);

        return dhcpRule;
    }

    findOneInPath(path: IFindOneDHCPRulePath, options?: FindOneOptions<DHCPRule>): Promise<DHCPRule | undefined> {
        return this._repository.findOneOrFail(this.getFindInPathOptions(path, options));
    }

    protected getFindInPathOptions(path: Partial<IFindOneDHCPRulePath>, options: FindOneOptions<DHCPRule> = {}): FindOneOptions<DHCPRule> {
        return Object.assign({
            join: {
                alias: 'dhcp',
                innerJoinAndSelect: {
                    firewall: 'dhcp.firewall',
                    fwcloud: 'firewall.fwCloud',
                }
            },
            where: (qb: SelectQueryBuilder<DHCPRule>): void => {
                if (path.firewallId) {
                    qb.andWhere('firewall.id = :firewallId', { firewallId: path.firewallId });
                }
                if (path.fwcloudId) {
                    qb.andWhere('fwcloud.id = :fwcloudId', { fwcloudId: path.fwcloudId });
                }
                if (path.id) {
                    qb.andWhere('dhcp.id = :id', { id: path.id });
                }
            },
        }, options);
    }

    public async getDHCPRulesData<T extends ItemForGrid | DHCPRuleItemForCompiler>(dst: AvailableDestinations, fwcloud: number, firewall: number, rules?: number[]): Promise<DHCPRulesData<T>[]> {
        let rulesData: DHCPRulesData<T>[];
        switch (dst) {
            case 'regular_grid':
                // It passes the value 1 and 3 because it corresponds to the type of regular rules and hook script.
                rulesData = await this._repository.getDHCPRules(fwcloud, firewall, rules, [1, 3]) as DHCPRulesData<T>[];
                break;
            case 'fixed_grid':
                // It passes the value 2 because it corresponds to the type of fixed ip rules.
                rulesData = await this._repository.getDHCPRules(fwcloud, firewall, rules, [2]) as DHCPRulesData<T>[];
                break;
            case 'compiler':
                rulesData = await this._repository.getDHCPRules(fwcloud, firewall, rules, [1, 3, 2], true) as DHCPRulesData<T>[];
                break;
        }

        let ItemsArrayMap: Map<number, T[]> = new Map<number, T[]>();
        for (let i = 0; i < rulesData.length; i++) {
            rulesData[i].items = [];

            ItemsArrayMap.set(rulesData[i].id, rulesData[i].items);
        }

        const sqls: SelectQueryBuilder<IPObj | IPObjGroup>[] = (dst === 'compiler') ?
            this.buildDHCPRulesCompilerSql(fwcloud, firewall) :
            this.getDHCPRulesGridSql(fwcloud, firewall);

        await Promise.all(sqls.map(sql => DHCPUtils.mapEntityData<T>(sql, ItemsArrayMap)));

        return rulesData.map(rule => {
            if (rule.items) {
                rule.items = rule.items.sort((a, b) => a._order - b._order);
            }
            return rule;
        });
    }

    public async bulkUpdate(ids: number[], data: IUpdateDHCPRule): Promise<DHCPRule[]> {
        if (data.group) {
            await this._repository.update({
                id: In(ids),
            }, { ...data, group: { id: data.group } });
        } else {
            const group: DHCPGroup = (await this._repository.findOne(ids[0], { relations: ['group'] })).group;
            if (data.group !== undefined && group && (group.rules.length - ids.length) < 1) {
                await this._groupService.remove({ id: group.id });
            }

            await this._repository.update({
                id: In(ids),
            }, data as QueryDeepPartialEntity<DHCPRule>);
        }

        return this._repository.find({
            where: {
                id: In(ids),
            }
        });
    }

    public async bulkRemove(ids: number[]): Promise<DHCPRule[]> {
        const rules: DHCPRule[] = await this._repository.find({
            where: {
                id: In(ids),
            },
        });

        for (let rule of rules) {
            await this.remove({ id: rule.id });
        }

        return rules;
    }

    private getDHCPRulesGridSql(fwcloud: number, firewall: number): SelectQueryBuilder<IPObj | IPObjGroup>[] {
        return [
            this._ipobjRepository.getIPObjsInDhcp_ForGrid('rule', fwcloud, firewall),
        ];
    }

    private buildDHCPRulesCompilerSql(fwcloud: number, firewall: number): SelectQueryBuilder<IPObj | IPObjGroup>[] {
        return [
            this._ipobjRepository.getIPObjsInDhcp_ForGrid('rule', fwcloud, firewall),
        ];
    }

    async validateUpdateIpObjIds(firewall: Firewall, data: IUpdateDHCPRule): Promise<void> {
        const errors: ErrorBag = {};

        if (!data.ipObjIds || data.ipObjIds.length === 0) {
            return;
        }

        const ipObjs: IPObj[] = await getRepository(IPObj).find({
            where: {
                id: In(data.ipObjIds.map(item => item.id)),
                ipObjTypeId: 9, // DNS
            },
            relations: ['fwCloud']
        });

        for (let i = 0; i < ipObjs.length; i++) {
            const ipObj: IPObj = ipObjs[i];

            if (ipObj.fwCloudId && ipObj.fwCloudId !== firewall.fwCloudId) {
                errors[`ipObjIds.${i}`] = ['ipObj id must exist']
            }
        }

        if (Object.keys(errors).length > 0) {
            throw new ValidationException('The given data was invalid', errors);
        }
    }
}
