//create object
var duplicityCheck = {};
//Export the object
module.exports = duplicityCheck;

var api_resp = require('../utils/api_response');

// Middleware for avoid ipobj duplicities.
duplicityCheck.ipobj = (req, res, next) => {
	// If the user wants to create de IPObj even if it is duplicated, create it.
	if (req.body.force===1) return next();

	// If we are creating an address for a network interface, then don check duplicity.
	if (req.body.interface!==null) return next();

	// If we are creating a new host, then don't check duplicity.
	if (req.body.type===8) return next();

	db.get((error, connection) => {
		if (error) return next();

		var sql = 'SELECT id,name FROM ' + tableModel +
		' WHERE (fwcloud IS NULL OR fwcloud=' + connection.escape(req.fwcloud) + ")" + 
		' AND type' + (req.body.type===null ? " IS NULL" : ("="+connection.escape(req.body.type))) +
		' AND protocol' + (req.body.protocol===null ? " IS NULL" : ("="+connection.escape(req.body.protocol))) +
		' AND address' + (req.body.address===null ? " IS NULL" : ("="+connection.escape(req.body.address))) +
		' AND netmask' + (req.body.netmask===null ? " IS NULL" : ("="+connection.escape(req.body.netmask))) +
		' AND diff_serv' + (req.body.diff_serv===null ? " IS NULL" : ("="+connection.escape(req.body.diff_serv))) +
 		' AND ip_version' + (req.body.ip_version===null ? " IS NULL" : ("="+connection.escape(req.body.ip_version))) +
		' AND icmp_type' + (req.body.icmp_type===null ? " IS NULL" : ("="+connection.escape(req.body.icmp_type))) +
		' AND icmp_code' + (req.body.icmp_code===null ? " IS NULL" : ("="+connection.escape(req.body.icmp_code))) +
		' AND tcp_flags_mask' + (req.body.tcp_flags_mask===null ? " IS NULL" : ("="+connection.escape(req.body.tcp_flags_mask))) +
		' AND tcp_flags_settings' + (req.body.tcp_flags_settings===null ? " IS NULL" : ("="+connection.escape(req.body.tcp_flags_settings))) +
		' AND range_start' + (req.body.range_start===null ? " IS NULL" : ("="+connection.escape(req.body.range_start))) +
		' AND range_end' + (req.body.range_end===null ? " IS NULL" : ("="+connection.escape(req.body.range_end))) +
		' AND source_port_start=' + connection.escape(req.body.source_port_start) +
		' AND source_port_end=' + connection.escape(req.body.source_port_end) +
		' AND destination_port_start=' + connection.escape(req.body.destination_port_start) +
		' AND destination_port_end=' + connection.escape(req.body.destination_port_end) +
		' AND options' + (req.body.options===null ? " IS NULL" : ("="+connection.escape(req.body.options))) +
		(req.body.id ? ' AND id!='+connection.escape(req.body.id) : '') +
		' AND interface IS NULL';
	
		connection.query(sql, (error, rows) => {
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
	});
};
