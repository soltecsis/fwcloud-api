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
		' AND type' + ((typeof req.body.type==='undefined' || req.body.type===null) ? " IS NULL" : ("="+req.body.type)) +
		' AND protocol' + ((typeof req.body.protocol==='undefined' || req.body.protocol===null) ? " IS NULL" : ("="+req.body.protocol)) +
		' AND address' + ((typeof req.body.address==='undefined' || req.body.address===null) ? " IS NULL" : ("="+req.dbCon.escape(req.body.address))) +
		' AND netmask' + ((typeof req.body.netmask==='undefined' || req.body.netmask===null) ? " IS NULL" : ("="+req.dbCon.escape(req.body.netmask))) +
		' AND diff_serv' + ((typeof req.body.diff_serv==='undefined' || req.body.diff_serv===null) ? " IS NULL" : ("="+req.body.diff_serv)) +
		' AND ip_version' + ((typeof req.body.ip_version==='undefined' || req.body.ip_version===null) ? " IS NULL" : ("="+req.body.ip_version)) +
		' AND icmp_type' + ((typeof req.body.icmp_type==='undefined' || req.body.icmp_type===null) ? " IS NULL" : ("="+req.body.icmp_type)) +
		' AND icmp_code' + ((typeof req.body.icmp_code==='undefined' || req.body.icmp_code===null) ? " IS NULL" : ("="+req.body.icmp_code)) +
		' AND tcp_flags_mask' + ((typeof req.body.tcp_flags_mask==='undefined' || req.body.tcp_flags_mask===null) ? " IS NULL" : ("="+req.body.tcp_flags_mask)) +
		' AND tcp_flags_settings' + ((typeof req.body.tcp_flags_settings==='undefined' || req.body.tcp_flags_settings===null) ? " IS NULL" : ("="+req.body.tcp_flags_settings)) +
		' AND range_start' + ((typeof req.body.range_start==='undefined' || req.body.range_start===null) ? " IS NULL" : ("="+req.dbCon.escape(req.body.range_start))) +
		' AND range_end' + ((typeof req.body.range_end==='undefined' || req.body.range_end===null) ? " IS NULL" : ("="+req.dbCon.escape(req.body.range_end))) +
		' AND source_port_start' + ((typeof req.body.source_port_start==='undefined' || req.body.source_port_start===null) ? " IS NULL" : ("="+req.body.source_port_start)) +
		' AND source_port_end' + ((typeof req.body.source_port_end==='undefined' || req.body.source_port_end===null) ? " IS NULL" : ("="+req.body.source_port_end)) +
		' AND destination_port_start' + ((typeof req.body.destination_port_start==='undefined' || req.body.destination_port_start===null) ? " IS NULL" : ("="+req.body.destination_port_start)) +
		' AND destination_port_end' + ((typeof req.body.destination_port_end==='undefined' || req.body.destination_port_end===null) ? " IS NULL" : ("="+req.body.destination_port_end)) +
		' AND options' + ((typeof req.body.options==='undefined' || req.body.options===null) ? " IS NULL" : ("="+req.body.options)) +
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
