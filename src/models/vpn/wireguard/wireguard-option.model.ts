/*!
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

import { Entity, Column, ManyToOne, JoinColumn, PrimaryGeneratedColumn } from 'typeorm';
import Model from '../../Model';
import { IPObj } from '../../ipobj/IPObj';
import { WireGuard } from './WireGuard';

const tableName: string = 'wireguard_opt';

@Entity(tableName)
export class WireGuardOption extends Model {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'wireGuard' })
  wireGuardId: number;

  @Column({ name: 'ipobj' })
  ipObjId: number;

  @Column({ name: 'wireguard_cli', nullable: true })
  wireguardCliId: number;

  @Column()
  name: string;

  @ManyToOne(() => WireGuard, (wireGuard) => wireGuard.WireGuardOptions)
  @JoinColumn({
    name: 'wireGuard',
  })
  wireGuard: WireGuard;

  @ManyToOne(() => WireGuard, (wireGuard) => wireGuard.childs)
  @JoinColumn({
    name: 'wireguard_cli',
  })
  wireguardCli: WireGuard;

  @ManyToOne(() => IPObj, (ipObj) => ipObj.optionsListWireGuard)
  @JoinColumn({
    name: 'ipobj',
  })
  ipObj: IPObj;

  @Column()
  arg: string;

  @Column()
  order: number;

  @Column()
  scope: number;

  @Column()
  comment: string;

  public getTableName(): string {
    return tableName;
  }
}
