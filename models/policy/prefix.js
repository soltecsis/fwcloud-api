//create object
var policyPrefixModel = {};

var tableModel = "policy_r__prefix";


//Add new policy_r__prefix
policyPrefixModel.insertInRule = req => {
	return new Promise(async (resolve, reject) => {
		var policyPrefix = {
			rule: req.body.rule,
			prefix: req.body.prefix,
			openvpn: req.body.openvpn,
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
		dbCon.query(`select type from ipobj_type__policy_position where type=400 and position=${position}`, (error, rows) => {
			if (error) return reject(error);
			resolve((rows.length>0)?1:0);
		});
	});
};


policyPrefixModel.checkExistsInPosition = (dbCon,rule,prefix,openvpn,position) => {
	return new Promise((resolve, reject) => {
		let sql = `SELECT rule FROM ${tableModel}
			WHERE rule=${rule} AND prefix=${prefix} AND openvpn=${openvpn} AND position=${position}`;
		dbCon.query(sql, (error, rows) => {
			if (error) return reject(error);
			resolve((rows.length>0)?1:0);
		});
	});
};


policyPrefixModel.moveToNewPosition = req => {
	return new Promise((resolve, reject) => {
		let sql = `UPDATE ${tableModel} SET rule=${req.body.new_rule}, position=${req.body.new_position}
			WHERE rule=${req.body.rule} AND prefix=${req.body.prefix} AND openvpn=${req.body.openvpn} AND position=${req.body.position}`;
		req.dbCon.query(sql, (error, rows) => {
			if (error) return reject(error);
			resolve();
		});
	});
};


policyPrefixModel.deleteFromRulePosition = req => {
	return new Promise((resolve, reject) => {
		let sql = `DELETE FROM ${tableModel} WHERE rule=${req.body.rule} AND prefix=${req.body.prefix} AND openvpn=${req.body.openvpn} AND position=${req.body.position}`;
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

//Duplicate policy_r__prefix RULES
policyPrefixModel.duplicatePolicy_r__prefix = (dbCon, rule, new_rule) => {
	return new Promise((resolve, reject) => {
		let sql = `INSERT INTO ${tableModel} (rule, prefix, openvpn, position, position_order, negate)
			(SELECT ${new_rule}, prefix, openvpn, position, position_order, negate
			from ${tableModel} where rule=${rule} order by  position, position_order)`;
		dbCon.query(sql, (error, result) => {
			if (error) return reject(error);
			resolve();
		});
	});
};

policyPrefixModel.searchPrefixInRule = (dbCon,fwcloud,prefix,openvpn) => {
	return new Promise((resolve, reject) => {
		var sql = `select * from policy_r__prefix P
			inner join policy_r R on R.id=P.rule
			inner join firewall F on F.id=R.firewall
			where F.fwcloud=${fwcloud} and P.prefix=${prefix} and P.openvpn=${openvpn}`;
		dbCon.query(sql, (error, rows) => {
			if (error) return reject(error);
			resolve(rows);
		});
	});
};

policyPrefixModel.searchPrefixInGroup = (dbCon,fwcloud,prefix,openvpn) => {
	return new Promise((resolve, reject) => {
		var sql = `select * from prefix__ipobj_g P
			inner join ipobj_g G on G.id=P.ipobj_g
			where G.fwcloud=${fwcloud} and P.prefix=${prefix} and P.openvpn=${openvpn}`;
		dbCon.query(sql, (error, rows) => {
			if (error) return reject(error);
			resolve(rows);
		});
	});
};


//Export the object
module.exports = policyPrefixModel;