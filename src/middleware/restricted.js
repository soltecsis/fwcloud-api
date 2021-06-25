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
var restrictedCheck = {};
//Export the object
module.exports = restrictedCheck;

import { User } from '../models/user/User';
import { Customer } from '../models/user/Customer';
import { Firewall } from '../models/firewall/Firewall';
import { Interface } from '../models/interface/Interface';
import { IPObjGroup } from '../models/ipobj/IPObjGroup';
import { Mark } from '../models/ipobj/Mark';
import { OpenVPNPrefix } from '../models/vpn/openvpn/OpenVPNPrefix';
import { Ca } from '../models/vpn/pki/Ca';
import { Crt } from '../models/vpn/pki/Crt';
import { OpenVPN } from '../models/vpn/openvpn/OpenVPN';
import { IPObj } from '../models/ipobj/IPObj';



restrictedCheck.customer = async(req, res, next) => {
	try {
		let data = await Customer.searchUsers(req);
		if (data.result) return res.status(403).json(data);
		data = await Customer.lastCustomer(req);
		if (data.result) return res.status(403).json(data);
		next();
	} catch (error) { res.status(400).json(error) }
};


restrictedCheck.user = async(req, res, next) => {
	try {
		if (await User.isAdmin(req)) {
			const data = await User.lastAdminUser(req);
			if (data.result) return res.status(403).json(data);
		}
		next();
	} catch (error) { res.status(400).json(error) }
};


restrictedCheck.fwcloud = (req, res, next) => {
	// If force parameter is set, don't check restrictions.
	if (req.body.force)	return next();

	var sql = `Select (SELECT count(*) FROM firewall where fwcloud=${req.body.fwcloud} AND cluster is null) as CF,
		(SELECT count(*) FROM cluster where fwcloud=${req.body.fwcloud}) as CC,
		(SELECT count(*) FROM ca where fwcloud=${req.body.fwcloud}) as CCA`;
	req.dbCon.query(sql, (error, row) => {
		if (error) return res.status(400).json(error);

		if (row && row.length > 0 && (row[0].CF > 0 || row[0].CC > 0 || row[0].CCA > 0))
			return res.status(403).json({ "count": row[0] });
		next();
	});
};


restrictedCheck.firewall = async(req, res, next) => {
	try {
		const data = await Firewall.searchFirewallRestrictions(req);
		if (data.result) res.status(403).json(data);
		else next();
	} catch (error) { res.status(400).json(error) }
};


restrictedCheck.firewallApplyTo = (req, res, next) => {
	// Is this firewall part of a cluster?
	let sql = 'SELECT cluster from firewall where id=' + req.body.firewall + ' AND fwcloud=' + req.body.fwcloud;
	req.dbCon.query(sql, (error, result) => {
		if (error) return res.status(400).json(error);
		if (result && result.length === 0) return next(); // No, it is not part of a cluster.

		// If it is part of a cluster then look if it appears in the apply to column of a rule of the cluster.
		sql = 'SELECT count(*) as cont FROM policy_r R inner join firewall F on R.firewall=F.id ' +
			' where fw_apply_to=' + req.body.firewall +
			' AND F.cluster=' + result[0].cluster +
			' AND F.fwcloud=' + req.body.fwcloud;
		req.dbCon.query(sql, (error, row) => {
			if (error) return res.status(400).json(error);
			if (row && row.length > 0) {
				if (row[0].cont > 0) {
					const restricted = { "result": false, "restrictions": "FIREWALL WITH RESTRICTIONS APPLY_TO ON RULES" };
					res.status(403).json(restricted);
				} else next();
			} else next();
		});
	});
};


restrictedCheck.interface = async(req, res, next) => {
	//Check interface in RULE O POSITIONS
	const type = (req.body.host) ? 11 /* Host interface */ : 10 /* Firewall interface */ ;
	try {
		const data = await Interface.searchInterfaceUsage(req.body.id, type, req.body.fwcloud, '');

		if (data.result) {
			// Ignore restrictions.InterfaceInFirewall restrictions.InterfaceInHost
			data.result = false;
			for (let key in data.restrictions) {
				if (key === 'InterfaceInFirewall' || key === 'InterfaceInHost')
					continue;
				if (data.restrictions[key].length > 0) {
					data.result = true;
					break;
				}
			}
		}

		if (data.result) res.status(403).json(data);
		else next();
	} catch (error) { res.status(400).json(error) }
};


restrictedCheck.ipobj = async(req, res, next) => {
	try {
		const data = await IPObj.searchIpobjUsage(req.dbCon, req.body.fwcloud, req.body.id, req.body.type);
		if (data.result) res.status(403).json(data);
		else next();
	} catch (error) { res.status(400).json(error) }
};


restrictedCheck.ipobj_group = async(req, res, next) => {
	try {
		const data = await IPObjGroup.searchGroupUsage(req.body.id, req.body.fwcloud);
		if (data.result) res.status(403).json(data);
		else next();
	} catch (error) { res.status(400).json(error) }
};


restrictedCheck.openvpn = async(req, res, next) => {
	try {
		let data = await OpenVPN.searchOpenvpnChild(req.dbCon, req.body.fwcloud, req.body.openvpn);
		if (data.result) return res.status(403).json(data);

		data = await OpenVPN.searchOpenvpnUsage(req.dbCon, req.body.fwcloud, req.body.openvpn);
		if (data.result) return res.status(403).json(data);

		next();
	} catch (error) { res.status(400).json(error) }
};


restrictedCheck.ca = async(req, res, next) => {
	try {
		let data = await Ca.searchCAHasCRTs(req.dbCon, req.body.fwcloud, req.body.ca);
		if (data.result) return res.status(403).json(data);

		data = await Ca.searchCAHasPrefixes(req.dbCon, req.body.fwcloud, req.body.ca);
		if (data.result) return res.status(403).json(data);

		next();
	} catch (error) { res.status(400).json(error) }
};

restrictedCheck.crt = async(req, res, next) => {
	try {
		let data = await Crt.searchCRTInOpenvpn(req.dbCon, req.body.fwcloud, req.body.crt);
		if (data.result) return res.status(403).json(data);
		next();
	} catch (error) { res.status(400).json(error) }
};

restrictedCheck.openvpn_prefix = async(req, res, next) => {
	try {
		let data = await OpenVPNPrefix.searchPrefixUsage(req.dbCon, req.body.fwcloud, req.body.prefix);
		if (data.result) return res.status(403).json(data);

		next();
	} catch (error) { res.status(400).json(error) }
};

restrictedCheck.mark = async(req, res, next) => {
	try {
		let data = await Mark.searchMarkUsage(req.dbCon, req.body.fwcloud, req.body.mark);
		if (data.result) return res.status(403).json(data);

		next();
	} catch (error) { res.status(400).json(error) }
};