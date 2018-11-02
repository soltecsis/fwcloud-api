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
ipobj_typeModel.getIpobj_type = function (id, callback) {
	db.get(function (error, connection) {
		if (error) callback(error, null);
		var sql = 'SELECT * FROM ' + tableModel + ' WHERE id = ' + connection.escape(id);
		connection.query(sql, function (error, row) {
			if (error)
				callback(error, null);
			else
				callback(null, row);
		});
	});
};

//Export the object
module.exports = ipobj_typeModel;