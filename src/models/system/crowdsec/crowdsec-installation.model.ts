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

const tableName = 'crowdsec_installation';

export enum CrowdSecInstallationMode {
  Standalone = 'standalone',
  Machine = 'machine',
}

@Entity({ name: tableName })
@Index(['firewallId'], { unique: true })
@Index(['centralFirewallId'])
export class CrowdSecInstallation extends Model {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'firewall' })
  firewallId: number;

  @ManyToOne(() => Firewall, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'firewall' })
  firewall: Firewall;

  @Column({ type: 'varchar', length: 16 })
  mode: CrowdSecInstallationMode;

  @Column({ name: 'central_firewall', nullable: true })
  centralFirewallId: number | null;

  @ManyToOne(() => Firewall, { nullable: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'central_firewall' })
  centralFirewall?: Firewall;

  @Column({ name: 'lapi_url', type: 'varchar', length: 256, nullable: true })
  lapiUrl: string | null;

  @Column({ name: 'machine_name', type: 'varchar', length: 128, nullable: true })
  machineName: string | null;

  @Column({ name: 'local_remediation', type: 'boolean', default: false })
  localRemediation: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  public getTableName(): string {
    return tableName;
  }
}
