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
import { EntityRepository, FindManyOptions, FindOneOptions, In, RemoveOptions, Repository, SelectQueryBuilder } from "typeorm";
import { Offset } from "../../../../offset";
import { DHCPRule } from "./dhcp_r.model";

interface IFindManyDHCPRPath {
    fwcloudId?: number;
    firewallId?: number;
    dhcpGroupId?: number;
}
interface IFindOneDHCPRPath extends IFindManyDHCPRPath {
    id: number;
}
@EntityRepository(DHCPRule)
export class DHCPRepository extends Repository<DHCPRule> {
    /**
     * Finds multiple DHCP records in a given path.
     * 
     * @param path - The path to search for DHCP records.
     * @param options - Additional options for the search.
     * @returns A promise that resolves to an array of DHCP records.
     */
    async findManyInPath(path: IFindManyDHCPRPath, options?: FindManyOptions<DHCPRule>): Promise<DHCPRule[]> {
        return this.find(this.getFindInPathOptions(path, options));
    }

    /**
     * Moves the DHCP rules with the specified IDs to a new position relative to the DHCP rule with the given ID.
     * @param ids - An array of DHCP rule IDs to be moved.
     * @param dhcpDestId - The ID of the DHCP rule to which the selected rules will be moved.
     * @param offset - The offset indicating whether the selected rules should be moved above or below the destination DHCP rule.
     * @returns A promise that resolves to an array of DHCPR objects representing the updated DHCP rules.
     */
    async move(ids: number[], dhcpDestId: number, offset: Offset): Promise<DHCPRule[]> {
        const dhcp_rs: DHCPRule[] = await this.find({
            where: {
                id: In(ids),
            },
            order: {
                'rule_order': 'ASC',
            },
            relations: ['firewall'],
        });

        let affectedDHCPs: DHCPRule[] = await this.findManyInPath({
            fwcloudId: dhcp_rs[0].firewall.fwCloudId,
            firewallId: dhcp_rs[0].firewall.id,
            dhcpGroupId: dhcp_rs[0].group?.id,
        });

        const destDHCP: DHCPRule | undefined = await this.findOneOrFail({
            where: {
                id: dhcpDestId,
            },
            relations: ['group', 'firewall'],
        });

        if (offset === Offset.Above) {
            affectedDHCPs = await this.moveAbove(dhcp_rs, affectedDHCPs, destDHCP);
        } else {
            affectedDHCPs = await this.moveBelow(dhcp_rs, affectedDHCPs, destDHCP);
        }

        await this.save(affectedDHCPs);

        await this.refreshOrders(dhcp_rs[0].group?.id);

        return await this.find({ where: { id: In(ids) } });
    }

    /**
     * Moves the affected DHCP rules above the specified destination DHCP rule.
     * 
     * @param dhcp_rs - The array of all DHCP rules.
     * @param affectedDHCPs - The array of affected DHCP rules.
     * @param destDHCP - The destination DHCP rule.
     * @returns The updated array of affected DHCP rules.
     */
    protected async moveAbove(dhcp_rs: DHCPRule[], affectedDHCPs: DHCPRule[], destDHCP: DHCPRule): Promise<DHCPRule[]> {
        const destPosition: number = destDHCP.rule_order;
        const movingIds: number[] = dhcp_rs.map((dhcp_r: DHCPRule) => dhcp_r.id);

        const currentPosition: number = dhcp_rs[0].rule_order;
        const forward: boolean = currentPosition < destDHCP.rule_order;

        affectedDHCPs.forEach((dhcp_r: DHCPRule) => {
            if (movingIds.includes(dhcp_r.id)) {
                const offset: number = movingIds.indexOf(dhcp_r.id);
                dhcp_r.rule_order = destPosition + offset;
                dhcp_r.group ? dhcp_r.group.id = destDHCP.group.id : dhcp_r.group = destDHCP.group;
            } else {
                if (forward && dhcp_r.rule_order >= destDHCP.rule_order) {
                    dhcp_r.rule_order += 1;
                }

                if (!forward && dhcp_r.rule_order >= destDHCP.rule_order && dhcp_r.rule_order < dhcp_rs[0].rule_order) {
                    dhcp_r.rule_order += 1;
                }
            }
        });

        return affectedDHCPs;
    }

    /**
     * Moves the affected DHCP rules below the specified destination DHCP rule.
     * 
     * @param dhcp_rs - The array of all DHCP rules.
     * @param affectedDHCPs - The array of affected DHCP rules.
     * @param destDHCP - The destination DHCP rule.
     * @returns The updated array of affected DHCP rules.
     */
    protected async moveBelow(dhcp_rs: DHCPRule[], affectedDHCPs: DHCPRule[], destDHCP: DHCPRule): Promise<DHCPRule[]> {
        const destPosition: number = destDHCP.rule_order;
        const movingIds: number[] = dhcp_rs.map((dhcp_r: DHCPRule) => dhcp_r.id);

        const currentPosition: number = dhcp_rs[0].rule_order;
        const forward: boolean = currentPosition < destDHCP.rule_order;

        affectedDHCPs.forEach((dhcp_r: DHCPRule): void => {
            if (movingIds.includes(dhcp_r.id)) {
                const offset: number = movingIds.indexOf(dhcp_r.id);
                dhcp_r.rule_order = destPosition + offset + 1;
                dhcp_r.group ? dhcp_r.group.id = destDHCP.group.id : dhcp_r.group = destDHCP.group;
            } else {
                if (forward && dhcp_r.rule_order > destDHCP.rule_order) {
                    dhcp_r.rule_order += dhcp_rs.length;
                }

                if (!forward && dhcp_r.rule_order > destDHCP.rule_order && dhcp_r.rule_order < dhcp_rs[0].rule_order) {
                    dhcp_r.rule_order += dhcp_rs.length;
                }
            }
        });

        return affectedDHCPs;
    }

    async remove(entities: DHCPRule[], options?: RemoveOptions): Promise<DHCPRule[]>;
    async remove(entity: DHCPRule, options?: RemoveOptions): Promise<DHCPRule>;
    /**
     * Removes one or more DHCP entities from the repository.
     * 
     * @param entityOrEntities - The DHCP entity or entities to be removed.
     * @param options - Optional parameters for the removal operation.
     * @returns A promise that resolves to the removed DHCP entity or entities.
     */
    async remove(entityOrEntities: DHCPRule | DHCPRule[], options?: RemoveOptions): Promise<DHCPRule | DHCPRule[]> {
        const result: DHCPRule[] = await super.remove(entityOrEntities as DHCPRule[], options);

        if (result && !Array.isArray(result)) {
            const dhcpRule: DHCPRule = result;
            if (dhcpRule.group) {
                await this.refreshOrders(dhcpRule.group.id);
            }
        } else if (result && Array.isArray(result) && result.length > 0) {
            const dhcpRule: DHCPRule = result[0];
            if (dhcpRule.group) {
                await this.refreshOrders(dhcpRule.group.id);
            }
        }
        return result;
    }

    /**
     * Retrieves the options for finding DHCP records based on the provided path.
     * 
     * @param path - The partial path object containing the IDs of fwcloud, firewall, and dhcpg.
     * @param options - The additional options for the find operation.
     * @returns The options for finding DHCP records.
     */
    protected getFindInPathOptions(path: Partial<IFindOneDHCPRPath>, options: FindOneOptions<DHCPRule> | FindManyOptions<DHCPRule> = {}): FindOneOptions<DHCPRule> | FindManyOptions<DHCPRule> {
        return Object.assign({
            join: {
                alias: 'dhcp',
                innerJoin: {
                    firewall: 'dhcp.firewall',
                    fwcloud: 'firewall.fwCloud',
                }
            },
            where: (qb: SelectQueryBuilder<DHCPRule>): void => {
                if (path.firewallId) {
                    qb.andWhere('firewall.id = :firewallId', { firewallId: path.firewallId });
                }
                if (path.fwcloudId) {
                    qb.andWhere('fwcloud.id = :fwcloudId', { fwcloudId: path.fwcloudId });
                }
                if (path.dhcpGroupId) {
                    qb.andWhere('group.id = :dhcpGroupId', { dhcpGroupId: path.dhcpGroupId });
                }
                if (path.id) {
                    qb.andWhere('dhcp.id = :id', { id: path.id });
                }
            },
        }, options)
    }

    /**
     * Refreshes the orders of DHCP rules based on the specified group ID.
     * @param DHCPGroupId The group ID of the DHCP rules to refresh.
     * @returns A Promise that resolves when the orders are successfully refreshed.
     */
    protected async refreshOrders(DHCPGroupId: number): Promise<void> {
        const dhcp_rs: DHCPRule[] = await this.find({
            where: {
                group: DHCPGroupId,
            },
            order: {
                'rule_order': 'ASC',
            },
        });

        let order: number = 1;
        dhcp_rs.forEach((dhcp_r: DHCPRule): void => {
            dhcp_r.rule_order = order++;
        });

        await this.save(dhcp_rs);
    }

    /**
     * Retrieves the last DHCP rule in a specified group.
     * @param DHCPGroupId - The ID of the DHCP group.
     * @returns A Promise that resolves to the last DHCP rule in the group.
     */
    async getLastDHCPRuleInGroup(DHCPGroupId: number): Promise<DHCPRule> {
        return (await this.find({
            where: {
                group: DHCPGroupId,
            },
            order: {
                'rule_order': 'DESC',
            },
            take: 1,
        }))[0];
    }

    async getDHCPRules(FWCloud: number, firewall: number, rules?: number[], rule_types?: number[], forCompilation: boolean = false): Promise<DHCPRule[]> {
        const query: SelectQueryBuilder<DHCPRule> = this.createQueryBuilder('dhcp_r')
            .leftJoinAndSelect('dhcp_r.group', 'group')
            .leftJoinAndSelect('dhcp_r.network', 'network')
            .leftJoinAndSelect('dhcp_r.range', 'range')
            .leftJoinAndSelect('dhcp_r.router', 'router')
            .leftJoinAndSelect('router.interface', 'routerInterface')
            .leftJoinAndSelect('routerInterface.firewall', 'routerFirewall')
            .leftJoinAndSelect('routerFirewall.cluster', 'routerCluster')
            .leftJoinAndSelect('dhcp_r.interface', 'interface')
            .leftJoinAndSelect('interface.firewall', 'interfaceFirewall')
            .leftJoinAndSelect('interface.hosts', 'hosts')
            .leftJoinAndSelect('hosts.hostIPObj', 'hostIPObj')
            .leftJoinAndSelect('dhcp_r.firewall', 'firewall')
            .leftJoinAndSelect('firewall.fwCloud', 'fwCloud')
            .where('firewall.id = :firewallId', { firewallId: firewall })
            .andWhere('fwCloud.id = :fwCloudId', { fwCloudId: FWCloud });

        if (rule_types) {
            query
                .andWhere('dhcp_r.rule_type IN (:...rule_types)')
                .setParameter('rule_types', rule_types);

            if (forCompilation) {
                query
                    .orderBy('FIELD(dhcp_r.rule_type, :...rule_types)', 'ASC')
                    .addOrderBy('dhcp_r.rule_order', 'ASC');
            } else {
                query
                    .orderBy('dhcp_r.rule_order', 'ASC');
            }
        } else {
            query.orderBy('dhcp_r.rule_order', 'ASC');
        }

        if (rules) {
            query
                .andWhere('dhcp_r.id IN (:...rule)')
                .setParameter('rule', rules);
        }

        return query.getMany();
    }
}
