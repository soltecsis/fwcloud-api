var express = require('express');
var router = express.Router();

const openvpnPrefixModel = require('../../models/vpn/openvpn/prefix');
const policyPrefixModel = require('../../models/policy/prefix');
const policy_r__ipobjModel = require('../../models/policy/policy_r__ipobj');
const policy_rModel = require('../../models/policy/policy_r');
const policy_cModel = require('../../models/policy/policy_c');
const firewallModel = require('../../models/firewall/firewall');
const utilsModel = require("../../utils/utils.js");
const fwcError = require('../../utils/error_table');

/* Create New policy_r__openvpn_prefix */
router.post("/",
utilsModel.disableFirewallCompileStatus,
async (req, res) => {
	try {
		if ((await openvpnPrefixModel.getOpenvpnClientesUnderPrefix(req.dbCon,req.prefix.openvpn,req.prefix.name)).length < 1)
			throw fwcError.IPOBJ_EMPTY_CONTAINER;

		if (!(await policyPrefixModel.checkPrefixPosition(req.dbCon,req.body.position)))
			throw fwcError.ALREADY_EXISTS;

		await policyPrefixModel.insertInRule(req);
		policy_rModel.compilePolicy_r(req.body.rule, (error, datac) => {});

		res.status(204).end();
	} catch(error) { res.status(400).json(error) }
});


/* Update POSITION policy_r__openvpn_prefix that exist */
router.put('/move',
utilsModel.disableFirewallCompileStatus,
async (req, res) => {
	try {
		if ((await openvpnPrefixModel.getOpenvpnClientesUnderPrefix(req.dbCon,req.prefix.openvpn,req.prefix.name)).length < 1)
			throw fwcError.IPOBJ_EMPTY_CONTAINER;
		
		if (await policyPrefixModel.checkExistsInPosition(req.dbCon,req.body.new_rule,req.body.prefix,req.body.openvpn,req.body.new_position))
			throw fwcError.ALREADY_EXISTS;

		// Get content of positions.
		const content = await policy_r__ipobjModel.getPositionsContent(req.dbCon, req.body.position, req.body.new_position);
		if (content.content1!=='O' || content.content2!=='O')
			throw fwcError.BAD_POSITION;

		// Invalidate compilation of the affected rules.
		await policy_cModel.deletePolicy_c(req.body.firewall, req.body.rule);
		await policy_cModel.deletePolicy_c(req.body.firewall, req.body.new_rule);
		await firewallModel.updateFirewallStatus(req.body.fwcloud,req.body.firewall,"|3");

		// Move OpenVPN configuration object to the new position.
		const data = await policyPrefixModel.moveToNewPosition(req);

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
		await policyPrefixModel.deleteFromRulePosition(req);
		res.status(204).end();
	} catch(error) { res.status(400).json(error) }
});

module.exports = router;