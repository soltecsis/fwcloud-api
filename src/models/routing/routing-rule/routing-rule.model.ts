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

import { Column, Entity, JoinColumn, JoinTable, ManyToMany, ManyToOne, OneToMany, PrimaryGeneratedColumn } from "typeorm";
import { IPObj } from "../../ipobj/IPObj";
import { IPObjGroup } from "../../ipobj/IPObjGroup";
import { Mark } from "../../ipobj/Mark";
import Model from "../../Model";
import { OpenVPN } from "../../vpn/openvpn/OpenVPN";
import { OpenVPNPrefix } from "../../vpn/openvpn/OpenVPNPrefix";
import { RoutingRuleToInterface } from "../routing-rule-to-interface/routing-rule-to-interface.model";
import { RoutingTable } from "../routing-table/routing-table.model";
import { RoutingGroup } from "../routing-group/routing-group.model";

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
    position: number;

    @Column()
    style: string;

    @Column({
        name: 'group'
    })
    groupId: number;

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

    @ManyToMany(type => OpenVPNPrefix, openVPNPrefix => openVPNPrefix.routingRules)
	@JoinTable({
		name: 'routing_r__openvpn_prefix',
		joinColumn: { name: 'rule'},
		inverseJoinColumn: { name: 'openvpn_prefix'}
	})
    openVPNPrefixes: OpenVPNPrefix[]

    
    public getTableName(): string {
        return tableName;
    }

}