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
import { KeepalivedRule } from "./keepalived_r.model";
import { KeepalivedRepository } from "./keepalived.repository";
import { IPObj } from "../../../ipobj/IPObj";
import { KeepalivedGroup } from "../keepalived_g/keepalived_g.model";
import { Offset } from "../../../../offset";
import { Application } from "../../../../Application";
import { Service } from "../../../../fonaments/services/service";
import { IPObjRepository } from "../../../ipobj/IPObj.repository";
import { AvailableDestinations, KeepalivedRuleItemForCompiler, KeepalivedUtils, ItemForGrid } from "../../shared";
import { Firewall } from "../../../firewall/Firewall";


interface IFindManyKeepalivedRulePath {
    fwcloudId?: number;
    firewallId?: number;
}

interface IFindOneKeepalivedRulePath extends IFindManyKeepalivedRulePath {
    id: number;
}

export interface ICreateKeepalivedRule {
    active?: boolean;
    groupId?: number;
    style?: string;
    rule_type?: number;
    firewallId?: number
    interfaceId?: number;
    virtualIpId?: number;
    masterNodeId?: number;
    cfg_text?: string;
    comment?: string;
    rule_order?: number;
    to?: number;
    offset?: Offset;
}

export interface IUpdateKeepalivedRule {
    active?: boolean;
    style?: string;
    virutalIpId?: number;
    masterNodeId?: number;
    interfaceId?: number;
    comment?: string;
    cfg_text?: string;
    rule_order?: number;
    group?: number;
}

export interface KeepalivedRulesData<T extends ItemForGrid | KeepalivedRuleItemForCompiler> extends KeepalivedRule {
    items: (T & { _order: number })[];
}

export class KeepalivedRuleService extends Service {
    private _repository: KeepalivedRepository;
    private _ipobjRepository: IPObjRepository;
    private _keepalivedRangeRepository: IPObjRepository;
    private _routerRepository: IPObjRepository;

    constructor(app: Application) {
        super(app)
        this._repository = getCustomRepository(KeepalivedRepository);
        this._ipobjRepository = getCustomRepository(IPObjRepository);
        this._keepalivedRangeRepository = getCustomRepository(IPObjRepository);
        this._routerRepository = getCustomRepository(IPObjRepository);
    }

    async store(data: ICreateKeepalivedRule): Promise<KeepalivedRule> {
        const keepalivedRuleData: Partial<KeepalivedRule> = {
            active: data.active,
            style: data.style,
            comment: data.comment,
        };
//TODO: REVISAR
        if (data.groupId) {
            keepalivedRuleData.group = await getRepository(KeepalivedGroup).findOneOrFail(data.groupId) as KeepalivedGroup;
        }
        if (data.interfaceId) {
            keepalivedRuleData.interface = await getRepository(IPObj).findOneOrFail(data.interfaceId) as IPObj;
        }
        if (data.virtualIpId) {
            keepalivedRuleData.virtualIp = await getRepository(IPObj).findOneOrFail(data.virtualIpId) as IPObj;
        }
        if (data.masterNodeId) {
            keepalivedRuleData.masterNode = await getRepository(IPObj).findOneOrFail(data.masterNodeId) as IPObj;
        }
        if (data.firewallId) {
            keepalivedRuleData.firewall = await getRepository(Firewall).findOneOrFail(data.firewallId) as Firewall;
        }

        const lastKeepalivedRule = await this._repository.getLastKeepalivedRuleInGroup(data.groupId);
        keepalivedRuleData.rule_order = lastKeepalivedRule?.rule_order ? lastKeepalivedRule.rule_order + 1 : 1;

        const persisted = await this._repository.save(keepalivedRuleData);

        if (Object.prototype.hasOwnProperty.call(data, 'to') && Object.prototype.hasOwnProperty.call(data, 'offset')) {
            return (await this.move([persisted.id], data.to, data.offset))[0]
        }

        return persisted;
    }

    async copy(ids: number[], destRule: number, position: Offset): Promise<KeepalivedRule[]> {
        const keepalived_rs: KeepalivedRule[] = await this._repository.find({
            where: {
                id: In(ids),
            },
            relations: ['group', 'firewall', 'firewall.fwCloud'],
        });

        const savedCopies: KeepalivedRule[] = await Promise.all(
            keepalived_rs.map(async rule => {
                const { id, ...copy } = rule;
                return await this._repository.save({ ...copy });
            })
        );
        //TODO: Mark firewall as uncompiled
        return this.move(savedCopies.map(item => item.id), destRule, position);
    }

    async move(ids: number[], destRule: number, offset: Offset): Promise<KeepalivedRule[]> {
        //TODO: Mark firewall as uncompiled

        return await this._repository.move(ids, destRule, offset);
    }

    async update(id: number, data: Partial<ICreateKeepalivedRule>): Promise<KeepalivedRule> {
        const keepalivedRule: KeepalivedRule | undefined = await this._repository.findOne(id);

        if (!keepalivedRule) {
            throw new Error('keepalivedRule not found');
        }

        Object.assign(keepalivedRule, {
            active: data.active !== undefined ? data.active : keepalivedRule.active,
            comment: data.comment !== undefined ? data.comment : keepalivedRule.comment,
            style: data.style !== undefined ? data.style : keepalivedRule.style,
            rule_order: data.rule_order !== undefined ? data.rule_order : keepalivedRule.rule_order
        });

        const fieldsToUpdate = ['groupId', 'virtualIpId', 'masterNodeId', 'interfaceId', 'firewallId'];

        for (const field of fieldsToUpdate) {
            if (data[field]) {
                keepalivedRule[field.slice(0, -2)] = await getRepository(field === 'firewallId' ? Firewall : IPObj).findOneOrFail(data[field]) as Firewall | IPObj;
            }
        }

        await this._repository.save(keepalivedRule);

        // await this.reorderTo(keepalivedRule.id);

        // TODO: Marcar el firewall como no compilado

        return keepalivedRule;
    }

    async remove(path: IFindOneKeepalivedRulePath): Promise<KeepalivedRule> {
        const keepalivedRule: KeepalivedRule = await this.findOneInPath(path);

        await this._repository.remove(keepalivedRule);

        //TODO: Mark firewall as uncompiled

        return keepalivedRule;
    }

    findOneInPath(path: IFindOneKeepalivedRulePath, options?: FindOneOptions<KeepalivedRule>): Promise<KeepalivedRule | undefined> {
        return this._repository.findOneOrFail(this.getFindInPathOptions(path, options));
    }

    findManyInPath(path: IFindManyKeepalivedRulePath, options?: FindOneOptions<KeepalivedRule>): Promise<KeepalivedRule[]> {
        return this._repository.find(this.getFindInPathOptions(path, options));
    }

    protected getFindInPathOptions(path: Partial<IFindOneKeepalivedRulePath>, options: FindOneOptions<KeepalivedRule> = {}): FindOneOptions<KeepalivedRule> {
        return Object.assign({
            join: {
                alias: 'keepalived',
                innerJoin: {
                    firewall: 'keepalived.firewall',
                    fwcloud: 'firewall.fwCloud',
                }
            },
            where: (qb: SelectQueryBuilder<KeepalivedRule>) => {
                if (path.firewallId) {
                    qb.andWhere('firewall.id = :firewallId', { firewallId: path.firewallId });
                }
                if (path.fwcloudId) {
                    qb.andWhere('fwcloud.id = :fwcloudId', { fwcloudId: path.fwcloudId });
                }
                if (path.id) {
                    qb.andWhere('keepalived.id = :id', { id: path.id });
                }
            },
        }, options);
    }

    //TODO: Need to add the data type keepalivedRuleItemForCompile
    public async getKeepalivedRulesData<T extends ItemForGrid | KeepalivedRuleItemForCompiler>(dst: AvailableDestinations, fwcloud: number, firewall: number, rules?: number[]): Promise<KeepalivedRulesData<T>[]> {
        let rulesData: KeepalivedRulesData<T>[];
        switch (dst) {

            case 'keepalived_grid':
                rulesData = await this._repository.getKeepalivedRules(fwcloud, firewall, rules, [1]) as KeepalivedRulesData<T>[];
                break;
            case 'compiler':
                rulesData = await this._repository.getKeepalivedRules(fwcloud, firewall, rules) as KeepalivedRulesData<T>[];
                break;
        }

        const ItemsArrayMap = new Map<number, T[]>();
        for (const rule of rulesData) {
            ItemsArrayMap.set(rule.id, rule.items);
        }

        //TODO: REVISAR
    /*    const sqls = (dst === 'compiler') ?
            this.buildKeepalivedRulesCompilerSql(fwcloud, firewall, rules) : 
            this.getKeepalivedRulesGridSql(fwcloud, firewall, rules);
        const result = await Promise.all(sqls.map(sql => KeepalivedUtils.mapEntityData<T>(sql, ItemsArrayMap)));
*/
        return rulesData.map(rule => {
            if (rule.items) {
                rule.items = rule.items.sort((a, b) => a._order - b._order);
            }
            return rule;
        });
    }

    public async bulkUpdate(ids: number[], data: IUpdateKeepalivedRule): Promise<KeepalivedRule[]> {
        await this._repository.update({
            id: In(ids),
        }, { ...data, group: { id: data.group } });

        //TODO: Mark firewall as uncompiled
        /*const firewallIds: number[] = (await this._repository.find({
            where: {
                id: In(ids),
            },
            join: {
                alias: 'keepalived_r',
            }
        })).map(item => item.firewall.id);*/

        return this._repository.find({
            where: {
                id: In(ids),
            }
        });
    }

    public async bulkRemove(ids: number[]): Promise<KeepalivedRule[]> {
        const rules: KeepalivedRule[] = await this._repository.find({
            where: {
                id: In(ids),
            },
        });

        for (let rule of rules) {
            await this.remove({ id: rule.id });
        }

        return rules;
    }
//TODO: REVISAR
  /*  private getKeepalivedRulesGridSql(fwcloud: number, firewall: number, rules?: number[]): SelectQueryBuilder<IPObj | IPObjGroup>[] {
        return [
            this._ipobjRepository.getIpobjsInKeepalived_ForGrid('keepalived_r', fwcloud, firewall),
            this._keepalivedRangeRepository.getKeepalivedRangesInKeepalived_ForGrid('keepalived_r', fwcloud, firewall),
            this._routerRepository.getRoutersInKeepalived_ForGrid('keepalived_r', fwcloud, firewall),
        ];
    }
    private buildKeepalivedRulesCompilerSql(fwcloud: number, firewall: number, rules?: number[]): SelectQueryBuilder<IPObj | IPObjGroup>[] {
        return [
            this._ipobjRepository.getIpobjsInKeepalived_ForGrid('keepalived_r', fwcloud, firewall),
            this._keepalivedRangeRepository.getKeepalivedRangesInKeepalived_ForGrid('keepalived_r', fwcloud, firewall),
            this._routerRepository.getRoutersInKeepalived_ForGrid('keepalived_r', fwcloud, firewall),
        ];
    }*/
}