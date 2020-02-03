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


//create object
var ipobj_type__policy_positionModel = {};
var tableModel="ipobj_type__policy_position";


var logger = require('log4js').getLogger("app");

//Get All ipobj_type__policy_position
ipobj_type__policy_positionModel.getIpobj_type__policy_positions = callback => {
	db.get(function (error, connection) {
		if (error) return callback(error, null);
		connection.query(`SELECT type,position FROM ${tableModel} ORDER BY type,position`, (error, rows) => {
			if (error)
				callback(error, null);
			else
				callback(null, rows);
		});
	});
};





//Get ipobj_type__policy_position by  id
ipobj_type__policy_positionModel.getIpobj_type__policy_position = function (type, position, callback) {
	db.get(function (error, connection) {
		if (error) callback(error, null);
		var sql = 'SELECT type, position, allowed FROM ' + tableModel + ' WHERE type = ' + connection.escape(type) + 'AND  position = ' + connection.escape(position);
		logger.debug(sql);
		connection.query(sql, function (error, row) {
			if (error)
				callback(error, null);
			else
				callback(null, row);
		});
	});
};


//Add new ipobj_type__policy_position
ipobj_type__policy_positionModel.insertIpobj_type__policy_position = function (ipobj_type__policy_positionData, callback) {
	db.get(function (error, connection) {
		if (error) callback(error, null);
		connection.query('INSERT INTO ' + tableModel + ' SET ?', ipobj_type__policy_positionData, function (error, result) {
			if (error) {
				callback(error, null);
			}
			else {
				//devolvemos la última id insertada
				callback(null, { "insertId": 'success' });
			}
		});
	});
};

//Update ipobj_type__policy_position
ipobj_type__policy_positionModel.updateIpobj_type__policy_position = function (ipobj_type__policy_positionData, callback) {

	db.get(function (error, connection) {
		if (error) callback(error, null);
		var sql = 'UPDATE ' + tableModel + ' SET type = ' + connection.escape(ipobj_type__policy_positionData.type) + ' ' +            
			' WHERE type = ' + connection.escape(ipobj_type__policy_positionData.type) + ' position = ' + connection.escape(ipobj_type__policy_positionData.position);
		connection.query(sql, function (error, result) {
			if (error) {
				callback(error, null);
			}
			else {
				callback(null, { "result": true });
			}
		});
	});
};

//Remove ipobj_type__policy_position with id to remove
ipobj_type__policy_positionModel.deleteIpobj_type__policy_position = function (type, position, callback) {
	db.get(function (error, connection) {
		if (error) callback(error, null);
		var sqlExists = 'SELECT * FROM ' + tableModel + ' WHERE type = ' + connection.escape(type) + ' position = ' + connection.escape(position);
		connection.query(sqlExists, function (error, row) {
			//If exists Id from ipobj_type__policy_position to remove
			if (row) {
				db.get(function (error, connection) {
					var sql = 'DELETE FROM ' + tableModel + ' WHERE type = ' + connection.escape(type) + ' position = ' + connection.escape(position);
					connection.query(sql, function (error, result) {
						if (error) {
							callback(error, null);
						}
						else {
							callback(null, { "result": true });
						}
					});
				});
			}
			else {
				callback(null, { "result": false });
			}
		});
	});
};

//Export the object
module.exports = ipobj_type__policy_positionModel;