var db = require('../../db.js');


//create object
var policy_cModel = {};
var tableModel = "policy_c";
var tableModelPolicy = "policy_r";

const firewallModel = require('../../models/firewall/firewall');

var logger = require('log4js').getLogger("app");

//Get All policy_c by firewall
policy_cModel.getPolicy_cs = function (idfirewall, callback) {

	db.get(function (error, connection) {
		if (error)
			callback(error, null);
		//var sql = 'SELECT * FROM ' + tableModel + ' WHERE firewall=' + connection.escape(idfirewall) + ' ORDER BY rule';
		var sql = 'SELECT R.id,R.rule_order,  ' + 
				' ((R.updated_at>=C.updated_at) OR C.updated_at is null) as c_status_recompile, C.rule_compiled as c_compiled, ' +
				' R.comment, R.fw_apply_to, IFNULL(FC.name , F.name) as firewall_name  ' +
				' FROM ' + tableModelPolicy + ' R LEFT JOIN ' + tableModel + ' C ON R.id=C.rule ' + 
				' INNER JOIN firewall F on F.id=R.firewall ' + 
				' LEFT JOIN firewall FC on FC.id=R.fw_apply_to ' +
				' WHERE R.firewall=' + connection.escape(idfirewall) +  ' AND R.active=1 ' +
				' ORDER BY R.type, R.rule_order';
		connection.query(sql, function (error, rows) {
			if (error)
				callback(error, null);
			else
				callback(null, rows);
		});
	});
};

//Get All policy_c by policy type and firewall
policy_cModel.getPolicy_cs_type = function (fwcloud, idfirewall, type, callback) {

	db.get(function (error, connection) {
		if (error)
			callback(error, null);
		//return only: id, rule_order, c_status_recompile, c_compiled, comment
		var sql = 'SELECT R.id,R.rule_order,  ' + 
				' ((R.updated_at>=C.updated_at) OR C.updated_at is null) as c_status_recompile, C.rule_compiled as c_compiled, ' +
				' R.comment, R.fw_apply_to, IFNULL(FC.name , F.name) as firewall_name  ' +
				' FROM ' + tableModelPolicy + ' R LEFT JOIN ' + tableModel + ' C ON R.id=C.rule ' + 
				' INNER JOIN firewall F on F.id=R.firewall ' + 
				' LEFT JOIN firewall FC on FC.id=R.fw_apply_to ' +
				' WHERE R.firewall=' + connection.escape(idfirewall) + ' AND R.type=' + connection.escape(type) + 
				' AND F.fwcloud=' +  connection.escape(fwcloud) + ' AND R.active=1 ' +
				' ORDER BY R.rule_order';          
		 
		connection.query(sql, function (error, rows) {
			if (error)
				callback(error, null);
			else
				callback(null, rows);
		});
	});
};




//Get policy_c by  id and firewall
policy_cModel.getPolicy_c = (fwcloud, firewall, rule) => {
	return new Promise(async (resolve,reject) => { 
		db.get((error, dbCon) => {
			if (error) return reject(error);

			var sql = `SELECT R.id,R.rule_order,
				((R.updated_at>=C.updated_at) OR C.updated_at is null) as c_status_recompile, C.rule_compiled as c_compiled,
				R.comment, R.fw_apply_to, IFNULL(FC.name , F.name) as firewall_name
				FROM ${tableModelPolicy} R LEFT JOIN ${tableModel} C ON R.id=C.rule
				INNER JOIN firewall F on F.id=R.firewall
				LEFT JOIN firewall FC on FC.id=R.fw_apply_to
				WHERE R.firewall=${firewall} AND R.id=${rule}	AND F.fwcloud=${fwcloud}`;
			
			dbCon.query(sql, (error, row) => {
				if (error) return reject(error);
				resolve(row);
			});
		});
	});
};


//Add new policy_c from user
policy_cModel.insertPolicy_c = (policy_cData) => {
	return new Promise((resolve,reject) => { 
		db.get((error, dbCon) => {
			if (error) return reject(error);
			
			let sqlExists = `SELECT * FROM ${tableModel} WHERE rule=${policy_cData.rule} AND firewall=${policy_cData.firewall}`;
			dbCon.query(sqlExists, async (error, row) => {
				if (row && row.length > 0) {
					try {
						await policy_cModel.updatePolicy_c(dbCon,policy_cData);
					} catch(error) { return reject(error) }
				} else {
					let sqlInsert = `INSERT INTO ${tableModel} SET rule=${policy_cData.rule}, firewall=${policy_cData.firewall}, 
					rule_compiled=${dbCon.escape(policy_cData.rule_compiled)}, status_compiled=${dbCon.escape(policy_cData.status_compiled)},
					updated_at=CURRENT_TIMESTAMP`;
					
					dbCon.query(sqlInsert, (error, result) => {
						if (error) return reject(error);
					});
				}
				resolve();
			});
		});
	});
};

//Update policy_c 
policy_cModel.updatePolicy_c = (dbCon, policy_cData) => {
	return new Promise((resolve, reject) => {
		var sql = `UPDATE ${tableModel} SET rule_compiled=${dbCon.escape(policy_cData.rule_compiled)},
			firewall=${policy_cData.firewall}, status_compiled=${policy_cData.status_compiled}, updated_at=CURRENT_TIMESTAMP
			WHERE rule=${policy_cData.rule}`;		
		dbCon.query(sql, (error, result) => {
			if (error) return reject(error);
			resolve();
		});
	});
};

//Remove policy_c with id to remove
policy_cModel.deletePolicy_c = function (fw, rule) {
	return new Promise((resolve, reject) => {
		db.get(function (error, connection) {
			if (error) return reject(error);
			let sql = 'DELETE FROM ' + tableModel + ' WHERE rule=' + connection.escape(rule) + ' AND firewall=' +connection.escape(fw);
			connection.query(sql, function (error, result) {
				if (error) return reject(error);
				resolve();
			});
		});
	});
};

//Remove all policy compilation for a firewall.
policy_cModel.deleteFullFirewallPolicy_c = function (fw) {
	return new Promise((resolve, reject) => {
		db.get(function (error, connection) {
			if (error) return reject(error);
			let sql = 'DELETE FROM ' + tableModel + ' WHERE firewall=' + connection.escape(fw);
			connection.query(sql, (error, result) => {
				if (error) return reject(error);
				resolve();
			});
		});
	});
};

//Remove all policy compilation for a group.
policy_cModel.deleteFullGroupPolicy_c = (dbCon, group) => {
	return new Promise((resolve, reject) => {
		let sql = `DELETE C.* FROM ${tableModel} C
			INNER JOIN policy_r R ON R.id=C.rule
			INNER JOIN policy_r__ipobj G ON G.rule=R.id
			WHERE G.ipobj_g=${group}`;
		dbCon.query(sql, (error, result) => {
			if (error) return reject(error);
			resolve();
		});
	});
};

//Remove policy compilation for the indicated rules.
policy_cModel.deleteRulesCompilation = (fwcloud, rules) => {
	return new Promise(async (resolve, reject) => {
		try {
			for (let rule of rules) {
				await policy_cModel.deletePolicy_c(rule.firewall, rule.rule);
				await firewallModel.updateFirewallStatus(fwcloud,rule.firewall,"|3");
			}
			resolve();
		} catch(error) { reject(error) }
	});
};

//Remove policy compilation for rules that use the indicated group.
policy_cModel.deleteGroupsInRulesCompilation = (dbCon, fwcloud, groups) => {
	return new Promise(async (resolve, reject) => {
		try {
			for(let group of groups) {
				// Invalidate the policy compilation of all affected rules.
				await policy_cModel.deleteFullGroupPolicy_c(dbCon, group.ipobj_g);
				// Update affected firewalls status.
				await firewallModel.updateFirewallStatusIPOBJ(fwcloud, -1, group.ipobj_g, -1, -1, "|3");
			}
			resolve();
		} catch(error) { reject(error) }
	});
};

//Export the object
module.exports = policy_cModel;