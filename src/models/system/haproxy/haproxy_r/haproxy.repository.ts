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

import { EntityRepository, FindManyOptions, FindOneOptions, In, RemoveOptions, Repository, SelectQueryBuilder } from "typeorm";
import { HAProxyRule } from "./haproxy_r.model";
import { Offset } from "../../../../offset";

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
    findManyInPath(path: IFindManyHAProxyRPath): Promise<HAProxyRule[]> {
        return this.find(this.getFindInPathOptions(path));
    }

    async move(ids: number[], haproxyDestId: number, offset: Offset): Promise<HAProxyRule[]> {
        const haproxy_rs: HAProxyRule[] = await this.find({
            where: {
                id: In(ids),
            },
            order: {
                'rule_order': 'ASC',
            },
            relations: ['firewall'],
        });

        let affectedHAProxies: HAProxyRule[] = await this.findManyInPath({
            fwcloudId: haproxy_rs[0].firewall.fwCloudId,
            firewallId: haproxy_rs[0].firewall.id,
            haproxyGroupId: haproxy_rs[0].group?.id,
        });

        const destHAProxy: HAProxyRule | undefined = await this.findOneOrFail({
            where: {
                id: haproxyDestId,
            },
            relations: ['group', 'firewall'],
        });

        if (offset === Offset.Above) {
            affectedHAProxies = await this.moveAbove(haproxy_rs, affectedHAProxies, destHAProxy);
        } else {
            affectedHAProxies = await this.moveBelow(haproxy_rs, affectedHAProxies, destHAProxy);
        }

        await this.save(affectedHAProxies);

        await this.refreshOrder(haproxy_rs[0].group?.id);

        return await this.find({ where: { id: In(ids) } });
    }

    protected async moveAbove(haproxy_rs: HAProxyRule[], affectedHAProxies: HAProxyRule[], destHAProxy: HAProxyRule): Promise<HAProxyRule[]> {
        const destPosition: number = destHAProxy.rule_order;
        const movingIds: number[] = haproxy_rs.map((haproxy_r: HAProxyRule) => haproxy_r.id);

        const currentPosition: number = haproxy_rs[0].rule_order;
        const forward: boolean = currentPosition < destPosition;

        affectedHAProxies.forEach((haproxy_r: HAProxyRule) => {
            if (movingIds.includes(haproxy_r.id)) {
                const offset: number = movingIds.indexOf(haproxy_r.id);
                haproxy_r.rule_order = destPosition + offset;
                haproxy_r.group ? haproxy_r.group.id = destHAProxy.group.id : haproxy_r.group = destHAProxy.group;
            } else {
                if (forward && haproxy_r.rule_order >= destHAProxy.rule_order) {
                    haproxy_r.rule_order++;
                }
                if (!forward && haproxy_r.rule_order >= destHAProxy.rule_order && haproxy_r.rule_order < haproxy_r[0].rule_order) {
                    haproxy_r.rule_order++;
                }
            }
        });

        return affectedHAProxies;
    }

    protected async moveBelow(haproxy_rs: HAProxyRule[], affectedHAProxies: HAProxyRule[], destHAProxy: HAProxyRule): Promise<HAProxyRule[]> {
        const destPosition: number = destHAProxy.rule_order;
        const movingIds: number[] = haproxy_rs.map((haproxy_r: HAProxyRule) => haproxy_r.id);

        const currentPosition: number = haproxy_rs[0].rule_order;
        const forward: boolean = currentPosition < destPosition;

        affectedHAProxies.forEach((haproxy_r: HAProxyRule) => {
            if (movingIds.includes(haproxy_r.id)) {
                const offset: number = movingIds.indexOf(haproxy_r.id);
                haproxy_r.rule_order = destPosition + offset + 1;
                haproxy_r.group ? haproxy_r.group.id = destHAProxy.group.id : haproxy_r.group = destHAProxy.group;
            } else {
                if (forward && haproxy_r.rule_order > destHAProxy.rule_order) {
                    haproxy_r.rule_order += haproxy_rs.length;
                }
                if (!forward && haproxy_r.rule_order > destHAProxy.rule_order && haproxy_r.rule_order < haproxy_rs[0].rule_order) {
                    haproxy_r.rule_order += haproxy_rs.length;
                }
            }
        });

        return affectedHAProxies;
    }

    async remove(entities: HAProxyRule[], options?: RemoveOptions): Promise<HAProxyRule[]>;
    async remove(entity: HAProxyRule, options?: RemoveOptions): Promise<HAProxyRule>;
    async remove(entityOrEntities: HAProxyRule | HAProxyRule[], options?: RemoveOptions): Promise<HAProxyRule | HAProxyRule[]> {
        const result: HAProxyRule | HAProxyRule[] = await super.remove(entityOrEntities as HAProxyRule[], options);

        if (result && !Array.isArray(result)) {
            const haproxy: HAProxyRule = result;
            if (haproxy.group) {
                await this.refreshOrder(haproxy.group.id);
            }
        } else {
            const haproxy: HAProxyRule = (result as HAProxyRule[])[0];
            if (haproxy.group) {
                await this.refreshOrder(haproxy.group.id);
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

    protected async refreshOrder(haproxyGroupId: number) {
        const haproxy_rs: HAProxyRule[] = await this.find({
            where: {
                group: {
                    id: haproxyGroupId,
                },
            },
            order: {
                rule_order: 'ASC',
            },
        });

        let order: number = 1;
        haproxy_rs.forEach((haproxy_r: HAProxyRule) => {
            haproxy_r.rule_order = order++;
        });

        await this.save(haproxy_rs);
    }

    async getLastHAProxy(firewall: number): Promise<HAProxyRule> {
        return (await this.find({
            where: {
                firewall: firewall,
            },
            order: {
                'rule_order': 'DESC',
            },
            take: 1,
        }))[0];
    }

    async getHAProxyRules(FwCloud: number, firewall: number, rules?: number[]): Promise<HAProxyRule[]> {
        const query: SelectQueryBuilder<HAProxyRule> = this.createQueryBuilder('haproxy')
            .leftJoinAndSelect('haproxy.group', 'group')
            .leftJoinAndSelect('haproxy.frontEndIP', 'frontEndIP')
            .leftJoinAndSelect('haproxy.frontEndPort', 'frontEndPort')
            .leftJoinAndSelect('haproxy.backEndIPs', 'backEndIPs')
            .leftJoinAndSelect('haproxy.backEndPort', 'backEndPort')
            .leftJoinAndSelect('haproxy.firewall', 'firewall')
            .leftJoinAndSelect('firewall.fwCloud', 'fwCloud')
            .where('firewall.id = :firewall', { firewall: firewall })
            .andWhere('fwCloud.id = :fwCloud', { fwCloud: FwCloud });

        if (rules) {
            query.andWhere('haproxy.id IN (:...rules)', { rules });
        }

        return query.getMany();
    }
}