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

import { Column, Entity, getRepository, JoinColumn, JoinTable, ManyToMany, ManyToOne, OneToMany, PrimaryGeneratedColumn } from "typeorm";
import { IPObj } from "../../ipobj/IPObj";
import { IPObjGroup } from "../../ipobj/IPObjGroup";
import { Mark } from "../../ipobj/Mark";
import Model from "../../Model";
import { OpenVPN } from "../../vpn/openvpn/OpenVPN";
import { OpenVPNPrefix } from "../../vpn/openvpn/OpenVPNPrefix";
import { RoutingRuleToInterface } from "../routing-rule-to-interface/routing-rule-to-interface.model";
import { RoutingTable } from "../routing-table/routing-table.model";
import { RoutingGroup } from "../routing-group/routing-group.model";
import { Interface } from "../../interface/Interface";
import db from "../../../database/database-manager";
import { RoutingRuleToOpenVPNPrefix } from "./routing-rule-to-openvpn-prefix.model";

const tableName: string = 'routing_r';

@Entity(tableName)
export class RoutingRule extends Model {

    @PrimaryGeneratedColumn()
    id: number;

    @Column({
        type: Boolean
    })
    active: boolean;

    @Column()
    comment: string;

    @Column({
        type: Number
    })
    rule_order: number;

    @Column()
    style: string;

    @Column({
        name: 'group'
    })
    routingGroupId: number;

    @ManyToOne(type => RoutingGroup, routingGroup => routingGroup.routingRules)
    @JoinColumn({
        name: 'group'
    })
    routingGroup: RoutingGroup;

    @Column({
        name: 'routing_table'
    })
    routingTableId: number;
    
    @ManyToOne(type => RoutingTable, routingTable => routingTable.routingRules)
    @JoinColumn({
        name: 'routing_table'
    })
    routingTable: RoutingTable;

    @OneToMany(type => RoutingRuleToInterface, routingRuleToInterface => routingRuleToInterface.routingRule)
	@JoinTable({
		name: 'routing_r__interface',
		joinColumn: { name: 'rule'},
		inverseJoinColumn: { name: 'mark'}
	})
    routingRuleToInterfaces: RoutingRuleToInterface[]

    @ManyToMany(type => Mark, mark => mark.routingRules)
	@JoinTable({
		name: 'routing_r__mark',
		joinColumn: { name: 'rule'},
		inverseJoinColumn: { name: 'mark'}
	})
    marks: Mark[]

    @ManyToMany(type => IPObj, ipobj => ipobj.routingRules)
	@JoinTable({
		name: 'routing_r__ipobj',
		joinColumn: { name: 'rule'},
		inverseJoinColumn: { name: 'ipobj'}
	})
    ipObjs: IPObj[]

    @ManyToMany(type => IPObjGroup, ipObjGroup => ipObjGroup.routingRules)
	@JoinTable({
		name: 'routing_r__ipobj_g',
		joinColumn: { name: 'rule'},
		inverseJoinColumn: { name: 'ipobj_g'}
	})
    ipObjGroups: IPObjGroup[]

    @ManyToMany(type => OpenVPN, openVPN => openVPN.routingRules)
	@JoinTable({
		name: 'routing_r__openvpn',
		joinColumn: { name: 'rule'},
		inverseJoinColumn: { name: 'openvpn'}
	})
    openVPNs: OpenVPN[]

    @OneToMany(() => RoutingRuleToOpenVPNPrefix, model => model.routingRule, {
        cascade: true,
    })
    routingRuleToOpenVPNPrefixes: RoutingRuleToOpenVPNPrefix[];
    
    public getTableName(): string {
        return tableName;
    }

    public static async getRoutingRuleWhichLastAddressInHost(ipobjId: number, type: number, fwcloud:number): Promise<RoutingRule[]> {
        const interfaces: Interface [] = await getRepository(Interface).createQueryBuilder('interface')
            .select('interface.id')
            .innerJoinAndSelect('interface.ipObjs', 'ipobj', 'ipobj.id = :id', {id: ipobjId})
            .innerJoin('interface.hosts', 'InterfaceIPObj')
            .innerJoin('InterfaceIPObj.hostIPObj', 'host')
            .innerJoin('host.routingRules', 'rules')
            .innerJoin('rules.routingTable', 'table')
            .innerJoinAndSelect('table.firewall', 'firewall')
            .leftJoinAndSelect('firewall.cluster', 'cluster')
            .innerJoin('firewall.fwCloud', 'fwcloud', 'fwcloud.id = :fwcloud', {fwcloud})
            .getMany();

        const uniqueInterfaces: Interface[] = [];
        for(let _interface of interfaces) {
            let addresses: IPObj[] = await Interface.getInterfaceAddr(db.getQuery(), _interface.id);

            if (addresses.length === 1 && addresses[0].id === ipobjId) {
                uniqueInterfaces.push(_interface);
            }
        }

        if (uniqueInterfaces.length === 0) {
            return [];
        }

        return await getRepository(RoutingRule).createQueryBuilder('routing_rule')
            .addSelect('firewall.id', 'firewall_id').addSelect('firewall.name', 'firewall_name')
            .addSelect('cluster.id', 'cluster_id').addSelect('cluster.name', 'cluster_name')
            .innerJoin('routing_rule.ipObjs', 'ipobj')
            .innerJoin('ipobj.hosts', 'InterfaceIPObj')
            .innerJoin('InterfaceIPObj.hostInterface', 'interface')
            .innerJoin('routing_rule.routingTable', 'table')
            .innerJoin('table.firewall', 'firewall')
            .leftJoin('firewall.cluster', 'cluster')
            .where(`interface.id IN (${uniqueInterfaces.map(item => item.id).join(',')})`)
            .getRawMany();
    }

    public static async getRoutingRuleWhichLastAddressInHostInGroup(ipobjId: number, type: number, fwcloud:number): Promise<RoutingRule[]> {
        const interfaces: Interface [] = await getRepository(Interface).createQueryBuilder('interface')
            .select('interface.id')
            .innerJoinAndSelect('interface.ipObjs', 'ipobj', 'ipobj.id = :id', {id: ipobjId})
            .innerJoin('interface.hosts', 'InterfaceIPObj')
            .innerJoin('InterfaceIPObj.hostIPObj', 'host')
            .innerJoin('host.ipObjToIPObjGroups', 'IPObjToIPObjGroup')
            .innerJoin('IPObjToIPObjGroup.ipObjGroup', 'group')
            .innerJoin('group.routingRules', 'rule')
            .innerJoin('rule.routingTable', 'table')
            .innerJoin('table.firewall', 'firewall')
            .innerJoin('firewall.fwCloud', 'fwcloud', 'fwcloud.id = :fwcloud', {fwcloud})
            .getMany();

        const uniqueInterfaces: Interface[] = [];
        for(let _interface of interfaces) {
            let addresses: IPObj[] = await Interface.getInterfaceAddr(db.getQuery(), _interface.id);

            if (addresses.length === 1 && addresses[0].id === ipobjId) {
                uniqueInterfaces.push(_interface);
            }
        }

        if (uniqueInterfaces.length === 0) {
            return [];
        }

        return await getRepository(RoutingRule).createQueryBuilder('routing_rule')
            .addSelect('firewall.id', 'firewall_id').addSelect('firewall.name', 'firewall_name')
            .addSelect('cluster.id', 'cluster_id').addSelect('cluster.name', 'cluster_name')
            .innerJoin('routing_rule.ipObjs', 'ipobj')
            .innerJoin('ipobj.hosts', 'InterfaceIPObj')
            .innerJoin('InterfaceIPObj.hostInterface', 'interface')
            .innerJoin('routing_rule.routingTable', 'table')
            .innerJoin('table.firewall', 'firewall')
            .leftJoin('firewall.cluster', 'cluster')
            .where(`interface.id IN (${uniqueInterfaces.map(item => item.id).join(',')})`)
            .getRawMany();
    }

}