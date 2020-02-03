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
var Policy_r__ipobjModel = require('../../models/policy/policy_r__ipobj');

//create object
var ipobj__ipobjgModel = {};

//Export the object
module.exports = ipobj__ipobjgModel;

var tableModel = "ipobj__ipobjg";


//Add new ipobj__ipobjg
ipobj__ipobjgModel.insertIpobj__ipobjg = req => {
	return new Promise((resolve, reject) => {
		var ipobj__ipobjgData = {
			ipobj_g: req.body.ipobj_g,
			ipobj: req.body.ipobj
		};
		req.dbCon.query(`INSERT INTO ${tableModel} SET ?`, ipobj__ipobjgData, (error, result) => {
			if (error) return reject(error);
			resolve(result.insertId);
		});
	});
};


//FALTA comprobar si el Grupo está en alguna Regla
//Remove ipobj__ipobjg with id to remove
ipobj__ipobjgModel.deleteIpobj__ipobjg = (dbCon, ipobj_g, ipobj) => {
	return new Promise((resolve, reject) => {
		let sql = `DELETE FROM ${tableModel} WHERE ipobj_g=${ipobj_g} AND ipobj=${ipobj}`;		
		dbCon.query(sql, (error, result) => {
			if (error) return reject(error);
			resolve();
		});
	});
};

//Remove ipobj__ipobjg with id to remove
ipobj__ipobjgModel.deleteIpobj__ipobjgAll = (dbCon, ipobj_g) => {
	return new Promise((resolve, reject) => {
		dbCon.query(`DELETE FROM ${tableModel} WHERE ipobj_g=${ipobj_g}`, (error, result) => {
			if (error) return reject(error);
			
			dbCon.query(`DELETE FROM openvpn_prefix__ipobj_g WHERE ipobj_g=${ipobj_g}`, (error, result) => {
				if (error) return reject(error);

				dbCon.query(`DELETE FROM openvpn__ipobj_g WHERE ipobj_g=${ipobj_g}`, (error, result) => {
					if (error) return reject(error);
					resolve();
				});
			});
		});
	});
};

//check if IPOBJ Exists in GROUP 
ipobj__ipobjgModel.searchIpobjInGroup = (ipobj, type, fwcloud) => {
	return new Promise((resolve, reject) => {
		db.get((error, connection) => {
			if (error) return reject(error);
			var sql = `SELECT I.id obj_id,I.name obj_name, I.type obj_type_id,T.type obj_type_name,
				C.id cloud_id, C.name cloud_name, GR.id group_id, GR.name group_name, GR.type group_type
				FROM ${tableModel} G
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
};

//check if addr host exists in a group 
ipobj__ipobjgModel.searchAddrHostInGroup = (dbCon, fwcloud, host) => {
	return new Promise((resolve, reject) => {
		let sql = `SELECT I.id obj_id,I.name obj_name, I.type obj_type_id,T.type obj_type_name,
			C.id cloud_id, C.name cloud_name, GR.id group_id, GR.name group_name, GR.type group_type
			FROM ${tableModel} G
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
};

