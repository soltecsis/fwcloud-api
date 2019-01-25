var db = require('../../db.js');


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