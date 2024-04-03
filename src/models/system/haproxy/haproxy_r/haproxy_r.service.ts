/*!
    Copyright 2024 SOLTECSIS SOLUCIONES TECNOLOGICAS, SLU
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

import { FindOneOptions, In, getCustomRepository, getRepository } from "typeorm";
import { Service } from "../../../../fonaments/services/service";
import { Offset } from "../../../../offset";
import { HAProxyRuleRepository } from "./haproxy.repository";
import { HAProxyRule } from "./haproxy_r.model";
import { IPObjRepository } from "../../../ipobj/IPObj.repository";
import { Application } from "../../../../Application";
import { HAProxyGroup } from "../haproxy_g/haproxy_g.model";
import { HAProxyRuleToIPObj } from "./haproxy_r-to_ipobj.model";
import { Firewall } from "../../../firewall/Firewall";
import { IPObj } from "../../../ipobj/IPObj";
import { FwCloud } from "../../../fwcloud/FwCloud";
import { QueryDeepPartialEntity } from "typeorm/query-builder/QueryPartialEntity";
import { ErrorBag } from "../../../../fonaments/validation/validator";
import { ValidationException } from "../../../../fonaments/exceptions/validation-exception";
import { HAProxyRuleItemForCompiler, ItemForGrid } from "../shared";

interface IFindManyHAProxyRPath {
    fwcloudId?: number;
    firewallId?: number;
}

interface IFindOneHAProxyRPath extends IFindManyHAProxyRPath {
    id: number;
}

export interface ICreateHAProxyRule {
    active?: boolean;
    group?: number;
    style?: string;
    rule_type?: number;
    firewallId?: number;
    frontEndIPId?: number;
    frontEndPortId?: number;
    backEndIPsIds?: { id: number, order: number }[];
    backEndPortId?: number;
    cfg_text?: string;
    comments?: string;
    rule_order?: number;
    to?: number;
    offset?: Offset;
}

export interface IUpdateHAProxyRule {
    active?: boolean;
    group?: number;
    style?: string;
    rule_type?: number;
    firewallId?: number;
    frontEndIPId?: number;
    frontEndPortId?: number;
    backEndIPsIds?: { id: number, order: number }[];
    backEndPortId?: number;
    cfg_text?: string;
    comments?: string;
    rule_order?: number;
    offset?: Offset;
}

export interface HAProxyRulesData<T extends ItemForGrid | HAProxyRuleItemForCompiler> extends HAProxyRule {
    items: (T & { _order: number })[];
}

interface IMoveFromHaProxyRule {
    fromId: number;
    toId: number;
    backEndIPsId?: number;
}

export class HAProxyRuleService extends Service {
    private _repository: HAProxyRuleRepository;
    private _ipobjService: IPObjRepository;

    constructor(app: Application) {
        super(app);
        this._repository = getCustomRepository(HAProxyRuleRepository);
        this._ipobjService = getCustomRepository(IPObjRepository);
    }

    async store(data: ICreateHAProxyRule): Promise<HAProxyRule> {
        const haProxyRule: Partial<HAProxyRule> = {
            active: data.active,
            style: data.style,
            rule_type: data.rule_type,
            cfg_text: data.cfg_text,
            comment: data.comments,
        };

        if (data.group) {
            haProxyRule.group = await getRepository(HAProxyGroup).findOneOrFail(data.group);
        }
        if (data.frontEndIPId) {
            haProxyRule.frontEndIP = await this._ipobjService.findOneOrFail({ id: data.frontEndIPId });
        }
        if (data.frontEndPortId) {
            haProxyRule.frontEndPort = await this._ipobjService.findOneOrFail({ id: data.frontEndPortId });
        }
        if (data.backEndPortId) {
            haProxyRule.backEndPort = await this._ipobjService.findOneOrFail({ id: data.backEndPortId });
        }

        if (data.backEndIPsIds) {
            await this.validateBackEndIPs(haProxyRule.firewall, data);
            haProxyRule.backEndIPs = data.backEndIPsIds.map(item => ({
                haproxyRuleId: haProxyRule.id,
                ipObjId: item.id,
                order: item.order
            } as HAProxyRuleToIPObj));
        }

        // Validate that the ip_version of haProxyRule.frontEndIp matches any of the ip_versions in haProxyRule.backEndIps
        if (haProxyRule.frontEndIP && haProxyRule.backEndIPs) {
            const frontEndIpVersion = haProxyRule.frontEndIP.ip_version;
            const hasMatchingIpVersion = haProxyRule.backEndIPs.some(backEndIp => backEndIp.ipObj.ip_version === frontEndIpVersion);
            if (!hasMatchingIpVersion) {
                throw new Error('IP version mismatch');
            }
        }

        const lastHAProxy: HAProxyRule = await this._repository.getLastHAProxy(data.firewallId);
        haProxyRule.rule_order = lastHAProxy ? lastHAProxy.rule_order + 1 : 1;
        const persisted: HAProxyRule = await this._repository.save(haProxyRule);

        if (Object.prototype.hasOwnProperty.call(data, 'to') && Object.prototype.hasOwnProperty.call(data, 'offset')) {
            return (await this.move([persisted.id], data.to, data.offset))[0]
        }

        return persisted;
    }

    async copy(ids: number[], destRule: number, position: Offset): Promise<HAProxyRule[]> {
        const haproxy_rs: HAProxyRule[] = await this._repository.find({
            where: {
                id: In(ids),
            },
            relations: ['group', 'firewall', 'firewall.fwCloud', 'frontEndIP', 'frontEndPort', 'backEndIPs', 'backEndPort'],
        });

        const savedCopies: HAProxyRule[] = await Promise.all(
            haproxy_rs.map(async rule => {
                const { id, ...copy } = rule;
                return await this._repository.save({ ...copy });
            })
        );

        return this.move(savedCopies.map(copy => copy.id), destRule, position);
    }

    async move(ids: number[], destRule: number, offset: Offset): Promise<HAProxyRule[]> {
        return this._repository.move(ids, destRule, offset);
    }

    async moveFrom(fromId: number, toId: number, data: IMoveFromHaProxyRule): Promise<[HAProxyRule, HAProxyRule]> {
        const fromRule: HAProxyRule = await this._repository.findOneOrFail(fromId, {
            relations: ['firewall', 'firewall.fwCloud', 'backEndIPs']
        });

        const toRule: HAProxyRule = await this._repository.findOneOrFail(toId, {
            relations: ['firewall', 'firewall.fwCloud', 'backEndIPs']
        });

        let lastPosition = 0;

        [].concat(toRule.backEndIPs).forEach((ipobj) => {
            lastPosition < ipobj.order ? lastPosition = ipobj.order : null;
        });

        if (data.backEndIPsId !== undefined) {
            const index = toRule.backEndIPs.findIndex(item => item.ipObjId === data.backEndIPsId);
            if (index >= 0) {
                fromRule.backEndIPs.splice(index, 1);
                toRule.backEndIPs.push({
                    haproxyRuleId: toRule.id,
                    ipObjId: data.backEndIPsId,
                    order: lastPosition + 1
                } as HAProxyRuleToIPObj);
            }
        }

        return await this._repository.save([fromRule, toRule]) as [HAProxyRule, HAProxyRule];
    }

    async update(id: number, data: Partial<ICreateHAProxyRule>): Promise<HAProxyRule> {
        let haProxyRule: HAProxyRule | undefined = await this._repository.findOneOrFail(id, {
            relations: ['group', 'frontEndIP', 'frontEndPort', 'backEndIPs', 'backEndPort']
        });

        Object.assign(haProxyRule, {
            active: data.active === undefined ? data.active : haProxyRule.active,
            style: data.style === undefined ? haProxyRule.style : data.style,
            cfg_text: data.cfg_text === undefined ? haProxyRule.cfg_text : data.cfg_text,
            comment: data.comments === undefined ? haProxyRule.comment : data.comments,
            rule_order: data.rule_order === undefined ? haProxyRule.rule_order : data.rule_order,
        });

        if (data.group !== undefined) {
            haProxyRule.group = await getRepository(HAProxyGroup).findOneOrFail(data.group);
        } else if (data.backEndIPsIds) {
            await this.validateBackEndIPs(haProxyRule.firewall, data);
            haProxyRule.backEndIPs = data.backEndIPsIds.map(item => ({
                haproxyRuleId: haProxyRule.id,
                ipObjId: item.id,
                order: item.order
            } as HAProxyRuleToIPObj));
        } else {
            const fieldsToUpdate: string[] = ['frontEndIPId', 'frontEndPortId', 'backEndPortId', 'firewallId'];

            for (const field of fieldsToUpdate) {
                if (data[field] !== undefined) {
                    haProxyRule[field.slice(0, -2)] = await getRepository(field === 'firewallId' ? Firewall : IPObj).findOneOrFail(data[field]) as Firewall | IPObj;
                }
            }
        }

        //TODO: Revisar compatibilidad de ip version

        return await this._repository.save(haProxyRule);
    }

    async remove(path: IFindOneHAProxyRPath): Promise<HAProxyRule> {
        const haProxyRule: HAProxyRule = await this.findOneInPath(path);

        haProxyRule.backEndIPs = [];

        await this._repository.save(haProxyRule);

        await this._repository.remove(haProxyRule);

        return haProxyRule;
    }

    findOneInPath(path: IFindOneHAProxyRPath, options?: FindOneOptions<HAProxyRule>): Promise<HAProxyRule> {
        return this._repository.findOneOrFail(this.getFindInPathOptions(path, options))
    }

    protected getFindInPathOptions(path: Partial<IFindOneHAProxyRPath>, options: FindOneOptions<HAProxyRule> = {}): FindOneOptions<HAProxyRule> {
        return Object.assign({
            join: {
                alias: 'haproxy',
                innerJoin: {
                    firewall: 'group.firewall',
                    fwcloud: 'firewall.fwCloud',
                }
            },
            where: (qb) => {
                if (path.fwcloudId) {
                    qb.andWhere('firewall.fwCloudId = :fwcloudId', { fwcloudId: path.fwcloudId });
                }
                if (path.firewallId) {
                    qb.andWhere('firewall.id = :firewallId', { firewallId: path.firewallId });
                }
                if (path.id) {
                    qb.andWhere('haproxy.id = :id', { id: path.id });
                }
            },
        }, options);
    }
    
    public async getHAProxyRulesData<T extends ItemForGrid | HAProxyRuleItemForCompiler>(fwcloud: number, firewall: number, rules?: number[]): Promise<HAProxyRulesData<T>[]> {
        const rulesData: HAProxyRulesData<T>[] = await this._repository.getHAProxyRules(fwcloud, firewall, rules) as HAProxyRulesData<T>[];

        let ItemsArrayMap: Map<number, T[]> = new Map<number, T[]>();
        for (let i = 0; i < rulesData.length; i++) {
            rulesData[i].items = [];
            ItemsArrayMap.set(rulesData[i].id, rulesData[i].items);
        }

        return rulesData.map((rule) => {
            if (rule.items) {
                rule.items = rule.items.sort((a, b) => a._order - b._order);
            }
            return rule;
        });
    }

    public async bulkUpdate(ids: number[], data: IUpdateHAProxyRule): Promise<HAProxyRule[]> {
        if (data.group) {
            await this._repository.update({
                id: In(ids),
            }, { ...data, group: { id: data.group } })
        } else {
            await this._repository.update({
                id: In(ids),
            }, data as QueryDeepPartialEntity<HAProxyRule>);
        }

        return this._repository.find({
            where: {
                id: In(ids),
            }
        });
    }

    public async bulkRemove(ids: number[]): Promise<HAProxyRule[]> {
        const rules: HAProxyRule[] = await this._repository.find({
            where: {
                id: In(ids),
            }
        });

        for (const rule of rules) {
            await this.remove({ id: rule.id })
        }

        return rules;
    }

    async validateBackEndIPs(firewall: Firewall, data: IUpdateHAProxyRule): Promise<void> {
        const errors: ErrorBag = {};

        if (!data.backEndIPsIds || data.backEndIPsIds.length === 0) {
            return;
        }

        const ipObjs: IPObj[] = await getRepository(IPObj).find({
            where: {
                id: In(data.backEndIPsIds.map(item => item.id)),
                ipObjTypeId: 1,
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