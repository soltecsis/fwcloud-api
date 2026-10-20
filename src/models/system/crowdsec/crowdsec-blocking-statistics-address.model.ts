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

import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import Model from '../../Model';
import { CrowdSecBlockingStatistics } from './crowdsec-blocking-statistics.model';

const tableName = 'crowdsec_blocking_statistics_address';

@Entity({ name: tableName })
@Index(['address', 'statisticsId'])
export class CrowdSecBlockingStatisticsAddress extends Model {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id: string;

  @Column({ name: 'crowdsec_blocking_statistics' })
  statisticsId: string;

  @ManyToOne(() => CrowdSecBlockingStatistics, (model) => model.addresses, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'crowdsec_blocking_statistics' })
  statistics: CrowdSecBlockingStatistics;

  @Column({ type: 'varchar', length: 255 })
  address: string;

  @Column({ type: 'bigint', unsigned: true })
  packets: string;

  @Column({ type: 'bigint', unsigned: true })
  bytes: string;

  public getTableName(): string {
    return tableName;
  }
}
