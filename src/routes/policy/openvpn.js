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

import { PolicyRuleToOpenVPN } from '../../models/policy/PolicyRuleToOpenVPN';
import { Firewall } from '../../models/firewall/Firewall';
import { PolicyRuleToIPObj } from '../../models/policy/PolicyRuleToIPObj';
import { logger } from '../../fonaments/abstract-application';
const fwcError = require('../../utils/error_table');
const utilsModel = require("../../utils/utils.js");

/* Create New policy_r__openvpn */
router.post("/",
utilsModel.disableFirewallCompileStatus,
async (req, res) => {
	try {
		// Verify that the OpenVPN configuration is of client type.
		if (req.openvpn.type!==1)
			throw fwcError.VPN_ONLY_CLI;

		if (!(await PolicyRuleToOpenVPN.checkOpenvpnPosition(req.dbCon,req.body.position)))
			throw fwcError.NOT_ALLOWED;

		await PolicyRuleToOpenVPN.insertInRule(req);

		res.status(204).end();
	} catch(error) {
		logger().error('Error creating new policy_r__openvpn: ' + JSON.stringify(error));
		res.status(400).json(error);
	}
});


/* Update POSITION policy_r__openvpn that exist */
router.put('/move',
utilsModel.disableFirewallCompileStatus,
async (req, res) => {
	try { 
		await Firewall.updateFirewallStatus(req.body.fwcloud,req.body.firewall,"|3");

		if (await PolicyRuleToOpenVPN.checkExistsInPosition(req.dbCon,req.body.new_rule,req.body.openvpn,req.body.new_position))
			throw fwcError.ALREADY_EXISTS;

		// Get content of positions.
		const content = await PolicyRuleToIPObj.getPositionsContent(req.dbCon, req.body.position, req.body.new_position);
		if (content.content1!=='O' || content.content2!=='O')
			throw fwcError.BAD_POSITION;

		// Move OpenVPN configuration object to the new position.
		await PolicyRuleToOpenVPN.moveToNewPosition(req);

		res.status(204).end();
	} catch(error) {
		logger().error('Error creating new policy_r__openvpn: ' + JSON.stringify(error));
		res.status(400).json(error);
	}
});


/* Update ORDER de policy_r__interface that exist */
router.put('/order', utilsModel.disableFirewallCompileStatus, (req, res) => {});


/* Remove policy_r__openvpn */
router.put('/del',
utilsModel.disableFirewallCompileStatus,
async (req, res) => {
	try { 
		await PolicyRuleToOpenVPN.deleteFromRulePosition(req);
		res.status(204).end();
	} catch(error) {
		logger().error('Error creating new policy_r__openvpn: ' + JSON.stringify(error));
		res.status(400).json(error);
	}
});

module.exports = router;