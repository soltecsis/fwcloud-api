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
import db from '../../database/database-manager';
import { Column, MoreThan, MoreThanOrEqual, LessThan, LessThanOrEqual, Between, Entity, PrimaryColumn, getRepository } from "typeorm";
import modelEventService from "../ModelEventService";
import { IPObj } from "../ipobj/IPObj";

var logger = require('log4js').getLogger("app");


const tableName: string = 'interface__ipobj';

@Entity(tableName)
export class InterfaceIPObj extends Model {

	@PrimaryColumn()
	interface: number;

	@PrimaryColumn()
	ipobj: number;

	@Column()
	interface_order: string;

	@Column()
	created_at: Date;

	@Column()
	updated_at: Date;

	@Column()
	created_by: number;

	@Column()
	updated_by: number;

	public getTableName(): string {
		return tableName;
	}

	//Get All interface__ipobj by interface
	public static getInterface__ipobjs_interface(_interface, callback) {

		db.get((error, connection) => {
			if (error)
				callback(error, null);
			var sql = 'SELECT * FROM ' + tableName + ' WHERE interface=' + connection.escape(_interface) + ' ORDER BY interface_order';
			connection.query(sql, (error, rows) => {
				if (error)
					callback(error, null);
				else
					callback(null, rows);
			});
		});
	}

	//Get All interface__ipobj by ipobj
	public static getInterface__ipobjs_ipobj(ipobj, callback) {

		db.get((error, connection) => {
			if (error)
				callback(error, null);
			var sql = 'SELECT * FROM ' + tableName + ' WHERE ipobj=' + connection.escape(ipobj) + ' ORDER BY interface_order';
			connection.query(sql, (error, rows) => {
				if (error)
					callback(error, null);
				else
					callback(null, rows);
			});
		});
	}



	//Get interface__ipobj by interface and ipobj
	public static getInterface__ipobj(_interface, ipobj, callback) {
		db.get((error, connection) => {
			if (error)
				callback(error, null);
			var sql = 'SELECT * FROM ' + tableName + ' WHERE interface = ' + connection.escape(_interface) + ' AND ipobj=' + connection.escape(ipobj);
			connection.query(sql, (error, row) => {
				if (error)
					callback(error, null);
				else
					callback(null, row);
			});
		});
	}

	//Search Interface in hosts
	public static getInterface__ipobj_hosts(_interface, fwcloud) {
		return new Promise((resolve, reject) => {
			db.get((error, connection) => {
				if (error) return reject(error);
				var sql = 'SELECT I.id obj_id,I.name obj_name, I.interface_type obj_type_id,T.type obj_type_name, ' +
					'C.id cloud_id, C.name cloud_name, H.id host_id, H.name host_name, H.type host_type, TH.type host_type_name ' +
					'FROM interface__ipobj O ' +
					'inner join  interface I on I.id=O.interface ' +
					'inner join ipobj_type T on T.id=I.interface_type ' +
					'inner join ipobj H on H.id=O.ipobj ' +
					'inner join ipobj_type TH on TH.id=H.type ' +
					'left join fwcloud C on C.id=H.fwcloud ' +
					' WHERE O.interface=' + _interface + ' AND (H.fwcloud=' + fwcloud + ' OR H.fwcloud is NULL) ORDER BY interface_order';
				connection.query(sql, (error, rows) => {
					if (error) return reject(error);
					resolve(rows);
				});
			});
		});
	}

	//Add new interface__ipobj 
	public static insertInterface__ipobj(dbCon, interface__ipobjData) {
		return new Promise((resolve, reject) => {
			dbCon.query(`INSERT INTO ${tableName} SET ?`, interface__ipobjData, (error, result) => {
				if (error) return reject(error);
				resolve(result.affectedRows > 0 ? result.insertId : null);
			});
		});
	}

	//Update interface__ipobj 
	public static async updateInterface__ipobj(get_interface, get_ipobj, get_interface_order, interface__ipobjData, callback) {

		await this.OrderList(interface__ipobjData.interface_order, get_interface, get_interface_order);

		db.get((error, connection) => {
			if (error)
				callback(error, null);
			var sql = 'UPDATE ' + tableName + ' SET ' +
				'interface = ' + connection.escape(interface__ipobjData.interface) + ',' +
				'ipobj = ' + connection.escape(interface__ipobjData.ipobj) + ',' +
				'interface_order = ' + connection.escape(interface__ipobjData.interface_order) + ' ' +
				' WHERE interface = ' + connection.escape(get_interface) + ' AND ipobj=' + connection.escape(get_ipobj);
			connection.query(sql, (error, result) => {
				if (error) {
					callback(error, null);
				} else {
					callback(null, { "result": true });
				}
			});
		});
	}

	//Update ORDER interface__ipobj
	public static async updateInterface__ipobj_order(new_order, interface__ipobjData, callback) {

		await this.OrderList(new_order, interface__ipobjData.interface, interface__ipobjData.interface_order);

		db.get((error, connection) => {
			if (error)
				callback(error, null);
			var sql = 'UPDATE ' + tableName + ' SET ' +
				'interface_order = ' + connection.escape(new_order) + ' ' +
				' WHERE interface = ' + connection.escape(interface__ipobjData.interface) + ' AND ipobj=' + connection.escape(interface__ipobjData.ipobj);
			connection.query(sql, (error, result) => {
				if (error) {
					callback(error, null);
				} else {
					callback(null, { "result": true });
				}
			});
		});
	}

	//UPDATE HOST IF IPOBJ IS UNDER 
	public static UpdateHOST(_interface) {
		return new Promise((resolve, reject) => {
			db.get((error, connection) => {
				if (error)
					reject(error);
				var sql = 'UPDATE ipobj H  ' +
					'inner join interface__ipobj I on I.ipobj=H.id ' +
					'set H.updated_at= CURRENT_TIMESTAMP ' +
					' WHERE I.interface = ' + connection.escape(_interface);
				logger.debug(sql);
				connection.query(sql, async (error, result) => {
					if (error) {
						logger.debug(error);
						reject(error);
					} else {
						if (result.affectedRows > 0) {
							const interfaceToIpObjs: InterfaceIPObj[] = await getRepository(InterfaceIPObj).find({
								interface: _interface
							})

							for(let i = 0; i < interfaceToIpObjs.length; i++) {
								await modelEventService.emit('update', IPObj, interfaceToIpObjs[i].ipobj);
							}
							resolve({ "result": true });
						} else {
							resolve({ "result": false });
						}
					}
				});
			});
		});
	}



	private static async OrderList(new_order, _interface, old_order) {

		return new Promise<any>((resolve, reject) => {
			var increment = '+1';
			var order1 = new_order;
			var order2 = old_order;
			if (new_order > old_order) {
				increment = '-1';
				order1 = old_order;
				order2 = new_order;
			}

			db.get((error, connection) => {
				if (error)
					reject(error);
				var sql = 'UPDATE ' + tableName + ' SET ' +
						'interface_order = interface_order' + increment +
						' WHERE interface = ' + connection.escape(_interface) +
						' AND interface_order>=' + order1 + ' AND interface_order<=' + order2;
				connection.query(sql, (error, result) => {
					if (error) {
						reject(error);
					}

					resolve(result);
				});
			});
		});
	}


	public static deleteHostInterface(dbCon, host, _interface) {
		return new Promise((resolve, reject) => {
			dbCon.query(`DELETE FROM ${tableName} WHERE interface=${_interface} and ipobj=${host}`, (error, result) => {
				if (error) return reject(error);
				resolve();
			});
		});
	}
}