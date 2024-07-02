/*!
    Copyright 2024 SOLTECSIS SOLUCIONES TECNOLOGICAS, SLU
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
import Model from '../../../Model';
import { Firewall } from '../../../firewall/Firewall';
import { HAProxyRule } from '../haproxy_r/haproxy_r.model';

const tableName = 'haproxy_g';

@Entity({ name: tableName })
export class HAProxyGroup extends Model {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ name: 'firewall' })
  firewallId: number;

  @ManyToOne((type) => Firewall, (firewall) => firewall.haproxyGroups)
  @JoinColumn({ name: 'firewall' })
  firewall: Firewall;

  @Column({ type: 'varchar', length: 50 })
  style: string;

  @OneToMany((type) => HAProxyRule, (haproxy) => haproxy.group, { eager: true })
  rules: HAProxyRule[];

  public getTableName(): string {
    return tableName;
  }
}
