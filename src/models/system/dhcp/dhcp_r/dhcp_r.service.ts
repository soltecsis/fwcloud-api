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
import { AvailableDestinations, ItemForGrid } from "../../../routing/shared";
import { IPObjRepository } from "../../../ipobj/IPObj.repository";
import { IPObjGroup } from "../../../ipobj/IPObjGroup";
import { DHCPUtils } from "../../shared";


interface IFindManyDHCPRulePath {
    fwcloudId?: number;
    firewallId?: number;
    dhcpgId?: number;
}

interface IFindOneDHCPRulePath extends IFindManyDHCPRulePath {
    id: number;
}

export interface ICreateDHCPRule {
    active?: boolean;
    groupId: number;
    style?: string;
    networkId?: number;
    rangeId?: number;
    routerId?: number;
    interfaceId?: number;
    max_lease?: number;
    cfg_text?: string;
    comment?: string;
    rule_order?: number;
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
}

//TODO: Need to add the data type DHCPRuleItemForCompile
export interface DHCPRulesData<T extends ItemForGrid> extends DHCPRule{
    items: (T & {_order: number})[];
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
        if(data.rangeId){
            dhcpRuleData.range = await getRepository(IPObj).findOneOrFail(data.rangeId) as IPObj;
        }
        if(data.routerId){
            dhcpRuleData.router = await getRepository(IPObj).findOneOrFail(data.routerId) as IPObj;
        }
        if(data.interfaceId){
            dhcpRuleData.interface = await getRepository(Interface).findOneOrFail(data.interfaceId) as Interface;
        }

        const lastDHCPRule = await this._repository.getLastDHCPRuleInGroup(data.groupId);
        dhcpRuleData.rule_order = lastDHCPRule?.rule_order ? lastDHCPRule.rule_order + 1 : 1;

        return await this._repository.save(dhcpRuleData);
    }

    async copy(ids: number[],destRule: number, position: Offset): Promise<DHCPRule[]> {
        const dhcp_rs: DHCPRule[] = await this._repository.find({
            where: {
                id: In(ids),
            },
            relations: ['group', 'group.firewall', 'group.firewall.fwCloud'],
        });
        const lastRule: DHCPRule = await this._repository.getLastDHCPRuleInGroup(dhcp_rs[0].group.id);
        dhcp_rs.map((item,index) => {
            item.rule_order = lastRule.rule_order + index + 1;
        });
        
        await this._repository.save(dhcp_rs);

        //TODO: Mark firewall as uncompiled
        return this.move(dhcp_rs.map(item => item.id),destRule,position);
    }

    async move(ids: number[], destRule: number, offset: Offset): Promise<DHCPRule[]> {
        //TODO: Mark firewall as uncompiled

        return await this._repository.move(ids, destRule, offset);
    }

    async update(id: number, data: Partial<ICreateDHCPRule>): Promise<DHCPRule> {
        let dhcpRule: DHCPRule = await this._repository.preload(Object.assign({
            active: data.active,
            comment: data.comment,
            sytle: data.style,
            max_lease: data.max_lease,
            cfg_text: data.cfg_text,
            rule_order: data.rule_order,
        }))

        if(data.groupId){
            dhcpRule.group = await getRepository(DHCPGroup).findOneOrFail(data.groupId) as DHCPGroup;
        }
        if(data.networkId){
            dhcpRule.network = await getRepository(IPObj).findOneOrFail(data.networkId) as IPObj;
        }
        if(data.rangeId){
            dhcpRule.range = await getRepository(IPObj).findOneOrFail(data.rangeId) as IPObj;
        }
        if(data.routerId){
            dhcpRule.router = await getRepository(IPObj).findOneOrFail(data.routerId) as IPObj;
        }
        if(data.interfaceId){
            dhcpRule.interface = await getRepository(Interface).findOneOrFail(data.interfaceId) as Interface;
        }

        dhcpRule = await this._repository.save(dhcpRule);

        //await this.reorderTo(dhcpRule.id);

        //TODO: Mark firewall as uncompiled

        return dhcpRule;
    }

    async remove(path: IFindOneDHCPRulePath): Promise<DHCPRule> {
        const dhcpRule: DHCPRule = await this.findOneInPath(path);

        await this._repository.remove(dhcpRule);

        //TODO: Mark firewall as uncompiled

        return dhcpRule;
    }

    findOneInPath(path: IFindOneDHCPRulePath,options?: FindOneOptions<DHCPRule>): Promise<DHCPRule | undefined> {
        return this._repository.findOneOrFail(this.getFindInPathOptions(path,options));
    }

    findManyInPath(path: IFindManyDHCPRulePath,options?: FindOneOptions<DHCPRule>): Promise<DHCPRule[]> {
        return this._repository.find(this.getFindInPathOptions(path,options));
    }

    protected getFindInPathOptions(path: Partial<IFindOneDHCPRulePath>,options: FindOneOptions<DHCPRule> = {}): FindOneOptions<DHCPRule> {
        return Object.assign({
            join: {
                alias: 'dhcp',
                innerJoin: {
                    group: 'dhcp.group',
                    firewall: 'group.firewall',
                    fwcloud: 'firewall.fwCloud',
                }
            },
            where: (qb: SelectQueryBuilder<DHCPRule>) => {
                if(path.firewallId) {
                    qb.andWhere('firewall.id = :firewallId', {firewallId: path.firewallId});
                }
                if(path.fwcloudId) {
                    qb.andWhere('fwcloud.id = :fwcloudId', {fwcloudId: path.fwcloudId});
                }
                if(path.dhcpgId) {
                    qb.andWhere('group.id = :dhcGroupId', {dhcGroupId: path.dhcpgId});
                }
                if(path.id) {
                    qb.andWhere('dhcp.id = :id', {id: path.id});
                }
            },
        },options);
    }

    //TODO: Need to add the data type DHCPRuleItemForCompile
    public async getDHCPRulesData<T extends ItemForGrid>(dst: AvailableDestinations, fwcloud: number, firewall: number, rules?: number[]): Promise<DHCPRulesData<T>[]> {
        const rulesData: DHCPRulesData<T>[] = await this._repository.getDHCPRules(fwcloud, firewall, rules) as DHCPRulesData<T>[];

        const ItemsArrayMap = new Map<number, T[]>();
        for (const rule of rulesData) {
            ItemsArrayMap.set(rule.id, rule.items);
        }

        const sqls = (dst === 'grid') ? this.getDHCPRulesGridSql(fwcloud, firewall, rules) : null;

        await Promise.all(sqls.map(sql => DHCPUtils.mapEntityData<T>(sql, ItemsArrayMap)));

        return rulesData.map(rule => {
            rule.items = rule.items.sort((a, b) => a._order - b._order);
            return rule;
        });
    }

    private getDHCPRulesGridSql(fwcloud: number, firewall: number, rules?: number[]): SelectQueryBuilder<IPObj | IPObjGroup>[] {
        return [
            this._ipobjRepository.getIpobjsInDhcp_ForGrid('dhcp_r', fwcloud, firewall),
            this._dhcpRangeRepository.getDhcpRangesInDhcp_ForGrid('dhcp_r', fwcloud, firewall),
            this._routerRepository.getRoutersInDhcp_ForGrid('dhcp_r', fwcloud, firewall),
            //TODO: Mark Respository getMarksInDhcp_ForGrid
        ];
    }
}
