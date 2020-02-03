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
var ipobj_typeModel = {};
var tableModel="ipobj_type";


var logger = require('log4js').getLogger("app");

//Get All ipobj_type
ipobj_typeModel.getIpobj_types = function (callback) {

	db.get(function (error, connection) {
		if (error) callback(error, null);
		connection.query('SELECT * FROM ' + tableModel + ' ORDER BY id', function (error, rows) {
			if (error)
				callback(error, null);
			else
				callback(null, rows);
		});
	});
};


//Get ipobj_type by  id
ipobj_typeModel.getIpobj_type = (req, id) => {
	return new Promise((resolve, reject) => {
		req.dbCon.query(`SELECT * FROM ${tableModel} WHERE id=${id}`, (error, row) => {
			if (error) return reject(error);
			resolve(row);
		});
	});
};

//Export the object
module.exports = ipobj_typeModel;