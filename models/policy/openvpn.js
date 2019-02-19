//create object
var policyOpenvpnModel = {};

var tableModel = "policy_r__openvpn";


//Add new policy_r__openvpn
policyOpenvpnModel.insertInRule = req => {
	return new Promise(async (resolve, reject) => {
		var policyOpenvpn = {
			rule: req.body.rule,
			openvpn: req.body.openvpn,
			position: req.body.position,
			position_order: req.body.position_order
		};
		req.dbCon.query(`insert into ${tableModel} set ?`, policyOpenvpn, (error, result) => {
			if (error) return reject(error);
			resolve(result.insertId);
		});
	});
};

policyOpenvpnModel.checkOpenvpnPosition = (dbCon,position) => {
	return new Promise((resolve, reject) => {
		dbCon.query(`select type from ipobj_type__policy_position where type=311 and position=${position}`, (error, rows) => {
			if (error) return reject(error);
			resolve((rows.length>0)?1:0);
		});
	});
};


policyOpenvpnModel.checkExistsInPosition = (dbCon,rule,openvpn,position) => {
	return new Promise((resolve, reject) => {
		let sql = `SELECT rule FROM ${tableModel}
			WHERE rule=${rule} AND openvpn=${openvpn} AND position=${position}`;
		dbCon.query(sql, (error, rows) => {
			if (error) return reject(error);
			resolve((rows.length>0)?1:0);
		});
	});
};


policyOpenvpnModel.moveToNewPosition = req => {
	return new Promise((resolve, reject) => {
		let sql = `UPDATE ${tableModel} SET rule=${req.body.new_rule}, position=${req.body.new_position}
			WHERE rule=${req.body.rule} AND openvpn=${req.body.openvpn} AND position=${req.body.position}`;
		req.dbCon.query(sql, (error, rows) => {
			if (error) return reject(error);
			resolve();
		});
	});
};


policyOpenvpnModel.deleteFromRulePosition = req => {
	return new Promise((resolve, reject) => {
		let sql = `DELETE FROM ${tableModel} WHERE rule=${req.body.rule} AND openvpn=${req.body.openvpn} AND position=${req.body.position}`;
		req.dbCon.query(sql, (error, rows) => {
			if (error) return reject(error);
			resolve();
		});
	});
};

policyOpenvpnModel.deleteFromRule = (dbCon,rule) => {
	return new Promise((resolve, reject) => {
		dbCon.query(`DELETE FROM ${tableModel} WHERE rule=${rule}`, (error, rows) => {
			if (error) return reject(error);
			resolve();
		});
	});
};


//Duplicate policy_r__openvpn RULES
policyOpenvpnModel.duplicatePolicy_r__openvpn = (dbCon, rule, new_rule) => {
	return new Promise((resolve, reject) => {
		let sql = `INSERT INTO ${tableModel} (rule, openvpn, position,position_order, negate)
			(SELECT ${new_rule}, openvpn, position, position_order, negate
			from ${tableModel} where rule=${rule} order by  position, position_order)`;
		dbCon.query(sql, (error, result) => {
			if (error) return reject(error);
			resolve();
		});
	});
};


policyOpenvpnModel.searchOpenvpnInRule = (dbCon,fwcloud,openvpn) => {
	return new Promise((resolve, reject) => {
		var sql = `select * from policy_r__openvpn P
			inner join policy_r R on R.id=P.rule
			inner join firewall F on F.id=R.firewall
			where F.fwcloud=${fwcloud} and P.openvpn=${openvpn}`;
		dbCon.query(sql, (error, rows) => {
			if (error) return reject(error);
			resolve(rows);
		});
	});
};

policyOpenvpnModel.searchOpenvpnInGroup = (dbCon,fwcloud,openvpn) => {
	return new Promise((resolve, reject) => {
		var sql = `select * from openvpn__ipobj_g P
			inner join ipobj_g G on G.id=P.ipobj_g
			where G.fwcloud=${fwcloud} and P.openvpn=${openvpn}`;
		dbCon.query(sql, (error, rows) => {
			if (error) return reject(error);
			resolve(rows);
		});
	});
};

policyOpenvpnModel.searchOpenvpnInPrefixInRule = (dbCon,fwcloud,openvpn) => {
	return new Promise((resolve, reject) => {
		var sql = `select * from policy_r__prefix P
			inner join prefix PRE on PRE.id=P.prefix
			where G.fwcloud=${fwcloud} and P.openvpn=${openvpn}`;
		dbCon.query(sql, (error, rows) => {
			if (error) return reject(error);
			resolve(rows);
		});
	});
};

policyOpenvpnModel.searchOpenvpnInPrefixInGroup = (dbCon,fwcloud,openvpn) => {
	return new Promise((resolve, reject) => {
/*		var sql = `select * from openvpn__ipobj_g P
			inner join ipobj_g G on G.id=P.ipobj_g
			where G.fwcloud=${fwcloud} and P.openvpn=${openvpn}`;
		dbCon.query(sql, (error, rows) => {
			if (error) return reject(error);
			resolve(rows);
		});*/
	});
};

//Export the object
module.exports = policyOpenvpnModel;