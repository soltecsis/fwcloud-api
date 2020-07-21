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

import Model from "../Model";
import { Entity, PrimaryGeneratedColumn, Column, ManyToMany, JoinTable, OneToMany, ManyToOne, BeforeRemove, AfterInsert } from "typeorm";
import db from '../../database/database-manager';
import * as path from "path";
import * as fs from "fs-extra";
import { User } from '../../models/user/User';
import { app, logger } from "../../fonaments/abstract-application";
import { DatabaseService } from "../../database/database.service";
import { Ca } from "../vpn/pki/Ca";
import { Cluster } from "../firewall/Cluster";
import { Firewall } from "../firewall/Firewall";
import { FwcTree } from "../tree/fwc-tree.model";
import { IPObj } from "../ipobj/IPObj";
import { Mark } from "../ipobj/Mark";
import { FSHelper } from "../../utils/fs-helper";

const fwcError = require('../../utils/error_table');

const tableName: string = 'fwcloud';

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
    locked_by: number;

    @Column()
    locked: number;

    @Column()
    image: string;

    @Column()
    comment: string;

    @ManyToMany(type => User, user => user.fwClouds)
    @JoinTable({
        name: 'user__fwcloud',
        joinColumn: { name: 'fwcloud'},
        inverseJoinColumn: { name: 'user'}
    })
    users: Array<User>

    @OneToMany(type => Ca, ca => ca.fwCloud)
    cas: Array<Ca>;

    @OneToMany(type => Cluster, cluster => cluster.fwCloud)
    clusters: Array<Cluster>;

    @OneToMany(type => Firewall, firewall => firewall.fwCloud)
    firewalls: Array<Firewall>;

    @OneToMany(type => FwcTree, fwcTree => fwcTree.fwCloud)
    fwcTrees: Array<FwcTree>;

    @OneToMany(type => IPObj, ipobj => ipobj.fwCloud)
    ipObjs: Array<IPObj>;

    @OneToMany(type => Mark, mark => mark.fwCloud)
    marks: Array<Mark>;

    public getTableName(): string {
        return tableName;
    }

    @BeforeRemove()
    public removeDataDirectories() {
        FSHelper.rmDirectorySync(this.getPkiDirectoryPath());
        FSHelper.rmDirectorySync(this.getPolicyDirectoryPath());
    }

    @AfterInsert()
    async createDataDirectories() {
        fs.mkdirpSync(this.getPkiDirectoryPath());
        fs.mkdirpSync(this.getPolicyDirectoryPath());
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
    public static getFwclouds(dbCon, user) {
        return new Promise((resolve, reject) => {
            var sql = `SELECT distinctrow C.* FROM ${tableName} C 
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
    public static getFwcloud (iduser, fwcloud, callback) {
        db.get((error, connection) => {
            if (error)
                callback(error, null);

            var sql = 'SELECT distinctrow C.* FROM ' + tableName + ' C  ' +
                ' INNER JOIN user__fwcloud U ON C.id=U.fwcloud ' +
                ' WHERE U.user=' + connection.escape(iduser) + ' AND C.id=' + connection.escape(fwcloud);
            connection.query(sql, (error, row) => {
                if (error)
                    callback(error, null);
                else
                    callback(null, row);
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
    public static getFwcloudAccess(iduser, fwcloud) {
        return new Promise((resolve, reject) => {
            db.get((error, connection) => {
                if (error) return reject(false);
                var sql = 'SELECT distinctrow C.* FROM ' + tableName + ' C  ' +
                    ' INNER JOIN user__fwcloud U ON C.id=U.fwcloud ' +
                    ' WHERE U.user=' + connection.escape(iduser) + ' AND C.id=' + connection.escape(fwcloud);
                connection.query(sql, (error, row) => {
                    if (error)
                        reject(false);
                    else if (row && row.length > 0) {
                        //logger().debug(row[0]);
                        logger().debug("IDUSER: " + iduser);
                        if (row[0].locked === 1 && Number(row[0].locked_by) === Number(iduser)) {
                            //Access OK, LOCKED by USER
                            resolve({ "access": true, "locked": true, "mylock": true, "locked_at": row[0].locked_at, "locked_by": row[0].locked_by });
                        } else if (row[0].locked === 1 && Number(row[0].locked_by) !== Number(iduser)) {
                            //Access OK, LOCKED by OTHER USER
                            resolve({ "access": true, "locked": true, "mylock": false, "locked_at": row[0].locked_at, "locked_by": row[0].locked_by });
                        } else if (row[0].locked === 0) {
                            //Access OK, NOT LOCKED
                            resolve({ "access": true, "locked": false, "mylock": false, "locked_at": "", "locked_by": "" });
                        }
                    } else {
                        //Access ERROR, NOT LOCKED
                        resolve({ "access": false, "locked": "", "mylock": false, "locked_at": "", "locked_by": "" });
                    }
                });
            });
        });
    }

    /**
     * Check Fwcloud locked timeout
     *  
     * @method getFwcloudLockedTimeout
     * 
     * @param {Function} callback    Function callback response
     * 
     *       callback(error, Rows)
     * 
     * @return {Boolean} Returns `RESULT UNLOCKED` 
     * 
     */
    public static checkFwcloudLockTimeout(timeout, callback) {
        return new Promise((resolve, reject) => {
            db.get((error, connection) => {
                if (error) return reject(false);
                var sql = 'select TIMESTAMPDIFF(MINUTE, updated_at, NOW()) as dif,  C.* from ' + tableName + ' C WHERE C.locked=1 HAVING dif>' + timeout;
                connection.query(sql, (error, rows) => {
                    if (error)
                        reject(false);
                    else if (rows && rows.length > 0) {
                        //UNLOCK ALL
                        for (var i = 0; i < rows.length; i++) {
                            var row = rows[i];
                            var sqlupdate = 'UPDATE ' + tableName + ' SET locked = 0  WHERE id = ' + row.id;
                            connection.query(sqlupdate, (error, result) => {
                                logger().info("-----> UNLOCK FWCLOUD: " + row.id + " BY TIMEOT INACTIVITY of " + row.dif + "  Min LAST UPDATE: " + row.updated_at +
                                    "  LAST LOCK: " + row.locked_at + "  BY: " + row.locked_by);
                            });
                        }
                        resolve(true);
                    } else {
                        reject(false);
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
            let fwcloudData = {
                name: req.body.name,
                image: req.body.image,
                comment: req.body.comment
            }

            req.dbCon.query(`INSERT INTO ${tableName} SET ?`, fwcloudData, async (error, result) => {
                if (error) return reject(error);

                let fwcloud = result.insertId;
                try {
                    const admins: any = await User.getAllAdminUserIds(req);
                    for(let admin of admins) {
                        await User.allowFwcloudAccess(req.dbCon,admin.id,fwcloud);
                    }
                    resolve(fwcloud);
                } catch(error) { reject(error) }
            });
        });
    }

    /**
     * UPDATE Fwcloud
     *  
     * @method updateFwcloud
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
     *       callback(null, {"result": true});
     *       
     * #### RESPONSE ERROR:
     *    
     *       callback(error, null);
     *       
     */
    public static updateFwcloud(req) {
        return new Promise((resolve, reject) => {
            let sql = `UPDATE ${tableName} SET name=${req.dbCon.escape(req.body.name)},
                image=${req.dbCon.escape(req.body.image)},
                comment=${req.dbCon.escape(req.body.comment)}
                WHERE id=${req.body.fwcloud}`;
            req.dbCon.query(sql, (error, result) => {
                if (error) return reject(error);
                resolve();
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
    public static updateFwcloudLock(fwcloudData) {
        return new Promise((resolve, reject) => {
            var locked = 1;
            db.get((error, connection) => {
                if (error) return reject(error);

                //Check if FWCloud is unlocked or locked by the same user
                var sqlExists = 'SELECT id FROM ' + tableName + '  ' +
                    ' WHERE id = ' + connection.escape(fwcloudData.fwcloud) +
                    ' AND (locked=0 OR (locked=1 AND locked_by=' + connection.escape(fwcloudData.iduser) + ')) ';

                connection.query(sqlExists, (error, row) => {
                    if (row && row.length > 0) {
                        //Check if there are FWCloud with Access and Edit permissions
                        var sqlExists = 'SELECT C.id FROM ' + tableName + ' C ' +
                            ' INNER JOIN user__fwcloud U on U.fwcloud=C.id AND U.user=' + connection.escape(fwcloudData.iduser) +
                            ' WHERE C.id = ' + connection.escape(fwcloudData.fwcloud);
                        logger().debug(sqlExists);
                        connection.query(sqlExists, (error, row) => {
                            if (row && row.length > 0) {

                                var sql = 'UPDATE ' + tableName + ' SET locked = ' + connection.escape(locked) + ',' +
                                    'locked_at = CURRENT_TIMESTAMP ,' +
                                    'locked_by = ' + connection.escape(fwcloudData.iduser) + ' ' +
                                    ' WHERE id = ' + fwcloudData.fwcloud;
                                logger().debug(sql);
                                connection.query(sql, (error, result) => {
                                    if (error) {
                                        reject(error);
                                    } else {
                                        resolve({ "result": true });
                                    }
                                });
                            } else {
                                resolve({ "result": false });
                            }
                        });
                    } else {
                        resolve({ "result": false });
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
    public static updateFwcloudUnlock(fwcloudData, callback) {
        return new Promise((resolve, reject) => {
            var locked = 0;
            db.get((error, connection) => {
                if (error)
                    reject(error);
                var sqlExists = 'SELECT id FROM ' + tableName + '  ' +
                    ' WHERE id = ' + connection.escape(fwcloudData.id) +
                    ' AND (locked=1 AND locked_by=' + connection.escape(fwcloudData.iduser) + ') ';
                connection.query(sqlExists, (error, row) => {
                    //If exists Id from fwcloud to remove
                    if (row && row.length > 0) {
                        var sql = 'UPDATE ' + tableName + ' SET locked = ' + connection.escape(locked) + ',' +
                            'locked_at = CURRENT_TIMESTAMP ,' +
                            'locked_by = ' + connection.escape(fwcloudData.iduser) + ' ' +
                            ' WHERE id = ' + fwcloudData.id;

                        connection.query(sql, (error, result) => {
                            if (error) {
                                reject(error);
                            } else {
                                resolve({ "result": true });
                            }
                        });
                    } else {
                        resolve({ "result": false });
                    }
                });
            });
        });
    }

    /**
     * DELETE Fwcloud
     *  
     * @method deleteFwcloud
     * 
     * @param iduser {Integer}  User identifier
     * @param id {Integer}  Fwcloud identifier
     * @param {Function} callback    Function callback response
     * 
     *       callback(error, Rows)
     * 
     * @return {CALLBACK RESPONSE}
     * 
     * @example
     * #### RESPONSE OK:
     *    
     *       callback(null, {"result": true, "msg": "deleted"});
     *       
     * #### RESPONSE ERROR:
     *    
     *       callback(null, {"result": false});
     *       
     */
    public static deleteFwcloud(req) {
        return new Promise((resolve, reject) => {
            let sql = `SELECT C.* FROM ${tableName} C
                INNER JOIN user__fwcloud U ON C.id=U.fwcloud
                WHERE U.user=${req.session.user_id} AND C.id=${req.body.fwcloud}`;
            req.dbCon.query(sql, async(error, row) => {
                if (error) return reject(error);

                //If exists Id from fwcloud to remove
                if (row && row.length > 0) {
                    try {
                        //DELETE ALL OBJECTS FROM CLOUD
                        await this.EmptyFwcloudStandard(req.body.fwcloud);
                        const admins: any = await User.getAllAdminUserIds(req);
                        for(let admin of admins) {
                            await User.disableFwcloudAccess(req.dbCon,admin.id,req.body.fwcloud);
                        }
                    } catch (error) { return reject(error) }

                    req.dbCon.query(`DELETE FROM ${tableName} WHERE id=${req.body.fwcloud}`, (error, result) => {
                        if (error) return reject(error);
                        resolve();
                    });
                } else reject(fwcError.NOT_FOUND);
            });
        });
    }

    private static EmptyFwcloudStandard(fwcloud) {
        return new Promise((resolve, reject) => {
            var sqlcloud = "  is null";
            if (fwcloud !== null)
                sqlcloud = "= " + fwcloud;
            db.get(async (error, connection) => {
                if (error)
                    reject(error);

                try {
                    const databaseService = await app().getService<DatabaseService>(DatabaseService.name);
                    await databaseService.connection.transaction(async transactionalManager => {
                        await transactionalManager.query("SET FOREIGN_KEY_CHECKS = 0");
                        await transactionalManager.query("DELETE I.* from  interface I inner join interface__ipobj II on II.interface=I.id inner join ipobj G On  G.id=II.ipobj where G.fwcloud" + sqlcloud);
                        await transactionalManager.query("DELETE II.* from  interface__ipobj II inner join ipobj G On  G.id=II.ipobj where G.fwcloud" + sqlcloud);
                        await transactionalManager.query("DELETE II.* from  ipobj__ipobjg II inner join ipobj G On  G.id=II.ipobj where G.fwcloud" + sqlcloud);
                        await transactionalManager.query("DELETE  FROM ipobj_g where fwcloud" + sqlcloud);
                        await transactionalManager.query("DELETE  FROM ipobj where fwcloud" + sqlcloud);
                        await transactionalManager.query("DELETE  FROM ipobj where fwcloud" + sqlcloud);
                        await transactionalManager.query("DELETE  FROM fwc_tree where fwcloud" + sqlcloud);
                        await transactionalManager.query("SET FOREIGN_KEY_CHECKS = 1");
                    });
                    resolve({ "result": true });
                } catch (e) {
                    reject(e);
                }
            });
        });
    }
}