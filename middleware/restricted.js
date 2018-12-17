//create object
var restrictedCheck = {};
//Export the object
module.exports = restrictedCheck;

var api_resp = require('../utils/api_response');
var interfaceModel = require('../models/interface/interface');
var ipobjModel = require('../models/ipobj/ipobj');
var ipobj_gModel = require('../models/ipobj/group');
const openvpnModel = require('../models/vpn/openvpn');


restrictedCheck.fwcloud = (req, res, next) => {
	var sql = 'Select (SELECT count(*) FROM firewall where fwcloud=' + req.body.fwcloud + ') as CF, ' +
		' (SELECT count(*) FROM cluster where fwcloud=' + req.body.fwcloud + ') as CC ';
	req.dbCon.query(sql, (error, row) => {
		if (error) return api_resp.getJson(null, api_resp.ACR_ERROR, 'Error', null, error, jsonResp => res.status(200).json(jsonResp));

		if (row && row.length > 0) {
			var cadRestricted = "";
			if (row[0].CF > 0) {
				cadRestricted = " FIREWALLS";
				if (row[0].CC > 0)
					cadRestricted = cadRestricted + " AND CLUSTERS";
			} else if (row[0].CC > 0)
				cadRestricted = "  CLUSTERS";

			if (cadRestricted !== "") {
				const restricted = { "result": false, "restrictions": "CLOUD WITH RESTRICTIONS, CLOUD HAS " + cadRestricted };
				api_resp.getJson(restricted, api_resp.ACR_RESTRICTED, 'RESTRICTED', null, null, jsonResp => res.status(200).json(jsonResp));
			} else next();
		} else next();
	});
};


restrictedCheck.otherFirewall = (req, res, next) => {
	interfaceModel.searchInterfaceInrulesOtherFirewall(req.body.fwcloud, req.body.firewall)
	.then(found_resp => {
		if (found_resp.found) {
			const restricted = { "result": false, "restrictions": found_resp };
			api_resp.getJson(restricted, api_resp.ACR_RESTRICTED, 'RESTRICTED', null, null, jsonResp => res.status(200).json(jsonResp));
		} else next();
	})
	.catch(error => api_resp.getJson(null, api_resp.ACR_ERROR, 'Error', null, error, jsonResp => res.status(200).json(jsonResp)));
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
		const data = await ipobjModel.searchIpobjInRules(req.body.id, req.body.type, req.body.fwcloud);
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
		const data = await openvpnModel.searchOpenvpnInRules(req);
		if (data.result) api_resp.getJson(data, api_resp.ACR_RESTRICTED, 'RESTRICTED', null, null, jsonResp => res.status(200).json(jsonResp));
		else next();
	} catch(error) { api_resp.getJson(null, api_resp.ACR_ERROR, 'Error', null, error, jsonResp => res.status(200).json(jsonResp)) }
};
