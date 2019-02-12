var db = require('../../db.js');


//create object
var policyPositionModel = {};
var tableModel = "policy_position";
var Policy_r__ipobjModel = require('./policy_r__ipobj');

var logger = require('log4js').getLogger("app");

//Get All policy_position
policyPositionModel.getPolicy_positions = function (callback) {
	db.get(function (error, connection) {
		if (error)
			callback(error, null);
		connection.query('SELECT * FROM ' + tableModel + ' ORDER BY position_order', function (error, rows) {
			if (error)
				callback(error, null);
			else
				callback(null, rows);
		});
	});
};



//Get policy_position by  type
policyPositionModel.getPolicyPositionsByType = (dbCon,type) => {
	return new Promise((resolve, reject) => {
		dbCon.query(`SELECT * FROM ${tableModel} WHERE policy_type=${type} ORDER BY position_order`, (error, result) => {
			if (error) return reject(error);
			resolve(result);
		});
	});
};

//Get policy_position by  type
policyPositionModel.getPolicy_positionsTypePro = function (data) {
	return new Promise((resolve, reject) => {
		db.get(function (error, connection) {
			if (error) return reject(error);
			
			var sql = `SELECT ${data.fwcloud} as fwcloud,${data.firewall} as firewall,${data.id} as rule, P.* 
				FROM ${tableModel} P WHERE P.policy_type=${data.type} ORDER BY P.position_order`;
			connection.query(sql, function (error, rows) {
				if (error) return reject(error);

				//Bucle por POSITIONS
				//logger.debug("DENTRO de BUCLE de POSITIONS REGLA: " + data.id + " --> " + rows.length + " Positions");
				Promise.all(rows.map(Policy_r__ipobjModel.getPolicy_r__ipobjs_interfaces_positionPro))
				.then(dataP => {                                
					data.positions = dataP;                                
					resolve(data);                                
				})
				.catch(e => reject(e));                                        
			});
		});
	});
};



//Get policy_position by  id
policyPositionModel.getPolicy_position = function (id, callback) {
	db.get(function (error, connection) {
		if (error)
			callback(error, null);
		var sql = 'SELECT * FROM ' + tableModel + ' WHERE id = ' + connection.escape(id);
		connection.query(sql, function (error, row) {
			if (error)
				callback(error, null);
			else
				callback(null, row);
		});
	});
};


//Add new policy_position
policyPositionModel.insertPolicy_position = function (policy_positionData, callback) {
	db.get(function (error, connection) {
		if (error)
			callback(error, null);
		connection.query('INSERT INTO ' + tableModel + ' SET ?', policy_positionData, function (error, result) {
			if (error) {
				callback(error, null);
			} else {
				//devolvemos la última id insertada
				callback(null, {"insertId": result.insertId});
			}
		});
	});
};

//Update policy_position
policyPositionModel.updatePolicy_position = function (policy_positionData, callback) {

	db.get(function (error, connection) {
		if (error)
			callback(error, null);
		var sql = 'UPDATE ' + tableModel + ' SET name = ' + connection.escape(policy_positionData.name) + ', ' +
				'policy_type = ' + connection.escape(policy_positionData.poicy_type) + ', ' +
				'position_order = ' + connection.escape(policy_positionData.position_order) + ', ' +
				'content = ' + connection.escape(policy_positionData.content) + ' ' +
				' WHERE id = ' + policy_positionData.id;
		logger.debug(sql);
		connection.query(sql, function (error, result) {
			if (error) {
				callback(error, null);
			} else {
				callback(null, {"result": true});
			}
		});
	});
};

//Remove policy_position with id to remove
policyPositionModel.deletePolicy_position = function (id, callback) {
	db.get(function (error, connection) {
		if (error)
			callback(error, null);
		var sqlExists = 'SELECT * FROM ' + tableModel + ' WHERE id = ' + connection.escape(id);
		connection.query(sqlExists, function (error, row) {
			//If exists Id from policy_position to remove
			if (row) {
				db.get(function (error, connection) {
					var sql = 'DELETE FROM ' + tableModel + ' WHERE id = ' + connection.escape(id);
					connection.query(sql, function (error, result) {
						if (error) {
							callback(error, null);
						} else {
							callback(null, {"result": true});
						}
					});
				});
			} else {
				callback(null, {"result": false});
			}
		});
	});
};

//Export the object
module.exports = policyPositionModel;