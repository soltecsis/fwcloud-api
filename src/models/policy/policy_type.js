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
var policy_typeModel = {};
var tableModel="policy_type";


var logger = require('log4js').getLogger("app");

//Get All policy_type
policy_typeModel.getPolicy_types = function (callback) {

	db.get(function (error, connection) {
		if (error) callback(error, null);
		connection.query('SELECT * FROM ' + tableModel + ' ORDER BY type_order', function (error, rows) {
			if (error)
				callback(error, null);
			else
				callback(null, rows);
		});
	});
};





//Get policy_type by  type
policy_typeModel.getPolicy_type = function (id, callback) {
	db.get(function (error, connection) {
		if (error) callback(error, null);
		var sql = 'SELECT * FROM ' + tableModel + ' WHERE id = ' + connection.escape(id);
		connection.query(sql, function (error, row) {
			if (error)
				callback(error, null);
			else{                
				callback(null, row);
			}
		});
	});
};

//Get policy_type by  type Letter
policy_typeModel.getPolicy_typeL = function (id, callback) {
	db.get(function (error, connection) {
		if (error) callback(error, null);
		var sql = 'SELECT * FROM ' + tableModel + ' WHERE type = ' + connection.escape(id);
		connection.query(sql, function (error, row) {
			if (error)
				callback(error, null);
			else{                
				callback(null, row);
			}
		});
	});
};

//Get policy_type by name
policy_typeModel.getPolicy_typeName = function (name, callback) {
	db.get(function (error, connection) {
		if (error) callback(error, null);
		var namesql = '%' + name + '%';
		var sql = 'SELECT * FROM ' + tableModel + ' WHERE name like  ' + connection.escape(namesql) + ' ORDER BY type_order' ;
		connection.query(sql, function (error, row) {
			if (error)
				callback(error, null);
			else
				callback(null, row);
		});
	});
};



//Add new policy_type
policy_typeModel.insertPolicy_type = function (policy_typeData, callback) {
	db.get(function (error, connection) {
		if (error) callback(error, null);
		connection.query('INSERT INTO ' + tableModel + ' SET ?', policy_typeData, function (error, result) {
			if (error) {
				callback(error, null);
			}
			else {
				//devolvemos la última id insertada
				callback(null, { "insertId": result.insertId });
			}
		});
	});
};

//Update policy_type
policy_typeModel.updatePolicy_type = function (policy_typeData, callback) {

	db.get(function (error, connection) {
		if (error) callback(error, null);
		var sql = 'UPDATE ' + tableModel + ' SET name = ' + connection.escape(policy_typeData.name) + ', ' +            
				' SET type = ' + connection.escape(policy_typeData.type) + ', ' +            
				' SET id = ' + connection.escape(policy_typeData.id) + ' ' +            
			' WHERE type = ' + policy_typeData.type;
			logger.debug(sql);
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

//Remove policy_type with type to remove
policy_typeModel.deletePolicy_type = function (type, callback) {
	db.get(function (error, connection) {
		if (error) callback(error, null);
		var sqlExists = 'SELECT * FROM ' + tableModel + ' WHERE type = ' + connection.escape(type);
		connection.query(sqlExists, function (error, row) {
			//If exists Id from policy_type to remove
			if (row) {
				db.get(function (error, connection) {
					var sql = 'DELETE FROM ' + tableModel + ' WHERE type = ' + connection.escape(type);
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
module.exports = policy_typeModel;