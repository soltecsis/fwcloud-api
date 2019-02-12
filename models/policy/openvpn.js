//create object
var policyOpenvpnModel = {};

var tableModel = "policy_r__openvpn";


//Add new policy_r__openvpn
policyOpenvpnModel.insertInRule = req => {
	return new Promise(async (resolve, reject) => {
		var policyOpenvpn = {
			rule: req.body.rule,
			openvpn: req.body.openvpn,
			negate: req.body.negate,
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


//Export the object
module.exports = policyOpenvpnModel;