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
import { Column, Entity, PrimaryGeneratedColumn, ValueTransformer } from 'typeorm';

const tableName = 'audit_logs';

const pad = (value: number, size: number = 2): string => value.toString().padStart(size, '0');

export const formatAuditLogDateForDb = (date: Date): string =>
  `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())} ${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}:${pad(date.getUTCSeconds())}.${pad(date.getUTCMilliseconds(), 3)}`;

const parseAuditLogDateFromDb = (value: Date | string | null | undefined): Date | null => {
  if (value == null) {
    return null;
  }

  if (value instanceof Date) {
    return new Date(
      Date.UTC(
        value.getFullYear(),
        value.getMonth(),
        value.getDate(),
        value.getHours(),
        value.getMinutes(),
        value.getSeconds(),
        value.getMilliseconds(),
      ),
    );
  }

  const normalized = value.trim().replace(' ', 'T');
  const hasTimezone = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(normalized);
  const date = new Date(hasTimezone ? normalized : `${normalized}Z`);

  return Number.isNaN(date.getTime()) ? null : date;
};

const auditLogUtcDateTransformer: ValueTransformer = {
  to: (value: Date | string | null | undefined): string | null => {
    if (value instanceof Date) {
      return Number.isNaN(value.getTime()) ? null : formatAuditLogDateForDb(value);
    }

    return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
  },
  from: parseAuditLogDateFromDb,
};

@Entity(tableName)
export class AuditLog extends Model {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({
    type: 'datetime',
    precision: 3,
    name: 'ts',
    transformer: auditLogUtcDateTransformer,
  })
  startedAt: Date;

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
    type: 'int',
    name: 'status',
    nullable: true,
  })
  status: number | null;

  @Column({
    type: 'int',
    name: 'duration_ms',
    nullable: true,
  })
  durationMs: number | null;

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
