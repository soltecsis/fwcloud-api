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
import { Entity, PrimaryGeneratedColumn, Column, ManyToMany, JoinTable, OneToMany, ManyToOne, AfterRemove, AfterInsert, RemoveOptions, QueryRunner } from "typeorm";
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
import { IPObjGroup } from "../ipobj/IPObjGroup";

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

	@OneToMany(type => IPObjGroup, ipObjGroup => ipObjGroup.fwCloud)
	ipObjGroups: Array<IPObjGroup>;

	@OneToMany(type => Mark, mark => mark.fwCloud)
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
		const sqls : string[] = [];
		
		// Root nodes.
		let nodes = await queryRunner.query(`select id from fwc_tree where fwcloud=${this.id} and id_parent is null`);

		// Next levels nodes.
		while(nodes.length > 0){
			sqls.unshift(`delete from fwc_tree where id in (${nodes.map(obj => obj.id)})`);
			nodes = await queryRunner.query(`select id from fwc_tree where id_parent in (${nodes.map(obj => obj.id)})`);
		}

		// Run queries removing node trees from down up to root nodes.
		for(let i=0; i < sqls.length; i++)
			await queryRunner.query(sqls[i]);

		return;
	}
		
	
	public async remove(options?: RemoveOptions): Promise<this> {
		const databaseService = await app().getService<DatabaseService>(DatabaseService.name);
		const queryRunner: QueryRunner = databaseService.connection.createQueryRunner();

		try {
			await queryRunner.startTransaction();

			// WARNING: Don't use 'SET FOREIGN_KEY_CHECKS=0' and 'SET FOREIGN_KEY_CHECKS=1'
      // This way we make sure that the delete procedure follows the referential integrity of the data base and
      // avoid left rows without correct relations in a table.

			// First remove the Firewall, Objects, Services and CA trees.
			await this.removeTrees(queryRunner);

			let query =
        // First remove the relational tables for policy rules and the policy rules themselves.
			 `delete PI from policy_r__interface PI inner join policy_r RULE on RULE.id=PI.rule inner join firewall FW on FW.id=RULE.firewall where FW.fwcloud=${this.id};
				delete PO from policy_r__ipobj PO inner join policy_r RULE on RULE.id=PO.rule inner join firewall FW on FW.id=RULE.firewall where FW.fwcloud=${this.id};
				delete PVPN from policy_r__openvpn PVPN inner join policy_r RULE on RULE.id=PVPN.rule inner join firewall FW on FW.id=RULE.firewall where FW.fwcloud=${this.id};
				delete PPRE from policy_r__openvpn_prefix PPRE inner join policy_r RULE on RULE.id=PPRE.rule inner join firewall FW on FW.id=RULE.firewall where FW.fwcloud=${this.id};
				delete RULE from policy_r RULE inner join firewall FW on FW.id=RULE.firewall where FW.fwcloud=${this.id};
				delete PG from policy_g PG inner join firewall FW on FW.id=PG.firewall where FW.fwcloud=${this.id};`

				// Next the routing policy rules.
			+`delete RRO from routing_r__ipobj RRO inner join routing_r RULE on RULE.id=RRO.rule inner join routing_table RT on RT.id=RULE.routing_table inner join firewall FW on FW.id=RT.firewall where FW.fwcloud=${this.id};
				delete RROG from routing_r__ipobj_g RROG inner join routing_r RULE on RULE.id=RROG.rule inner join routing_table RT on RT.id=RULE.routing_table inner join firewall FW on FW.id=RT.firewall where FW.fwcloud=${this.id};
				delete RRVPN from routing_r__openvpn RRVPN inner join routing_r RULE on RULE.id=RRVPN.rule inner join routing_table RT on RT.id=RULE.routing_table inner join firewall FW on FW.id=RT.firewall where FW.fwcloud=${this.id};
				delete RRPRE from routing_r__openvpn_prefix RRPRE inner join routing_r RULE on RULE.id=RRPRE.rule inner join routing_table RT on RT.id=RULE.routing_table inner join firewall FW on FW.id=RT.firewall where FW.fwcloud=${this.id};
				delete RRM from routing_r__mark RRM inner join routing_r RULE on RULE.id=RRM.rule inner join routing_table RT on RT.id=RULE.routing_table inner join firewall FW on FW.id=RT.firewall where FW.fwcloud=${this.id};
				delete RR from routing_r RR inner join routing_table RT on RT.id=RR.routing_table inner join firewall FW on FW.id=RT.firewall where FW.fwcloud=${this.id};
				delete RRG from routing_g RRG inner join firewall FW on FW.id=RRG.firewall where FW.fwcloud=${this.id};`

				// Next the routing tables.
				+`delete RO from route__ipobj RO inner join route ROUTE on ROUTE.id=RO.route inner join routing_table RT on RT.id=ROUTE.routing_table inner join firewall FW on FW.id=RT.firewall where FW.fwcloud=${this.id};
				delete ROG from route__ipobj_g ROG inner join route ROUTE on ROUTE.id=ROG.route inner join routing_table RT on RT.id=ROUTE.routing_table inner join firewall FW on FW.id=RT.firewall where FW.fwcloud=${this.id};
				delete RVPN from route__openvpn RVPN inner join route ROUTE on ROUTE.id=RVPN.route inner join routing_table RT on RT.id=ROUTE.routing_table inner join firewall FW on FW.id=RT.firewall where FW.fwcloud=${this.id};
				delete RPRE from route__openvpn_prefix RPRE inner join route ROUTE on ROUTE.id=RPRE.route inner join routing_table RT on RT.id=ROUTE.routing_table inner join firewall FW on FW.id=RT.firewall where FW.fwcloud=${this.id};
				delete ROUTE from route ROUTE inner join routing_table RT on RT.id=ROUTE.routing_table inner join firewall FW on FW.id=RT.firewall where FW.fwcloud=${this.id};
				delete RT from routing_table RT inner join firewall FW on FW.id=RT.firewall where FW.fwcloud=${this.id};
				delete RG from route_g RG inner join firewall FW on FW.id=RG.firewall where FW.fwcloud=${this.id};`

				//Delete DHCP Rules
				+`delete DHCPIPOBJ from dhcp_r__ipobj DHCPIPOBJ inner join dhcp_r RULE on RULE.id=DHCPIPOBJ.rule inner join firewall FW on FW.id=RULE.firewall where FW.fwcloud=${this.id};
				delete DHCPR from dhcp_r DHCPR inner join firewall FW on FW.id=DHCPR.firewall where FW.fwcloud=${this.id};
				delete DHCPG from dhcp_g DHCPG inner join firewall FW on FW.id=DHCPG.firewall where FW.fwcloud=${this.id};`

				// Next the OpenVPN entities of the database.
			+`delete OPT from openvpn_opt OPT inner join openvpn VPN on VPN.id=OPT.openvpn inner join firewall FW On FW.id=VPN.firewall where FW.fwcloud=${this.id};
				delete VPN from openvpn__ipobj_g VPN inner join ipobj_g G on G.id=VPN.ipobj_g where G.fwcloud=${this.id};
				delete PRE from openvpn_prefix__ipobj_g PRE inner join ipobj_g G on G.id=PRE.ipobj_g where G.fwcloud=${this.id};
				delete PRE from openvpn_prefix PRE inner join openvpn VPN on VPN.id=PRE.openvpn inner join firewall FW on FW.id=VPN.firewall where FW.fwcloud=${this.id};
				delete VPN from openvpn VPN inner join firewall FW on FW.id=VPN.firewall where VPN.openvpn is not null and FW.fwcloud=${this.id};
				delete VPN from openvpn VPN inner join firewall FW on FW.id=VPN.firewall where FW.fwcloud=${this.id};`

        // Now the PKI entities.
			+`delete CRT from crt CRT inner join ca CA on CA.id=CRT.ca where CA.fwcloud=${this.id};
				delete PRE from ca_prefix PRE inner join ca CA on CA.id=PRE.ca where CA.fwcloud=${this.id};
				delete from ca where fwcloud=${this.id};`

        // Object groups.
			+`delete OG from ipobj__ipobjg OG inner join ipobj_g G on G.id=OG.ipobj_g where G.fwcloud=${this.id};
				delete from ipobj_g where fwcloud=${this.id};`

        // Host interfaces IPs and hosts interfaces.
			+`delete OBJ from interface__ipobj II inner join interface I on I.id=II.interface inner join ipobj OBJ on OBJ.interface=I.id where OBJ.fwcloud=${this.id};
				delete II from interface__ipobj II inner join ipobj OBJ on OBJ.id=II.ipobj where OBJ.fwcloud=${this.id};
				delete from interface where firewall is null and id not in (select interface from interface__ipobj);`

        // IP objects.
      +`delete from ipobj where fwcloud=${this.id};
				delete from mark where fwcloud=${this.id};`

        // Firewall interfaces.
      +`delete I from interface I inner join firewall FW on FW.id=I.firewall where FW.fwcloud=${this.id};`

        // Clusters and firewalls.
		  +`delete from firewall where fwcloud=${this.id};
        delete from cluster where fwcloud=${this.id};`

        // Users access to this fwcloud.
			+`delete from user__fwcloud where fwcloud=${this.id};`

        // Remove the fwcloud itself.
			+`delete from fwcloud where id=${this.id};`;

			await queryRunner.query(query);
			await queryRunner.commitTransaction();
			await queryRunner.release();

			// The @AfterRemove() decorator is not working, for this reason here we must invoke the removeDataDirectories();
			this.removeDataDirectories();
		} catch (err) {
			await queryRunner.rollbackTransaction();
			await queryRunner.release();
			throw err;
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
}