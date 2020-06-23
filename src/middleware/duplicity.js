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
var duplicityCheck = {};
//Export the object
module.exports = duplicityCheck;

const fwcError = require('../utils/error_table');
const ip = require('ip');
const { logger } = require('../fonaments/abstract-application');


// Middleware for avoid ipobj duplicities.
duplicityCheck.ipobj = (req, res, next) => {
	// If the user wants to create de IPObj even if it is duplicated, create it.
	if (req.body.force===1) return next();

	// If we are creating an address for a network interface, then don't check duplicity.
	if (req.body.interface && req.body.interface!==null) return next();

	// If we are creating a new host, then don't check duplicity.
	if (req.body.type===8) return next();

	let sql;
	if (req.body.type===5 || req.body.type===7) { // 5: ADDRESS, 7: NETWORK
		// We have two formats for the netmask (for example, 255.255.255.0 or /24).
		sql = `select id,name,address,netmask from ipobj 
						where (fwcloud IS NULL OR fwcloud=${req.body.fwcloud}) 
						and address=${req.dbCon.escape(req.body.address)} and type=${req.body.type}
						${req.body.id ? ` AND id!=${req.body.id}` : ``}`;
	}
	else if (req.body.type===9) { // DNS
		// If we are creating a new DNS input, then we must search for one whith the same name.
		sql = `select id,name from ipobj
						where (fwcloud IS NULL OR fwcloud=${req.body.fwcloud})
						and name=${req.dbCon.escape(req.body.name)} and type=9
						${req.body.id ? ` AND id!=${req.body.id}` : ``}`;
	}
	else { // Other types
		sql = `SELECT id,name FROM ipobj
			WHERE (fwcloud IS NULL OR fwcloud=${req.body.fwcloud})
			AND type${(typeof req.body.type==='undefined' || req.body.type===null) ? ` IS NULL` : `=${req.body.type}`}
			AND protocol${(typeof req.body.protocol==='undefined' || req.body.protocol===null) ? ` IS NULL` : `=${req.body.protocol}`}
			AND address${(typeof req.body.address==='undefined' || req.body.address===null) ? ` IS NULL` :  `=${req.dbCon.escape(req.body.address)}`}
			AND netmask${(typeof req.body.netmask==='undefined' || req.body.netmask===null) ? ` IS NULL` : `=${req.dbCon.escape(req.body.netmask)}`}
			AND diff_serv${(typeof req.body.diff_serv==='undefined' || req.body.diff_serv===null) ? ` IS NULL` : `=${req.body.diff_serv}`}
			AND ip_version${(typeof req.body.ip_version==='undefined' || req.body.ip_version===null) ? ` IS NULL` : `=${req.body.ip_version}`}
			AND icmp_type${(typeof req.body.icmp_type==='undefined' || req.body.icmp_type===null) ? ` IS NULL` : `=${req.body.icmp_type}`}
			AND icmp_code${(typeof req.body.icmp_code==='undefined' || req.body.icmp_code===null) ? ` IS NULL` : `=${req.body.icmp_code}`}
			AND tcp_flags_mask${(typeof req.body.tcp_flags_mask==='undefined' || req.body.tcp_flags_mask===null) ? ` IS NULL` : `=${req.body.tcp_flags_mask}`}
			AND tcp_flags_settings${(typeof req.body.tcp_flags_settings==='undefined' || req.body.tcp_flags_settings===null) ? ` IS NULL` : `=${req.body.tcp_flags_settings}`}
			AND range_start${(typeof req.body.range_start==='undefined' || req.body.range_start===null) ? ` IS NULL` : `=${req.dbCon.escape(req.body.range_start)}`}
			AND range_end${(typeof req.body.range_end==='undefined' || req.body.range_end===null) ? ` IS NULL` : `=${req.dbCon.escape(req.body.range_end)}`}
			AND source_port_start${(typeof req.body.source_port_start==='undefined' || req.body.source_port_start===null) ? ` IS NULL` : `=${req.body.source_port_start}`}
			AND source_port_end${(typeof req.body.source_port_end==='undefined' || req.body.source_port_end===null) ? ` IS NULL` : `=${req.body.source_port_end}`}
			AND destination_port_start${(typeof req.body.destination_port_start==='undefined' || req.body.destination_port_start===null) ? ` IS NULL` : `=${req.body.destination_port_start}`}
			AND destination_port_end${(typeof req.body.destination_port_end==='undefined' || req.body.destination_port_end===null) ? ` IS NULL` : `=${req.body.destination_port_end}`}
			AND options${(typeof req.body.options==='undefined' || req.body.options===null) ? ` IS NULL` : `=${req.body.options}`}
			${req.body.id ? ` AND id!=${req.body.id}` : ``}
			AND interface IS NULL`;
	}

	req.dbCon.query(sql, (error, rows) => {
		if (error) return next();

		try {
			if (rows.length>0) {
				if (req.body.type===5 || req.body.type===7) { // 5: ADDRESS, 7: NETWORK
					// We have two formats for the netmask (for example, 255.255.255.0 or /24).
					// We have to check if the object already exist independently of the netmask format.
					const net1 = (req.body.netmask[0]==='/') ? ip.cidrSubnet(`${req.body.address}${req.body.netmask}`) : ip.subnet(req.body.address, req.body.netmask);
					let net2 = {};
					for (row of rows) {
						net2 = (row.netmask[0] === '/') ? ip.cidrSubnet(`${row.address}${row.netmask}`) : ip.subnet(row.address, row.netmask);
						if (net1.subnetMaskLength===net2.subnetMaskLength)
							throw fwcError.ALREADY_EXISTS;
					}
					next();
				} 
				else throw fwcError.ALREADY_EXISTS;
			}
			else next();
		} catch(error) { 
			error.data=rows;
			logger().error('Error during duplicity check: ' + JSON.stringify(error));
			res.status(400).json(error);
			delete error.data;
		}
	});
};
