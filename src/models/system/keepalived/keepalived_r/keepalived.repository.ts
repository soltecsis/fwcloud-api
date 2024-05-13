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
import { Offset } from "../../../../offset";
import { KeepalivedRule } from "./keepalived_r.model";
import { Firewall } from "../../../firewall/Firewall";

interface IFindManyKeepalivedRPath {
    fwcloudId?: number;
    firewallId?: number;
    keepalivedGroupId?: number;
}
interface IFindOneKeepalivedRPath extends IFindManyKeepalivedRPath {
    id: number;
}
@EntityRepository(KeepalivedRule)
export class KeepalivedRepository extends Repository<KeepalivedRule> {
    /**
     * Finds multiple Keepalived records in a given path.
     * 
     * @param path - The path to search for Keepalived records.
     * @param options - Additional options for the search.
     * @returns A promise that resolves to an array of keepalived records.
     */
    async findManyInPath(path: IFindManyKeepalivedRPath, options?: FindManyOptions<KeepalivedRule>): Promise<KeepalivedRule[]> {
        return this.find(this.getFindInPathOptions(path, options));
    }

    /**
     * Moves the Keepalived rules with the specified IDs to a new position relative to the keepalived rule with the given ID.
     * @param ids - An array of keepalived rule IDs to be moved.
     * @param keepalivedDestId - The ID of the Keepalived rule to which the selected rules will be moved.
     * @param offset - The offset indicating whether the selected rules should be moved above or below the destination keepalived rule.
     * @returns A promise that resolves to an array of keepalivedR objects representing the updated Keepalived rules.
     */
    async move(ids: number[], keepalivedDestId: number, offset: Offset): Promise<KeepalivedRule[]> {
        const keepalived_rs: KeepalivedRule[] = await this.find({
            where: {
                id: In(ids),
            },
            order: {
                'rule_order': 'ASC',
            },
            relations: ['firewall', 'group'],
        });

        let affectedKeepaliveds: KeepalivedRule[] = await this.findManyInPath({
            fwcloudId: keepalived_rs[0].firewall.fwCloudId,
            firewallId: keepalived_rs[0].firewall.id,
        });

        const destkeepalived: KeepalivedRule | undefined = await this.findOneOrFail({
            where: {
                id: keepalivedDestId,
            },
        });

        if (offset === Offset.Above) {
            affectedKeepaliveds = await this.moveAbove(keepalived_rs, affectedKeepaliveds, destkeepalived);
        } else {
            affectedKeepaliveds = await this.moveBelow(keepalived_rs, affectedKeepaliveds, destkeepalived);
        }

        await this.save(affectedKeepaliveds);

        await this.refreshOrders(keepalived_rs[0].firewallId);

        return await this.find({ where: { id: In(ids) } });
    }

    /**
     * Moves the affected Keepalived rules above the specified destination Keepalived rule.
     * 
     * @param rules - The array of all Keepalived rules.
     * @param affectedkeepaliveds - The array of affected Keepalived rules.
     * @param destkeepalived - The destination Keepalived rule.
     * @returns The updated array of affected Keepalived rules.
     */
    protected async moveAbove(rules: KeepalivedRule[], affectedRules: KeepalivedRule[], destRule: KeepalivedRule): Promise<KeepalivedRule[]> {
        const destPosition: number = destRule.rule_order;
        const movingIds: number[] = rules.map((keepalived_r: KeepalivedRule) => keepalived_r.id);

        const currentPosition: number = rules[0].rule_order;
        const forward: boolean = currentPosition < destRule.rule_order;

        affectedRules.forEach((rule) => {
            if (movingIds.includes(rule.id)) {
                if (!destRule.groupId) {
                    const offset = movingIds.indexOf(rule.id);
                    rule.rule_order = destPosition + offset;
                    rule.groupId = destRule.groupId;
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
            } else {
                if (forward && rule.rule_order >= destRule.rule_order) {
                    rule.rule_order += rules.length;
                }

                if (!forward && rule.rule_order >= destRule.rule_order && rule.rule_order < rules[0].rule_order) {
                    rule.rule_order += rules.length;
                }
            }
        });

        return affectedRules;
    }

    /**
     * Moves the affected Keepalived rules below the specified destination keepalived rule.
     * 
     * @param rules - The array of all Keepalived rules.
     * @param affectedkeepaliveds - The array of affected Keepalived rules.
     * @param destkeepalived - The destination Keepalived rule.
     * @returns The updated array of affected Keepalived rules.
     */
    protected async moveBelow(rules: KeepalivedRule[], affectedRules: KeepalivedRule[], destRule: KeepalivedRule): Promise<KeepalivedRule[]> {
        const destPosition: number = destRule.rule_order;
        const movingIds: number[] = rules.map((keepalived_r: KeepalivedRule) => keepalived_r.id);

        const currentPosition: number = rules[0].rule_order;
        const forward: boolean = currentPosition < destRule.rule_order;

        affectedRules.forEach((rule) => {
            if (movingIds.includes(rule.id)) {
                if (!destRule.groupId) {
                    const offset: number = movingIds.indexOf(rule.id);
                    rule.rule_order = destPosition + offset + 1;
                    rule.groupId = destRule.groupId;
                } else {
                    if (forward && rule.groupId == destRule.groupId) {
                        const offset: number = movingIds.indexOf(rule.id);
                        rule.rule_order = destPosition + offset + 1;
                    }
                    rule.groupId = destRule.groupId;
                }
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

    async remove(entities: KeepalivedRule[], options?: RemoveOptions): Promise<KeepalivedRule[]>;
    async remove(entity: KeepalivedRule, options?: RemoveOptions): Promise<KeepalivedRule>;
    /**
     * Removes one or more Keepalived entities from the repository.
     * 
     * @param entityOrEntities - The Keepalived entity or entities to be removed.
     * @param options - Optional parameters for the removal operation.
     * @returns A promise that resolves to the removed Keepalived entity or entities.
     */
    async remove(entityOrEntities: KeepalivedRule | KeepalivedRule[], options?: RemoveOptions): Promise<KeepalivedRule | KeepalivedRule[]> {
        const result = await super.remove(entityOrEntities as KeepalivedRule[], options);

        if (result && !Array.isArray(result)) {
            const keepalivedRule = result as KeepalivedRule;
            if (keepalivedRule.group) {
                await this.refreshOrders(keepalivedRule.firewallId);
            }
        } else if (result && Array.isArray(result) && result.length > 0) {
            const keepalivedRule = result[0] as KeepalivedRule;
            if (keepalivedRule.group) {
                await this.refreshOrders(keepalivedRule.firewallId);
            }
        }
        return result;
    }

    /**
     * Retrieves the options for finding Keepalived records based on the provided path.
     * 
     * @param path - The partial path object containing the IDs of fwcloud, firewall, and Keepalivedg.
     * @param options - The additional options for the find operation.
     * @returns The options for finding Keepalived records.
     */
    protected getFindInPathOptions(path: Partial<IFindOneKeepalivedRPath>, options: FindOneOptions<KeepalivedRule> | FindManyOptions<KeepalivedRule> = {}): FindOneOptions<KeepalivedRule> | FindManyOptions<KeepalivedRule> {
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
                if (path.keepalivedGroupId) {
                    qb.andWhere('group.id = :keepalivedGroupId', { keepalivedGroupId: path.keepalivedGroupId });
                }
                if (path.id) {
                    qb.andWhere('keepalived.id = :id', { id: path.id });
                }
            },
        }, options)
    }

    /**
     * Refreshes the orders of Keepalived rules based on the specified group ID.
     * @param keepalivedgid The group ID of the Keepalived rules to refresh.
     * @returns A Promise that resolves when the orders are successfully refreshed.
     */
    protected async refreshOrders(firewallId: number): Promise<void> {
        const firewall: Firewall = await getRepository(Firewall).findOneOrFail(firewallId);
        const rules: KeepalivedRule[] = await this.findManyInPath({
            fwcloudId: firewall.fwCloudId,
            firewallId: firewall.id,
        });

        if (rules.length === 0) {
            return;
        }

        await this.query(
            `SET @a:=0; UPDATE ${KeepalivedRule._getTableName()} SET rule_order=@a:=@a+1 WHERE id IN (${rules.map(item => item.id).join(',')}) ORDER BY rule_order`
        );
    }

    async getLastKeepalivedRuleInFirewall(firewall: number): Promise<KeepalivedRule | undefined> {
        return this.createQueryBuilder('rule')
            .where('rule.firewall = :firewall', { firewall })
            .orderBy('rule.rule_order', 'DESC')
            .take(1)
            .getOne();
    }

    async getKeepalivedRules(fwcloud: number, firewall: number, rules?: number[]): Promise<KeepalivedRule[]> {
        const query: SelectQueryBuilder<KeepalivedRule> = this.createQueryBuilder('keepalived_r')
            .leftJoinAndSelect('keepalived_r.group', 'group')
            .leftJoinAndSelect('keepalived_r.interface', 'interface')
            .leftJoinAndSelect('keepalived_r.masterNode', 'masterNode')
            .leftJoinAndSelect('interface.firewall', 'interfaceFirewall')
            .leftJoinAndSelect('interfaceFirewall.cluster', 'interfaceCluster')
            .leftJoinAndSelect('interface.hosts', 'hosts')
            .leftJoinAndSelect('hosts.hostIPObj', 'hostIPObj')
            .innerJoin('keepalived_r.firewall', 'firewall')
            .innerJoin('firewall.fwCloud', 'fwCloud')
            .where('firewall.id = :firewallId', { firewallId: firewall })
            .andWhere('fwCloud.id = :fwCloudId', { fwCloudId: fwcloud });

        if (rules) {
            query
                .andWhere('keepalived_r.id IN (:...rule)')
                .setParameter('rule', rules);
        }

        return query.orderBy('keepalived_r.rule_order', 'ASC').getMany();
    }
}