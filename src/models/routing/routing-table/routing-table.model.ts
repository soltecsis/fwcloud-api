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

import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Firewall } from '../../firewall/Firewall';
import Model from '../../Model';
import { Route } from '../route/route.model';
import { RoutingRule } from '../routing-rule/routing-rule.model';
const tableName: string = 'routing_table';

@Entity(tableName)
export class RoutingTable extends Model {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  number: number;

  @Column()
  name: string;

  @Column()
  comment?: string;

  @Column({ name: 'firewall' })
  firewallId: number;

  @ManyToOne((type) => Firewall, (firewall) => firewall.routingTables)
  @JoinColumn({
    name: 'firewall',
  })
  firewall: Firewall;

  @OneToMany((type) => Route, (model) => model.routingTable)
  routes: Route[];

  @OneToMany((type) => RoutingRule, (model) => model.routingTable)
  routingRules: RoutingRule[];

  public getTableName(): string {
    return tableName;
  }
}
