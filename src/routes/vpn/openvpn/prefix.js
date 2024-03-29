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


var express = require('express');
var router = express.Router();
import { OpenVPNPrefix } from '../../../models/vpn/openvpn/OpenVPNPrefix';
import { Firewall } from '../../../models/firewall/Firewall';
import { OpenVPN } from '../../../models/vpn/openvpn/OpenVPN';
import { app, logger } from '../../../fonaments/abstract-application';
import { OpenVPNPrefixService } from '../../../models/vpn/openvpn/openvpn-prefix.service';
const restrictedCheck = require('../../../middleware/restricted');
const fwcError = require('../../../utils/error_table');


/**
 * Create a new crt prefix container.
 */
router.post('/', async (req, res) => {
	try {
		// We can only create prefixes for OpenVPN server configurations.
		if (req.openvpn.type!==2)
			throw fwcError.VPN_NOT_SER;

    // Verify that we are not creating a prefix that already exists for the same CA.
		if (await OpenVPNPrefix.existsPrefix(req.dbCon,req.body.openvpn,req.body.name)) 
			throw fwcError.ALREADY_EXISTS;

   	// Create the tree node.
		const id = await OpenVPNPrefix.createPrefix(req);

		// Apply the new CRT prefix container.
		await OpenVPNPrefix.applyOpenVPNPrefixes(req.dbCon,req.body.fwcloud,req.body.openvpn);

		res.status(200).json({insertId: id});
	} catch(error) {
		logger().error('Error creating a prefix: ' + JSON.stringify(error));
		res.status(400).json(error);
	}
});


/**
 * Modify an OpenVPN client prefix container.
 */
router.put('/', async (req, res) => {
	try {
		
		const openVPNPrefixService = await app().getService(OpenVPNPrefixService.name);
		await openVPNPrefixService.update(req);
		
		var data_return = {};
		await Firewall.getFirewallStatusNotZero(req.body.fwcloud, data_return);
		await OpenVPN.getOpenvpnStatusNotZero(req, data_return);

		res.status(204).json(data_return);
	} catch(error) {
		logger().error('Error updating a prefix: ' + JSON.stringify(error));
		res.status(400).json(error);
	}
});


/**
 * Get OpenVPN configuration metadata.
 */
router.put('/info/get', async(req, res) => {
	try {
		const data = await OpenVPNPrefix.getPrefixOpenvpnInfo(req.dbCon,req.body.fwcloud,req.body.prefix);
		res.status(200).json(data[0]);
	} catch(error) {
		logger().error('Error getting prefix metadata: ' + JSON.stringify(error));
		res.status(400).json(error) }
});


/**
 * Delete a CRT prefix container.
 */
router.put('/del', 
restrictedCheck.openvpn_prefix,
async (req, res) => {
	try {
		// Delete prefix.
		await OpenVPNPrefix.deletePrefix(req.dbCon,req.body.prefix);

		// Regenerate prefixes.
		await OpenVPNPrefix.applyOpenVPNPrefixes(req.dbCon,req.body.fwcloud,req.prefix.openvpn);
	
		res.status(204).end();
	} catch(error) {
		logger().error('Error removing prefix: ' + JSON.stringify(error));
		res.status(400).json(error);
	}
});


// API call for check deleting restrictions.
router.put('/restricted', restrictedCheck.openvpn_prefix, (req, res) => res.status(204).end());


router.put('/where', async (req, res) => {
	try {
		const data = await OpenVPNPrefix.searchPrefixUsage(req.dbCon, req.body.fwcloud, req.body.prefix, true);
		if (data.result)
			res.status(200).json(data);
		else
			res.status(204).end();
	} catch(error) {
		logger().error('Error getting prefix references: ' + JSON.stringify(error));
		res.status(400).json(error);
	}
});

module.exports = router;