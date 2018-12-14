//create object
var duplicityCheck = {};
//Export the object
module.exports = duplicityCheck;

var logger = require('log4js').getLogger("app");
var api_resp = require('../utils/api_response');

// Middleware for avoid ipobj duplicities.
duplicityCheck.ipobj = (req, res, next) => {
	// If the user wants to create de IPObj even if it is duplicated, create it.
	if (req.body.force===1) return next();

	// If we are creating an address for a network interface, then don't check duplicity.
	if (req.body.interface && req.body.interface!==null) return next();

	// If we are creating a new host, then don't check duplicity.
	if (req.body.type===8) return next();

	var sql = 'SELECT id,name FROM ipobj' +
		' WHERE (fwcloud IS NULL OR fwcloud=' + req.body.fwcloud + ")" + 
		' AND type' + (!req.body.type ? " IS NULL" : ("="+req.body.type)) +
		' AND protocol' + (!req.body.protocol ? " IS NULL" : ("="+req.body.protocol)) +
		' AND address' + (!req.body.address ? " IS NULL" : ("="+req.dbCon.escape(req.body.address))) +
		' AND netmask' + (!req.body.netmask ? " IS NULL" : ("="+req.dbCon.escape(req.body.netmask))) +
		' AND diff_serv' + (!req.body.diff_serv ? " IS NULL" : ("="+req.body.diff_serv)) +
		' AND ip_version' + (!req.body.ip_version ? " IS NULL" : ("="+req.body.ip_version)) +
		' AND icmp_type' + (!req.body.icmp_type ? " IS NULL" : ("="+req.body.icmp_type)) +
		' AND icmp_code' + (!req.body.icmp_code ? " IS NULL" : ("="+req.body.icmp_code)) +
		' AND tcp_flags_mask' + (!req.body.tcp_flags_mask ? " IS NULL" : ("="+req.body.tcp_flags_mask)) +
		' AND tcp_flags_settings' + (!req.body.tcp_flags_settings ? " IS NULL" : ("="+req.body.tcp_flags_settings)) +
		' AND range_start' + (!req.body.range_start ? " IS NULL" : ("="+req.dbCon.escape(req.body.range_start))) +
		' AND range_end' + (!req.body.range_end ? " IS NULL" : ("="+req.dbCon.escape(req.body.range_end))) +
		' AND source_port_start' + (!req.body.source_port_start ? " IS NULL" : ("="+req.body.source_port_start)) +
		' AND source_port_end' + (!req.body.source_port_end ? " IS NULL" : ("="+req.body.source_port_end)) +
		' AND destination_port_start' + (!req.body.destination_port_start ? " IS NULL" : ("="+req.body.destination_port_start)) +
		' AND destination_port_end' + (!req.body.destination_port_end ? " IS NULL" : ("="+req.body.destination_port_end)) +
		' AND options' + (!req.body.options ? " IS NULL" : ("="+req.body.options)) +
    (req.body.id ? ' AND id!='+req.body.id : '') +
		' AND interface IS NULL';

	req.dbCon.query(sql, (error, rows) => {
		if (!error) {
			if (rows.length>0)
				api_resp.getJson(rows, api_resp.ACR_ALREADY_EXISTS, 'Duplicated IP Object.', null, null, jsonResp => res.status(200).json(jsonResp));
			else
				next();
		} else {
			logger.error(error);
			next();
		}
	});
};
