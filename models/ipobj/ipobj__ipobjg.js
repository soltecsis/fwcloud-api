var db = require('../../db.js');
var Policy_r__ipobjModel = require('../../models/policy/policy_r__ipobj');

//create object
var ipobj__ipobjgModel = {};

//Export the object
module.exports = ipobj__ipobjgModel;

var tableModel = "ipobj__ipobjg";


var logger = require('log4js').getLogger("app");




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
ipobj__ipobjgModel.deleteIpobj__ipobjg = function (fwcloud,ipobj_g, ipobj, callback) {
	//CHECK IPOBJ OR GROUP IN RULE
	Policy_r__ipobjModel.checkGroupInRule(ipobj_g,  fwcloud, function (error, data) {
		if (error) {
			callback(error, null);
		} else {
			logger.debug(data);
			if (!data.result) {
				db.get(function (error, connection) {
					if (error)
						callback(error, null);
					var sqlExists = 'SELECT * FROM ' + tableModel + ' WHERE ipobj_g = ' + connection.escape(ipobj_g) + ' AND ipobj=' + connection.escape(ipobj);
					
					connection.query(sqlExists, function (error, row) {
						//If exists Id from ipobj__ipobjg to remove
						if (row.length>0) {
							db.get(function (error, connection) {
								var sql = 'DELETE FROM ' + tableModel + ' WHERE ipobj_g = ' + connection.escape(ipobj_g) + ' AND ipobj=' + connection.escape(ipobj);
								
								connection.query(sql, function (error, result) {
									if (error) {
										logger.debug("ERROR SQL:" , error);
										callback(error, null);
									} else {
										
										if (result.affectedRows > 0)
											callback(null, {"result": true, "msg": "deleted", "alert": data.msg });
										else
											callback(null, {"result": false, "msg": "notExist"});
									}
								});
							});
						} else {
							callback(null, {"result": false, "msg": "notExist"});
						}
					});
				});
			}
			else
				callback(null, {"msg": "Restricted"});
		}
	});
};

//Remove ipobj__ipobjg with id to remove
ipobj__ipobjgModel.deleteIpobj__ipobjgAll = function (ipobj_g, callback) {
	db.get(function (error, connection) {

		var sql = 'DELETE FROM ' + tableModel + ' WHERE ipobj_g = ' + connection.escape(ipobj_g);
		connection.query(sql, function (error, result) {
			if (error) {
				callback(error, null);
			} else {
				callback(null, {"result": true, "msg": "deleted"});
			}
		});


	});
};

//check if IPOBJ Exists in GROUP 
ipobj__ipobjgModel.searchIpobjGroup = (ipobj, type, fwcloud) => {
	return new Promise((resolve, reject) => {
		db.get((error, connection) => {
			if (error) return reject(error);
			var sql = 'SELECT I.id obj_id,I.name obj_name, I.type obj_type_id,T.type obj_type_name, ' +
				'C.id cloud_id, C.name cloud_name, GR.id group_id, GR.name group_name, GR.type group_type ' +
				'FROM ' + tableModel + ' G  ' +
				'INNER JOIN ipobj_g GR ON GR.id=G.ipobj_g ' +
				'INNER JOIN  ipobj I on I.id=G.ipobj ' +
				'inner join ipobj_type T on T.id=I.type ' +
				'left join fwcloud C on C.id=I.fwcloud ' +
				' WHERE I.id=' + ipobj + ' AND I.type=' + type + ' AND (I.fwcloud=' + fwcloud + ' OR I.fwcloud IS NULL)';
			connection.query(sql, (error, rows) => {
				if (error) return reject(error);
				resolve(rows);
			});
		});
	});
};

