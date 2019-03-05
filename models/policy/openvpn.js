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
		var sql = `select O.*, FW.id as firewall_id, FW.name as firewall_name, 
			O.openvpn obj_id, CRT.cn obj_name,
			R.id as rule_id, R.type rule_type, 311 as obj_type_id,
			PT.name rule_type_name, O.position as rule_position_id, P.name rule_position_name,
			FW.cluster as cluster_id, IF(FW.cluster is null,null,(select name from cluster where id=FW.cluster)) as cluster_name
		  from policy_r__openvpn O
			inner join policy_r R on R.id=O.rule
			inner join firewall FW on FW.id=R.firewall
			inner join policy_position P on P.id=O.position
			inner join policy_type PT on PT.id=R.type
			inner join openvpn VPN on VPN.id=O.openvpn
			inner join crt CRT on CRT.id=VPN.crt
			where FW.fwcloud=${fwcloud} and O.openvpn=${openvpn}`;
		dbCon.query(sql, (error, rows) => {
			if (error) return reject(error);
			resolve(rows);
		});
	});
};

policyOpenvpnModel.searchOpenvpnInGroup = (dbCon,fwcloud,openvpn) => {
	return new Promise((resolve, reject) => {
		var sql = `select P.*, P.ipobj_g as group_id, G.name as group_name from openvpn__ipobj_g P
			inner join ipobj_g G on G.id=P.ipobj_g
			where G.fwcloud=${fwcloud} and P.openvpn=${openvpn}`;
		dbCon.query(sql, (error, rows) => {
			if (error) return reject(error);
			resolve(rows);
		});
	});
};

policyOpenvpnModel.getConfigsUnderOpenvpnPrefix = (dbCon,openvpn_server_id,prefix_name) => {
	return new Promise((resolve, reject) => {
		// Get all OpenVPN client configs under an openvpn configuration server whose CRT common name matches the prefix name.
		var sql = `select VPN.id from openvpn VPN
			inner join crt CRT on CRT.id=VPN.crt
			where VPN.openvpn=${openvpn_server_id} and CRT.type=1 and CRT.cn like CONCAT(${dbCon.escape(prefix_name)},'%')`;
		dbCon.query(sql, (error, rows) => {
			if (error) return reject(error);
			resolve(rows);
		});
	});
};

policyOpenvpnModel.searchLastOpenvpnInPrefixInRule = (dbCon,fwcloud,openvpn) => {
	return new Promise((resolve, reject) => {
		// Fisrt get all the OpenVPN prefixes in rules to which the openvpn configuration belongs.
		var sql = `select P.rule rule_id, P.prefix, PRE.openvpn, PRE.name, R.type rule_type,
			PT.name rule_type_name, PP.name rule_position_name, R.firewall firewall_id, F.name firewall_name,
			F.cluster as cluster_id, IF(F.cluster is null,null,(select name from cluster where id=F.cluster)) as cluster_name
			from policy_r__openvpn_prefix P
			inner join policy_r R on R.id=P.rule
			inner join firewall F on F.id = R.firewall
			inner join policy_position PP on PP.id=P.position
			inner join policy_type PT on PT.id=R.type
			inner join openvpn_prefix PRE on PRE.id=P.prefix
			inner join openvpn VPN on VPN.openvpn=PRE.openvpn
			inner join crt CRT on CRT.id=VPN.crt
			inner join ca CA on CA.id=CRT.ca
			where CA.fwcloud=${fwcloud} and VPN.id=${openvpn} and CRT.type=1 and CRT.cn like CONCAT(PRE.name,'%')`;
		dbCon.query(sql, async (error, rows) => {
			if (error) return reject(error);

			let result = [];
			try {
				for(let row of rows) {
					let data = await policyOpenvpnModel.getConfigsUnderOpenvpnPrefix(dbCon,row.openvpn,row.name);
					// We are the last OpenVPN client config in the prefix used in and openvpn server and in a rule.
					if (data.length===1 && data[0].id===openvpn) 
						result.push(row);
				}
			} catch(error) { return reject(error) }

			resolve(result);
		});
	});
};

policyOpenvpnModel.searchLastOpenvpnInPrefixInGroup = (dbCon,fwcloud,openvpn) => {
	return new Promise((resolve, reject) => {
		// Fisrt get all the OpenVPN prefixes in groups to which the openvpn configuration belongs.
		var sql = `select P.prefix, PRE.openvpn, PRE.name, GR.id group_id, GR.name group_name
			from openvpn_prefix__ipobj_g P
			inner join ipobj_g GR on GR.id=P.ipobj_g
			inner join openvpn_prefix PRE on PRE.id=P.prefix
			inner join openvpn VPN on VPN.openvpn=PRE.openvpn
			inner join crt CRT on CRT.id=VPN.crt
			inner join ca CA on CA.id=CRT.ca
			where CA.fwcloud=${fwcloud} and VPN.id=${openvpn} and CRT.type=1 and CRT.cn like CONCAT(PRE.name,'%')`;
		dbCon.query(sql, async (error, rows) => {
			if (error) return reject(error);

			let result = [];
			try {
				for(let row of rows) {
					let data = await policyOpenvpnModel.getConfigsUnderOpenvpnPrefix(dbCon,row.openvpn,row.name);
					// We are the last OpenVPN client config in the prefix used in and openvpn server and in a rule.
					if (data.length===1 && data[0].id===openvpn) 
						result.push(row);
				}
			} catch(error) { return reject(error) }

			resolve(result);
		});
	});
};

policyOpenvpnModel.searchOpenvpnInPrefixInRule = (dbCon,fwcloud,openvpn) => {
	return new Promise((resolve, reject) => {
		// Get all the OpenVPN prefixes in rules to which the openvpn configuration belongs.
		var sql = `select R.firewall,P.rule from policy_r__openvpn_prefix P
			inner join openvpn_prefix PRE on PRE.id=P.prefix
			inner join openvpn VPN on VPN.openvpn=PRE.openvpn
			inner join crt CRT on CRT.id=VPN.crt
			inner join policy_r R on R.id=P.rule
			inner join firewall F on F.id=R.firewall
			where F.fwcloud=${fwcloud} and VPN.id=${openvpn} and CRT.type=1 and CRT.cn like CONCAT(PRE.name,'%')`;
		dbCon.query(sql, async (error, result) => {
			if (error) return reject(error);
			resolve(result);
		});
	});
};

policyOpenvpnModel.searchOpenvpnInPrefixInGroup = (dbCon,fwcloud,openvpn) => {
	return new Promise((resolve, reject) => {
		// Get all the OpenVPN prefixes in groups to which the openvpn configuration belongs.
		var sql = `select P.ipobj_g from openvpn_prefix__ipobj_g P
			inner join openvpn_prefix PRE on PRE.id=P.prefix
			inner join openvpn VPN on VPN.openvpn=PRE.openvpn
			inner join crt CRT on CRT.id=VPN.crt
			inner join ca CA on CA.id=CRT.ca
			where CA.fwcloud=${fwcloud} and VPN.id=${openvpn} and CRT.type=1 and CRT.cn like CONCAT(PRE.name,'%')`;
		dbCon.query(sql, async (error, result) => {
			if (error) return reject(error);
			resolve(result);
		});
	});
};

//Export the object
module.exports = policyOpenvpnModel;