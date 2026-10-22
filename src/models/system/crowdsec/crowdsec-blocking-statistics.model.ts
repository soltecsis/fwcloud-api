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
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import Model from '../../Model';
import { Firewall } from '../../firewall/Firewall';
import { CrowdSecBlockingStatisticsAddress } from './crowdsec-blocking-statistics-address.model';

const tableName = 'crowdsec_blocking_statistics';

@Entity({ name: tableName })
@Index(['firewallId', 'collectedAt'])
@Index(['firewallId', 'policyGeneration', 'collectedAt'])
export class CrowdSecBlockingStatistics extends Model {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id: string;

  @Column({ name: 'firewall' })
  firewallId: number;

  @ManyToOne(() => Firewall, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'firewall' })
  firewall: Firewall;

  @Column({ name: 'collected_at', type: 'datetime', precision: 3 })
  collectedAt: Date;

  @Column({ name: 'policy_generation', type: 'bigint', unsigned: true })
  policyGeneration: string;

  @Column({ name: 'ipv4_input_packets', type: 'bigint', unsigned: true })
  ipv4InputPackets: string;

  @Column({ name: 'ipv4_input_bytes', type: 'bigint', unsigned: true })
  ipv4InputBytes: string;

  @Column({ name: 'ipv4_forward_packets', type: 'bigint', unsigned: true })
  ipv4ForwardPackets: string;

  @Column({ name: 'ipv4_forward_bytes', type: 'bigint', unsigned: true })
  ipv4ForwardBytes: string;

  @Column({ name: 'ipv6_input_packets', type: 'bigint', unsigned: true })
  ipv6InputPackets: string;

  @Column({ name: 'ipv6_input_bytes', type: 'bigint', unsigned: true })
  ipv6InputBytes: string;

  @Column({ name: 'ipv6_forward_packets', type: 'bigint', unsigned: true })
  ipv6ForwardPackets: string;

  @Column({ name: 'ipv6_forward_bytes', type: 'bigint', unsigned: true })
  ipv6ForwardBytes: string;

  @OneToMany(() => CrowdSecBlockingStatisticsAddress, (model) => model.statistics)
  addresses: CrowdSecBlockingStatisticsAddress[];

  public getTableName(): string {
    return tableName;
  }
}
