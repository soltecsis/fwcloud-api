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
var accessCtrl = {};
//Export the object
export default accessCtrl;

import { User } from '../models/user/User';
import { Firewall } from '../models/firewall/Firewall';
import { logger } from '../fonaments/abstract-application';

const fwcError = require('../utils/error_table');


// Access control for fwclouds and firewalls.
// We have already validated the input data.
accessCtrl.check = async (req, res, next) => {
	// Access control excluded URLs.
	if ((req.method === 'POST' && req.url === '/user/login') ||
		(req.method === 'GET' && req.url === '/ipobj/types') ||
		(req.method === 'GET' && req.url === '/policy/types') ||
		(req.method === 'GET' && req.url === '/ipobj/positions/policy') ||
		(req.method === 'POST' && req.url === '/fwcloud') ||
		(req.method === 'GET' && req.url === '/fwcloud/all/get') ||
		(req.method === 'GET' && req.url === '/stream') ||
		(req.method === 'PUT' && req.url === '/updates/updater'))
		return next();

	logger().debug("---------------- RECEIVED HEADERS-----------------");
	logger().debug("\n", req.headers);
	logger().debug("--------------------------------------------------");
	logger().debug("METHOD: " + req.method + "   PATHNAME: " + req.url);


	// Check access to customer and user creation functionality.
	if (req.url.substring(0,5)==="/user" || req.url.substring(0,9)==="/customer") {
		// Allow the logged user to change its own password.
		if (req.url==='/user/changepass')
			return next();
		
		// Any user can end the session.
		if (req.url==='/user/logout')
			return next();

		// All other customer and user changes are only allowed to administrator users.
	 	if (await User.isLoggedUserAdmin(req))
			return next();
		
		logger().debug("Error during access_control: " + JSON.stringify(fwcError.NOT_ADMIN_USER));
		return res.status(400).json(fwcError.NOT_ADMIN_USER);
	}

	try {
		// This MUST be the first access control.
		if (req.body.fwcloud && !(await checkFwCloudAccess(req)))
			throw fwcError.ACC_FWCLOUD;

		// Check firewall access for the user.
		if (req.body.firewall) {
			const accessData = { iduser: req.session.user_id, fwcloud: req.body.fwcloud, firewall: req.body.firewall };
			if (!(await Firewall.getFirewallAccess(accessData)))
				throw fwcError.ACC_FIREWALL;
		}

		// Check access to the tree cluster indicated in req.body.cluster.
		if (req.body.cluster || (req.body.clusterData && req.body.clusterData.cluster)) {
			if (!(await checkClusterAccess(req,req.body.cluster ? req.body.cluster : req.body.clusterData.cluster)))
				throw fwcError.ACC_CLUSTER;
		}
		
		// Check access to the tree node indicated in req.body.node_id.
		if (req.body.node_id) {
			if (!(await checkTreeNodeAccess(req)))
				throw fwcError.ACC_TREE_NODE;
		}

		// Check access to the CA indicated in req.body.ca.
		if (req.body.ca) {
			if (!(await checkCAAccess(req)))
				throw fwcError.ACC_CA;
		}

		// Check access to the crt indicated in req.body.crt.
		if (req.body.crt) {
			if (!(await checkCrtAccess(req)))
				throw fwcError.ACC_CRT;
		}

		// Check access to the openvpn indicated in req.body.openvpn.
		if (req.body.openvpn) {
			if (!(await checkOpenVPNAccess(req)))
				throw fwcError.ACC_OPENVPN;
		}

		// Check access to the wireguard indicated in req.body.wireguard.
		if (req.body.wireguard) {
			if (!(await checkWireguardAccess(req)))
				throw fwcError.ACC_WIREGUARD;
		}

		// Check access to the CRT prefix indicated in req.body.prefix.
		if (req.body.prefix) {
			if (!(await checkPrefixAccess(req)))
				throw fwcError.ACC_CRT_PREFIX;
		}

		// Check access to the rule indicated by req.body.rule o req.body.new_rule.
		if (req.body.rule) {
			if (!(await checkPolicyRuleAccess(req,req.body.rule)))
				throw fwcError.ACC_POLICY_RULE;
		}
		if (req.body.new_rule) {
			if (!(await checkPolicyRuleAccess(req,req.body.new_rule)))
				throw fwcError.ACC_POLICY_RULE;
		}
		if (req.body.rulesIds) {
			for (let rule of req.body.rulesIds) {
				if (!(await checkPolicyRuleAccess(req,rule)))
					throw fwcError.ACC_POLICY_RULE;
			}	
		}

		// Check access to the iptables mark indicated by req.body.mark parameter.
		if (req.body.mark) {
			if (!(await checkIptablesMarkAccess(req)))
				throw fwcError.ACC_IPTABLES_MARK;
		}
		
		next()
	} catch(error) {
		logger().debug("Error during access_control: " + JSON.stringify(error));
		res.status(400).json(error);
	}
};

// Check access to the firewalls cluster.
function checkClusterAccess(req,cluster) {
	return new Promise((resolve, reject) => {
		req.dbCon.query(`select id FROM cluster WHERE id=${cluster} and fwcloud=${req.body.fwcloud}`, (error, result) => {
			if (error) return reject(error);
			if (result.length!==1) return resolve(false);
			resolve(true);
		});
	});
};

// Check access to iptables mark object.
function checkIptablesMarkAccess(req) {
	return new Promise((resolve, reject) => {
		req.dbCon.query(`select id from mark where id=${req.body.mark} and fwcloud=${req.body.fwcloud}`, (error, result) => {
			if (error) return reject(error);
			if (result.length!==1) return resolve(false);

			resolve(true);
		});
	});
};


// Check access to firewall policy rule.
function checkPolicyRuleAccess(req, rule) {
	return new Promise((resolve, reject) => {
	 let sql = `select R.id FROM policy_r R
			INNER JOIN firewall F ON F.id=R.firewall
			INNER JOIN fwcloud C ON C.id=F.fwcloud
			WHERE R.id=${rule} AND F.id=${req.body.firewall} and C.id=${req.body.fwcloud}`;
		req.dbCon.query(sql, (error, result) => {
			if (error) return reject(error);
			if (result.length!==1) return resolve(false);

			resolve(true);
		});
	});
};

// Check access to CA.
function checkCAAccess(req) {
	return new Promise((resolve, reject) => {
	 let sql = 'select * FROM ca WHERE id='+req.body.ca;
		req.dbCon.query(sql, (error, result) => {
			if (error) return reject(error);

			// Check that fwcloud of the CA is the same fwcloud indicated in the req.body.fwcloud.
			// We have already verified that the user has access to the fwcloud indicated in req.body.fwcloud.
			if (result.length!==1 || req.body.fwcloud!==result[0].fwcloud) return resolve(false);

			// Store the ca info for use in the API call processing.
			req.ca = result[0];

			resolve(true);
		});
	});
};

// Check access to certificate.
function checkCrtAccess(req) {
	return new Promise((resolve, reject) => {
	 let sql = `select R.*,A.fwcloud FROM crt R
			INNER JOIN ca A ON R.ca=A.id
			WHERE R.id=${req.body.crt}`;
		req.dbCon.query(sql, (error, result) => {
			if (error) return reject(error);

			// Check that fwcloud of the CA of the CRT is the same fwcloud indicated in the req.body.fwcloud.
			// We have already verified that the user has access to the fwcloud indicated in req.body.fwcloud.
			if (result.length!==1 || req.body.fwcloud!==result[0].fwcloud) return resolve(false);

			// Store the crt info for use in the API call processing.
			req.crt = result[0];

			resolve(true);
		});
	});
};

// Check access to openvpn configuration.
function checkOpenVPNAccess(req) {
	return new Promise((resolve, reject) => {
		let sql = `select F.fwcloud,O.*,CRT.* FROM openvpn O
			INNER JOIN firewall F ON O.firewall=F.id
			INNER JOIN crt CRT ON CRT.id=O.crt
			WHERE O.id=${req.body.openvpn}`;
		req.dbCon.query(sql, (error, result) => {
			if (error) return reject(error);

			// Check that fwcloud of the CA of the OpenVPN config is the same fwcloud indicated in the req.body.fwcloud.
			// We have already verified that the user has access to the fwcloud indicated in req.body.fwcloud.
			if (result.length!==1 || req.body.fwcloud!==result[0].fwcloud) return resolve(false);

			// Store the crt info for use in the API call processing.
			req.openvpn = result[0];

			resolve(true);
		});
	});
};

// Check access to wireguard configuration.
function checkWireguardAccess(req) {
	return new Promise((resolve, reject) => {
		let sql = `select F.fwcloud,W.*,CRT.* FROM wireguard W
			INNER JOIN firewall F ON W.firewall=F.id
			INNER JOIN crt CRT ON CRT.id=W.crt
			WHERE W.id=${req.body.wireguard}`;
		req.dbCon.query(sql, (error, result) => {
			if (error) return reject(error);

			// Check that fwcloud of the CA of the OpenVPN config is the same fwcloud indicated in the req.body.fwcloud.
			// We have already verified that the user has access to the fwcloud indicated in req.body.fwcloud.
			if (result.length!==1 || req.body.fwcloud!==result[0].fwcloud) return resolve(false);

			// Store the crt info for use in the API call processing.
			req.wireguard = result[0];

			resolve(true);
		});
	});
};


// Check access to CRT Prefix.
function checkPrefixAccess(req) {
	return new Promise((resolve, reject) => {
		let sql;
		const item = req.url.split('/');
    if (item[1]==='vpn' && item[2]==='pki' && item[3]==='prefix') {
			sql = `select CA.fwcloud,P.* FROM ca_prefix P
				INNER JOIN ca CA ON CA.id=P.ca
				WHERE P.id=${req.body.prefix}`;
		}
		else if ((item[1]==='vpn' && item[2]==='openvpn' && item[3]==='prefix') || (item[1]==='policy' && item[2]==='prefix')
			|| (item[1]==='ipobj' && item[2]==='group' && item[3]==='addto')) {
			sql = `select FW.fwcloud,P.* FROM openvpn_prefix P
				INNER JOIN openvpn VPN ON VPN.id=P.openvpn
				INNER JOIN firewall FW ON FW.id=VPN.firewall
				WHERE P.id=${req.body.prefix}`;
		}
		else resolve(false);

		req.dbCon.query(sql, (error, result) => {
			if (error) return reject(error);

			// Check that fwcloud of the CA of the CRT prefix row is the same fwcloud indicated in the req.body.fwcloud.
			// We have already verified that the user has access to the fwcloud indicated in req.body.fwcloud.
			if (result.length!==1 || req.body.fwcloud!==result[0].fwcloud) return resolve(false);

			// Store the prefix info for use in the API call processing.
			req.prefix = result[0];

			resolve(true);
		});
	});
};


// Check access to the tree node.
function checkTreeNodeAccess(req) {
	return new Promise((resolve, reject) => {
		var sql = 'select * FROM fwc_tree WHERE id='+req.body.node_id;
		req.dbCon.query(sql, (error, result) => {
			if (error) return reject(error);

			// Check that fwcloud of the node is the same fwcloud indicated in the req.body.fwcloud.
			// We have already verified that the user has access to the fwcloud indicated in req.body.fwcloud.
			if (result.length!==1 || req.body.fwcloud!==result[0].fwcloud) return resolve(false);

			// Store the node information for use in the API call processing.
			req.tree_node = result[0];

			resolve(true);
		});
	});
};

// Check access to the fwcloud.
function checkFwCloudAccess(req) {
	return new Promise((resolve, reject) => {
		var sql = `select * FROM user__fwcloud WHERE user=${req.session.user_id} and fwcloud=${req.body.fwcloud}`;
		req.dbCon.query(sql, (error, result) => {
			if (error) return reject(error);
			resolve(result.length!==1? false : true);
		});
	});
};

//CHECK IF A USER HAS ACCCESS TO FWCLOUD AND IF FWCLOUD IS NOT LOCKED.
/*function checkFwCloudAccess(iduser, fwcloud, update, req, res) {
	return new Promise((resolve, reject) => {
		var fwcloudData = { fwcloud: fwcloud, iduser: iduser };
		//Check FWCLOUD LOCK
		FwcloudModel.getFwcloudAccess(iduser, fwcloud)
			.then(resp => {
				//{"access": true, "locked": false, , "mylock" : true  "locked_at": "", "locked_by": ""}
				//logger().warn(resp);
				logger().debug("UPDATE: " + update);
				if (resp.access && !update) {
					logger().warn("OK --> FWCLOUD ACCESS ALLOWED TO READ ");
					return resolve(true);
				} else if (resp.access && resp.locked && resp.mylock) { //Acces ok an locked by user
					logger().warn("OK --> FWCLOUD ACCESS ALLOWED and LOCKED ");
					return resolve(true);
				} else if (resp.access && !resp.locked) { //Acces ok and No locked
					//GET FWCLOUD LOCK
					FwcloudModel.updateFwcloudLock(fwcloudData)
						.then(data => {
							if (data.result) {
								logger().info("FWCLOUD: " + fwcloudData.fwcloud + "  LOCKED BY USER: " + fwcloudData.iduser);
								logger().warn("OK --> FWCLOUD ACCESS ALLOWED and GET LOCKED ");
								return resolve(true);
							} else {
								logger().info("NOT ACCESS FOR LOCKING FWCLOUD: " + fwcloudData.fwcloud + "  BY USER: " + fwcloudData.iduser);
								return reject(fwcError.other('Error locking'));
							}
						})
						.catch(r => {
							logger().info("ERROR LOCKING FWCLOUD: " + fwcloudData.fwcloud + "  BY USER: " + fwcloudData.iduser);
							return reject(fwcError.other('Error locking'));
						});
				} else if (resp.access && resp.locked && !resp.mylock) { //Acces ok an locked by other user
					logger().warn("KO --> FWCLOUD ACCESS LOCKED BY OTHER USER ");
					return reject(fwcError.other('FWCLOUD ACCESS LOCK BY OTHER USER'));
				} else if (!resp.access) { //Acces Error
					logger().warn("KO --> FWCLOUD ACCESS NOT ALLOWED");
					return reject(fwcError.ACC_FWCLOUD);
				}
				logger().warn("--------------------------------------------------");
			})
			.catch(resp => {
				logger().warn(resp);
				logger().warn("ERROR --> FWCLOUD ACCESS NOT ALLOWED ");
				logger().warn("--------------------------------------------------");
				return reject(fwcError.ACC_FWCLOUD);
			});
	});
}; */