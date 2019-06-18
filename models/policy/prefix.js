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


//create object
var policyPrefixModel = {};

var tableModel = "policy_r__openvpn_prefix";


//Add new policy_r__openvpn_prefix
policyPrefixModel.insertInRule = req => {
	return new Promise(async (resolve, reject) => {
		var policyPrefix = {
			rule: req.body.rule,
			prefix: req.body.prefix,
			position: req.body.position,
			position_order: req.body.position_order
		};
		req.dbCon.query(`insert into ${tableModel} set ?`, policyPrefix, (error, result) => {
			if (error) return reject(error);
			resolve(result.insertId);
		});
	});
};

policyPrefixModel.checkPrefixPosition = (dbCon,position) => {
	return new Promise((resolve, reject) => {
		dbCon.query(`select type from ipobj_type__policy_position where type=401 and position=${position}`, (error, rows) => {
			if (error) return reject(error);
			resolve((rows.length>0)?1:0);
		});
	});
};


policyPrefixModel.checkExistsInPosition = (dbCon,rule,prefix,openvpn,position) => {
	return new Promise((resolve, reject) => {
		let sql = `SELECT rule FROM ${tableModel}
			WHERE rule=${rule} AND prefix=${prefix} AND position=${position}`;
		dbCon.query(sql, (error, rows) => {
			if (error) return reject(error);
			resolve((rows.length>0)?1:0);
		});
	});
};


policyPrefixModel.moveToNewPosition = req => {
	return new Promise((resolve, reject) => {
		let sql = `UPDATE ${tableModel} SET rule=${req.body.new_rule}, position=${req.body.new_position}
			WHERE rule=${req.body.rule} AND prefix=${req.body.prefix} AND position=${req.body.position}`;
		req.dbCon.query(sql, (error, rows) => {
			if (error) return reject(error);
			resolve();
		});
	});
};


policyPrefixModel.deleteFromRulePosition = req => {
	return new Promise((resolve, reject) => {
		let sql = `DELETE FROM ${tableModel} WHERE rule=${req.body.rule} AND prefix=${req.body.prefix} AND position=${req.body.position}`;
		req.dbCon.query(sql, (error, rows) => {
			if (error) return reject(error);
			resolve();
		});
	});
};

policyPrefixModel.deleteFromRule = (dbCon,rule) => {
	return new Promise((resolve, reject) => {
		dbCon.query(`DELETE FROM ${tableModel} WHERE rule=${rule}`, (error, rows) => {
			if (error) return reject(error);
			resolve();
		});
	});
};

//Duplicate policy_r__openvpn_prefix RULES
policyPrefixModel.duplicatePolicy_r__prefix = (dbCon, rule, new_rule) => {
	return new Promise((resolve, reject) => {
		let sql = `INSERT INTO ${tableModel} (rule, prefix, position, position_order)
			(SELECT ${new_rule}, prefix, position, position_order
			from ${tableModel} where rule=${rule} order by  position, position_order)`;
		dbCon.query(sql, (error, result) => {
			if (error) return reject(error);
			resolve();
		});
	});
};


//Export the object
module.exports = policyPrefixModel;