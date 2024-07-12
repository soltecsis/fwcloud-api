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
import { Firewall } from './Firewall';
import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, OneToMany } from 'typeorm';
import { Tree } from '../tree/Tree';
import { Interface } from '../../models/interface/Interface';
import { FwCloud } from '../fwcloud/FwCloud';
import { logger } from '../../fonaments/abstract-application';
import Query from '../../database/Query';

const tableName: string = 'cluster';

@Entity(tableName)
export class Cluster extends Model {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  @Column()
  comment: string;

  @Column()
  created_at: Date;

  @Column()
  updated_at: Date;

  @Column()
  created_by: number;

  @Column()
  updated_by: number;

  @Column({ name: 'fwcloud' })
  fwCloudId: number;

  @ManyToOne((type) => FwCloud, (fwcloud) => fwcloud.clusters)
  @JoinColumn({
    name: 'fwcloud',
  })
  fwCloud: FwCloud;

  @OneToMany((type) => Firewall, (firewall) => firewall.cluster)
  firewalls: Array<Firewall>;

  public getTableName(): string {
    return tableName;
  }

  //Get All clusters
  public static getClusterCloud(req) {
    return new Promise((resolve, reject) => {
      const sql = `SELECT T.* FROM ${tableName} T 
                INNER JOIN user__fwcloud U ON T.fwcloud=U.fwcloud AND U.user=${req.session.user_id}
                WHERE T.fwcloud=${req.body.fwcloud}`;
      req.dbCon.query(sql, (error, rows) => {
        if (error) return reject(error);
        resolve(rows);
      });
    });
  }

  //Get FULL cluster by  id
  public static getCluster(req): Promise<void> {
    return new Promise((resolve, reject) => {
      const sql =
        'SELECT * FROM ' +
        tableName +
        ' WHERE id = ' +
        req.dbCon.escape(req.body.cluster) +
        ' AND fwcloud=' +
        req.dbCon.escape(req.body.fwcloud);
      req.dbCon.query(sql, (error, row) => {
        if (error) return reject(error);
        if (row && row.length > 0) {
          const dataCluster = row[0];
          //SEARCH FIREWALL NODES
          Firewall.getFirewallCluster(req.session.user_id, req.body.cluster, (error, dataFw) => {
            if (error) return reject(error);
            //get data
            if (dataFw && dataFw.length > 0) {
              dataCluster.nodes = dataFw;
              //SEARCH INTERFACES FW-MASTER
              Firewall.getFirewallClusterMaster(
                req.session.user_id,
                req.body.cluster,
                (error, dataFwM) => {
                  if (error) return reject(error);
                  if (dataFwM && dataFwM.length > 0) {
                    const idFwMaster = dataFwM[0].id;
                    Interface.getInterfacesFull(idFwMaster, req.body.fwcloud, (error, dataI) => {
                      if (error) return reject(error);
                      if (dataI && dataI.length > 0) {
                        dataCluster.interfaces = dataI;
                      } else dataCluster.interfaces = [];
                      resolve(dataCluster);
                    });
                  } else resolve(dataCluster);
                },
              );
            } else {
              dataCluster.nodes = [];
              resolve(dataCluster);
            }
          });
        } else resolve();
      });
    });
  }

  //Get clusters by name
  public static getClusterName = (name: string, callback: Function) => {
    db.get((error, connection) => {
      if (error) callback(error, null);
      const sql =
        'SELECT * FROM ' + tableName + ' WHERE name like  "%' + connection.escape(name) + '%"';
      connection.query(sql, (error, row) => {
        if (error) callback(error, null);
        else callback(null, row);
      });
    });
  };

  //Add new cluster
  public static async insertCluster(clusterData) {
    return new Promise((resolve, reject) => {
      db.get((error, connection) => {
        if (error) return reject(error);
        connection.query(`INSERT INTO ${tableName} SET ?`, clusterData, (error, result) => {
          if (error) return reject(error);
          resolve(result.insertId);
        });
      });
    });
  }

  //Update cluster
  public static updateCluster(dbCon: Query, fwcloud: number, clusterData): Promise<void> {
    return new Promise((resolve, reject) => {
      let sql = `UPDATE ${tableName} SET name=${dbCon.escape(clusterData.name)}, comment=${dbCon.escape(clusterData.comment)}, plugins=${dbCon.escape(clusterData.plugins)}
                WHERE id=${clusterData.id} AND fwcloud=${fwcloud}`;
      dbCon.query(sql, (error) => {
        if (error) return reject(error);

        sql = `UPDATE firewall SET status=status|3, options=${clusterData.options}
                    WHERE cluster=${clusterData.id} AND fwcloud=${fwcloud}`;
        dbCon.query(sql, (error) => {
          if (error) return reject(error);
          resolve();
        });
      });
    });
  }

  //Remove cluster with id to remove
  public static deleteClusterSimple(
    id: number,
    iduser: number,
    fwcloud: number,
    callback: Function,
  ) {
    db.get((error, connection) => {
      if (error) callback(error, null);
      logger().debug('------>>>> DELETING CLUSTER: ', id);
      const sqlExists =
        'SELECT T.* , A.id as idnode FROM ' +
        tableName +
        ' T ' +
        ' INNER JOIN fwc_tree A ON A.id_obj = T.id AND A.obj_type=100 ' +
        ' WHERE T.id = ' +
        connection.escape(id);
      logger().debug('SQL DELETE CLUSTER: ', sqlExists);
      connection.query(sqlExists, (error, row) => {
        //If exists Id from cluster to remove
        if (row.length > 0) {
          const dataNode = {
            id: row[0].idnode,
            fwcloud: fwcloud,
            iduser: iduser,
          };
          void Tree.deleteFwc_TreeFullNode(dataNode).then(() => {
            db.get((error, connection) => {
              const sql = 'DELETE FROM ' + tableName + ' WHERE id = ' + connection.escape(id);
              connection.query(sql, (error) => {
                if (error) {
                  callback(error, null);
                } else {
                  callback(null, { result: true });
                }
              });
            });
          });
        } else {
          callback(null, { result: false });
        }
      });
    });
  }
}
