var express = require('express');
var router = express.Router();

var api_resp = require('../../../utils/api_response');

var objModel = 'OpenvpnPrefix';

const openvpnPrefixModel = require('../../../models/vpn/openvpn/prefix');
const policyPrefixModel = require('../../../models/policy/prefix');
const policy_cModel = require('../../../models/policy/policy_c');
const restrictedCheck = require('../../../middleware/restricted');
const Policy_r__ipobjModel = require('../../../models/policy/policy_r__ipobj');


/**
 * Create a new crt prefix container.
 */
router.post('/', async (req, res) => {
	try {
		// We can only create prefixes for OpenVPN server configurations.
		if (req.openvpn.type!==2)
			throw(new Error('Prefixes can only be created over server OpenVPN configurations'));

    // Verify that we are not creating a prefix that already exists for the same CA.
		if (await openvpnPrefixModel.existsPrefix(req.dbCon,req.body.openvpn,req.body.name)) 
			return api_resp.getJson(null, api_resp.ACR_ALREADY_EXISTS, 'OpenVPN prefix name already exists', objModel, null, jsonResp => res.status(200).json(jsonResp));

   	// Create the tree node.
		const id = await openvpnPrefixModel.createPrefix(req);

		// Apply the new CRT prefix container.
		await openvpnPrefixModel.applyOpenVPNPrefixes(req.dbCon,req.body.fwcloud,req.body.openvpn);

		api_resp.getJson({insertId: id}, api_resp.ACR_INSERTED_OK, 'INSERTED OK', objModel, null, jsonResp => res.status(200).json(jsonResp));
  } catch(error) { api_resp.getJson(null, api_resp.ACR_ERROR, 'Error creating prefix container', objModel, error, jsonResp => res.status(200).json(jsonResp)) }
});


/**
 * Modify a CRT prefix container.
 */
router.put('/', async (req, res) => {
	try {
		// Verify that the new prefix name doesn't already exists.
		req.body.ca = req.prefix.ca;
		if (await openvpnPrefixModel.existsPrefix(req.dbCon,req.prefix.openvpn,req.body.name))
			return api_resp.getJson(null, api_resp.ACR_ALREADY_EXISTS, 'OpenVPN prefix name already exists', objModel, null, jsonResp => res.status(200).json(jsonResp));

		// If we modify a prefix used in a rule or group, and the new prefix name has no openvpn clients, then don't allow it.
		const search = await policyPrefixModel.searchPrefixUsage(req.dbCon,req.body.fwcloud,req.body.prefix);
		if (search.result && (await openvpnPrefixModel.getOpenvpnClientesUnderPrefix(req.dbCon,req.prefix.openvpn,req.body.name)).length < 1)
			return api_resp.getJson(null, api_resp.ACR_EMPTY_CONTAINER, 'It is not possible to leave empty prefixes into rule positions', objModel, null, jsonResp => res.status(200).json(jsonResp));

		// Invalidate the compilation of the rules that use this prefix.
		for(let rule of search.restrictions.PrefixInRule) {
			await policy_cModel.deletePolicy_c(rule.firewall, rule.rule);
			await FirewallModel.updateFirewallStatus(req.body.fwcloud,rule.firewall,"|3");
		}

		// Invalidate the compilation of the rules that use a group that use this prefix.
		for(let group of search.restrictions.PrefixInGroup) {
			// Search rules that use the group.
			const groupInRules = await Policy_r__ipobjModel.searchGroupInRule(group.group,req.body.fwcloud);
			// Invalidate rules compilation.
			for(let rule of groupInRules) {
				await policy_cModel.deletePolicy_c(rule.firewall, rule.rule);
				await FirewallModel.updateFirewallStatus(req.body.fwcloud,rule.firewall,"|3");
			}
		}

   	// Modify the prefix name.
		await openvpnPrefixModel.modifyPrefix(req);

		// Apply the new CRT prefix container.
		await openvpnPrefixModel.applyOpenVPNPrefixes(req.dbCon,req.body.fwcloud,req.prefix.openvpn);

		api_resp.getJson(null, api_resp.ACR_OK, 'UPDATE OK', objModel, null, jsonResp => res.status(200).json(jsonResp));
  } catch(error) { api_resp.getJson(null, api_resp.ACR_ERROR, 'Error modifying prefix container', objModel, error, jsonResp => res.status(200).json(jsonResp)) }
});


/**
 * Get OpenVPN configuration metadata.
 */
router.put('/info/get', async(req, res) => {
	try {
		const data = await openvpnPrefixModel.getPrefixOpenvpnInfo(req.dbCon,req.body.fwcloud,req.body.prefix);
		api_resp.getJson(data[0], api_resp.ACR_OK, 'OpenVPN sever prefix info sent', objModel, null, jsonResp => res.status(200).json(jsonResp));
	} catch (error) { return api_resp.getJson(null, api_resp.ACR_ERROR, 'Error getting OpenVPN server prefix info', objModel, error, jsonResp => res.status(200).json(jsonResp)) }
});


/**
 * Delete a CRT prefix container.
 */
router.put('/del', 
restrictedCheck.openvpn_prefix,
async (req, res) => {
	try {
		// Delete prefix.
		await openvpnPrefixModel.deletePrefix(req);

		// Regenerate prefixes.
		await openvpnPrefixModel.applyOpenVPNPrefixes(req.dbCon,req.body.fwcloud,req.prefix.openvpn);
	
		api_resp.getJson(null, api_resp.ACR_OK, 'REMOVED OK', objModel, null, jsonResp => res.status(200).json(jsonResp));
  } catch(error) { api_resp.getJson(null, api_resp.ACR_ERROR, 'Error removing prefix container', objModel, error, jsonResp => res.status(200).json(jsonResp)) }
});


// API call for check deleting restrictions.
router.put('/restricted',
	restrictedCheck.openvpn_prefix,
	(req, res) => api_resp.getJson(null, api_resp.ACR_OK, '', objModel, null, jsonResp => res.status(200).json(jsonResp)));


router.put('/where', async (req, res) => {
	try {
		const data = await policyPrefixModel.searchPrefixUsage(req.dbCon,req.body.fwcloud,req.body.prefix);
		if (data && data.result)
			api_resp.getJson(data, api_resp.ACR_OK, '', objModel, null, jsonResp => res.status(200).json(jsonResp));
		else
			api_resp.getJson(data, api_resp.ACR_NOTEXIST, '', objModel, null, jsonResp => res.status(200).json(jsonResp));
	} catch(error) { api_resp.getJson(null, api_resp.ACR_ERROR, 'Error', objModel, error, jsonResp => res.status(200).json(jsonResp)) }
});

module.exports = router;