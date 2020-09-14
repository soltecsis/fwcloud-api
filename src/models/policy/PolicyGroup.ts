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


import { Entity, PrimaryGeneratedColumn, Column, UpdateDateColumn, CreateDateColumn, ManyToOne, JoinColumn, OneToMany, BeforeRemove } from 'typeorm';
import db from '../../database/database-manager';

import Model from '../Model';
import { PolicyRule } from './PolicyRule';
import { Firewall } from '../firewall/Firewall';
import { logger } from '../../fonaments/abstract-application';

const tableName = "policy_g";

@Entity(tableName)
export class PolicyGroup extends Model {

	@PrimaryGeneratedColumn()
	id: number;

	@Column()
	name: string;

	@Column()
	comment: string;

	@CreateDateColumn()
	created_at: Date;

	@UpdateDateColumn()
	updated_at: Date;

	@Column()
	created_by: Number;

	@Column()
	updated_by: Number;

	@Column()
	groupstyle: string;

	@Column({name: 'firewall'})
	firewallId: number;

	@ManyToOne(type => Firewall, firewall => firewall.policyGroups)
	@JoinColumn({
		name: 'firewall'
	})
	firewall: Firewall;

	@Column({name: 'idgroup'})
	parentId: number;

	@ManyToOne(type => PolicyGroup, policyGroup => policyGroup.childs)
	@JoinColumn({
		name: 'idgroup'
	})
	parent: PolicyGroup

	@OneToMany(type => PolicyGroup, policyGroup => policyGroup.parent)
	childs: Array<PolicyGroup>

	@OneToMany(type => PolicyRule, policyRule => policyRule.policyGroup)
	policyRules: Array<PolicyRule>;

	public getTableName(): string {
		return tableName;
	}

	@BeforeRemove()
	async unassignPolicyRulesBeforeRemove() {
		await PolicyRule.update({policyGroupId: this.id},{policyGroupId: null})
	}

	//Get All policy_g by firewall
	public static getPolicy_gs(idfirewall, callback) {

		db.get((error, connection) => {
			if (error)
				callback(error, null);
			var sql = 'SELECT * FROM ' + tableName + ' WHERE firewall=' + connection.escape(idfirewall) + ' ORDER BY id';
			connection.query(sql, (error, rows) => {
				if (error)
					callback(error, null);
				else
					callback(null, rows);
			});
		});
	}

	//Get All policy_g by firewall and group father
	public static getPolicy_gs_group(idfirewall, idgroup, callback) {

		db.get((error, connection) => {
			if (error)
				callback(error, null);
			var sql = 'SELECT * FROM ' + tableName + ' WHERE firewall=' + connection.escape(idfirewall) + ' AND idgroup=' + connection.escape(idgroup) + ' ORDER BY id';
			connection.query(sql, (error, rows) => {
				if (error)
					callback(error, null);
				else
					callback(null, rows);
			});
		});
	}

	//Get policy_g by  id and firewall
	public static getPolicy_g(idfirewall, id, callback) {
		db.get((error, connection) => {
			if (error)
				callback(error, null);
			var sql = 'SELECT * FROM ' + tableName + ' WHERE id = ' + connection.escape(id) + ' AND firewall=' + connection.escape(idfirewall);
			connection.query(sql, (error, row) => {
				if (error)
					callback(error, null);
				else
					callback(null, row);
			});
		});
	}

	//Add new policy_g from user
	public static insertPolicy_g(policy_gData, callback) {
		db.get((error, connection) => {
			if (error)
				callback(error, null);
			var sqlExists = 'SELECT * FROM ' + tableName + '  WHERE id = ' + connection.escape(policy_gData.id) + ' AND firewall=' + connection.escape(policy_gData.firewall);

			connection.query(sqlExists, (error, row) => {
				if (row && row.length > 0) {
					logger().debug("GRUPO Existente: " + policy_gData.id);
					callback(null, { "insertId": policy_gData.id });

				} else {
					const sqlInsert = 'INSERT INTO ' + tableName + ' SET firewall=' + policy_gData.firewall + ", name=" + connection.escape(policy_gData.name) + ", comment=" + connection.escape(policy_gData.comment);
					connection.query(sqlInsert, (error, result) => {
						if (error) {
							callback(error, null);
						} else {
							//devolvemos la última id insertada
							logger().debug("CREADO nuevo GRUPO: " + result.insertId);
							callback(null, { "insertId": result.insertId });
						}
					});
				}
			});
		});
	};

	//Update policy_g from user
	public static updatePolicy_g(policy_gData, callback) {

		db.get((error, connection) => {
			if (error)
				callback(error, null);
			var sql = 'UPDATE ' + tableName + ' SET name = ' + connection.escape(policy_gData.name) + ',' +
				'firewall = ' + connection.escape(policy_gData.firewall) + ',' +
				'comment = ' + connection.escape(policy_gData.comment) + ' ' +
				' WHERE id = ' + policy_gData.id;

			connection.query(sql, (error, result) => {
				if (error) {
					callback(error, null);
				} else {
					callback(null, { "result": true });
				}
			});
		});
	};

	//Update policy_g NAME 
	public static updatePolicy_g_name(policy_gData, callback) {

		db.get((error, connection) => {
			if (error)
				callback(error, null);
			var sql = 'UPDATE ' + tableName + ' SET name = ' + connection.escape(policy_gData.name) + ' ' +
				' WHERE id = ' + policy_gData.id;

			connection.query(sql, (error, result) => {
				if (error) {
					callback(error, null);
				} else {
					callback(null, { "result": true });
				}
			});
		});
	};

	//Update policy_r Style
	public static updatePolicy_g_Style(firewall, id, style, callback) {

		db.get((error, connection) => {
			if (error)
				callback(error, null);

			var sql = 'UPDATE ' + tableName + ' SET ' +
				'groupstyle = ' + connection.escape(style) + ' ' +
				' WHERE id = ' + connection.escape(id) + " and firewall=" + connection.escape(firewall);
			connection.query(sql, (error, result) => {
				if (error) {
					logger().error(error);
					callback(error, null);
				} else {
					if (result.affectedRows > 0) {
						callback(null, { "result": true });
					} else
						callback(null, { "result": false });
				}
			});
		});
	};

	//Remove policy_g with id to remove
	//FALTA BORRADO EN CASCADA 
	public static deletePolicy_g(idfirewall, id, callback) {
		db.get((error, connection) => {
			if (error)
				callback(error, null);
			var sqlExists = 'SELECT * FROM ' + tableName + '  WHERE id = ' + connection.escape(id) + ' AND firewall=' + connection.escape(idfirewall);
			connection.query(sqlExists, (error, row) => {
				//If exists Id from policy_g to remove
				if (row) {
					db.get((error, connection) => {
						var sql = 'DELETE FROM ' + tableName + ' WHERE id = ' + connection.escape(id);
						connection.query(sql, (error, result) => {
							if (error) {
								callback(error, null);
							} else {
								callback(null, { "result": true, "msg": "deleted" });
							}
						});
					});
				} else {
					callback(null, { "result": false });
				}
			});
		});
	};


	//Clone policy groups
	public static clonePolicyGroups(idFirewall, idNewFirewall) {
		return new Promise((resolve, reject) => {
			db.get((error, connection) => {
				if (error) return reject(error);

				let sql = 'select ' + connection.escape(idNewFirewall) + ' as newfirewall,id,firewall,name,comment,idgroup,groupstyle' +
					' from ' + tableName + ' where firewall=' + connection.escape(idFirewall);
				connection.query(sql, (error, rows) => {
					if (error) return reject(error);

					//Bucle for each policy group.
					Promise.all(rows.map(data => this.cloneGroup(data)))
						.then(data => resolve(data))
						.catch(error => reject(error));
				});
			});
		});
	};

	public static cloneGroup(rowData) {
		return new Promise((resolve, reject) => {
			db.get((error, connection) => {
				if (error) return reject(error);

				let sql = 'INSERT INTO ' + tableName + ' (firewall,name,comment,idgroup,groupstyle)' +
					' VALUES(' + connection.escape(rowData.newfirewall) + ',' +
					connection.escape(rowData.name) + ',' + connection.escape(rowData.comment) + ',' +
					connection.escape(rowData.idgroup) + ',' + connection.escape(rowData.groupstyle) + ')';
				connection.query(sql, (error, result) => {
					if (error) return reject(error);

					sql = 'UPDATE policy_r SET idgroup=' + connection.escape(result.insertId) +
						' WHERE idgroup=' + connection.escape(rowData.id) + ' AND firewall=' + connection.escape(rowData.newfirewall);
					connection.query(sql, async (error, result) => {
						if (error) return reject(error);
						resolve();
					});
				});
			});
		});
	};

	//Clone policy groups
	public static deleteFirewallGroups(idFirewall) {
		return new Promise((resolve, reject) => {
			db.get((error, connection) => {
				if (error) return reject(error);

				let sql = 'DELETE FROM ' + tableName + ' WHERE firewall=' + connection.escape(idFirewall);
				connection.query(sql, (error, rows) => {
					if (error) return reject(error);
					resolve();
				});
			});
		});
	};

	//Move rules from one firewall to other.
	public static moveToOtherFirewall(dbCon, src_firewall, dst_firewall) {
		return new Promise((resolve, reject) => {
			dbCon.query(`UPDATE ${tableName} SET firewall=${dst_firewall} WHERE firewall=${src_firewall}`, (error, result) => {
				if (error) return reject(error);
				resolve();
			});
		});
	};
}

