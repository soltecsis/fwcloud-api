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

import { Entity, PrimaryGeneratedColumn, Column, ManyToMany, ManyToOne, JoinTable, JoinColumn, OneToMany } from "typeorm";
import Model from "../Model";
import { Firewall } from "../firewall/Firewall";
import { RoutingGroup } from "./routing-group.model";
import { RoutingRuleToIPObj } from "./routing-rule-to-ipobj.model";
import { RoutingRuleToInterface } from "./routing-rule-to-interface.model";

const tableName: string = 'routing_r';

@Entity(tableName)
export class RoutingRule extends Model {
    
    @PrimaryGeneratedColumn()
    id: number;

    @Column({name: 'idgroup'})
    routingGroupId: number;

    @Column({name: 'firewall'})
    firewallId: number;

    @Column()
    rule_order: number;

    @Column()
    metric: number;

    @Column()
    options: string;

    @Column()
    comment: string;

    @Column()
    active: number;

    @Column()
    created_at: Date;

    @Column()
    updated_at: Date;

    @Column()
    created_by: number;

    @Column()
    updated_by: number;

    @ManyToOne(type => RoutingGroup, routingGroup => routingGroup.routingRules)
    @JoinColumn({
        name: 'idgroup'
    })
    routingGroup: Array<RoutingGroup>;

    @OneToMany(type => RoutingRuleToIPObj, routingRuleToIPObj => routingRuleToIPObj.routingRule)
    routingRuleToIPObjs!: Array<RoutingRuleToIPObj>;

    @OneToMany(type => RoutingRuleToInterface, routingRuleToInterface => routingRuleToInterface.routingRule)
    routingRuleToInterfaces!: Array<RoutingRuleToInterface>;

    @ManyToOne(type => Firewall, firewall => firewall.routingRules)
    @JoinColumn({
        name: 'firewall'
    })
    firewall: Firewall;

    public getTableName(): string {
        return tableName;
    }

}