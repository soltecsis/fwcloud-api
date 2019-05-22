var express = require('express');
var router = express.Router();

const policyOpenvpnModel = require('../../models/policy/openvpn');
const policy_r__ipobjModel = require('../../models/policy/policy_r__ipobj');
const policy_rModel = require('../../models/policy/policy_r');
const policy_cModel = require('../../models/policy/policy_c');
const firewallModel = require('../../models/firewall/firewall');
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

		if (!(await policyOpenvpnModel.checkOpenvpnPosition(req.dbCon,req.body.position)))
			throw fwcError.NOT_ALLOWED;

		await policyOpenvpnModel.insertInRule(req);
		policy_rModel.compilePolicy_r(req.body.rule, (error, datac) => {});

		res.status(204).end();
	} catch(error) { res.status(400).json(error) }
});


/* Update POSITION policy_r__openvpn that exist */
router.put('/move',
utilsModel.disableFirewallCompileStatus,
async (req, res) => {
	try { 
		// Invalidate compilation of the affected rules.
		await policy_cModel.deletePolicy_c(req.body.rule);
		await policy_cModel.deletePolicy_c(req.body.new_rule);
		await firewallModel.updateFirewallStatus(req.body.fwcloud,req.body.firewall,"|3");

		if (await policyOpenvpnModel.checkExistsInPosition(req.dbCon,req.body.new_rule,req.body.openvpn,req.body.new_position))
			throw fwcError.ALREADY_EXISTS;

		// Get content of positions.
		const content = await policy_r__ipobjModel.getPositionsContent(req.dbCon, req.body.position, req.body.new_position);
		if (content.content1!=='O' || content.content2!=='O')
			throw fwcError.BAD_POSITION;

		// Move OpenVPN configuration object to the new position.
		const data = await policyOpenvpnModel.moveToNewPosition(req);

		res.status(200).json(data);
	} catch(error) { res.status(400).json(error) }
});


/* Update ORDER de policy_r__interface that exist */
router.put('/order', utilsModel.disableFirewallCompileStatus, (req, res) => {});


/* Remove policy_r__openvpn */
router.put('/del',
utilsModel.disableFirewallCompileStatus,
async (req, res) => {
	try { 
		await policyOpenvpnModel.deleteFromRulePosition(req);
		res.status(204).end();
	} catch(error) { res.status(400).json(error) }
});

module.exports = router;