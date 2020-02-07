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

import { OpenVPNPrefix } from '../../models/vpn/openvpn/OpenVPNPrefix';
import { PolicyRuleToOpenVPNPrefix } from '../../models/policy/PolicyRuleToOpenVPNPrefix';
import { PolicyCompilation } from '../../models/policy/PolicyCompilation';
import { Firewall } from '../../models/firewall/Firewall';
const policy_r__ipobjModel = require('../../models/policy/policy_r__ipobj');
import { PolicyRule } from '../../models/policy/PolicyRule';
const utilsModel = require("../../utils/utils.js");
const fwcError = require('../../utils/error_table');

/* Create New policy_r__openvpn_prefix */
router.post("/",
utilsModel.disableFirewallCompileStatus,
async (req, res) => {
	try {
		if ((await OpenVPNPrefix.getOpenvpnClientesUnderPrefix(req.dbCon,req.prefix.openvpn,req.prefix.name)).length < 1)
			throw fwcError.IPOBJ_EMPTY_CONTAINER;

		if (!(await PolicyRuleToOpenVPNPrefix.checkPrefixPosition(req.dbCon,req.body.position)))
			throw fwcError.ALREADY_EXISTS;

		await PolicyRuleToOpenVPNPrefix.insertInRule(req);
		PolicyRule.compilePolicy_r(req.body.rule, (error, datac) => {});

		res.status(204).end();
	} catch(error) { res.status(400).json(error) }
});


/* Update POSITION policy_r__openvpn_prefix that exist */
router.put('/move',
utilsModel.disableFirewallCompileStatus,
async (req, res) => {
	try {
		if ((await OpenVPNPrefix.getOpenvpnClientesUnderPrefix(req.dbCon,req.prefix.openvpn,req.prefix.name)).length < 1)
			throw fwcError.IPOBJ_EMPTY_CONTAINER;
		
		if (await PolicyRuleToOpenVPNPrefix.checkExistsInPosition(req.dbCon,req.body.new_rule,req.body.prefix,req.body.openvpn,req.body.new_position))
			throw fwcError.ALREADY_EXISTS;

		// Get content of positions.
		const content = await policy_r__ipobjModel.getPositionsContent(req.dbCon, req.body.position, req.body.new_position);
		if (content.content1!=='O' || content.content2!=='O')
			throw fwcError.BAD_POSITION;

		// Invalidate compilation of the affected rules.
		await PolicyCompilation.deletePolicy_c(req.body.rule);
		await PolicyCompilation.deletePolicy_c(req.body.new_rule);
		await Firewall.updateFirewallStatus(req.body.fwcloud,req.body.firewall,"|3");

		// Move OpenVPN configuration object to the new position.
		const data = await PolicyRuleToOpenVPNPrefix.moveToNewPosition(req);

		res.status(200).json(data);
	} catch(error) { res.status(400).json(error) }
});


/* Update ORDER de policy_r__interface that exist */
router.put('/order', utilsModel.disableFirewallCompileStatus, (req, res) => {});


/* Remove policy_r__openvpn_prefix */
router.put('/del',
utilsModel.disableFirewallCompileStatus,
async (req, res) => {
	try { 
		await PolicyRuleToOpenVPNPrefix.deleteFromRulePosition(req);
		res.status(204).end();
	} catch(error) { res.status(400).json(error) }
});

module.exports = router;