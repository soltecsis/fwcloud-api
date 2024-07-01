/*!
    Copyright 2019 SOLTECSIS SOLUCIONES TECNOLOGICAS, SLU
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
  Entity,
  PrimaryColumn,
  Column,
  ManyToOne,
  JoinTable,
  ManyToMany,
  JoinColumn,
  OneToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import Model from '../../Model';
import { IPObj } from '../../ipobj/IPObj';
import { OpenVPN } from './OpenVPN';

const tableName: string = 'openvpn_opt';

@Entity(tableName)
export class OpenVPNOption extends Model {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'openvpn' })
  openVPNId: number;

  @Column({ name: 'ipobj' })
  ipObjId: number;

  @Column()
  name: string;

  @ManyToOne((type) => OpenVPN, (openVPN) => openVPN.openVPNOptions)
  @JoinColumn({
    name: 'openvpn',
  })
  openVPN: OpenVPN;

  @ManyToOne((type) => IPObj, (ipObj) => ipObj.optionsList)
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
