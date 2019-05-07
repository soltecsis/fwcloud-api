//create object
var restrictedCheck = {};
//Export the object
module.exports = restrictedCheck;

const api_resp = require('../utils/api_response');
const customerModel = require('../models/user/customer');
const userModel = require('../models/user/user');
const firewallModel = require('../models/firewall/firewall');
const interfaceModel = require('../models/interface/interface');
const ipobjModel = require('../models/ipobj/ipobj');
const ipobj_gModel = require('../models/ipobj/group');
const pkiCAModel = require('../models/vpn/pki/ca');
const pkiCRTModel = require('../models/vpn/pki/crt');
const openvpnModel = require('../models/vpn/openvpn/openvpn');
const openvpnPrefixModel = require('../models/vpn/openvpn/prefix');
const markModel = require('../models/ipobj/mark');

restrictedCheck.customer = async (req, res, next) => {
	try {
		let data = await customerModel.searchUsers(req);
		if (data.result) return res.status(403).json(data);
		data = await customerModel.lastCustomer(req);
		if (data.result) return res.status(403).json(data);
		next();
	} catch(error) { res.status(400).json(error) }
};


restrictedCheck.user = async (req, res, next) => {
	try {
		const data = await userModel.lastAdminUser(req);
		if (data.result) return res.status(403).json(data);
		next();
	} catch(error) { res.status(400).json(error) }
};


restrictedCheck.fwcloud = (req, res, next) => {
	var sql = `Select (SELECT count(*) FROM firewall where fwcloud=${req.body.fwcloud} AND cluster is null) as CF,
		(SELECT count(*) FROM cluster where fwcloud=${req.body.fwcloud}) as CC,
		(SELECT count(*) FROM ca where fwcloud=${req.body.fwcloud}) as CCA`;
	req.dbCon.query(sql, (error, row) => {
		if (error) return res.status(400).json(error);

		if (row && row.length>0 && (row[0].CF>0 || row[0].CC>0 || row[0].CCA>0))
			return res.status(403).json({"result": false, "count": row[0]});
		next();
	});
};


restrictedCheck.firewall = async (req, res, next) => {
	try {
		const data = await firewallModel.searchFirewallRestrictions(req);
		if (data.result) api_resp.getJson(data, api_resp.ACR_RESTRICTED, 'RESTRICTED', null, null, jsonResp => res.status(200).json(jsonResp));
		else next();
	} catch(error) { api_resp.getJson(null, api_resp.ACR_ERROR, 'Error', null, error, jsonResp => res.status(200).json(jsonResp)) }
};


restrictedCheck.firewallApplyTo = (req, res, next) => {
	// Is this firewall part of a cluster?
	let sql = 'SELECT cluster from firewall where id=' + req.body.fwcloud + ' AND fwcloud=' + req.body.fwcloud;
	req.dbCon.query(sql, function(error, result) {
		if (error) return api_resp.getJson(null, api_resp.ACR_ERROR, 'Error', null, error, jsonResp => res.status(200).json(jsonResp));
		if (result && result.length === 0) return next(); // No, it is not part of a cluster.

		// If it is part of a cluster then look if it appears in the apply to column of a rule of the cluster.
		sql = 'SELECT count(*) as cont FROM policy_r R inner join firewall F on R.firewall=F.id ' +
			' where fw_apply_to=' + req.body.firewall +
			' AND F.cluster=' + result[0].cluster +
			' AND F.fwcloud=' + req.body.fwcloud;
		req.dbCon.query(sql, function(error, row) {
			if (error) return api_resp.getJson(null, api_resp.ACR_ERROR, 'Error', null, error, jsonResp => res.status(200).json(jsonResp));

			if (row && row.length > 0) {
				if (row[0].cont > 0) {
					const restricted = { "result": false, "restrictions": "FIREWALL WITH RESTRICTIONS APPLY_TO ON RULES" };
					api_resp.getJson(restricted, api_resp.ACR_RESTRICTED, 'RESTRICTED', null, null, jsonResp => res.status(200).json(jsonResp));
				} else next();
			} else next();
		});
	});
};


restrictedCheck.interface = async (req, res, next) => {
	//Check interface in RULE O POSITIONS
	const type = (req.body.host) ? 11 /* Host interface */ : 10 /* Firewall interface */ ;
	try {
		const data = await interfaceModel.searchInterfaceUsage(req.body.id, type, req.body.fwcloud, '');

		if (data.result) {
			// Ignore restrictions.InterfaceInFirewall restrictions.InterfaceInHost
			data.result = false;
			for (let key in data.restrictions) {
				if (key==='InterfaceInFirewall' || key==='InterfaceInHost')
					continue;
				if (data.restrictions[key].length > 0) {
					data.result = true;
					break;
				}
			}
		}
		
		if (data.result) api_resp.getJson(data, api_resp.ACR_RESTRICTED, 'RESTRICTED', null, null, jsonResp => res.status(200).json(jsonResp));
		else next();
	} catch(error) { api_resp.getJson(null, api_resp.ACR_ERROR, 'Error', null, error, jsonResp => res.status(200).json(jsonResp)) }
};


restrictedCheck.ipobj = async (req, res, next) => {
	try {
		const data = await ipobjModel.searchIpobjUsage(req.dbCon, req.body.fwcloud, req.body.id, req.body.type);
		if (data.result) api_resp.getJson(data, api_resp.ACR_RESTRICTED, 'RESTRICTED', null, null, jsonResp => res.status(200).json(jsonResp));
		else next();
	} catch(error) { api_resp.getJson(null, api_resp.ACR_ERROR, 'Error', null, error, jsonResp => res.status(200).json(jsonResp)) }
};


restrictedCheck.ipobj_group = async (req, res, next) => {
	try {
		const data = await ipobj_gModel.searchGroupUsage(req.body.id, req.body.fwcloud);
		if (data.result) api_resp.getJson(data, api_resp.ACR_RESTRICTED, 'RESTRICTED', null, null, jsonResp => res.status(200).json(jsonResp));
		else next();
	} catch(error) { api_resp.getJson(null, api_resp.ACR_ERROR, 'Error', null, error, jsonResp => res.status(200).json(jsonResp)) }
};


restrictedCheck.openvpn = async (req, res, next) => {
	try {
		let data = await openvpnModel.searchOpenvpnChild(req.dbCon,req.body.fwcloud,req.body.openvpn);
		if (data.result) return api_resp.getJson(data, api_resp.ACR_RESTRICTED, 'RESTRICTED', null, null, jsonResp => res.status(200).json(jsonResp));
	
		data = await openvpnModel.searchOpenvpnUsage(req.dbCon,req.body.fwcloud,req.body.openvpn);
		if (data.result) return api_resp.getJson(data, api_resp.ACR_RESTRICTED, 'RESTRICTED', null, null, jsonResp => res.status(200).json(jsonResp));
		
		next();
	} catch(error) { api_resp.getJson(null, api_resp.ACR_ERROR, 'Error', null, error, jsonResp => res.status(200).json(jsonResp)) }
};


restrictedCheck.ca = async (req, res, next) => {
	try {
		let data = await pkiCAModel.searchCAHasCRTs(req.dbCon,req.body.fwcloud,req.body.ca);
		if (data.result) return api_resp.getJson(data, api_resp.ACR_RESTRICTED, 'RESTRICTED', null, null, jsonResp => res.status(200).json(jsonResp));

		data = await pkiCAModel.searchCAHasPrefixes(req.dbCon,req.body.fwcloud,req.body.ca);
		if (data.result) return api_resp.getJson(data, api_resp.ACR_RESTRICTED, 'RESTRICTED', null, null, jsonResp => res.status(200).json(jsonResp));

		next();
	} catch(error) { api_resp.getJson(null, api_resp.ACR_ERROR, 'Error', null, error, jsonResp => res.status(200).json(jsonResp)) }
};

restrictedCheck.crt = async (req, res, next) => {
	try {
		let data = await pkiCRTModel.searchCRTInOpenvpn(req.dbCon,req.body.fwcloud,req.body.crt);
		if (data.result) return api_resp.getJson(data, api_resp.ACR_RESTRICTED, 'RESTRICTED', null, null, jsonResp => res.status(200).json(jsonResp));
		next();
	} catch(error) { api_resp.getJson(null, api_resp.ACR_ERROR, 'Error', null, error, jsonResp => res.status(200).json(jsonResp)) }
};

restrictedCheck.openvpn_prefix = async (req, res, next) => {
	try {
		let data = await openvpnPrefixModel.searchPrefixUsage(req.dbCon,req.body.fwcloud,req.body.prefix);
		if (data.result) return api_resp.getJson(data, api_resp.ACR_RESTRICTED, 'RESTRICTED', null, null, jsonResp => res.status(200).json(jsonResp));
		
		next();
	} catch(error) { api_resp.getJson(null, api_resp.ACR_ERROR, 'Error', null, error, jsonResp => res.status(200).json(jsonResp)) }
};

restrictedCheck.mark = async (req, res, next) => {
	try {
		let data = await markModel.searchMarkUsage(req.dbCon,req.body.fwcloud,req.body.mark);
		if (data.result) return api_resp.getJson(data, api_resp.ACR_RESTRICTED, 'RESTRICTED', null, null, jsonResp => res.status(200).json(jsonResp));
		
		next();
	} catch(error) { api_resp.getJson(null, api_resp.ACR_ERROR, 'Error', null, error, jsonResp => res.status(200).json(jsonResp)) }
};
