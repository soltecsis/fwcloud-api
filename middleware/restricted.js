//create object
var restrictedCheck = {};
//Export the object
module.exports = restrictedCheck;

var api_resp = require('../utils/api_response');
var firewallModel = require('../models/firewall/firewall');
var interfaceModel = require('../models/interface/interface');
var ipobjModel = require('../models/ipobj/ipobj');
var ipobj_gModel = require('../models/ipobj/group');
const pkiModel = require('../models/vpn/pki');
const openvpnModel = require('../models/vpn/openvpn');


restrictedCheck.fwcloud = (req, res, next) => {
	var sql = `Select (SELECT count(*) FROM firewall where fwcloud=${req.body.fwcloud} AND cluster is null) as CF,
		(SELECT count(*) FROM cluster where fwcloud=${req.body.fwcloud}) as CC,
		(SELECT count(*) FROM ca where fwcloud=${req.body.fwcloud}) as CCA`;
	req.dbCon.query(sql, (error, row) => {
		if (error) return api_resp.getJson(null, api_resp.ACR_ERROR, 'Error', null, error, jsonResp => res.status(200).json(jsonResp));

		if (row && row.length > 0) {
			if (row[0].CF>0 || row[0].CC>0 || row[0].CCA>0) {
				api_resp.getJson({"result": false, "count": row[0]}, api_resp.ACR_RESTRICTED, 'RESTRICTED', null, null, jsonResp => res.status(200).json(jsonResp));
			} else next();
		} else next();
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
	const type = (req.body.firewallhost) ? 11 /* Host interface */ : 10 /* Firewall interface */ ;
	try {
		const data = await interfaceModel.searchInterfaceInrulesPro(req.body.id, type, req.body.fwcloud, '');
		if (data.result) api_resp.getJson(data, api_resp.ACR_RESTRICTED, 'RESTRICTED', null, null, jsonResp => res.status(200).json(jsonResp));
		else next();
	} catch(error) { api_resp.getJson(null, api_resp.ACR_ERROR, 'Error', null, error, jsonResp => res.status(200).json(jsonResp)) }
};


restrictedCheck.ipobj = async (req, res, next) => {
	try {
		const data = await ipobjModel.searchIpobjUsage(req.body.fwcloud, req.body.id, req.body.type, 0); // 0 = Search in rules, openvpn, etc.
		if (data.result) api_resp.getJson(data, api_resp.ACR_RESTRICTED, 'RESTRICTED', null, null, jsonResp => res.status(200).json(jsonResp));
		else next();
	} catch(error) { api_resp.getJson(null, api_resp.ACR_ERROR, 'Error', null, error, jsonResp => res.status(200).json(jsonResp)) }
};


restrictedCheck.ipobj_group = async (req, res, next) => {
	try {
		const data = await ipobj_gModel.searchGroupInRules(req.body.id, req.body.fwcloud);
		if (data.result) api_resp.getJson(data, api_resp.ACR_RESTRICTED, 'RESTRICTED', null, null, jsonResp => res.status(200).json(jsonResp));
		else next();
	} catch(error) { api_resp.getJson(null, api_resp.ACR_ERROR, 'Error', null, error, jsonResp => res.status(200).json(jsonResp)) }
};


restrictedCheck.openvpn = async (req, res, next) => {
	try {
		let data = await openvpnModel.searchOpenvpnChilds(req.dbCon,req.body.fwcloud,req.body.openvpn);
		if (data.result) return api_resp.getJson(data, api_resp.ACR_RESTRICTED, 'RESTRICTED', null, null, jsonResp => res.status(200).json(jsonResp));
	
		data = await openvpnModel.searchOpenvpnUsage(req.dbCon,req.body.fwcloud,req.body.openvpn);
		if (data.result) return api_resp.getJson(data, api_resp.ACR_RESTRICTED, 'RESTRICTED', null, null, jsonResp => res.status(200).json(jsonResp));
		
		next();
	} catch(error) { api_resp.getJson(null, api_resp.ACR_ERROR, 'Error', null, error, jsonResp => res.status(200).json(jsonResp)) }
};


restrictedCheck.ca = async (req, res, next) => {
	try {
		let data = await pkiModel.searchCAHasCRTs(req.dbCon,req.body.fwcloud,req.body.ca);
		if (data.result) return api_resp.getJson(data, api_resp.ACR_RESTRICTED, 'RESTRICTED', null, null, jsonResp => res.status(200).json(jsonResp));
		next();
	} catch(error) { api_resp.getJson(null, api_resp.ACR_ERROR, 'Error', null, error, jsonResp => res.status(200).json(jsonResp)) }
};

restrictedCheck.crt = async (req, res, next) => {
	try {
		let data = await pkiModel.searchCRTInOpenvpn(req.dbCon,req.body.fwcloud,req.body.crt);
		if (data.result) return api_resp.getJson(data, api_resp.ACR_RESTRICTED, 'RESTRICTED', null, null, jsonResp => res.status(200).json(jsonResp));
		next();
	} catch(error) { api_resp.getJson(null, api_resp.ACR_ERROR, 'Error', null, error, jsonResp => res.status(200).json(jsonResp)) }
};

restrictedCheck.prefix = async (req, res, next) => {
	try {
		let data = await pkiModel.searchPrefixUsage(req.dbCon,req.body.fwcloud,req.body.prefix);
		if (data.result) return api_resp.getJson(data, api_resp.ACR_RESTRICTED, 'RESTRICTED', null, null, jsonResp => res.status(200).json(jsonResp));
		
		next();
	} catch(error) { api_resp.getJson(null, api_resp.ACR_ERROR, 'Error', null, error, jsonResp => res.status(200).json(jsonResp)) }
};
