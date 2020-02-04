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


import db from '../../database/DatabaseService';
import { Entity, PrimaryGeneratedColumn, Column, UpdateDateColumn, CreateDateColumn, getRepository } from 'typeorm';
import Logger from 'log4js';

const logger = Logger.getLogger("app");

const tableName = "policy_g";

@Entity(tableName)
export class PolicyGroup {

	@PrimaryGeneratedColumn()
	id: number;

	@Column()
	name: string;

	@Column()
	comment: string;

	@Column()
	firewall: number;

	@Column()
	idgroup: number;

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

	static getTableName(): string {
		return tableName;
	}

	//Delete policy group if it is empty.
	/**
	 * 
	 * @param dbCon Database connection
	 * @param firewall Firewall id
	 * @param group 
	 */
	public deleteIfEmpty(dbCon, firewall) {
		return new Promise((resolve, reject) => {
			let sql = 'SELECT count(*) AS n FROM policy_r WHERE idgroup=' + this.id + ' AND firewall=' + firewall;
			dbCon.query(sql, (error, rows) => {
				if (error) return reject(error);

				// Only delete if the group is empty.
				if (rows[0].n > 0) return resolve();

				sql = 'DELETE FROM ' + tableName + ' WHERE id=' + this.id;
				dbCon.query(sql, (error, rows) => {
					if (error) return reject(error);
					resolve();
				});
			});
		});
	};
}

