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

import { EntityRepository, FindManyOptions, FindOneOptions, getConnection, getManager, In, LessThan, LessThanOrEqual, MoreThan, QueryBuilder, QueryRunner, RemoveOptions, Repository, SelectQueryBuilder } from "typeorm";
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

    async getLastRoutingRuleInRoutingTable(routingTableId: number): Promise<RoutingRule | undefined> {
        return await this.find({
            where: {
                routingTableId: routingTableId
            },
            order: {
                rule_order: 'DESC',
            },
            take: 1
        })[0]
    }

    /**
     * Moves a RoutingRule into the "to" rule_order (updating other RoutingRules rule_order affected by this change).
     * 
     * @param id 
     * @param to 
     * @returns 
     */
    async move(ids: number[], to: number): Promise<RoutingRule[]> {

        const rules: RoutingRule[] = await this.find({
            where: {
                id: In(ids)
            }, 
            relations: ['routingTable', 'routingTable.firewall']
        });

        const forward: boolean = rules[0].rule_order < to;

        const affectedRules: RoutingRule[] = await this.findManyInPath({
            fwCloudId: rules[0].routingTable.firewall.fwCloudId,
            firewallId: rules[0].routingTable.firewall.id
        });
        
        affectedRules.forEach((rule) => {
            if (ids.includes(rule.id)) {
                const offset: number = ids.indexOf(rule.id);
                rule.rule_order = to + offset;
            } else {
                if (forward) {
                    if (rule.rule_order > to) {
                        rule.rule_order += rules.length;
                    }

                    if (rule.rule_order === to) {
                        rule.rule_order -= 1;
                    }
                }

                if (!forward) {
                    if (rule.rule_order >= to && rule.rule_order < rules[0].rule_order) {
                        rule.rule_order += rules.length;
                    }
                }
            }
        });

        await this.save(affectedRules);

        await this.query(
            `SET @a:=0; UPDATE ${RoutingRule._getTableName()} SET rule_order=@a:=@a+1 WHERE id IN (${affectedRules.map(item => item.id).join(',')}) ORDER BY rule_order`
        )
        
        return this.find({where: {id: In(ids)}});
    }

    async remove(entities: RoutingRule[], options?: RemoveOptions): Promise<RoutingRule[]>;
    async remove(entity: RoutingRule, options?: RemoveOptions): Promise<RoutingRule>;
    async remove(entityOrEntities: RoutingRule|RoutingRule[], options?: RemoveOptions): Promise<RoutingRule|RoutingRule[]> {
        const entities: RoutingRule[] = !Array.isArray(entityOrEntities) ? [entityOrEntities] : entityOrEntities;
        
        const queryRunner: QueryRunner = getConnection().createQueryRunner();
        await queryRunner.connect();
        await queryRunner.startTransaction();
        
        try {
            for(const entity of entities) {
                const queryBuilder: QueryBuilder<RoutingRule> = this.createQueryBuilder('rule', queryRunner);
            
                await super.remove(entity, options);
                await queryBuilder
                        .update()
                        .where('routingTableId = :table', {table: entity.routingTableId})
                        .andWhere('rule_order > :lower', {lower: entity.rule_order})
                        .set({
                            rule_order: () => "rule_order - 1"
                        }).execute();
            }
            
            await queryRunner.commitTransaction();
            
            return entityOrEntities;

        } catch(e) {
            await queryRunner.rollbackTransaction();
        } finally {
            await queryRunner.release()
        }
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

    getRoutingRules(fwcloud: number, firewall: number, rule?: number): Promise<RoutingRule[]> {
        let query = this.createQueryBuilder("rule")
            .innerJoinAndSelect("rule.routingTable","table")
            .leftJoinAndSelect("rule.routingGroup", "group")
            .innerJoin("table.firewall", "firewall")
            .innerJoin("firewall.fwCloud", "fwcloud")
            .where("firewall.id = :firewall", {firewall: firewall})
            .andWhere("fwcloud.id = :fwcloud", {fwcloud: fwcloud});

        if (rule) query = query.andWhere("rule.id = :rule", {rule});
            
        return query.orderBy("rule.rule_order").getMany();
    }
}