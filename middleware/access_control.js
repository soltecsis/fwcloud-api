//create object
var accessCtrl = {};
//Export the object
module.exports = accessCtrl;

const api_resp = require('../utils/api_response');
const FwcloudModel = require('../models/fwcloud/fwcloud');
const FirewallModel = require('../models/firewall/firewall');
const logger = require('log4js').getLogger("app");

// Access control for fwclouds and firewalls.
// We have already validated the input data.
accessCtrl.check = async(req, res, next) => {
	// Access control excluded URLs.
	if ((req.method === 'POST' && req.url === '/user/login') ||
		(req.method === 'GET' && req.url === '/ipobj/types') ||
		(req.method === 'GET' && req.url === '/policy/types') ||
		(req.method === 'GET' && req.url === '/ipobj/positions/policy') ||
		(req.method === 'POST' && req.url === '/fwcloud') ||
		(req.method === 'GET' && req.url === '/fwcloud/all/get') ||
		(req.method === 'GET' && req.url === '/stream'))
		return next();

	logger.debug("---------------- RECEIVED HEADERS-----------------");
	logger.debug("\n", req.headers);
	logger.debug("--------------------------------------------------");
	logger.debug("METHOD: " + req.method + "   PATHNAME: " + req.url);

	const iduser = req.session.user_id;
	const fwcloud = req.body.fwcloud;

	const update = (req.method === 'GET') ? false : true;

	logger.warn("API CHECK FWCLOUD ACCESS USER : [" + iduser + "] --- FWCLOUD: [" + fwcloud + "]   ACTION UPDATE: " + update);

	try {
		await checkFwCloudAccess(iduser, fwcloud, update, req, res);

		// Check firewall access for the user.
		if (req.body.firewall) {
			const accessData = { iduser: req.session.user_id, fwcloud: req.body.fwcloud, firewall: req.body.firewall };
			if (!(await FirewallModel.getFirewallAccess(accessData)))
				return api_resp.getJson(null, api_resp.ACR_ACCESS_ERROR, 'FIREWALL ACCESS NOT ALLOWED', 'FIREWALL', null, jsonResp => res.status(200).json(jsonResp));
		}

		// Check access to the tree node indicated in req.body.node_id.
		if (req.body.node_id) {
			if (!(await checkTreeNodeAccess(req)))
				return api_resp.getJson(null, api_resp.ACR_ACCESS_ERROR, 'TREE NODE ACCESS NOT ALLOWED', 'TREE', null, jsonResp => res.status(200).json(jsonResp));
		}

		// Check access to the CA indicated in req.body.ca.
		if (req.body.ca) {
			if (!(await checkCAAccess(req)))
				return api_resp.getJson(null, api_resp.ACR_ACCESS_ERROR, 'CA ACCESS NOT ALLOWED', 'CA', null, jsonResp => res.status(200).json(jsonResp));
		}

		// Check access to the crt indicated in req.body.crt.
		if (req.body.crt) {
			if (!(await checkCrtAccess(req)))
				return api_resp.getJson(null, api_resp.ACR_ACCESS_ERROR, 'CRT ACCESS NOT ALLOWED', 'CRT', null, jsonResp => res.status(200).json(jsonResp));
		}

		// Check access to the openvpn indicated in req.body.openvpn.
		if (req.body.openvpn) {
			if (!(await checkOpenVPNAccess(req)))
				return api_resp.getJson(null, api_resp.ACR_ACCESS_ERROR, 'OpenVPN ACCESS NOT ALLOWED', 'OpenVPN', null, jsonResp => res.status(200).json(jsonResp));
		}

		// Check access to the CRT prefix indicated in req.body.prefix.
		if (req.body.prefix) {
			if (!(await checkPrefixAccess(req)))
				return api_resp.getJson(null, api_resp.ACR_ACCESS_ERROR, 'CRT Prefix ACCESS NOT ALLOWED', 'CRT Prefix', null, jsonResp => res.status(200).json(jsonResp));
		}

		// Check access to the rule indicated by req.body.rule o req.body.new_rule.
		if (req.body.rule) {
			if (!(await checkPolicyRuleAccess(req,req.body.rule)))
				return api_resp.getJson(null, api_resp.ACR_ACCESS_ERROR, 'Policy rule ACCESS NOT ALLOWED', 'CRT Prefix', null, jsonResp => res.status(200).json(jsonResp));
		}
		if (req.body.new_rule) {
			if (!(await checkPolicyRuleAccess(req,req.body.new_rule)))
				return api_resp.getJson(null, api_resp.ACR_ACCESS_ERROR, 'Policy rule ACCESS NOT ALLOWED', 'CRT Prefix', null, jsonResp => res.status(200).json(jsonResp));
		}
		if (req.body.rulesIds) {
			for (let rule of req.body.rulesIds) {
				if (!(await checkPolicyRuleAccess(req,rule)))
					return api_resp.getJson(null, api_resp.ACR_ACCESS_ERROR, 'Policy rule ACCESS NOT ALLOWED', 'CRT Prefix', null, jsonResp => res.status(200).json(jsonResp));
			}	
		}

		next()
	} catch (error) { return api_resp.getJson(null, api_resp.ACR_ERROR, 'ERROR IN ACCESS CONTROL', 'ACCESS CONTROL', error, jsonResp => res.status(200).json(jsonResp)) }
};

// Check access to certificate.
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
    else if (item[1]==='vpn' && item[2]==='openvpn' && item[3]==='prefix') {
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

//CHECK IF A USER HAS ACCCESS TO FWCLOUD AND IF FWCLOUD IS NOT LOCKED.
function checkFwCloudAccess(iduser, fwcloud, update, req, res) {
	return new Promise((resolve, reject) => {
		var fwcloudData = { fwcloud: fwcloud, iduser: iduser };
		//Check FWCLOUD LOCK
		FwcloudModel.getFwcloudAccess(iduser, fwcloud)
			.then(resp => {
				//{"access": true, "locked": false, , "mylock" : true  "locked_at": "", "locked_by": ""}
				//logger.warn(resp);
				logger.debug("UPDATE: " + update);
				if (resp.access && !update) {
					logger.warn("OK --> FWCLOUD ACCESS ALLOWED TO READ ");
					return resolve(true);
				} else if (resp.access && resp.locked && resp.mylock) { //Acces ok an locked by user
					logger.warn("OK --> FWCLOUD ACCESS ALLOWED and LOCKED ");
					return resolve(true);
				} else if (resp.access && !resp.locked) { //Acces ok and No locked
					//GET FWCLOUD LOCK
					FwcloudModel.updateFwcloudLock(fwcloudData)
						.then(data => {
							if (data.result) {
								logger.info("FWCLOUD: " + fwcloudData.fwcloud + "  LOCKED BY USER: " + fwcloudData.iduser);
								logger.warn("OK --> FWCLOUD ACCESS ALLOWED and GET LOCKED ");
								return resolve(true);
							} else {
								logger.info("NOT ACCESS FOR LOCKING FWCLOUD: " + fwcloudData.fwcloud + "  BY USER: " + fwcloudData.iduser);
								return reject(new Error('Error locking'));
							}
						})
						.catch(r => {
							logger.info("ERROR LOCKING FWCLOUD: " + fwcloudData.fwcloud + "  BY USER: " + fwcloudData.iduser);
							return reject(new Error('Error locking'));
						});
				} else if (resp.access && resp.locked && !resp.mylock) { //Acces ok an locked by other user
					logger.warn("KO --> FWCLOUD ACCESS LOCKED BY OTHER USER ");
					//next(new Error("KO --> FWCLOUD ACCESS NOT ALLOWED "));
					return reject(new Error('FWCLOUD ACCESS LOCK BY OTHER USER'));
				} else if (!resp.access) { //Acces Error
					logger.warn("KO --> FWCLOUD ACCESS NOT ALLOWED");
					//next(new Error("KO --> FWCLOUD ACCESS NOT ALLOWED "));
					return reject(new Error('FWCLOUD ACCESS NOT ALLOWED'));
				}
				logger.warn("--------------------------------------------------");
			})
			.catch(resp => {
				logger.warn(resp);
				logger.warn("ERROR --> FWCLOUD ACCESS NOT ALLOWED ");
				logger.warn("--------------------------------------------------");
				return reject(new Error('FWCLOUD ACCESS NOT ALLOWED'));
			});
	});
};