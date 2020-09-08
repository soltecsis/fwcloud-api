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


import db from '../../database/database-manager';
import Model from "../Model";
import { PolicyRule } from './PolicyRule';
import { Firewall } from '../../models/firewall/Firewall';
import { Column, Entity, PrimaryColumn, ManyToOne, JoinTable, JoinColumn, OneToOne } from 'typeorm';

const tableName: string = 'policy_c';

@Entity(tableName)
export class PolicyCompilation extends Model {

	@PrimaryColumn({name: 'rule'})
	policyRuleId: number;

	@OneToOne(type => PolicyRule, policyRule => policyRule.compilation)
	@JoinColumn({
		name: 'rule'
	})
	policyRule: PolicyRule;

	@Column()
	rule_compiled: string;

	@Column()
	created_at: Date;

	@Column()
	updated_at: Date;

	@Column()
	created_by: number;

	@Column()
	updated_by: number;

	@Column()
	status_compiled: number;

	public getTableName(): string {
		return tableName;
	}

	//Get All policy_c by firewall
	public static getPolicy_cs(idfirewall, callback) {

		db.get((error, connection) => {
			if (error)
				callback(error, null);
			//var sql = 'SELECT * FROM ' + tableName + ' WHERE firewall=' + connection.escape(idfirewall) + ' ORDER BY rule';
			var sql = 'SELECT R.id,R.rule_order,  ' +
				' ((R.updated_at>=C.updated_at) OR C.updated_at is null) as c_status_recompile, C.rule_compiled as c_compiled, ' +
				' R.comment, R.fw_apply_to, IFNULL(FC.name , F.name) as firewall_name  ' +
				' FROM ' + (new PolicyRule).getTableName() + ' R LEFT JOIN ' + tableName + ' C ON R.id=C.rule ' +
				' INNER JOIN firewall F on F.id=R.firewall ' +
				' LEFT JOIN firewall FC on FC.id=R.fw_apply_to ' +
				' WHERE R.firewall=' + connection.escape(idfirewall) + ' AND R.active=1 ' +
				' ORDER BY R.type, R.rule_order';
			connection.query(sql, (error, rows) => {
				if (error)
					callback(error, null);
				else
					callback(null, rows);
			});
		});
	};

	//Get All policy_c by policy type and firewall
	public static getPolicy_cs_type(fwcloud, idfirewall, type, callback) {

		db.get((error, connection) => {
			if (error)
				callback(error, null);
			//return only: id, rule_order, c_status_recompile, c_compiled, comment
			var sql = 'SELECT R.id,R.rule_order,  ' +
				' ((R.updated_at>=C.updated_at) OR C.updated_at is null) as c_status_recompile, C.rule_compiled as c_compiled, ' +
				' R.comment, R.fw_apply_to, IFNULL(FC.name , F.name) as firewall_name  ' +
				' FROM ' + (new PolicyRule).getTableName() + ' R LEFT JOIN ' + tableName + ' C ON R.id=C.rule ' +
				' INNER JOIN firewall F on F.id=R.firewall ' +
				' LEFT JOIN firewall FC on FC.id=R.fw_apply_to ' +
				' WHERE R.firewall=' + connection.escape(idfirewall) + ' AND R.type=' + connection.escape(type) +
				' AND F.fwcloud=' + connection.escape(fwcloud) + ' AND R.active=1 ' +
				' ORDER BY R.rule_order';

			connection.query(sql, (error, rows) => {
				if (error)
					callback(error, null);
				else
					callback(null, rows);
			});
		});
	};




	//Get policy_c by  id and firewall
	public static getPolicy_c(fwcloud, firewall, rule) {
		return new Promise(async (resolve, reject) => {
			db.get((error, dbCon) => {
				if (error) return reject(error);

				var sql = `SELECT R.id,R.rule_order,
				((R.updated_at>=C.updated_at) OR C.updated_at is null) as c_status_recompile, C.rule_compiled as c_compiled,
				R.comment, R.fw_apply_to, IFNULL(FC.name , F.name) as firewall_name
				FROM ${(new PolicyRule).getTableName()} R LEFT JOIN ${tableName} C ON R.id=C.rule
				INNER JOIN firewall F on F.id=R.firewall
				LEFT JOIN firewall FC on FC.id=R.fw_apply_to
				WHERE R.firewall=${firewall} AND R.id=${rule}	AND F.fwcloud=${fwcloud}`;

				dbCon.query(sql, (error, row) => {
					if (error) return reject(error);
					resolve(row);
				});
			});
		});
	};


	//Add new policy_c from user
	public static insertPolicy_c(policy_cData) {
		return new Promise((resolve, reject) => {
			db.get((error, dbCon) => {
				if (error) return reject(error);

				let sqlExists = `SELECT * FROM ${tableName} WHERE rule=${policy_cData.rule}`;
				dbCon.query(sqlExists, async (error, row) => {
					if (row && row.length > 0) {
						try {
							await this.updatePolicy_c(dbCon, policy_cData);
						} catch (error) { return reject(error) }
					} else {
						let sqlInsert = `INSERT INTO ${tableName} SET rule=${policy_cData.rule},  
					rule_compiled=${dbCon.escape(policy_cData.rule_compiled)}, 
					status_compiled=${dbCon.escape(policy_cData.status_compiled)},
					updated_at=CURRENT_TIMESTAMP`;

						dbCon.query(sqlInsert, (error, result) => {
							if (error) return reject(error);
						});
					}
					resolve();
				});
			});
		});
	};

	//Update policy_c 
	public static updatePolicy_c(dbCon, policy_cData) {
		return new Promise((resolve, reject) => {
			var sql = `UPDATE ${tableName} SET rule_compiled=${dbCon.escape(policy_cData.rule_compiled)},
			status_compiled=${policy_cData.status_compiled}, updated_at=CURRENT_TIMESTAMP
			WHERE rule=${policy_cData.rule}`;
			dbCon.query(sql, (error, result) => {
				if (error) return reject(error);
				resolve();
			});
		});
	};

	//Remove policy_c with id to remove
	public static deletePolicy_c(rule) {
		return new Promise((resolve, reject) => {
			db.get((error, connection) => {
				if (error) return reject(error);
				connection.query(`DELETE FROM ${tableName} WHERE rule=${rule}`, (error, result) => {
					if (error) return reject(error);
					resolve();
				});
			});
		});
	};

	//Remove all policy compilation for a firewall.
	public static deleteFullFirewallPolicy_c(dbCon, firewall) {
		return new Promise((resolve, reject) => {
			let sql = `DELETE C.* FROM ${tableName} C 
			INNER JOIN policy_r R on R.id=C.rule
			WHERE R.firewall=${firewall}`;
			dbCon.query(sql, (error, result) => {
				if (error) return reject(error);
				resolve();
			});
		});
	};

	//Remove all policy compilation for a group.
	public static deleteFullGroupPolicy_c(dbCon, group) {
		return new Promise((resolve, reject) => {
			let sql = `DELETE C.* FROM ${tableName} C
			INNER JOIN policy_r R ON R.id=C.rule
			INNER JOIN policy_r__ipobj G ON G.rule=R.id
			WHERE G.ipobj_g=${group}`;
			dbCon.query(sql, (error, result) => {
				if (error) return reject(error);
				resolve();
			});
		});
	};

	//Remove policy compilation for the indicated rules.
	public static deleteRulesCompilation(fwcloud, rules) {
		return new Promise(async (resolve, reject) => {
			try {
				for (let rule of rules) {
					await this.deletePolicy_c(rule.rule);
					await Firewall.updateFirewallStatus(fwcloud, (rule.firewall) ? rule.firewall : rule.firewall_id, "|3");
				}
				resolve();
			} catch (error) { reject(error) }
		});
	};

	//Remove policy compilation for rules that use the indicated group.
	public static deleteGroupsInRulesCompilation(dbCon, fwcloud, groups) {
		return new Promise(async (resolve, reject) => {
			try {
				for (let group of groups) {
					// Invalidate the policy compilation of all affected rules.
					await this.deleteFullGroupPolicy_c(dbCon, group.ipobj_g);
					// Update affected firewalls status.
					await Firewall.updateFirewallStatusIPOBJ(fwcloud, -1, group.ipobj_g, -1, -1, "|3");
				}
				resolve();
			} catch (error) { reject(error) }
		});
	};
}