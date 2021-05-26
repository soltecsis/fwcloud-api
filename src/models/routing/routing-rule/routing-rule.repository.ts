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

import { EntityRepository, FindManyOptions, FindOneOptions, getConnection, LessThan, LessThanOrEqual, MoreThan, QueryBuilder, QueryRunner, RemoveOptions, Repository, SelectQueryBuilder } from "typeorm";
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
            take: 1
        })[0]
    }

    /**
     * Moves a RoutingRule into the "to" position (updating other RoutingRules position affected by this change).
     * 
     * @param id 
     * @param to 
     * @returns 
     */
    async move(id: number, to: number): Promise<RoutingRule> {
        const rule: RoutingRule = await this.findOneOrFail(id, {relations: ['routingTable', 'routingTable.firewall']});
        
        let affectedRules: RoutingRule[] = [];
        
        const lastPositionRule: RoutingRule = (await this.findManyInPath({
            fwCloudId: rule.routingTable.firewall.fwCloudId,
            firewallId: rule.routingTable.firewall.id,
        }, {
            take: 1,
            order: {
                position: 'DESC'
            }
        }))[0];

        const greaterValidPosition: number = lastPositionRule ? lastPositionRule.position + 1 : 1;
        
        //Assert position is valid
        to = Math.min(Math.max(1, to), greaterValidPosition);

        if (rule.position > to) {
            affectedRules = await this.createQueryBuilder('rule')
                .where("rule.position >= :greater", {greater: to})
                .andWhere("rule.position < :lower", {lower: rule.position})
                .andWhere("rule.routingTableId = :table", {table: rule.routingTableId}).getMany();
            
            affectedRules.forEach(rule => rule.position = rule.position + 1);
        }

        if (rule.position < to) {
            affectedRules = await this.createQueryBuilder('rule')
                .where("rule.position > :greater", {greater: rule.position})
                .andWhere("rule.position <= :lower", {lower: to})
                .andWhere("rule.routingTableId = :table", {table: rule.routingTableId}).getMany();

            affectedRules.forEach(rule => rule.position = rule.position - 1);
        }

        rule.position = to;
        affectedRules.push(rule);
        
        await this.save(affectedRules);

        return rule;
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
            
                await super.remove(entity);
                await queryBuilder
                        .update()
                        .where('routingTableId = :table', {table: entity.routingTableId})
                        .andWhere('rule_order > :lower', {lower: entity.position})
                        .set({
                            position: () => "position - 1"
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
}