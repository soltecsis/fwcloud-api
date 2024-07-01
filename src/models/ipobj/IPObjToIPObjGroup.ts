/*
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
import db from '../../database/database-manager';
import {
  PrimaryGeneratedColumn,
  Column,
  getRepository,
  Entity,
  Repository,
  ManyToOne,
  JoinTable,
  JoinColumn,
} from 'typeorm';
import { IPObjGroup } from './IPObjGroup';
import { app } from '../../fonaments/abstract-application';
import { IPObj } from './IPObj';

const tableName: string = 'ipobj__ipobjg';

@Entity(tableName)
export class IPObjToIPObjGroup extends Model {
  @PrimaryGeneratedColumn({ name: 'id_gi' })
  id: number;

  @Column({ name: 'ipobj_g' })
  ipObjGroupId: number;

  @Column({ name: 'ipobj' })
  ipObjId: number;

  @Column()
  created_at: Date;

  @Column()
  updated_at: Date;

  @Column()
  created_by: number;

  @Column()
  updated_by: number;

  @ManyToOne((type) => IPObj, (ipObj) => ipObj.ipObjToIPObjGroups)
  @JoinColumn({
    name: 'ipobj',
  })
  ipObj!: IPObj;

  @ManyToOne(
    (type) => IPObjGroup,
    (ipObjGroup) => ipObjGroup.ipObjToIPObjGroups,
  )
  @JoinColumn({
    name: 'ipobj_g',
  })
  ipObjGroup!: IPObjGroup;

  public getTableName(): string {
    return tableName;
  }

  //Add new ipobj__ipobjg
  public static insertIpobj__ipobjg(req) {
    return new Promise((resolve, reject) => {
      const ipobj__ipobjgData = {
        ipobj_g: req.body.ipobj_g,
        ipobj: req.body.ipobj,
      };
      req.dbCon.query(
        `INSERT INTO ${tableName} SET ?`,
        ipobj__ipobjgData,
        (error, result) => {
          if (error) return reject(error);
          resolve(result.insertId);
        },
      );
    });
  }

  //FALTA comprobar si el Grupo está en alguna Regla
  //Remove ipobj__ipobjg with id to remove
  public static deleteIpobj__ipobjg(dbCon, ipobj_g, ipobj): Promise<void> {
    return new Promise((resolve, reject) => {
      const sql = `DELETE FROM ${tableName} WHERE ipobj_g=${ipobj_g} AND ipobj=${ipobj}`;
      dbCon.query(sql, (error, result) => {
        if (error) return reject(error);
        resolve();
      });
    });
  }

  //Remove ipobj__ipobjg with id to remove
  public static deleteIpobj__ipobjgAll(dbCon, ipobj_g): Promise<void> {
    return new Promise((resolve, reject) => {
      dbCon.query(
        `DELETE FROM ${tableName} WHERE ipobj_g=${ipobj_g}`,
        (error, result) => {
          if (error) return reject(error);

          dbCon.query(
            `DELETE FROM openvpn_prefix__ipobj_g WHERE ipobj_g=${ipobj_g}`,
            (error, result) => {
              if (error) return reject(error);

              dbCon.query(
                `DELETE FROM openvpn__ipobj_g WHERE ipobj_g=${ipobj_g}`,
                (error, result) => {
                  if (error) return reject(error);
                  resolve();
                },
              );
            },
          );
        },
      );
    });
  }

  //check if IPOBJ Exists in GROUP
  public static searchIpobjInGroup(ipobj, type, fwcloud) {
    return new Promise((resolve, reject) => {
      db.get((error, connection) => {
        if (error) return reject(error);
        const sql = `SELECT I.id obj_id,I.name obj_name, I.type obj_type_id,T.type obj_type_name,
                    C.id cloud_id, C.name cloud_name, GR.id group_id, GR.name group_name, GR.type group_type
                    FROM ${tableName} G
                    INNER JOIN ipobj_g GR ON GR.id=G.ipobj_g
                    INNER JOIN  ipobj I on I.id=G.ipobj
                    inner join ipobj_type T on T.id=I.type
                    left join fwcloud C on C.id=I.fwcloud
                    WHERE I.id=${ipobj} AND I.type=${type} AND (I.fwcloud=${fwcloud} OR I.fwcloud IS NULL)`;
        connection.query(sql, (error, rows) => {
          if (error) return reject(error);
          resolve(rows);
        });
      });
    });
  }

  //check if addr host exists in a group
  public static searchAddrHostInGroup(dbCon, fwcloud, host) {
    return new Promise((resolve, reject) => {
      const sql = `SELECT I.id obj_id,I.name obj_name, I.type obj_type_id,T.type obj_type_name,
                C.id cloud_id, C.name cloud_name, GR.id group_id, GR.name group_name, GR.type group_type
                FROM ${tableName} G
                INNER JOIN ipobj_g GR ON GR.id=G.ipobj_g
                INNER JOIN ipobj I on I.id=G.ipobj
                inner join ipobj_type T on T.id=I.type
                inner join fwcloud C on C.id=I.fwcloud
                inner join interface__ipobj II on II.interface=I.interface
                WHERE II.ipobj=${host} AND I.type=5 AND I.fwcloud=${fwcloud}`;
      dbCon.query(sql, (error, rows) => {
        if (error) return reject(error);
        resolve(rows);
      });
    });
  }
}
