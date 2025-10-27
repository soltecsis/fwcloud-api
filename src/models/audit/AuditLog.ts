/*
    Copyright 2025 SOLTECSIS SOLUCIONES TECNOLOGICAS, SLU
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

import Model from '../Model';
import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

const tableName = 'audit_logs';

@Entity(tableName)
export class AuditLog extends Model {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({
    type: 'datetime',
    name: 'ts',
    default: () => 'CURRENT_TIMESTAMP',
  })
  timestamp: Date;

  @Column({
    type: 'int',
    name: 'user_id',
    nullable: true,
  })
  userId: number | null;

  @Column({
    type: 'varchar',
    length: 255,
    name: 'user_name',
    nullable: true,
  })
  userName: string | null;

  @Column({
    type: 'int',
    name: 'session_id',
    nullable: true,
  })
  sessionId: number | null;

  @Column({
    type: 'varchar',
    length: 45,
    name: 'source_ip',
    nullable: true,
  })
  sourceIp: string | null;

  @Column({
    type: 'int',
    name: 'fwcloud_id',
    nullable: true,
  })
  fwCloudId: number | null;

  @Column({
    type: 'varchar',
    length: 255,
    name: 'fwcloud_name',
    nullable: true,
  })
  fwCloudName: string | null;

  @Column({
    type: 'int',
    name: 'firewall_id',
    nullable: true,
  })
  firewallId: number | null;

  @Column({
    type: 'varchar',
    length: 255,
    name: 'firewall_name',
    nullable: true,
  })
  firewallName: string | null;

  @Column({
    type: 'int',
    name: 'cluster_id',
    nullable: true,
  })
  clusterId: number | null;

  @Column({
    type: 'varchar',
    length: 255,
    name: 'cluster_name',
    nullable: true,
  })
  clusterName: string | null;

  @Column({
    type: 'varchar',
    length: 255,
    name: 'call',
  })
  call: string;

  @Column({
    type: 'longtext',
    name: 'data',
  })
  data: string;

  @Column({
    type: 'text',
    name: 'desc',
  })
  description: string;

  public getTableName(): string {
    return tableName;
  }
}
