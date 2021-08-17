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

import { EntityRepository, FindManyOptions, FindOneOptions, getConnection, getManager, getRepository, In, LessThan, LessThanOrEqual, MoreThan, QueryBuilder, QueryRunner, RemoveOptions, Repository, SelectQueryBuilder } from "typeorm";
import { Firewall } from "../../firewall/Firewall";
import { RoutingRule } from "./routing-rule.model";

export interface IFindManyRoutingRulePath {
    firewallId?: number;
    fwCloudId?: number;
}

export interface IFindOneRoutingRulePath extends IFindManyRoutingRulePath {
    id: number;
}

@EntityRepository(RoutingRule)
export class RoutingRuleRepository extends Repository<RoutingRule> {
    /**
     * Finds routing rules which belongs to the given path
     *
     * @param path 
     * @returns 
     */
    findManyInPath(path: IFindManyRoutingRulePath, options?: FindManyOptions<RoutingRule>): Promise<RoutingRule[]> {
        return this.find(this.getFindInPathOptions(path, options));
    }

    /**
     * Fins one routing rule which belongs to the given path
     * @param path 
     * @returns 
     */
    findOneInPath(path: IFindOneRoutingRulePath): Promise<RoutingRule | undefined> {
        return this.findOne(this.getFindInPathOptions(path));
    }

    /**
     * Finds one routing rule in a path or throws an exception 
     * @param path 
     * @returns 
     */
    findOneInPathOrFail(path: IFindOneRoutingRulePath): Promise<RoutingRule> {
        return this.findOneOrFail(this.getFindInPathOptions(path));
    }

    async getLastRoutingRuleInFirewall(firewallId: number): Promise<RoutingRule | undefined> {
        return this.createQueryBuilder('rule')
            .innerJoin('rule.routingTable', 'table')
            .where('table.firewallId = :firewallId', {firewallId})
            .orderBy('rule.rule_order', 'DESC')
            .take(1)
            .getOne()
    }

    /**
     * Moves a RoutingRule into the "to" rule_order (updating other RoutingRules rule_order affected by this change).
     * 
     * @param id 
     * @param to 
     * @returns 
     */
    async move(ids: number[], toRuleId: number, offset: 'above' | 'below'): Promise<RoutingRule[]> {

        const rules: RoutingRule[] = await this.find({
            where: {
                id: In(ids)
            },
            order: {
                'rule_order': 'ASC'
            },
            relations: ['routingTable', 'routingTable.firewall']
        });

        let affectedRules: RoutingRule[] = await this.findManyInPath({
            fwCloudId: rules[0].routingTable.firewall.fwCloudId,
            firewallId: rules[0].routingTable.firewall.id
        });
        
        const destRule: RoutingRule | undefined = await this.findOneOrFail({
            where: {
                id: toRuleId
            }
        });
        
        if (offset === 'above') {
            affectedRules = await this.moveAbove(rules, affectedRules, destRule);
        } else {
            affectedRules = await this.moveBelow(rules, affectedRules, destRule);
        }

        await this.save(affectedRules);

        await this.refreshOrders(rules[0].routingTable.firewall.id);
        
        return this.find({where: {id: In(ids)}});
    }

    protected async moveAbove(rules: RoutingRule[], affectedRules: RoutingRule[], destRule: RoutingRule): Promise<RoutingRule[]> {
        const destPosition: number = destRule.rule_order;
        const movingIds: number[] = rules.map(rule => rule.id);

        const currentPosition: number = rules[0].rule_order;
        const forward: boolean = currentPosition < destRule.rule_order;

        affectedRules.forEach((rule) => {
            if (movingIds.includes(rule.id)) {
                const offset: number = movingIds.indexOf(rule.id);
                rule.rule_order = destPosition + offset;
                rule.routingGroupId = destRule.routingGroupId;
            } else {
                if (forward &&
                    rule.rule_order >= destRule.rule_order
                ) {
                    rule.rule_order += rules.length;
                }
                
                if (!forward && 
                    rule.rule_order >= destRule.rule_order && 
                    rule.rule_order < rules[0].rule_order
                ) {
                    rule.rule_order += rules.length;
                }
            }
        });

        return affectedRules;
    }

    protected async moveBelow(rules: RoutingRule[], affectedRules: RoutingRule[], destRule: RoutingRule): Promise<RoutingRule[]> {
        const destPosition: number = destRule.rule_order;
        const movingIds: number[] = rules.map(rule => rule.id);

        const currentPosition: number = rules[0].rule_order;
        const forward: boolean = currentPosition < destRule.rule_order;

        affectedRules.forEach((rule) => {
            if (movingIds.includes(rule.id)) {
                const offset: number = movingIds.indexOf(rule.id);
                rule.rule_order = destPosition + offset + 1;
                rule.routingGroupId = destRule.routingGroupId;
            } else {
                if (forward && rule.rule_order > destRule.rule_order) {
                    rule.rule_order += rules.length;
                }
                
                if (!forward && rule.rule_order > destRule.rule_order &&
                    rule.rule_order < rules[0].rule_order
                ) {
                    rule.rule_order += rules.length;
                }
            }
        });

        return affectedRules;
    }

    /**
     * Performs a remove of rules. It refreshes remaining rules order in order to keep them consecutive
     * @param entities 
     * @param options 
     */
    async remove(entities: RoutingRule[], options?: RemoveOptions): Promise<RoutingRule[]>;
    async remove(entity: RoutingRule, options?: RemoveOptions): Promise<RoutingRule>;
    async remove(entityOrEntities: RoutingRule|RoutingRule[], options?: RemoveOptions): Promise<RoutingRule|RoutingRule[]> {
        const affectedFirewalls: {[id: number]: Firewall} = {}

        const entityArray: RoutingRule[] = Array.isArray(entityOrEntities) ? entityOrEntities : [entityOrEntities];
        const entitiesWithFirewall: RoutingRule[] = await this.find({
            where: {
                id: In(entityArray.map(item => item.id))
            },
            relations: ['routingTable', 'routingTable.firewall']
        });

        for(let entity of entitiesWithFirewall) {
            if (!Object.prototype.hasOwnProperty.call(affectedFirewalls, entity.routingTable.firewallId)) {
                affectedFirewalls[entity.routingTable.firewallId] = entity.routingTable.firewall;
            }
        }
        
        // Using Type assertion because TypeScript compiler fails 
        const result = await super.remove(entityOrEntities as RoutingRule[], options);

        for(let firewall of Object.values(affectedFirewalls)) {
            await this.refreshOrders(firewall.id);
        }

        return result;
    }

    /**
     * Some operations might leave an inconsistent rule_order. This function refresh the rule_order
     * value in order to keep them consecutive
     * 
     * @param firewallId 
     */
    protected async refreshOrders(firewallId: number): Promise<void> {
        const firewall: Firewall = await getRepository(Firewall).findOneOrFail(firewallId);
        const rules: RoutingRule[] = await this.findManyInPath({
            fwCloudId: firewall.fwCloudId,
            firewallId: firewall.id
        });

        if (rules.length === 0) {
            return;
        }

        await this.query(
            `SET @a:=0; UPDATE ${RoutingRule._getTableName()} SET rule_order=@a:=@a+1 WHERE id IN (${rules.map(item => item.id).join(',')}) ORDER BY rule_order`
        )
    }

    protected getFindInPathOptions(path: Partial<IFindOneRoutingRulePath>, options: FindOneOptions<RoutingRule> | FindManyOptions<RoutingRule> = {}): FindOneOptions<RoutingRule> | FindManyOptions<RoutingRule> {
        return Object.assign({
            join: {
                alias: 'rule',
                innerJoin: {
                    table: 'rule.routingTable',
                    firewall: 'table.firewall',
                    fwcloud: 'firewall.fwCloud'
                }
            },
            where: (qb: SelectQueryBuilder<RoutingRule>) => {
                if (path.firewallId) {
                    qb.andWhere('firewall.id = :firewall', {firewall: path.firewallId})
                }

                if (path.fwCloudId) {
                    qb.andWhere('firewall.fwCloudId = :fwcloud', {fwcloud: path.fwCloudId})
                }

                if (path.id) {
                    qb.andWhere('rule.id = :id', {id: path.id})
                }
            }
        }, options)
    }

    getRoutingRules(fwcloud: number, firewall: number, rules?: number[]): Promise<RoutingRule[]> {
        let query = this.createQueryBuilder("rule")
            .innerJoinAndSelect("rule.routingTable","table")
            .leftJoinAndSelect("rule.routingGroup", "group")
            .innerJoin("table.firewall", "firewall")
            .innerJoin("firewall.fwCloud", "fwcloud")
            .where("firewall.id = :firewall", {firewall: firewall})
            .andWhere("fwcloud.id = :fwcloud", {fwcloud: fwcloud});

        if (rules) query = query.andWhere("rule.id IN (:...rules)", {rules: rules});
            
        return query.orderBy("rule.rule_order").getMany();
    }
}