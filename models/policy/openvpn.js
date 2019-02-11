//create object
var policyOpenvpnModel = {};

var tableModel = "policy_r__openvpn";


//Add new policy_r__openvpn
policyOpenvpnModel.create = (idfirewall, policy_r__interfaceData) => {
	return new Promise((resolve, reject) => {
			//Check if IPOBJ TYPE is ALLOWED in this Position
		checkInterfacePosition(idfirewall, policy_r__interfaceData.rule, policy_r__interfaceData.interface, policy_r__interfaceData.position, function(error, data) {
			if (error) return reject(error);
			allowed = data;
			if (allowed) {
				db.get(function(error, connection) {
					if (error) return reject(error);
					connection.query('INSERT INTO ' + tableModel + ' SET ?', policy_r__interfaceData, function(error, result) {
						if (error)return reject(error);
						if (result.affectedRows > 0) {
							OrderList(policy_r__interfaceData.position_order, policy_r__interfaceData.rule, policy_r__interfaceData.position, 999999, policy_r__interfaceData.interface);
							resolve({ "result": true, "allowed": "1" });
						} else
							resolve({ "result": false, "allowed": "1" });
					});
				});
			} else {
				callback(null, { "result": false, "allowed": "0" });
			}
		});
	});
};


//Export the object
module.exports = policyOpenvpnModel;