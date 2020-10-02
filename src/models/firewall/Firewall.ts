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
import db from '../../database/database-manager'
import { Entity, Column, PrimaryGeneratedColumn, JoinColumn, ManyToOne, OneToMany, getConnection, UpdateResult, getManager, getRepository, Not, IsNull } from "typeorm";

import { Interface } from '../../models/interface/Interface';
import { OpenVPNPrefix } from '../../models/vpn/openvpn/OpenVPNPrefix';
import { OpenVPN } from '../../models/vpn/openvpn/OpenVPN';

var utilsModel = require("../../utils/utils.js");
import { PolicyRule } from '../../models/policy/PolicyRule';
import { PolicyGroup } from '../../models/policy/PolicyGroup';
import { Tree } from '../tree/Tree';
import { FwCloud } from "../fwcloud/FwCloud";
import { Cluster } from "./Cluster";
import { RoutingRule } from "../routing/routing-rule.model";
import { RoutingGroup } from "../routing/routing-group.model";
import { DatabaseService } from "../../database/database.service";
import { app } from "../../fonaments/abstract-application";
import * as path from "path";

const config = require('../../config/config');
var firewall_Data = require('../../models/data/data_firewall');
const fwcError = require('../../utils/error_table');

const sshTools = require('../../utils/ssh');

const tableName: string = 'firewall';

@Entity(tableName)
export class Firewall extends Model {

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
	compiled_at: Date;

	@Column()
	installed_at: Date;

	@Column()
	by_user: number;

	@Column()
	status: number;

	@Column()
	install_user: string;

	@Column()
	install_pass: string;

	@Column()
	save_user_pass: number;

	@Column()
	install_interface: number;

	@Column()
	install_ipobj: number;

	@Column()
	fwmaster: number;

	@Column()
	install_port: number;

	@Column()
	options: number;

	@Column({name: 'fwcloud'})
	fwCloudId: number;

	@ManyToOne(type => FwCloud, fwcloud => fwcloud.firewalls)
	@JoinColumn({
		name: 'fwcloud'
	})
	fwCloud: FwCloud;

	@Column({name: 'cluster'})
	clusterId: number;

	@ManyToOne(type => Cluster, cluster => cluster.firewalls)
	@JoinColumn({
		name: "cluster"
	})
	cluster: Cluster;

	@OneToMany(type => Interface, _interface => _interface.firewall)
	interfaces: Array<Interface>

	@OneToMany(type => OpenVPN, openVPN => openVPN.firewall)
	openVPNs: Array<OpenVPN>;

	@OneToMany(type => PolicyGroup, policyGroup => policyGroup.firewall)
	policyGroups: Array<PolicyGroup>;

	@OneToMany(type => PolicyRule, policyRule => policyRule.firewall)
	policyRules: Array<PolicyRule>;

	@OneToMany(type => RoutingGroup, routingGroup => routingGroup.firewall)
	routingGroup: Array<RoutingGroup>;

	@OneToMany(type => RoutingRule, routingRule => routingRule.firewall)
	routingRules: Array<RoutingRule>;

	
	public getTableName(): string {
		return tableName;
	}

	public getPolicyFilePath(): string {
		if (this.fwCloudId && this.id) {
			return path.join(app().config.get('policy').data_dir, this.fwCloudId.toString(), this.id.toString(), app().config.get('policy').script_name);
		}

		return null;
	}

	public async resetCompilationStatus(): Promise<Firewall> {
		this.status = 0;
		this.compiled_at = null;
		this.installed_at = null;

		return await (await app().getService<DatabaseService>(DatabaseService.name)).connection.manager.save(this);
	}

	/**
	 * Returns true if the firewall has at least one rule which is marked
	 */
	public async hasMarkedRules(): Promise<boolean> {
		return (await getRepository(PolicyRule).find({
			where: {
				firewallId: this.id,
				markId: Not(IsNull())
			}
		})).length > 0;
	}

	/**
	 * Get Firewall by User and ID
	 *  
	 * @method getFirewall
	 * 
	 * @param {Integer} iduser User identifier
	 * @param {Integer} id firewall identifier
	 * @param {Function} callback    Function callback response
	 * 
	 */
	public static getFirewall(req) {
		return new Promise((resolve, reject) => {
			var sql = `SELECT T.*, I.name as interface_name, O.name as ip_name, O.address as ip, M.id as id_fwmaster
				FROM ${tableName} T
				INNER JOIN user__fwcloud U ON T.fwcloud=U.fwcloud AND U.user=${req.session.user_id}
				LEFT join interface I on I.id=T.install_interface
				LEFT join ipobj O on O.id=T.install_ipobj and O.interface=I.id
				LEFT JOIN firewall M on M.cluster=T.cluster and M.fwmaster=1
				WHERE T.id=${req.body.firewall} AND T.fwcloud=${req.body.fwcloud}`;
			
			req.dbCon.query(sql, async (error, rows) => {
				if (error) return reject(error);
				if (rows.length !== 1) return reject(fwcError.NOT_FOUND);

				try {
					let firewall_data:any = (await Promise.all(rows.map(data => utilsModel.decryptDataUserPass(data))))[0];
					resolve(firewall_data);
				} catch(error) { return reject(error) } 
			});
		});
	}

	/**
	 * Get Firewalls by User and Cloud
	 *  
	 * @method getFirewallCloud
	 * 
	 * @param {Integer} iduser User identifier
	 * @param {Integer} idCloud Cloud identifier
	 * @param {Function} callback    Function callback response
	 * 
	 *       callback(error, Rows)
	 * 
	 * @return {ARRAY of Firewall objects} Returns `ARRAY OBJECT FIREWALL DATA` 
	 * 
	 * Table: __firewall__
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
	public static getFirewallCloud(req) {
		return new Promise((resolve, reject) => {
			var sql = `SELECT T.*, I.name as interface_name, O.name as ip_name, O.address as ip
			FROM ${tableName} T INNER JOIN user__fwcloud U ON T.fwcloud=U.fwcloud AND U.user=${req.session.user_id}
			LEFT join interface I on I.id=T.install_interface
			LEFT join ipobj O on O.id=T.install_ipobj and O.interface=I.id
			WHERE T.fwcloud=${req.body.fwcloud}`;

			req.dbCon.query(sql, (error, rows) => {
				if (error) return reject(error);
				Promise.all(rows.map(data => utilsModel.decryptDataUserPass(data)))
					.then(data => resolve(data))
					.catch(error => reject(error));
			});
		});
	};

	/**
	 * Get Firewall SSH connection data
	 *  
	 * @method getFirewallSSH
	 * 
	 * @param {Integer} iduser User identifier
	 * @param {Integer} id firewall identifier
	 * @param {Function} callback    Function callback response
	 * 
	 *       callback(error, Rows)
	 * 
	 * @return {Firewall object} Returns `OBJECT FIREWALL DATA` 
	 * 
	 * Table: __firewall__
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
	public static getFirewallSSH(req) {
		return new Promise(async (resolve, reject) => {
			try {
				var data: any = await this.getFirewall(req);

				// Obtain SSH connSettings for the firewall to which we want install the policy.
				var SSHconn = {
					host: data.ip,
					port: data.install_port,
					username: data.install_user,
					password: data.install_pass
				}

				// If we have ssh user and pass in the body of the request, then these data have preference over the data stored in database.
				if (req.body.sshuser && req.body.sshpass) {
					SSHconn.username = req.body.sshuser;
					SSHconn.password = req.body.sshpass;
				}

				// If we have no user or password for the ssh connection, then error.
				if (!SSHconn.username || !SSHconn.password)
					throw (fwcError.other('User or password for the SSH connection not found'));

				data.SSHconn = SSHconn;
				resolve(data);
			} catch (error) { reject(error) }
		});
	};

	/**
	 * Get Firewall Access by Locked 
	 *  
	 * @method getFirewallLockedAccess
	 * 
	 * @param {Integer} iduser User identifier
	 * @param {Integer} idfirewall firewall identifier
	 * @param {Integer} fwcloud fwcloud identifier 
	 * @param {Function} callback    Function callback response
	 * 
	 *       callback(error, Rows)
	 * 
	 * @return {Boolean} Returns `LOCKED STATUS` 
	 * 
	 */
	public static getFirewallAccess(accessData) {
		return new Promise((resolve, reject) => {
			db.get((error, connection) => {
				if (error) return reject(error);

				//CHECK FIREWALL PERIMSSIONS
				var sql = `SELECT T.* FROM ${tableName} T
				INNER JOIN user__fwcloud U ON T.fwcloud=U.fwcloud AND U.user=${accessData.iduser}
				WHERE T.id=${accessData.firewall}	AND T.fwcloud=${accessData.fwcloud}`;
				connection.query(sql, (error, row) => {
					if (error) return reject(error);

					resolve((row && row.length > 0) ? true : false);
				});
			});
		});
	};

	/**
	 * Get Firewalls by User and Cluster
	 *  
	 * @method getFirewallCluster
	 * 
	 * @param {Integer} iduser User identifier
	 * @param {Integer} idcluster Cluster identifier
	 * @param {Function} callback    Function callback response
	 * 
	 *       callback(error, Rows)
	 * 
	 * @return {ARRAY of Firewall objects} Returns `ARRAY OBJECT FIREWALL DATA` 
	 * 
	 * Table: __firewall__
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
	public static getFirewallCluster(iduser, idcluster, callback) {
		db.get((error, connection) => {
			if (error) return callback(error, null);
			var sql = `SELECT T.*, I.name as interface_name, O.name as ip_name, O.address as ip
			FROM ${tableName} T 
			INNER JOIN user__fwcloud U ON T.fwcloud=U.fwcloud AND U.user=${iduser}
			LEFT join interface I on I.id=T.install_interface
			LEFT join ipobj O on O.id=T.install_ipobj and O.interface=I.id
			WHERE cluster=${idcluster} ORDER BY T.fwmaster desc, T.id`;
			connection.query(sql, (error, rows) => {
				if (error)
					callback(error, null);
				else {
					Promise.all(rows.map(data => utilsModel.decryptDataUserPass(data)))
						.then(data => {
							Promise.all(data.map(data => this.getfirewallData(data)))
								.then(dataF => {
									callback(null, dataF);
								});
						})
						.catch(e => {
							callback(e, null);
						});
				}
			});
		});
	};

	private static getfirewallData(row) {
		return new Promise((resolve, reject) => {
			var firewall = new firewall_Data(row);
			resolve(firewall);
		});
	}

	public static getFirewallClusterMaster(iduser, idcluster, callback) {
		db.get((error, connection) => {
			if (error)
				callback(error, null);
			var sql = `SELECT T.*, I.name as interface_name, O.name as ip_name, O.address as ip
					FROM ${tableName} T 
					INNER JOIN user__fwcloud U ON T.fwcloud=U.fwcloud AND U.user=${iduser}
					LEFT join interface I on I.id=T.install_interface
					LEFT join ipobj O on O.id=T.install_ipobj and O.interface=I.id
					WHERE cluster=${idcluster} AND fwmaster=1`;
			connection.query(sql, async (error, rows) => {
				if (error)
					callback(error, null);
				else {
					try {
						let firewall_data:any = await Promise.all(rows.map(data => utilsModel.decryptDataUserPass(data)));	
						callback(null, firewall_data);
					} catch(error) { return callback(error, null) } 
				}
			});
		});
	};

	/**
	 * ADD New Firewall
	 *  
	 * @method insertFirewall
	 * 
	 * @param iduser {Integer}  User identifier
	 * @param firewallData {Firewall Object}  Firewall Object data
	 *       @param firewallData.id {NULL} 
	 *       @param firewallData.cluster {Integer} Cluster ID
	 *       @param firewallData.fwcloud {Integer} FWcloud ID
	 *       @param firewallData.name {string} Firewall Name
	 *       @param [firewallData.comment] {String}  comment text 
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
	public static insertFirewall(firewallData) {
		return new Promise((resolve, reject) => {
			db.get((error, connection) => {
				if (error) return reject(error);

				connection.query(`INSERT INTO ${tableName} SET ?`, firewallData, (error, result) => {
					if (error) return reject(error);
					resolve(result.insertId);
				});
			});
		});
	};


	/**
	 * UPDATE Firewall
	 *  
	 * @method updateFirewall
	 * 
	 * @param iduser {Integer}  User identifier
	 * @param firewallData {Firewall Object}  Firewall Object data
	 *       @param firewallData.id {NULL} 
	 *       @param firewallData.cluster {Integer} Cluster ID
	 *       @param firewallData.fwcloud {Integer} FWcloud ID
	 *       @param firewallData.name {string} Firewall Name
	 *       @param [firewallData.comment] {String}  comment text 
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
	public static updateFirewall(dbCon, iduser, firewallData) {
		return new Promise((resolve, reject) => {
			var sqlExists = `SELECT T.id FROM ${tableName} T 
			INNER JOIN user__fwcloud U ON T.fwcloud=U.fwcloud AND U.user=${iduser}
			WHERE T.id=${firewallData.id}`;
			dbCon.query(sqlExists, (error, row) => {
				if (error) return reject(error);

				if (row && row.length > 0) {
					var sql = `UPDATE ${tableName} SET name=${dbCon.escape(firewallData.name)},
					comment=${dbCon.escape(firewallData.comment)},
					install_user=${dbCon.escape(firewallData.install_user)},
					install_pass=${dbCon.escape(firewallData.install_pass)},
					save_user_pass=${firewallData.save_user_pass},
					install_interface=${firewallData.install_interface},
					install_ipobj=${firewallData.install_ipobj},
					install_port=${firewallData.install_port},
					by_user=${iduser},
					options=${firewallData.options}
					WHERE id=${firewallData.id}`;
					dbCon.query(sql, (error, result) => {
						if (error) return reject(error);
						resolve(true);
					});
				} else resolve(false);
			});
		});
	};


	// Get the ID of all firewalls who's status field is not zero.
	public static getFirewallStatusNotZero(fwcloud, data) {
		return new Promise((resolve, reject) => {
			db.get((error, connection) => {
				if (error) return reject(error);

				var sql = `SELECT id,cluster,status FROM ${tableName} WHERE status!=0 AND fwcloud=${fwcloud}`;
				connection.query(sql, (error, rows) => {
					if (error) return reject(error);
					if (data) {
						data.fw_status = rows;
						resolve(data);
					} else
						resolve(rows);
				});
			});
		});
	};


	public static updateFirewallStatus(fwcloud, firewall, status_action) {
		return new Promise((resolve, reject) => {
			db.get((error, connection) => {
				if (error) return reject(error);
				let sql = `UPDATE ${tableName} SET status=status${status_action} WHERE id=${firewall} AND fwcloud=${fwcloud}`;
				connection.query(sql, (error, result) => {
					if (error) return reject(error);
					resolve({ "result": true });
				});
			});
		});
	};

	public static updateFirewallCompileDate(fwcloud, firewall) {
		return new Promise((resolve, reject) => {
			db.get((error, connection) => {
				if (error) return reject(error);
				let sql = `UPDATE ${tableName} SET compiled_at=NOW() WHERE id=${firewall} AND fwcloud=${fwcloud}`;
				connection.query(sql, (error, result) => {
					if (error) return reject(error);
					resolve();
				});
			});
		});
	};

	public static updateFirewallInstallDate(fwcloud, firewall) {
		return new Promise((resolve, reject) => {
			db.get((error, connection) => {
				if (error) return reject(error);
				let sql = `UPDATE ${tableName} SET installed_at=NOW() WHERE id=${firewall} AND fwcloud=${fwcloud}`;
				connection.query(sql, (error, result) => {
					if (error) return reject(error);
					resolve();
				});
			});
		});
	};

	public static promoteToMaster(dbCon, firewall) {
		return new Promise((resolve, reject) => {
			dbCon.query(`UPDATE ${tableName} SET fwmaster=1 WHERE id=${firewall}`, (error, result) => {
				if (error) return reject(error);
				resolve();
			});
		});
	};

	public static updateFirewallStatusIPOBJ(fwcloud: any, ipobj: number, ipobj_g: number, _interface: number, type: string | number, status_action: string) {
		return new Promise((resolve, reject) => {
			db.get((error, connection) => {
				if (error) return reject(error);
				var sql = `UPDATE ${tableName} F
				INNER JOIN policy_r PR ON PR.firewall=F.id
				INNER JOIN ${(_interface != -1) ? `policy_r__interface` : `policy_r__ipobj`} PRI ON PRI.rule=PR.id
				SET F.status=F.status${status_action}
				WHERE F.fwcloud=${fwcloud} 
				${(ipobj != -1 || ipobj_g != -1) ? `AND PRI.ipobj=${ipobj} AND PRI.ipobj_g=${ipobj_g}` : ``} AND PRI.interface=${_interface}`;
				connection.query(sql, (error, result) => {
					if (error) return reject(error);

					// If ipobj!=-1 we must see if it is part of a group and then update the status of the firewalls that use that group.
					if (ipobj != -1) {
						sql = 'UPDATE ' + tableName + ' F' +
							' INNER JOIN policy_r PR ON PR.firewall=F.id' +
							' INNER JOIN policy_r__ipobj PRI ON PRI.rule=PR.id' +
							' INNER JOIN ipobj__ipobjg IG ON IG.ipobj_g=PRI.ipobj_g' +
							' SET F.status=F.status' + status_action +
							' WHERE F.fwcloud=' + connection.escape(fwcloud) + ' AND IG.ipobj=' + connection.escape(ipobj);
						connection.query(sql, (error, result) => {
							if (error) return reject(error);

							if (type === 5 || type === "5") { // ADDRESS
								// We must see if the ADDRESS is part of a network interface and then update the status of the firewalls that use that network interface.
								sql = 'UPDATE ' + tableName + ' F' +
									' INNER JOIN policy_r PR ON PR.firewall=F.id' +
									' INNER JOIN policy_r__ipobj PRI ON PRI.rule=PR.id' +
									' INNER JOIN ipobj IPO ON IPO.interface=PRI.interface' +
									' SET F.status=F.status' + status_action +
									' WHERE F.fwcloud=' + connection.escape(fwcloud) + ' AND IPO.id=' + connection.escape(ipobj);
								connection.query(sql, (error, result) => {
									if (error) return reject(error);

									// We must see too if the ADDRESS is part of a network interface that belogns to a host
									// and then update the status of the firewalls that use that host in any of its positions.
									sql = 'UPDATE ' + tableName + ' F' +
										' INNER JOIN policy_r PR ON PR.firewall=F.id' +
										' INNER JOIN policy_r__ipobj PRI ON PRI.rule=PR.id' +
										' INNER JOIN interface__ipobj IO ON IO.ipobj=PRI.ipobj' +
										' INNER JOIN ipobj IPO ON IPO.interface=IO.interface' +
										' SET F.status=F.status' + status_action +
										' WHERE F.fwcloud=' + connection.escape(fwcloud) + ' AND IPO.id=' + connection.escape(ipobj);
									connection.query(sql, (error, result) => {
										if (error) return reject(error);
										resolve({ "result": true });
									});
								});
							} else
								resolve({ "result": true });
						});
					} else
						resolve({ "result": true });
				});
			});
		});
	}

	public static cloneFirewall(iduser, firewallData) {
		return new Promise((resolve, reject) => {
			db.get((error, connection) => {
				if (error) return reject(error);
				var sqlExists = `SELECT T.id FROM ${tableName} T 
					INNER JOIN user__fwcloud U ON T.fwcloud=U.fwcloud AND U.user=${iduser}
					WHERE T.id=${firewallData.id}`;
				connection.query(sqlExists, (error, row) => {
					//NEW FIREWALL
					if (row && row.length > 0) {
						var sql = 'insert into firewall(cluster,fwcloud,name,comment,by_user,status,fwmaster,install_port,options,install_user,install_pass) ' +
							' select cluster,fwcloud,' + connection.escape(firewallData.name) + ',' + connection.escape(firewallData.comment) + ',' + connection.escape(iduser) + ' , 3, fwmaster, install_port, options, "", "" ' +
							' from firewall where id= ' + firewallData.id + ' and fwcloud=' + firewallData.fwcloud;
						connection.query(sql, (error, result) => {
							if (error) return reject(error);
							resolve({ "insertId": result.insertId });
						});
					} else reject(fwcError.NOT_FOUND);
				});
			});
		});
	}

	public static updateFWMaster(iduser, fwcloud, cluster, idfirewall, fwmaster) {
		return new Promise((resolve, reject) => {
			db.get((error, connection) => {
				if (error) return reject(error);
				var sqlExists = `SELECT T.id FROM ${tableName} T 
					INNER JOIN user__fwcloud U ON T.fwcloud=U.fwcloud AND U.user=${iduser}
					WHERE T.id=${idfirewall}`;
				connection.query(sqlExists, (error, row) => {
					if (error) return reject(error);
					if (row && row.length > 0) {
						var sql = 'UPDATE ' + tableName + ' SET ' +
							'fwmaster = ' + fwmaster + ', ' +
							'by_user = ' + connection.escape(iduser) +
							' WHERE id = ' + idfirewall + ' AND fwcloud=' + fwcloud + ' AND cluster=' + cluster;
						connection.query(sql, (error, result) => {
							if (error) return reject(error);
							if (fwmaster == 1) {
								var sql = 'UPDATE ' + tableName + ' SET ' +
									'fwmaster = 0, ' +
									'by_user = ' + connection.escape(iduser) +
									' WHERE id <> ' + idfirewall + ' AND fwcloud=' + fwcloud + ' AND cluster=' + cluster;
								connection.query(sql, (error, result) => {
									if (error) return reject(error);
									resolve({ "result": true });
								});
							} else resolve({ "result": true });
						});
					} else reject(fwcError.NOT_FOUND);
				});
			});
		});
	}

	public static updateFirewallCluster(firewallData) {
		return new Promise((resolve, reject) => {
			db.get((error, connection) => {
				if (error) return reject(error);
				var sqlExists = `SELECT T.id FROM ${tableName} T 
					INNER JOIN user__fwcloud U ON T.fwcloud=U.fwcloud	AND U.user=${firewallData.by_user}
					WHERE T.id=${firewallData.id}`;
				connection.query(sqlExists, (error, row) => {
					if (error) return reject(error);
					if (row && row.length > 0) {
						var sql = 'UPDATE ' + tableName + ' SET cluster = ' + connection.escape(firewallData.cluster) + ',' +
							'by_user = ' + connection.escape(firewallData.by_user) + ' ' +
							' WHERE id = ' + firewallData.id;
						connection.query(sql, (error, result) => {
							if (error) return reject(error);
							resolve({ "result": true });
						});
					} else
						resolve({ "result": false });
				});
			});
		});
	}

	public static removeFirewallClusterSlaves(cluster, fwcloud, callback) {

		db.get((error, connection) => {
			if (error)
				callback(error, null);

			var sql = 'DELETE FROM ' + tableName +
				' WHERE cluster = ' + connection.escape(cluster) + ' AND fwcloud=' + connection.escape(fwcloud) + ' AND fwmaster=0';
			connection.query(sql, (error, result) => {
				if (error) {
					callback(error, null);
				} else {
					callback(null, { "result": true });
				}
			});
		});
	}

	/**
	 * UPDATE Firewall lock status
	 *  
	 * @method updateFirewallLock
	 * 
	 * @param iduser {Integer}  User identifier
	 * @param firewallData {Firewall Object}  Firewall Object data
	 *       @param firewallData.id {NULL} 
	 *       @param firewallData.fwcloud {Integer} FWcloud ID
	 *       @param firewallData.locked {Integer} Locked status
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
	public static updateFirewallLock(firewallData, callback) {

		var locked = 1;
		db.get((error, connection) => {
			if (error)
				callback(error, null);
			var sqlExists = `SELECT T.id FROM ${tableName} T 
				INNER JOIN user__fwcloud U ON T.fwcloud=U.fwcloud AND U.user=${firewallData.iduser}
				WHERE T.id=${firewallData.id}	AND (locked=0 OR (locked=1 AND locked_by=${firewallData.iduser}))`;
			connection.query(sqlExists, (error, row) => {

				if (row && row.length > 0) {
					var sql = 'UPDATE ' + tableName + ' SET locked = ' + connection.escape(locked) + ',' +
						'locked_at = CURRENT_TIMESTAMP ,' +
						'locked_by = ' + connection.escape(firewallData.iduser) + ' ' +
						' WHERE id = ' + firewallData.id;
					connection.query(sql, (error, result) => {
						if (error) {
							callback(error, null);
						} else {
							callback(null, { "result": true });
						}
					});
				} else {
					callback(null, { "result": false });
				}
			});
		});
	};

	/**
	 * UNLOCK Firewall status
	 *  
	 * @method updateFirewallUnlock
	 * 
	 * @param iduser {Integer}  User identifier
	 * @param firewallData {Firewall Object}  Firewall Object data
	 *       @param firewallData.id {NULL} 
	 *       @param firewallData.fwcloud {Integer} FWcloud ID
	 *       @param firewallData.locked {Integer} Locked status
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
	public static updateFirewallUnlock(firewallData, callback) {

		var locked = 0;
		db.get((error, connection) => {
			if (error)
				callback(error, null);
			var sqlExists = `SELECT T.id FROM ${tableName} T 
				INNER JOIN user__fwcloud U ON T.fwcloud=U.fwcloud AND U.user=${firewallData.iduser}
				WHERE T.id=${firewallData.id} AND (locked=1 AND locked_by=${firewallData.iduser})`;
			connection.query(sqlExists, (error, row) => {

				if (row && row.length > 0) {
					var sql = 'UPDATE ' + tableName + ' SET locked = ' + connection.escape(locked) + ',' +
						'locked_at = CURRENT_TIMESTAMP ,' +
						'locked_by = ' + connection.escape(firewallData.iduser) + ' ' +
						' WHERE id = ' + firewallData.id;
					connection.query(sql, (error, result) => {
						if (error) {
							callback(error, null);
						} else {
							callback(null, { "result": true });
						}
					});
				} else {
					callback(null, { "result": false });
				}
			});
		});
	};


	/**
	 * DELETE Firewall
	 *  
	 * @method deleteFirewall
	 * 
	 * @param user {Integer}  User identifier
	 * @param id {Integer}  Firewall identifier
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
	public static deleteFirewall = (user, fwcloud, firewall) => {
		return new Promise((resolve, reject) => {
			db.get((error, dbCon) => {
				if (error) return reject(error);

				var sql = 'select id from fwc_tree where node_type="FW" and id_obj=' + firewall + ' and fwcloud=' + fwcloud;
				dbCon.query(sql, async (error, row) => {
					if (error) return reject(error);

					//If exists Id from firewall to remove
					if (row && row.length > 0) {
						try {
							await PolicyRule.deletePolicy_r_Firewall(firewall); //DELETE POLICY, Objects in Positions and firewall rule groups.
							await OpenVPNPrefix.deletePrefixAll(dbCon, fwcloud, firewall); // Remove all firewall openvpn prefixes.
							await OpenVPN.delCfgAll(dbCon, fwcloud, firewall); // Remove all OpenVPN configurations for this firewall.
							await Interface.deleteInterfacesIpobjFirewall(firewall); // DELETE IPOBJS UNDER INTERFACES
							await Interface.deleteInterfaceFirewall(firewall); //DELETE INTEFACES
							await Tree.deleteFwc_TreeFullNode({ id: row[0].id, fwcloud: fwcloud, iduser: user }); //DELETE TREE NODES From firewall
							await utilsModel.deleteFolder(config.get('policy').data_dir + '/' + fwcloud + '/' + firewall); // DELETE DATA DIRECTORY FOR THIS FIREWALL
							await Firewall.deleteFirewallRow(dbCon, fwcloud, firewall);
							resolve();
						} catch (error) { return reject(error) }
					} else reject(fwcError.NOT_FOUND);
				});
			});
		});
	}


	public static deleteFirewallRow = (dbCon, fwcloud, firewall) => {
		return new Promise((resolve, reject) => {
			dbCon.query(`DELETE FROM ${tableName} WHERE id=${firewall} AND fwcloud=${fwcloud}`, (error, result) => {
				if (error) return reject(error);
				resolve();
			});
		});
	}


	public static deleteFirewallFromCluster = req => {
		return new Promise((resolve, reject) => {
			var sqlExists = `SELECT T.*, A.id as idnode FROM ${tableName} T 
				INNER JOIN user__fwcloud U ON T.fwcloud=U.fwcloud AND U.user=${req.session.user_id}
				INNER JOIN fwc_tree A ON A.id_obj=T.id AND A.node_type="FW"
				WHERE T.id=${req.body.firewall} AND T.cluster=${req.body.cluster}`;
			req.dbCon.query(sqlExists, async (error, row) => {
				if (error) return reject(error);
				if (row.length === 0) return reject(fwcError.NOT_FOUND);

				var rowF = row[0];
				var idNodeFirewall = rowF.idnode;

				// Deleting FIREWAL MASTER
				if (rowF.fwmaster === 1) {
					// Transfer data to the new slave firewall.
					var sql = `SELECT T.id FROM ${tableName} T
						WHERE fwmaster=0 AND  T.cluster=${req.body.cluster}	ORDER by T.id limit 1`;
					req.dbCon.query(sql, async (error, rowS) => {
						if (error) return reject(error);
						if (rowS.length === 0) return reject(fwcError.NOT_FOUND);

						var idNewFM = rowS[0].id;
						try {
							// Rename data directory with the new firewall master id.
							await utilsModel.renameFirewallDataDir(req.body.fwcloud, req.body.firewall, idNewFM);

							// Move all related objects to the new firewall.
							await PolicyRule.moveToOtherFirewall(req.dbCon, req.body.firewall, idNewFM);
							await PolicyGroup.moveToOtherFirewall(req.dbCon, req.body.firewall, idNewFM);
							await Interface.moveToOtherFirewall(req.dbCon, req.body.firewall, idNewFM);
							await OpenVPN.moveToOtherFirewall(req.dbCon, req.body.firewall, idNewFM);

							// Promote the new master.
							await Firewall.promoteToMaster(req.dbCon, idNewFM);

							// Delete the old firewall node.
							await Firewall.deleteFirewallRow(req.dbCon, req.body.fwcloud, req.body.firewall);
						} catch (error) { return reject(error) }

						//UPDATE TREE RECURSIVE FROM IDNODE CLUSTER
						//GET NODE FROM CLUSTER
						sql = `SELECT ${req.body.firewall} as OLDFW, ${idNewFM} as NEWFW, T.* FROM fwc_tree T 
							WHERE node_type='CL' AND id_obj=${req.body.cluster} AND fwcloud=${req.body.fwcloud}`;
						req.dbCon.query(sql, async (error, rowT) => {
							if (error) return reject(error);

							if (rowT && rowT.length > 0) {
								try {
									await Tree.updateIDOBJFwc_TreeFullNode(rowT[0]);

									//DELETE TREE NODES From firewall
									var dataNode = { id: idNodeFirewall, fwcloud: req.body.fwcloud, iduser: req.session.user_id };
									await Tree.deleteFwc_TreeFullNode(dataNode);
								} catch (error) { return reject(error) }
							}
							resolve();
						});
					});
				} else { // Deleting FIREWALL SLAVE
					try {
						//DELETE TREE NODES From firewall
						await Tree.deleteFwc_TreeFullNode({ id: idNodeFirewall, fwcloud: req.body.fwcloud, iduser: req.session.user_id });
						await Firewall.deleteFirewallRow(req.dbCon, req.body.fwcloud, req.body.firewall);
						resolve();
					} catch (error) { reject(error) }
				}
			});
		});
	};

	public static checkBodyFirewall(body, isNew) {
		try {
			return new Promise((resolve, reject) => {
				var param: any = "";
				if (!isNew) {
					param = body.id;
					if (param === undefined || param === '' || isNaN(param) || param == null) {
						reject("Firewall ID not valid");
					}
				}
				param = body.cluster;
				if (param === undefined || param === '' || isNaN(param) || param == null) {
					body.cluster = null;
				}

				param = body.name;
				if (param === undefined || param === '' || param == null) {
					reject("Firewall name not valid");
				}


				param = body.save_user_pass;
				if (param === undefined || param === '' || param == null || param == 0) {
					body.save_user_pass = false;
				} else
					body.save_user_pass = true;
				param = body.install_user;
				if (param === undefined || param === '' || param == null) {
					body.install_user = '';
				}
				param = body.install_pass;
				if (param === undefined || param === '' || param == null) {
					body.install_pass = '';
				}
				param = body.install_interface;
				if (param === undefined || param === '' || isNaN(param) || param == null) {
					body.install_interface = null;
				}
				param = body.install_ipobj;
				if (param === undefined || param === '' || isNaN(param) || param == null) {
					body.install_ipobj = null;
				}
				param = body.install_port;
				if (param === undefined || param === '' || isNaN(param) || param == null) {
					body.install_port = 22;
				}
				param = body.fwmaster;
				if (param === undefined || param === '' || isNaN(param) || param == null) {
					body.fwmaster = 0;
				}
				resolve(body);
			});
		} catch (e) {
			console.error(e);
		}
	};


	public static getFirewallOptions(fwcloud, fw) {
		return new Promise((resolve, reject) => {
			db.get((error, connection) => {
				if (error) return reject(error);

				let sql = 'SELECT options FROM ' + tableName +
					' WHERE fwcloud=' + connection.escape(fwcloud) + ' AND id=' + connection.escape(fw);
				connection.query(sql, (error, rows) => {
					if (error) return reject(error);
					if (rows.length !== 1) return reject(fwcError.NOT_FOUND);
					resolve(rows[0].options);
				});
			});
		});
	}

	public static getMasterFirewallId = (fwcloud, cluster) => {
		return new Promise((resolve, reject) => {
			db.get((error, connection) => {
				if (error) return reject(error);

				let sql = 'SELECT id FROM ' + tableName +
					' WHERE fwcloud=' + connection.escape(fwcloud) + ' AND cluster=' + connection.escape(cluster) + ' AND fwmaster=1';
				connection.query(sql, (error, rows) => {
					if (error) return reject(error);
					if (rows.length !== 1) return reject(fwcError.NOT_FOUND);
					resolve(rows[0].id);
				});
			});
		});
	}

	public static searchFirewallRestrictions = req => {
		return new Promise(async (resolve, reject) => {
			try {
				let search: any = {};
				search.result = false;
				search.restrictions = {};

				let orgFirewallId = req.body.firewall;
				if (req.body.cluster)
					req.body.firewall = await Firewall.getMasterFirewallId(req.body.fwcloud, req.body.cluster);

				/* Verify that the nex firewall/cluster objets are not been used in any rule of other firewall:
					- Interfaces and address of interface.
					- OpenVPN configuration.
							  - OpenVPN prefix configuration.
						  	
						  Verify too that these objects are not being used in any group.
				*/
				const r1: any = await Interface.searchInterfaceUsageOutOfThisFirewall(req);
				const r2: any = await OpenVPN.searchOpenvpnUsageOutOfThisFirewall(req);
				const r3: any = await OpenVPNPrefix.searchPrefixUsageOutOfThisFirewall(req);

				if (r1) search.restrictions = utilsModel.mergeObj(search.restrictions, r1.restrictions);
				if (r2) search.restrictions = utilsModel.mergeObj(search.restrictions, r2.restrictions);
				if (r3) search.restrictions = utilsModel.mergeObj(search.restrictions, r3.restrictions);

				for (let key in search.restrictions) {
					if (search.restrictions[key].length > 0) {
						search.result = true;
						break;
					}
				}
				if (req.body.cluster) req.body.firewall = orgFirewallId;
				resolve(search);
			} catch (error) { reject(error) }
		});
	};


	public static getInterfacesData(SSHconn) {
		return new Promise(async (resolve, reject) => {
			try {
				const data: any = await sshTools.runCommand(SSHconn, "ip a");
				
				// Before answer, parse data to see if we have get a valid answer.

				resolve(data);
			} catch (error) { reject(error) }
		});
	}
}