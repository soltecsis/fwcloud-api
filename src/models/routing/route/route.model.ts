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

import { Column, Entity, JoinColumn, JoinTable, ManyToMany, ManyToOne, PrimaryGeneratedColumn } from "typeorm";
import { Interface } from "../../interface/Interface";
import { IPObj } from "../../ipobj/IPObj";
import { IPObjGroup } from "../../ipobj/IPObjGroup";
import Model from "../../Model";
import { OpenVPN } from "../../vpn/openvpn/OpenVPN";
import { OpenVPNPrefix } from "../../vpn/openvpn/OpenVPNPrefix";
import { RoutingTable } from "../routing-table/routing-table.model";
import { RouteGroup } from "../route-group/route-group.model";

const tableName: string = 'route';

@Entity(tableName)

export class Route extends Model {
    
    @PrimaryGeneratedColumn()
    id: number;

    @Column({name: 'routing_table'})
    routingTableId: number;

    @ManyToOne(type => RoutingTable, model => model.routes)
    @JoinColumn({
        name: 'routing_table'
    })
    routingTable: RoutingTable;

    
    @Column({name: 'gateway'})
    gatewayId: number;

    @ManyToOne(type => IPObj, model => model.routeGateways)
    @JoinColumn({
        name: 'gateway'
    })
    gateway: IPObj;

    @Column({name: 'interface'})
    interfaceId: number;

    @ManyToOne(type => Interface, model => model.routes)
    @JoinColumn({
        name: 'interface'
    })
    interface: Interface;

    @Column({
        type: Boolean,
    })
    active: boolean;

    @Column()
    comment: string;

    @Column()
    style: string

    @Column({
        type: Number
    })
    position: number;

    @Column({
        name: 'group'
    })
    routeGroupId: number;

    @ManyToOne(type => RouteGroup, model => model.routes)
    @JoinColumn({
        name: 'group'
    })
    routeGroup: RouteGroup;

    @ManyToMany(type => IPObj, ipobj => ipobj.routes)
	@JoinTable({
		name: 'route__ipobj',
		joinColumn: { name: 'route'},
		inverseJoinColumn: { name: 'ipobj'}
	})
    ipObjs: IPObj[]

    @ManyToMany(type => IPObjGroup, group => group.routes)
	@JoinTable({
		name: 'route__ipobj_g',
		joinColumn: { name: 'route'},
		inverseJoinColumn: { name: 'ipobj_g'}
	})
    ipObjGroups: IPObjGroup[]

    @ManyToMany(type => OpenVPN, openVPN => openVPN.routes)
	@JoinTable({
		name: 'route__openvpn',
		joinColumn: { name: 'route'},
		inverseJoinColumn: { name: 'openvpn'}
	})
    openVPNs: OpenVPN[];

    @ManyToMany(type => OpenVPNPrefix, openVPNPrefix => openVPNPrefix.routes)
	@JoinTable({
		name: 'route__openvpn_prefix',
		joinColumn: { name: 'route'},
		inverseJoinColumn: { name: 'openvpn_prefix'}
	})
    openVPNPrefixes: OpenVPNPrefix[]

    public getTableName(): string {
        return tableName;
    }

}