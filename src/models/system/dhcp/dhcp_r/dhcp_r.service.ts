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


interface IFindManyDHCPRulePath {
    fwcloudId?: number;
    firewallId?: number;
}

interface IFindOneDHCPRulePath extends IFindManyDHCPRulePath {
    id: number;
}

export interface ICreateDHCPRule {
    active?: boolean;
    groupId?: number;
    style?: string;
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

//TODO: Need to add the data type DHCPRuleItemForCompile
export interface DHCPRulesData<T extends ItemForGrid | DHCPRuleItemForCompiler> extends DHCPRule {
    items: (T & { _order: number })[];
}

export class DHCPRuleService extends Service {
    private _repository: DHCPRepository;
    private _ipobjRepository: IPObjRepository;
    private _dhcpRangeRepository: IPObjRepository;
    private _routerRepository: IPObjRepository;

    constructor(app: Application) {
        super(app)
        this._repository = getCustomRepository(DHCPRepository);
        this._ipobjRepository = getCustomRepository(IPObjRepository);
        this._dhcpRangeRepository = getCustomRepository(IPObjRepository);
        this._routerRepository = getCustomRepository(IPObjRepository);
    }

    async store(data: ICreateDHCPRule): Promise<DHCPRule> {
        const dhcpRuleData: Partial<DHCPRule> = {
            active: data.active,
            style: data.style,
            max_lease: data.max_lease,
            cfg_text: data.cfg_text,
            comment: data.comment,
        };

        if (data.groupId) {
            dhcpRuleData.group = await getRepository(DHCPGroup).findOneOrFail(data.groupId) as DHCPGroup;
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
            dhcpRuleData.interface = await getRepository(Interface).findOneOrFail(data.interfaceId) as Interface;
        }
        if (data.firewallId) {
            dhcpRuleData.firewall = await getRepository(Firewall).findOneOrFail(data.firewallId) as Firewall;
        }

        const lastDHCPRule = await this._repository.getLastDHCPRuleInGroup(data.groupId);
        dhcpRuleData.rule_order = lastDHCPRule?.rule_order ? lastDHCPRule.rule_order + 1 : 1;

        const persisted = await this._repository.save(dhcpRuleData);

        if (Object.prototype.hasOwnProperty.call(data, 'to') && Object.prototype.hasOwnProperty.call(data, 'offset')) {
            return (await this.move([persisted.id], data.to, data.offset))[0]
        }

        return persisted;
    }

    async copy(ids: number[], destRule: number, position: Offset): Promise<DHCPRule[]> {
        const dhcp_rs: DHCPRule[] = await this._repository.find({
            where: {
                id: In(ids),
            },
            relations: ['group', 'firewall', 'firewall.fwCloud'],
        });

        const savedCopies: DHCPRule[] = await Promise.all(
            dhcp_rs.map(async rule => {
                const { id, ...copy } = rule;
                return await this._repository.save({ ...copy });
            })
        );
        //TODO: Mark firewall as uncompiled
        return this.move(savedCopies.map(item => item.id), destRule, position);
    }

    async move(ids: number[], destRule: number, offset: Offset): Promise<DHCPRule[]> {
        //TODO: Mark firewall as uncompiled

        return await this._repository.move(ids, destRule, offset);
    }

    async update(id: number, data: Partial<ICreateDHCPRule>): Promise<DHCPRule> {
        const dhcpRule: DHCPRule | undefined = await this._repository.findOne(id);

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

        const fieldsToUpdate = ['groupId', 'networkId', 'rangeId', 'routerId', 'interfaceId', 'firewallId'];

        for (const field of fieldsToUpdate) {
            if (data[field]) {
                dhcpRule[field.slice(0, -2)] = await getRepository(field === 'firewallId' ? Firewall : IPObj).findOneOrFail(data[field]) as Firewall | IPObj;
            }
        }

        await this._repository.save(dhcpRule);

        // await this.reorderTo(dhcpRule.id);

        // TODO: Marcar el firewall como no compilado

        return dhcpRule;
    }

    async remove(path: IFindOneDHCPRulePath): Promise<DHCPRule> {
        const dhcpRule: DHCPRule = await this.findOneInPath(path);

        await this._repository.remove(dhcpRule);

        //TODO: Mark firewall as uncompiled

        return dhcpRule;
    }

    findOneInPath(path: IFindOneDHCPRulePath, options?: FindOneOptions<DHCPRule>): Promise<DHCPRule | undefined> {
        return this._repository.findOneOrFail(this.getFindInPathOptions(path, options));
    }

    findManyInPath(path: IFindManyDHCPRulePath, options?: FindOneOptions<DHCPRule>): Promise<DHCPRule[]> {
        return this._repository.find(this.getFindInPathOptions(path, options));
    }

    protected getFindInPathOptions(path: Partial<IFindOneDHCPRulePath>, options: FindOneOptions<DHCPRule> = {}): FindOneOptions<DHCPRule> {
        return Object.assign({
            join: {
                alias: 'dhcp',
                innerJoin: {
                    firewall: 'dhcp.firewall',
                    fwcloud: 'firewall.fwCloud',
                }
            },
            where: (qb: SelectQueryBuilder<DHCPRule>) => {
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

    //TODO: Need to add the data type DHCPRuleItemForCompile
    public async getDHCPRulesData<T extends ItemForGrid | DHCPRuleItemForCompiler>(dst: AvailableDestinations, fwcloud: number, firewall: number, rules?: number[]): Promise<DHCPRulesData<T>[]> {
        let rulesData: DHCPRulesData<T>[];
        switch (dst) {
            case 'regular_grid':
                // It passes the value 1 and 3 because it corresponds to the type of regular rules and hook script.
                rulesData = await this._repository.getDHCPRules(fwcloud, firewall, rules, [1,3]) as DHCPRulesData<T>[];
                break;
            case 'fixed_grid':
                // It passes the value 2 because it corresponds to the type of fixed ip rules.
                rulesData = await this._repository.getDHCPRules(fwcloud, firewall, rules, [2]) as DHCPRulesData<T>[];
                break;
            case 'compiler':
                rulesData = await this._repository.getDHCPRules(fwcloud, firewall, rules) as DHCPRulesData<T>[];
                break;
        }

        const ItemsArrayMap = new Map<number, T[]>();
        for (const rule of rulesData) {
            ItemsArrayMap.set(rule.id, rule.items);
        }

        const sqls = (dst === 'compiler') ?
            this.buildDHCPRulesCompilerSql(fwcloud, firewall, rules) : 
            this.getDHCPRulesGridSql(fwcloud, firewall, rules);

        const result = await Promise.all(sqls.map(sql => DHCPUtils.mapEntityData<T>(sql, ItemsArrayMap)));

        return rulesData.map(rule => {
            if (rule.items) {
                rule.items = rule.items.sort((a, b) => a._order - b._order);
            }
            return rule;
        });
    }

    public async bulkUpdate(ids: number[], data: IUpdateDHCPRule): Promise<DHCPRule[]> {
        await this._repository.update({
            id: In(ids),
        }, { ...data, group: { id: data.group } });

        //TODO: Mark firewall as uncompiled
        /*const firewallIds: number[] = (await this._repository.find({
            where: {
                id: In(ids),
            },
            join: {
                alias: 'dhcp_r',
            }
        })).map(item => item.firewall.id);*/

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

    private getDHCPRulesGridSql(fwcloud: number, firewall: number, rules?: number[]): SelectQueryBuilder<IPObj | IPObjGroup>[] {
        return [
            this._ipobjRepository.getIpobjsInDhcp_ForGrid('dhcp_r', fwcloud, firewall),
            this._dhcpRangeRepository.getDhcpRangesInDhcp_ForGrid('dhcp_r', fwcloud, firewall),
            this._routerRepository.getRoutersInDhcp_ForGrid('dhcp_r', fwcloud, firewall),
        ];
    }

    private buildDHCPRulesCompilerSql(fwcloud: number, firewall: number, rules?: number[]): SelectQueryBuilder<IPObj | IPObjGroup>[] {
        return [
            this._ipobjRepository.getIpobjsInDhcp_ForGrid('dhcp_r', fwcloud, firewall),
            this._dhcpRangeRepository.getDhcpRangesInDhcp_ForGrid('dhcp_r', fwcloud, firewall),
            this._routerRepository.getRoutersInDhcp_ForGrid('dhcp_r', fwcloud, firewall),
        ];
    }
}
