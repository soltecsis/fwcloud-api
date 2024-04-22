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

import { EntityRepository, FindManyOptions, FindOneOptions, In, RemoveOptions, Repository, SelectQueryBuilder, getRepository } from "typeorm";
import { HAProxyRule } from "./haproxy_r.model";
import { Offset } from "../../../../offset";
import { Firewall } from "../../../firewall/Firewall";

interface IFindManyHAProxyRPath {
    fwcloudId?: number;
    firewallId?: number;
    haproxyGroupId?: number;
}

interface IFindOneHAProxyGPath extends IFindManyHAProxyRPath {
    id: number;
}

@EntityRepository(HAProxyRule)
export class HAProxyRuleRepository extends Repository<HAProxyRule> {
    findManyInPath(path: IFindManyHAProxyRPath, options?: FindManyOptions<HAProxyRule>): Promise<HAProxyRule[]> {
        return this.find(this.getFindInPathOptions(path, options));
    }

    async move(ids: number[], haproxyDestId: number, offset: Offset): Promise<HAProxyRule[]> {
        const haproxy_rs: HAProxyRule[] = await this.find({
            where: {
                id: In(ids),
            },
            order: {
                'rule_order': 'ASC',
            },
            relations: ['firewall', 'group'],
        });

        let affectedHAProxies: HAProxyRule[] = await this.findManyInPath({
            fwcloudId: haproxy_rs[0].firewall.fwCloudId,
            firewallId: haproxy_rs[0].firewall.id,
        });

        const destHAProxy: HAProxyRule | undefined = await this.findOneOrFail({
            where: {
                id: haproxyDestId,
            }
        });

        if (offset === Offset.Above) {
            affectedHAProxies = await this.moveAbove(haproxy_rs, affectedHAProxies, destHAProxy);
        } else {
            affectedHAProxies = await this.moveBelow(haproxy_rs, affectedHAProxies, destHAProxy);
        }

        await this.save(affectedHAProxies);

        await this.refreshOrders(haproxy_rs[0].firewallId);

        return await this.find({ where: { id: In(ids) } });
    }

    protected async moveAbove(rules: HAProxyRule[], affectedRules: HAProxyRule[], destRule: HAProxyRule): Promise<HAProxyRule[]> {
        const destPosition: number = destRule.rule_order;
        const movingIds: number[] = rules.map((haproxy_r: HAProxyRule) => haproxy_r.id);

        const currentPosition: number = rules[0].rule_order;
        const forward: boolean = currentPosition < destPosition;

        affectedRules.forEach((rule) => {
            if (movingIds.includes(rule.id)) {
                const offset = movingIds.indexOf(rule.id);
                rule.rule_order = destPosition + offset;
                rule.groupId = destRule.groupId;
            } else {
                if (forward &&
                    rule.rule_order >= destRule.rule_order) {
                    rule.rule_order += rules.length;
                }
                if (!forward &&
                    rule.rule_order >= destRule.rule_order &&
                    rule.rule_order < rule[0].rule_order) {
                    rule.rule_order += rules.length;
                }
            }
        });

        return affectedRules;
    }

    protected async moveBelow(rules: HAProxyRule[], affectedRules: HAProxyRule[], destRule: HAProxyRule): Promise<HAProxyRule[]> {
        const destPosition: number = destRule.rule_order;
        const movingIds: number[] = rules.map((haproxy_r: HAProxyRule) => haproxy_r.id);

        const currentPosition: number = rules[0].rule_order;
        const forward: boolean = currentPosition < destPosition;

        affectedRules.forEach((rule: HAProxyRule) => {
            if (movingIds.includes(rule.id)) {
                if (!destRule.groupId) {
                    const offset = movingIds.indexOf(rule.id);
                    rule.rule_order = destPosition + offset + 1;
                    rule.groupId = destRule.groupId;
                } else {
                    rule.groupId = destRule.groupId;
                    if (!forward) {
                        const offset = movingIds.indexOf(rule.id);
                        rule.rule_order = destPosition + offset + 1;
                    }
                }
            } else {
                if (forward && rule.rule_order > destRule.rule_order) {
                    rule.rule_order += rules.length;
                }
                if (!forward && rule.rule_order > destRule.rule_order && rule.rule_order < rules[0].rule_order) {
                    rule.rule_order += rules.length;
                }
            }
        });

        return affectedRules;
    }

    async remove(entities: HAProxyRule[], options?: RemoveOptions): Promise<HAProxyRule[]>;
    async remove(entity: HAProxyRule, options?: RemoveOptions): Promise<HAProxyRule>;
    async remove(entityOrEntities: HAProxyRule | HAProxyRule[], options?: RemoveOptions): Promise<HAProxyRule | HAProxyRule[]> {
        const result: HAProxyRule | HAProxyRule[] = await super.remove(entityOrEntities as HAProxyRule[], options);

        if (result && !Array.isArray(result)) {
            const haproxy: HAProxyRule = result;
            if (haproxy.group) {
                await this.refreshOrders(haproxy.firewallId);
            }
        } else if (result && Array.isArray(result) && result.length > 0) {
            const haproxy: HAProxyRule = (result as HAProxyRule[])[0];
            if (haproxy.group) {
                await this.refreshOrders(haproxy.firewallId);
            }
        }
        return result;
    }

    protected getFindInPathOptions(path: Partial<IFindOneHAProxyGPath>, options: FindOneOptions<HAProxyRule> | FindManyOptions<HAProxyRule> = {}): FindOneOptions<HAProxyRule> | FindManyOptions<HAProxyRule> {
        return Object.assign({
            join: {
                alias: 'haproxy',
                innerJoin: {
                    group: 'haproxy.group',
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
                if (path.haproxyGroupId) {
                    qb.andWhere('group.id = :haproxyGroupId', { haproxyGroupId: path.haproxyGroupId });
                }
                if (path.id) {
                    qb.andWhere('haproxy.id = :id', { id: path.id });
                }
            },
        }), options;
    }

    protected async refreshOrders(firewallId: number) {
        const firewall: Firewall = await getRepository(Firewall).findOneOrFail(firewallId);
        const rules: HAProxyRule[] = await this.findManyInPath({
            fwcloudId: firewall.fwCloudId,
            firewallId: firewall.id,
        });

        if (rules.length === 0) {
            return;
        }

        await this.query(
            `SET @a:=0; UPDATE ${HAProxyRule._getTableName()} SET rule_order=@a:=@a+1 WHERE id IN (${rules.map(item => item.id).join(',')}) ORDER BY rule_order`
        );
    }

    async getLastHAProxyRuleInFirewall(firewall: number): Promise<HAProxyRule> {
        return this.createQueryBuilder('rule')
            .where('rule.firewall = :firewall', { firewall })
            .orderBy('rule.rule_order', 'DESC')
            .take(1)
            .getOne();
    }

    async getHAProxyRules(FwCloud: number, firewall: number, rules?: number[], forCompilation: boolean = false): Promise<HAProxyRule[]> {
        const query: SelectQueryBuilder<HAProxyRule> = this.createQueryBuilder('haproxy')
            .leftJoinAndSelect('haproxy.group', 'group')
            .leftJoinAndSelect('haproxy.frontendIp', 'frontendIp')
            .leftJoinAndSelect('haproxy.frontendPort', 'frontendPort')
            .leftJoinAndSelect('haproxy.backendIps', 'backendIps')
            .leftJoinAndSelect('haproxy.backendPort', 'backendPort')
            .leftJoinAndSelect('frontendIp.interface', 'frontendIpInterface')
            .leftJoinAndSelect('frontendIpInterface.firewall', 'frontendIpFirewall')
            .leftJoinAndSelect('frontendIpInterface.hosts', 'frontendIpInterfaceHosts')
            .leftJoinAndSelect('frontendIpInterfaceHosts.hostIPObj', 'frontendIpInterfaceHostIPObj')
            .leftJoinAndSelect('frontendIpFirewall.cluster', 'frontendIpCluster')
            .leftJoinAndSelect('haproxy.firewall', 'firewall')
            .leftJoinAndSelect('firewall.fwCloud', 'fwCloud')
            .where('firewall.id = :firewall', { firewall: firewall })
            .andWhere('fwCloud.id = :fwCloud', { fwCloud: FwCloud });

        if (rules) {
            query.andWhere('haproxy.id IN (:...rules)', { rules });
        }

        let haproxyRules: HAProxyRule[] = await query.orderBy('haproxy.rule_order', 'ASC').getMany();

        if (forCompilation) {
            haproxyRules.sort(item => item.rule_type);
        }

        return haproxyRules;
    }
}