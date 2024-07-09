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
import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, OneToMany } from 'typeorm';
import { Firewall } from '../../../firewall/Firewall';
import { KeepalivedRule } from '../keepalived_r/keepalived_r.model';
import Model from '../../../Model';

const tableName: string = 'keepalived_g';
@Entity(tableName)
export class KeepalivedGroup extends Model {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ name: 'firewall' })
  firewallId: number;

  @ManyToOne((type) => Firewall, (firewall) => firewall.keepalivedGroups)
  @JoinColumn({
    name: 'firewall',
  })
  firewall: Firewall;

  @Column({ type: 'varchar', length: 50 })
  style: string;

  @OneToMany((type) => KeepalivedRule, (model) => model.group, {
    eager: true,
  })
  rules: KeepalivedRule[];

  public getTableName(): string {
    return tableName;
  }

  public static moveToOtherFirewall(src_firewall: number, dst_firewall: number) {
    return KeepalivedGroup.createQueryBuilder()
      .update()
      .set({ firewallId: dst_firewall })
      .where('firewallId = :src_firewall', { src_firewall })
      .execute();
  }
}
