/*!
    Copyright 2026 SOLTECSIS SOLUCIONES TECNOLOGICAS, SLU
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
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import Model from '../../Model';
import { Firewall } from '../../firewall/Firewall';

const tableName = 'crowdsec_blocking_statistics_sampling';

@Entity({ name: tableName })
@Index(['firewallId'], { unique: true })
export class CrowdSecBlockingStatisticsSampling extends Model {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'firewall' })
  firewallId: number;

  @ManyToOne(() => Firewall, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'firewall' })
  firewall: Firewall;

  @Column({ type: 'boolean', default: false })
  enabled: boolean;

  @Column({ name: 'sampling_interval', type: 'int', unsigned: true, default: 30 })
  samplingInterval: number;

  @Column({ name: 'request_max_samples', type: 'int', unsigned: true, default: 1000 })
  requestMaxSamples: number;

  @Column({ name: 'cache_max_size', type: 'int', unsigned: true, default: 10485760 })
  cacheMaxSize: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  public getTableName(): string {
    return tableName;
  }
}
