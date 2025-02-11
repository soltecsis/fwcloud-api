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
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToMany,
  JoinTable,
  OneToMany,
  ManyToOne,
  AfterRemove,
  AfterInsert,
  RemoveOptions,
  QueryRunner,
} from 'typeorm';
import db from '../../database/database-manager';
import * as path from 'path';
import * as fs from 'fs-extra';
import { User } from '../../models/user/User';
import { app, logger } from '../../fonaments/abstract-application';
import { Ca } from '../vpn/pki/Ca';
import { Cluster } from '../firewall/Cluster';
import { Firewall } from '../firewall/Firewall';
import { FwcTree } from '../tree/fwc-tree.model';
import { IPObj } from '../ipobj/IPObj';
import { Mark } from '../ipobj/Mark';
import { FSHelper } from '../../utils/fs-helper';
import { IPObjGroup } from '../ipobj/IPObjGroup';

const tableName: string = 'fwcloud';

export interface Lock {
  access: boolean;
  locked: boolean;
  locked_at: string;
  locked_by: number;
  mylock: boolean;
}

@Entity(tableName)
export class FwCloud extends Model {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  @Column()
  created_at: Date;

  @Column()
  updated_at: Date;

  @Column()
  created_by: Date;

  @Column()
  updated_by: Date;

  @Column()
  locked_at: Date;

  @Column()
  locked_by: string;

  @Column()
  locked: boolean;

  @Column()
  image: string;

  @Column()
  comment: string;

  @ManyToMany((type) => User, (user) => user.fwClouds)
  @JoinTable({
    name: 'user__fwcloud',
    joinColumn: { name: 'fwcloud' },
    inverseJoinColumn: { name: 'user' },
  })
  users: Array<User>;

  @OneToMany((type) => Ca, (ca) => ca.fwCloud)
  cas: Array<Ca>;

  @OneToMany((type) => Cluster, (cluster) => cluster.fwCloud)
  clusters: Array<Cluster>;

  @OneToMany((type) => Firewall, (firewall) => firewall.fwCloud)
  firewalls: Array<Firewall>;

  @OneToMany((type) => FwcTree, (fwcTree) => fwcTree.fwCloud)
  fwcTrees: Array<FwcTree>;

  @OneToMany((type) => IPObj, (ipobj) => ipobj.fwCloud)
  ipObjs: Array<IPObj>;

  @OneToMany((type) => IPObjGroup, (ipObjGroup) => ipObjGroup.fwCloud)
  ipObjGroups: Array<IPObjGroup>;

  @OneToMany((type) => Mark, (mark) => mark.fwCloud)
  marks: Array<Mark>;

  public getTableName(): string {
    return tableName;
  }

  @AfterRemove()
  public removeDataDirectories() {
    FSHelper.rmDirectorySync(this.getPkiDirectoryPath());
    FSHelper.rmDirectorySync(this.getPolicyDirectoryPath());
    FSHelper.rmDirectorySync(this.getSnapshotDirectoryPath());
  }

  @AfterInsert()
  async createDataDirectories() {
    // Make sure that doesn't exists any data directory of the just created FWCloud.
    this.removeDataDirectories();
    fs.mkdirpSync(this.getPkiDirectoryPath());
    fs.mkdirpSync(this.getPolicyDirectoryPath());
    fs.mkdirpSync(this.getSnapshotDirectoryPath());
  }

  /**
   * Removes all fwcloud trees
   *
   */
  public async removeTrees(queryRunner: QueryRunner): Promise<void> {
    const sqls: string[] = [];
    try {
      // Root nodes.
      let nodes = await queryRunner.query(
        `select id from fwc_tree where fwcloud=${this.id} and id_parent is null`,
      );

      // Next levels nodes.
      while (nodes.length > 0) {
        sqls.unshift(`delete from fwc_tree where id in (${nodes.map((obj) => obj.id)})`);
        nodes = await queryRunner.query(
          `select id from fwc_tree where id_parent in (${nodes.map((obj) => obj.id)})`,
        );
      }

      // Run queries removing node trees from down up to root nodes.
      for (let i = 0; i < sqls.length; i++) await queryRunner.query(sqls[i]);

      return;
    } catch (error) {
      console.error('Error in removeTrees:', error);
      throw error; // Re-throw the error after logging it
    }
  }

  public async remove(options?: RemoveOptions): Promise<this> {
    const queryRunner: QueryRunner = db.getQueryRunner();
    await queryRunner.connect();
    try {
      await queryRunner.startTransaction();

      // WARNING: Don't use 'SET FOREIGN_KEY_CHECKS=0' and 'SET FOREIGN_KEY_CHECKS=1'
      // This way we make sure that the delete procedure follows the referential integrity of the data base and
      // avoid left rows without correct relations in a table.

      // First remove the Firewall, Objects, Services and CA trees.
      await this.removeTrees(queryRunner);

      const queries = [
        // First remove the relational tables for policy rules and the policy rules themselves.
        `delete PI from policy_r__interface PI inner join policy_r RULE on RULE.id=PI.rule inner join firewall FW on FW.id=RULE.firewall where FW.fwcloud=${this.id};`,
        `delete PO from policy_r__ipobj PO inner join policy_r RULE on RULE.id=PO.rule inner join firewall FW on FW.id=RULE.firewall where FW.fwcloud=${this.id};`,
        `delete PVPN from policy_r__openvpn PVPN inner join policy_r RULE on RULE.id=PVPN.rule inner join firewall FW on FW.id=RULE.firewall where FW.fwcloud=${this.id};`,
        `delete PPRE from policy_r__openvpn_prefix PPRE inner join policy_r RULE on RULE.id=PPRE.rule inner join firewall FW on FW.id=RULE.firewall where FW.fwcloud=${this.id};`,
        `delete RULE from policy_r RULE inner join firewall FW on FW.id=RULE.firewall where FW.fwcloud=${this.id};`,
        `delete PG from policy_g PG inner join firewall FW on FW.id=PG.firewall where FW.fwcloud=${this.id};`,

        // Next the routing policy rules.
        `delete RRO from routing_r__ipobj RRO inner join routing_r RULE on RULE.id=RRO.rule inner join routing_table RT on RT.id=RULE.routing_table inner join firewall FW on FW.id=RT.firewall where FW.fwcloud=${this.id};`,
        `delete RROG from routing_r__ipobj_g RROG inner join routing_r RULE on RULE.id=RROG.rule inner join routing_table RT on RT.id=RULE.routing_table inner join firewall FW on FW.id=RT.firewall where FW.fwcloud=${this.id};`,
        `delete RRVPN from routing_r__openvpn RRVPN inner join routing_r RULE on RULE.id=RRVPN.rule inner join routing_table RT on RT.id=RULE.routing_table inner join firewall FW on FW.id=RT.firewall where FW.fwcloud=${this.id};`,
        `delete RRPRE from routing_r__openvpn_prefix RRPRE inner join routing_r RULE on RULE.id=RRPRE.rule inner join routing_table RT on RT.id=RULE.routing_table inner join firewall FW on FW.id=RT.firewall where FW.fwcloud=${this.id};`,
        `delete RRM from routing_r__mark RRM inner join routing_r RULE on RULE.id=RRM.rule inner join routing_table RT on RT.id=RULE.routing_table inner join firewall FW on FW.id=RT.firewall where FW.fwcloud=${this.id};`,
        `delete RR from routing_r RR inner join routing_table RT on RT.id=RR.routing_table inner join firewall FW on FW.id=RT.firewall where FW.fwcloud=${this.id};`,
        `delete RRG from routing_g RRG inner join firewall FW on FW.id=RRG.firewall where FW.fwcloud=${this.id};`,

        // Next the routing tables.
        `delete RO from route__ipobj RO inner join route ROUTE on ROUTE.id=RO.route inner join routing_table RT on RT.id=ROUTE.routing_table inner join firewall FW on FW.id=RT.firewall where FW.fwcloud=${this.id};`,
        `delete ROG from route__ipobj_g ROG inner join route ROUTE on ROUTE.id=ROG.route inner join routing_table RT on RT.id=ROUTE.routing_table inner join firewall FW on FW.id=RT.firewall where FW.fwcloud=${this.id};`,
        `delete RVPN from route__openvpn RVPN inner join route ROUTE on ROUTE.id=RVPN.route inner join routing_table RT on RT.id=ROUTE.routing_table inner join firewall FW on FW.id=RT.firewall where FW.fwcloud=${this.id};`,
        `delete RPRE from route__openvpn_prefix RPRE inner join route ROUTE on ROUTE.id=RPRE.route inner join routing_table RT on RT.id=ROUTE.routing_table inner join firewall FW on FW.id=RT.firewall where FW.fwcloud=${this.id};`,
        `delete ROUTE from route ROUTE inner join routing_table RT on RT.id=ROUTE.routing_table inner join firewall FW on FW.id=RT.firewall where FW.fwcloud=${this.id};`,
        `delete RT from routing_table RT inner join firewall FW on FW.id=RT.firewall where FW.fwcloud=${this.id};`,
        `delete RG from route_g RG inner join firewall FW on FW.id=RG.firewall where FW.fwcloud=${this.id};`,

        //Delete DHCP Rules
        `delete DHCPIPOBJ from dhcp_r__ipobj DHCPIPOBJ inner join dhcp_r RULE on RULE.id=DHCPIPOBJ.rule inner join firewall FW on FW.id=RULE.firewall where FW.fwcloud=${this.id};`,
        `delete DHCPR from dhcp_r DHCPR inner join firewall FW on FW.id=DHCPR.firewall where FW.fwcloud=${this.id};`,
        `delete DHCPG from dhcp_g DHCPG inner join firewall FW on FW.id=DHCPG.firewall where FW.fwcloud=${this.id};`,

        //Delete Keepalived Rules
        `delete KEEPALIVEDIPOBJ from keepalived_r__ipobj KEEPALIVEDIPOBJ inner join keepalived_r RULE on RULE.id=KEEPALIVEDIPOBJ.rule inner join firewall FW on FW.id=RULE.firewall where FW.fwcloud=${this.id};`,
        `delete KEEPALIVEDR from keepalived_r KEEPALIVEDR inner join firewall FW on FW.id=KEEPALIVEDR.firewall where FW.fwcloud=${this.id};`,
        `delete KEEPALIVEDRG from keepalived_g KEEPALIVEDRG inner join firewall FW on FW.id=KEEPALIVEDRG.firewall where FW.fwcloud=${this.id};`,

        //Delete HAProxy groups and rules
        `delete HAPROXYIPOBJ from haproxy_r__ipobj HAPROXYIPOBJ inner join haproxy_r RULE on RULE.id=HAPROXYIPOBJ.rule inner join firewall FW on FW.id=RULE.firewall where FW.fwcloud=${this.id};`,
        `delete HAPROXYR from haproxy_r HAPROXYR inner join firewall FW on FW.id=HAPROXYR.firewall where FW.fwcloud=${this.id};`,
        `delete HAPROXYG from haproxy_g HAPROXYG inner join firewall FW on FW.id=HAPROXYG.firewall where FW.fwcloud=${this.id};`,

        // Next the OpenVPN entities of the database.
        `delete OPT from openvpn_opt OPT inner join openvpn VPN on VPN.id=OPT.openvpn inner join firewall FW On FW.id=VPN.firewall where FW.fwcloud=${this.id};`,
        `delete VPN from openvpn__ipobj_g VPN inner join ipobj_g G on G.id=VPN.ipobj_g where G.fwcloud=${this.id};`,
        `delete PRE from openvpn_prefix__ipobj_g PRE inner join ipobj_g G on G.id=PRE.ipobj_g where G.fwcloud=${this.id};`,
        `delete PRE from openvpn_prefix PRE inner join openvpn VPN on VPN.id=PRE.openvpn inner join firewall FW on FW.id=VPN.firewall where FW.fwcloud=${this.id};`,
        `delete VPN from openvpn VPN inner join firewall FW on FW.id=VPN.firewall where VPN.openvpn is not null and FW.fwcloud=${this.id};`,
        `delete VPN from openvpn VPN inner join firewall FW on FW.id=VPN.firewall where FW.fwcloud=${this.id};`,

        // Now the PKI entities.
        `delete CRT from crt CRT inner join ca CA on CA.id=CRT.ca where CA.fwcloud=${this.id};`,
        `delete PRE from ca_prefix PRE inner join ca CA on CA.id=PRE.ca where CA.fwcloud=${this.id};`,
        `delete from ca where fwcloud=${this.id};`,

        // Object groups.
        `delete OG from ipobj__ipobjg OG inner join ipobj_g G on G.id=OG.ipobj_g where G.fwcloud=${this.id};`,
        `delete from ipobj_g where fwcloud=${this.id};`,

        // Host interfaces IPs and hosts interfaces.
        `delete OBJ from interface__ipobj II inner join interface I on I.id=II.interface inner join ipobj OBJ on OBJ.interface=I.id where OBJ.fwcloud=${this.id};`,
        `delete II from interface__ipobj II inner join ipobj OBJ on OBJ.id=II.ipobj where OBJ.fwcloud=${this.id};`,
        `delete from interface where firewall is null and id not in (select interface from interface__ipobj);`,

        // IP objects.
        `delete from ipobj where fwcloud=${this.id};`,
        `delete from mark where fwcloud=${this.id};`,

        // Firewall interfaces.
        `delete I from interface I inner join firewall FW on FW.id=I.firewall where FW.fwcloud=${this.id};`,

        // Clusters and firewalls.
        `delete from firewall where fwcloud=${this.id};`,
        `delete from cluster where fwcloud=${this.id};`,

        // Users access to this fwcloud.
        `delete from user__fwcloud where fwcloud=${this.id};`,

        // Remove the fwcloud itself.
        `delete from fwcloud where id=${this.id};`,
      ];

      for (const query of queries) {
        await queryRunner.query(query);
      }

      await queryRunner.commitTransaction();

      // The @AfterRemove() decorator is not working, for this reason here we must invoke the removeDataDirectories();
      this.removeDataDirectories();
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }

    return;
  }

  /**
   * Returns the fwcloud PKI data directory
   *
   * @return {string}
   */
  public getPkiDirectoryPath(): string {
    if (this.id) {
      return path.join(app().config.get('pki').data_dir, this.id.toString());
    }

    return null;
  }

  /**
   * Returns the fwcloud Policy data directory
   *
   * @return {string}
   */
  public getPolicyDirectoryPath(): string {
    if (this.id) {
      return path.join(app().config.get('policy').data_dir, this.id.toString());
    }

    return null;
  }

  /**
   * Returns the fwcloud snapshot directory
   *
   * @return {string}
   */
  public getSnapshotDirectoryPath(): string {
    if (this.id) {
      return path.join(app().config.get('snapshot').data_dir, this.id.toString());
    }

    return null;
  }

  /**
   * Get Fwcloud by User
   *
   * @method getFwcloud
   *
   * @param {Integer} iduser User identifier
   * @param {Function} callback    Function callback response
   *
   *       callback(error, Rows)
   *
   * @return {ARRAY of Fwcloud objects} Returns `ARRAY OBJECT FWCLOUD DATA`
   *
   * Table: __fwcloud__
   *
   *           id	int(11) AI PK
   *           cluster	int(11)
   *           fwcloud	int(11)
   *           name	varchar(255)
   *           comment	longtext
   *           created_at	datetime
   *           updated_at	datetime
   *           by_user	int(11)
   */
  public static getFwclouds(dbCon, user): Promise<FwCloud[]> {
    return new Promise((resolve, reject) => {
      const sql = `SELECT DISTINCT C.* FROM ${tableName} C
				INNER JOIN user__fwcloud U ON C.id=U.fwcloud
				WHERE U.user=${user} ORDER BY C.name`;
      dbCon.query(sql, (error, rows) => {
        if (error) return reject(error);
        resolve(rows);
      });
    });
  }

  /**
   * Get Fwcloud by User and ID
   *
   * @method getFwcloud
   *
   * @param {Integer} iduser User identifier
   * @param {Integer} id fwcloud identifier
   * @param {Function} callback    Function callback response
   *
   *       callback(error, Rows)
   *
   * @return {Fwcloud object} Returns `OBJECT FWCLOUD DATA`
   *
   * Table: __fwcloud__
   *
   *           id	int(11) AI PK
   *           cluster	int(11)
   *           fwcloud	int(11)
   *           name	varchar(255)
   *           comment	longtext
   *           created_at	datetime
   *           updated_at	datetime
   *           by_user	int(11)
   */
  public static getFwcloud(iduser, fwcloud, callback) {
    db.get((error, connection) => {
      if (error) callback(error, null);

      const sql = `
        SELECT DISTINCT C.* 
        FROM ${tableName} C  
        INNER JOIN user__fwcloud U ON C.id=U.fwcloud 
        WHERE U.user=? 
        AND C.id=?
      `;
      connection.query(sql, [iduser, fwcloud], (error, row) => {
        if (error) callback(error, null);
        else callback(null, row);
      });
    });
  }

  /**
   * Get Fwcloud Access by Locked
   *
   * @method getFwcloudLockedAccess
   *
   * @param {Integer} iduser User identifier
   * @param {Integer} fwcloud fwcloud identifier
   * @param {Function} callback    Function callback response
   *
   *       callback(error, Rows)
   *
   * @return {Boolean} Returns `LOCKED STATUS`
   *
   */
  public static getFwcloudAccess(iduser, fwcloud, lock_session_id): Promise<Lock> {
    return new Promise((resolve, reject) => {
      db.get((error, connection) => {
        if (error) return reject(false);
        const sql = `
          SELECT DISTINCT C.* 
          FROM ${tableName} C 
          INNER JOIN user__fwcloud U ON C.id=U.fwcloud 
          WHERE U.user=${connection.escape(iduser)} 
          AND C.id=${connection.escape(fwcloud)}
        `;
        connection.query(sql, (error, row) => {
          if (error) reject(false);
          else if (row && row.length > 0) {
            //logger().debug(row[0]);
            logger().debug('IDUSER: ' + iduser);
            if (row[0].locked === 1 && row[0].locked_by === lock_session_id) {
              //Access OK, LOCKED by USER
              resolve({
                access: true,
                locked: true,
                locked_at: row[0].locked_at,
                locked_by: row[0].locked_by,
                mylock: true,
              });
            } else if (row[0].locked === 1 && row[0].locked_by !== lock_session_id) {
              //Access OK, LOCKED by ANOTHER USER or SESSION
              resolve({
                access: true,
                locked: true,
                locked_at: row[0].locked_at,
                locked_by: row[0].locked_by,
                mylock: false,
              });
            } else if (row[0].locked === 0) {
              //Access OK, NOT LOCKED
              resolve({
                access: true,
                locked: false,
                locked_at: '',
                locked_by: null,
                mylock: false,
              });
            }
          } else {
            //Access ERROR, NOT LOCKED
            resolve({
              access: false,
              locked: false,
              locked_at: '',
              locked_by: null,
              mylock: false,
            });
          }
        });
      });
    });
  }

  /**
   * Checks if the lock on the FwCloud instance has timed out and unlocks it if necessary.
   *
   * This method performs the following steps:
   * 1. Queries the database to check if the FwCloud instance is locked.
   * 2. If locked, it checks if the session file associated with the lock exists.
   * 3. If the session file exists, it reads the file to determine if the lock has expired based on the keepalive timestamp.
   * 4. If the lock has expired or the session file does not exist, it updates the database to unlock the FwCloud instance.
   *
   * @param fwcloudId - The ID of the FwCloud instance to check.
   * @returns A promise that resolves when the check is complete.
   * @throws An error if there is an issue with the database query, file system operations, or JSON parsing.
   */
  static async checkFwcloudLockTimeout(fwcloudId: number): Promise<void> {
    return new Promise((resolve, reject) => {
      const locked = 1;
      const unlocked = 0;

      db.get(async (error, connection) => {
        if (error) return reject(error);

        const sql = `
          SELECT locked_by
          FROM ${tableName} 
          WHERE id = ${connection.escape(fwcloudId)} 
          AND locked = ${connection.escape(locked)}
        `;

        connection.query(sql, async (error, result) => {
          if (error) return reject(error);
          if (result.length === 0) return resolve();

          const sessionFilePath = path.join(
            app().config.get('session').files_path,
            result[0].locked_by + '.json',
          );

          try {
            const exists = await fs.pathExists(sessionFilePath);
            const sqlUpdate = `
              UPDATE ${tableName}
              SET locked = ${connection.escape(unlocked)}
              WHERE id = ${connection.escape(fwcloudId)}
            `;

            if (exists) {
              logger().info(`Checking lock timeout for session ${sessionFilePath}`);

              fs.readFile(sessionFilePath, 'utf8', (err, data) => {
                if (err) return reject(err);

                try {
                  const sessionData = JSON.parse(data);
                  const elapsed_ms: number = Date.now() - sessionData.keepalive_ts;
                  const keepalive_ms: number = app().config.get('session').keepalive_ms;

                  if (elapsed_ms > keepalive_ms) {
                    logger().info(
                      `Session file ${sessionFilePath} has expired, unlocking FwCloud ${fwcloudId}`,
                    );
                    connection.query(sqlUpdate, (err, result) => {
                      if (err) return reject(err);
                      resolve();
                    });
                  } else {
                    resolve();
                  }
                } catch (parseError) {
                  reject(parseError);
                }
              });
            } else {
              logger().info(
                `Session file ${sessionFilePath} not found, unlocking FwCloud ${fwcloudId}`,
              );
              connection.query(sqlUpdate, (err, result) => {
                if (err) return reject(err);
                resolve();
              });
            }
          } catch (fsError) {
            reject(fsError);
          }
        });
      });
    });
  }

  /**
   * ADD New Fwcloud
   *
   * @method insertFwcloud
   *
   * @param iduser {Integer}  User identifier
   * @param fwcloudData {Fwcloud Object}  Fwcloud Object data
   *       @param fwcloudData.id {NULL}
   *       @param fwcloudData.name {string} Fwcloud Name
   * @param {Function} callback    Function callback response
   *
   *       callback(error, Rows)
   *
   * @return {CALLBACK RESPONSE}
   *
   * @example
   * #### RESPONSE OK:
   *
   *       callback(null, {"insertId": fwid});
   *
   * #### RESPONSE ERROR:
   *
   *       callback(error, null);
   *
   */
  public static insertFwcloud(req) {
    return new Promise((resolve, reject) => {
      const fwcloudData = {
        name: req.body.name,
        image: req.body.image,
        comment: req.body.comment,
      };

      req.dbCon.query(`INSERT INTO ${tableName} SET ?`, fwcloudData, async (error, result) => {
        if (error) return reject(error);

        const fwcloud = result.insertId;
        try {
          const admins: any = await User.getAllAdminUserIds(req);
          for (const admin of admins) {
            await User.allowFwcloudAccess(req.dbCon, admin.id, fwcloud);
          }
          resolve(fwcloud);
        } catch (error) {
          reject(error);
        }
      });
    });
  }

  /**
   * UPDATE Fwcloud lock status
   *
   * @method updateFwcloudLock
   *
   * @param iduser {Integer}  User identifier
   * @param fwcloudData {Fwcloud Object}  Fwcloud Object data
   *       @param fwcloudData.id {NULL}
   *       @param fwcloudData.fwcloud {Integer} FWcloud ID
   *       @param fwcloudData.locked {Integer} Locked status
   * @param {Function} callback    Function callback response
   *
   *       callback(error, Rows)
   *
   * @return {CALLBACK RESPONSE}
   *
   * @example
   * #### RESPONSE OK:
   *
   *       callback(null, {"result": true});
   *
   * #### RESPONSE ERROR:
   *
   *       callback(error, null);
   *
   */
  public static updateFwcloudLock(
    fwcloudData,
  ): Promise<{ result: boolean; lockByUser?: string; lockedAt?: string }> {
    return new Promise(async (resolve, reject) => {
      await FwCloud.checkFwcloudLockTimeout(fwcloudData.fwcloud);

      const locked = 1;
      db.get((error, connection) => {
        if (error) return reject(error);

        // Check if FWCloud is unlocked or locked by the same user
        const sqlExists = `
          SELECT id FROM ${tableName}
          WHERE id = ${connection.escape(fwcloudData.fwcloud)}
          AND (locked=0 OR (locked=1 AND locked_by=${connection.escape(fwcloudData.lock_session_id)}))
        `;

        connection.query(sqlExists, (error, row) => {
          if (row && row.length > 0) {
            // Check if there are FWCloud with Access and Edit permissions
            const sqlExists = `
              SELECT C.id FROM ${tableName} C
              INNER JOIN user__fwcloud U on U.fwcloud=C.id AND U.user=${connection.escape(fwcloudData.iduser)}
              WHERE C.id = ${connection.escape(fwcloudData.fwcloud)}
            `;
            //logger().debug(sqlExists);
            connection.query(sqlExists, (error, row) => {
              if (error) {
                return reject(error);
              }
              if (row && row.length > 0) {
                const sql = `
                  UPDATE ${tableName}
                  SET locked = ${connection.escape(locked)},
                  locked_at = CURRENT_TIMESTAMP,
                  locked_by = ${connection.escape(fwcloudData.lock_session_id)}
                  WHERE id = ${fwcloudData.fwcloud}
                `;
                //logger().debug(sql);
                connection.query(sql, (error, result) => {
                  if (error) {
                    reject(error);
                  } else {
                    resolve({ result: true });
                  }
                });
              } else {
                resolve({ result: false });
              }
            });
          } else {
            const sqlLockedBy = `
              SELECT locked_by, locked_at FROM ${tableName}
              WHERE id = ${connection.escape(fwcloudData.fwcloud)}
              AND locked = ${connection.escape(locked)}
            `;

            connection.query(sqlLockedBy, async (error, row) => {
              if (error) {
                return reject(error);
              } else if (row && row.length > 0) {
                const sessionFilePath = path.join(
                  app().config.get('session').files_path,
                  row[0].locked_by + '.json',
                );

                try {
                  const exists = await fs.pathExists(sessionFilePath);
                  if (exists) {
                    fs.readFile(sessionFilePath, 'utf8', (err, data) => {
                      if (err) return reject(err);
                      try {
                        const sessionData = JSON.parse(data);
                        resolve({
                          result: false,
                          lockByUser: sessionData.username,
                          lockedAt: row[0].locked_at,
                        });
                      } catch (fsError) {
                        reject(fsError);
                      }
                    });
                  }
                } catch (fsError) {
                  reject(fsError);
                }
              }
            });
          }
        });
      });
    });
  }

  /**
   * UNLOCK Fwcloud status
   *
   * @method updateFwcloudUnlock
   *
   * @param iduser {Integer}  User identifier
   * @param fwcloudData {Fwcloud Object}  Fwcloud Object data
   *       @param fwcloudData.id {NULL}
   *       @param fwcloudData.fwcloud {Integer} FWcloud ID
   *       @param fwcloudData.locked {Integer} Locked status
   * @param {Function} callback    Function callback response
   *
   *       callback(error, Rows)
   *
   * @return {CALLBACK RESPONSE}
   *
   * @example
   * #### RESPONSE OK:
   *
   *       callback(null, {"result": true});
   *
   * #### RESPONSE ERROR:
   *
   *       callback(error, null);
   *
   */
  public static updateFwcloudUnlock(fwcloudData): Promise<{ result: boolean }> {
    return new Promise((resolve, reject) => {
      const locked = 1;
      const unlocked = 0;
      db.get((error, connection) => {
        if (error) reject(error);
        const sqlExists = `SELECT id FROM ${tableName} WHERE id = ${connection.escape(fwcloudData.id)} AND (locked=${connection.escape(locked)} AND locked_by=${connection.escape(fwcloudData.lock_session_id)})`;
        connection.query(sqlExists, (error, row) => {
          if (error) {
            reject(error);
          }
          //If exists Id from fwcloud to remove
          if (row && row.length > 0) {
            const sql = `UPDATE ${tableName} SET locked = ${connection.escape(unlocked)}, locked_by = null WHERE id = ${fwcloudData.id}`;

            connection.query(sql, (error, result) => {
              if (error) {
                reject(error);
              } else {
                resolve({ result: true });
              }
            });
          } else {
            resolve({ result: false });
          }
        });
      });
    });
  }
}
