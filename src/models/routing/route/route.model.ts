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
import { Interface } from "../../interface/Interface";
import { IPObj } from "../../ipobj/IPObj";
import { IPObjGroup } from "../../ipobj/IPObjGroup";
import Model from "../../Model";
import { OpenVPN } from "../../vpn/openvpn/OpenVPN";
import { OpenVPNPrefix } from "../../vpn/openvpn/OpenVPNPrefix";
import { RoutingTable } from "../routing-table/routing-table.model";
import { RouteGroup } from "../route-group/route-group.model";
import db from "../../../database/database-manager";
import { RouteToOpenVPNPrefix } from "./route-to-openvpn-prefix.model";
import { RouteToOpenVPN } from "./route-to-openvpn.model";
import { RouteToIPObjGroup } from "./route-to-ipobj-group.model";
import { RouteToIPObj } from "./route-to-ipobj.model";

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
    route_order: number;

    @Column({
        name: 'group'
    })
    routeGroupId: number;

    @ManyToOne(type => RouteGroup, model => model.routes)
    @JoinColumn({
        name: 'group'
    })
    routeGroup: RouteGroup;

    @OneToMany(() => RouteToIPObj, model => model.route, {
        cascade: true,
    })
    routeToIPObjs: RouteToIPObj[];

    @OneToMany(() => RouteToIPObjGroup, model => model.route, {
        cascade: true,
    })
    routeToIPObjGroups: RouteToIPObjGroup[];
    
    @OneToMany(() => RouteToOpenVPN, model => model.route, {
        cascade: true,
    })
    routeToOpenVPNs: RouteToOpenVPN[];
    
    @OneToMany(() => RouteToOpenVPNPrefix, model => model.route, {
        cascade: true,
    })
    routeToOpenVPNPrefixes: RouteToOpenVPNPrefix[];

    public getTableName(): string {
        return tableName;
    }


    public static async getRouteWhichLastAddressInHost(ipobjId: number, type: number, fwcloud:number): Promise<Route[]> {
        const routeToIPObjs: RouteToIPObj[] = await getRepository(RouteToIPObj).createQueryBuilder('routeToIPObj')
            .innerJoin('routeToIPObj.ipObj', 'ipobj')
            .innerJoin('ipobj.hosts', 'interfaceIPObj')
            .innerJoin('routeToIPObj.route', 'route')
            .innerJoin('interfaceIPObj.hostInterface', 'interface')
            .innerJoin('interface.ipObjs', 'intIPObj')
            .innerJoin('route.routingTable', 'table')
            .innerJoin('table.firewall', 'firewall')
            .where('intIPObj.id = :ipobjId', {ipobjId})
            .andWhere('firewall.fwCloudId = :fwcloud', {fwcloud})  
            .getMany()

        let result: RouteToIPObj[] = [];
        
        for (let routeToIPObj of routeToIPObjs) {
            let addrs: any = await Interface.getHostAddr(db.getQuery(), routeToIPObj.ipObjId);

            // Count the amount of interface address with the same IP version of the rule.
            let n = 0;
            let id = 0;
            for (let addr of addrs) {
                n++;
                if (n === 1) id = addr.id;
            }

            // We are the last IP address in the host used in a firewall rule.
            if (n === 1 && ipobjId === id)
                result.push(routeToIPObj);
        }

        if (result.length === 0) {
            return [];
        }

        return await getRepository(Route).createQueryBuilder('route')
            .distinct()
            .addSelect('firewall.id', 'firewall_id')
            .addSelect('firewall.name', 'firewall_name')
            .addSelect('cluster.id', 'cluster_id')
            .addSelect('cluster.name', 'cluster_name')
            .addSelect('table.name', 'table_name')
            .addSelect('table.number', 'table_number')
            .innerJoin('route.routingTable', 'table')
            .innerJoin('table.firewall', 'firewall')
            .leftJoin('firewall.cluster', 'cluster')
            .whereInIds(result.map(item => item.routeId)).getRawMany();
    }

    public static async getRouteWhichLastAddressInHostInGroup(ipobjId: number, type: number, fwcloud:number): Promise<Route[]> {
        const routeToIPObjGroups: RouteToIPObjGroup[] = await getRepository(RouteToIPObjGroup).createQueryBuilder('routeToIPObjGroups')
            .innerJoinAndSelect('routeToIPObjGroups.ipObjGroup', 'ipObjGroup')
            .innerJoinAndSelect('ipObjGroup.ipObjToIPObjGroups', 'ipObjToIPObjGroups')
            .innerJoin('ipObjToIPObjGroups.ipObj', 'ipobj')
            .innerJoin('ipobj.hosts', 'interfaceIPObj')
            .innerJoin('routeToIPObjGroups.route', 'route')
            .innerJoin('interfaceIPObj.hostInterface', 'interface')
            .innerJoin('interface.ipObjs', 'intIPObj')
            .innerJoin('route.routingTable', 'table')
            .innerJoin('table.firewall', 'firewall')
            .where('intIPObj.id = :ipobjId', {ipobjId})
            .andWhere('firewall.fwCloudId = :fwcloud', {fwcloud})  
            .getMany();

        let result: RouteToIPObjGroup[] = [];
        
        for (let routeToIPObjGroup of routeToIPObjGroups) {
            for(let ipObjToIPObjGroup of routeToIPObjGroup.ipObjGroup.ipObjToIPObjGroups) {
                let addrs: any = await Interface.getHostAddr(db.getQuery(), ipObjToIPObjGroup.ipObjId);

                // Count the amount of interface address with the same IP version of the rule.
                let n = 0;
                let id = 0;
                for (let addr of addrs) {
                    n++;
                    if (n === 1) id = addr.id;
                }

                // We are the last IP address in the host used in a firewall rule.
                if (n === 1 && ipobjId === id)
                    result.push(routeToIPObjGroup);
            }
        }

        if (result.length === 0) {
            return [];
        }

        return await getRepository(Route).createQueryBuilder('route')
            .distinct()
            .addSelect('firewall.id', 'firewall_id')
            .addSelect('firewall.name', 'firewall_name')
            .addSelect('cluster.id', 'cluster_id')
            .addSelect('cluster.name', 'cluster_name')
            .addSelect('table.name', 'table_name')
            .addSelect('table.number', 'table_number')
            .innerJoin('route.routingTable', 'table')
            .innerJoin('table.firewall', 'firewall')
            .leftJoin('firewall.cluster', 'cluster')
            .whereInIds(result.map(item => item.routeId))
        .getRawMany();
    }
}