/*!
    Copyright 2019 SOLTECSIS SOLUCIONES TECNOLOGICAS, SLU
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

import Model from "../Model";
import { Firewall } from "../firewall/Firewall";
import { ManyToOne, JoinColumn, PrimaryGeneratedColumn, Column, OneToMany, Entity } from "typeorm";
import { RoutingRule } from "./routing-rule.model";

const tableName: string = 'routing_g';

@Entity(tableName)
export class RoutingGroup extends Model {

    @PrimaryGeneratedColumn()
    id: number;

    @Column()
    name: string;

    @Column()
    comment: string;

    @Column({name: 'idgroup'})
    parentId: number;

    @Column()
    created_at: Date;

    @Column()
    updated_at: Date;

    @Column()
    created_by: number;

    @Column()
    updated_by: number;

    @Column({name: 'firewall'})
    firewallId: number;
    
    @ManyToOne(type => Firewall, firewall => firewall.routingRules)
    @JoinColumn({
        name: 'firewall'
    })
    firewall: Firewall;

    /**
    * Pending foreign keys.
    @ManyToOne(type => RoutingGroup, model => model.childs)
    @JoinColumn({
        name: 'idgroup'
    })
    parent: RoutingGroup;

    @OneToMany(type => RoutingGroup, model => model.parent)
    childs: Array<RoutingGroup>;
    */

    @OneToMany(type => RoutingRule, routingRule => routingRule.routingGroup)
    routingRules: Array<RoutingRule>;

    public getTableName(): string {
        return tableName;
    }

}