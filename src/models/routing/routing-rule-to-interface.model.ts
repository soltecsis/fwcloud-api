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
import { PrimaryColumn, Column, ManyToOne, JoinColumn, Entity } from "typeorm";
import { Interface } from "../interface/Interface";
import { RoutingRule } from "./routing-rule.model";

const tableName: string = 'routing_r__interface';

@Entity(tableName)
export class RoutingRuleToInterface extends Model {

    @PrimaryColumn({name: 'rule'})
    routingRuleId: number;

    @PrimaryColumn({name: 'interface'})
    interfaceId: number;

    @Column()
    interface_order: string;

    @Column()
    created_at: Date;

    @Column()
    updated_at: Date;

    @Column()
    created_by: number;

    @Column()
    updated_by: number;

    
    @ManyToOne(type => Interface, _interface => _interface.routingRuleToInterfaces)
    @JoinColumn({
        name: 'interface'
    })
    routingRuleInterface: Interface;

    @ManyToOne(type => RoutingRule, policyRule => policyRule.routingRuleToInterfaces)
    @JoinColumn({
        name: 'rule'
    })
    routingRule: RoutingRule;


    public getTableName(): string {
        return tableName;
    }

}