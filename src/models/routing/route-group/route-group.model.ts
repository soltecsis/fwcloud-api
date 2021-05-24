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

import { Column, Entity, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn } from "typeorm";
import { Firewall } from "../../firewall/Firewall";
import Model from "../../Model";
import { Route } from "../route/route.model";

const tableName: string = 'route_g';

@Entity(tableName)
export class RouteGroup extends Model {
    
    @PrimaryGeneratedColumn()
    id: number;

    @Column()
    name: string

    @Column()
    comment: string;

    @Column({
        name: 'firewall'
    })
    firewallId: number;

    @ManyToOne(type => Firewall, model => model.routeGroups)
    @JoinColumn({
        name: 'firewall'
    })
    firewall: Firewall;

    @OneToMany(type => Route, model => model.routeGroup, {
        eager: true
    })
    routes: Route[];

    
    public getTableName(): string {
        return tableName;
    }

    toJSON(): any {
        return this;
    } 
    
}