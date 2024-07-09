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

import Model from '../Model';
import { Entity, PrimaryGeneratedColumn, Column, OneToMany, ManyToOne, JoinColumn } from 'typeorm';
import { FwCloud } from '../fwcloud/FwCloud';
import { IPObjType } from '../ipobj/IPObjType';

const tableName: string = 'fwc_tree';

@Entity(tableName)
export class FwcTree extends Model {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  @Column()
  node_order: number;

  @Column()
  node_type: string;

  @Column({ name: 'id_parent' })
  parentId: number;

  @Column()
  id_obj: number;

  @Column({ name: 'obj_type' })
  ipObjTypeId: number;

  @Column({ name: 'fwcloud' })
  fwCloudId: number;

  @ManyToOne((type) => FwCloud, (fwcloud) => fwcloud.fwcTrees)
  @JoinColumn({
    name: 'fwcloud',
  })
  fwCloud: FwCloud;

  @ManyToOne((type) => FwcTree, (fwcTree) => fwcTree.childs)
  @JoinColumn({
    name: 'id_parent',
  })
  parent: FwcTree;

  @OneToMany((type) => FwcTree, (fwcTree) => fwcTree.parent)
  childs: Array<FwcTree>;

  @ManyToOne((type) => IPObjType, (ipObjType) => ipObjType.fwcTrees)
  @JoinColumn({
    name: 'obj_type',
  })
  ipObjType: IPObjType;

  public getTableName(): string {
    return tableName;
  }
}
