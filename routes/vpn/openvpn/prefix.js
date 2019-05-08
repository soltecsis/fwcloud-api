var express = require('express');
var router = express.Router();

const fwcError = require('../../../utils/error_table');
const openvpnPrefixModel = require('../../../models/vpn/openvpn/prefix');
const policy_cModel = require('../../../models/policy/policy_c');
const restrictedCheck = require('../../../middleware/restricted');


/**
 * Create a new crt prefix container.
 */
router.post('/', async (req, res) => {
	try {
		// We can only create prefixes for OpenVPN server configurations.
		if (req.openvpn.type!==2)
			throw fwcError.VPN_NOT_SER;

    // Verify that we are not creating a prefix that already exists for the same CA.
		if (await openvpnPrefixModel.existsPrefix(req.dbCon,req.body.openvpn,req.body.name)) 
			throw fwcError.ALREADY_EXISTS;

   	// Create the tree node.
		const id = await openvpnPrefixModel.createPrefix(req);

		// Apply the new CRT prefix container.
		await openvpnPrefixModel.applyOpenVPNPrefixes(req.dbCon,req.body.fwcloud,req.body.openvpn);

		res.status(200).json({insertId: id});
	} catch(error) { res.status(400).json(error) }
});


/**
 * Modify an OpenVPN client prefix container.
 */
router.put('/', async (req, res) => {
	try {
		// Verify that the new prefix name doesn't already exists.
		req.body.ca = req.prefix.ca;
		if (await openvpnPrefixModel.existsPrefix(req.dbCon,req.prefix.openvpn,req.body.name))
			throw fwcError.ALREADY_EXISTS;

		// If we modify a prefix used in a rule or group, and the new prefix name has no openvpn clients, then don't allow it.
		const search = await openvpnPrefixModel.searchPrefixUsage(req.dbCon,req.body.fwcloud,req.body.prefix);
		if (search.result && (await openvpnPrefixModel.getOpenvpnClientesUnderPrefix(req.dbCon,req.prefix.openvpn,req.body.name)).length < 1)
			throw fwcError.IPOBJ_EMPTY_CONTAINER;

		// Invalidate the compilation of the rules that use this prefix.
		await policy_cModel.deleteRulesCompilation(req.body.fwcloud,search.restrictions.PrefixInRule);

		// Invalidate the compilation of the rules that use a group that use this prefix.
		await policy_cModel.deleteGroupsInRulesCompilation(req.dbCon,req.body.fwcloud,search.restrictions.PrefixInGroup);

   	// Modify the prefix name.
		await openvpnPrefixModel.modifyPrefix(req);

		// Apply the new CRT prefix container.
		await openvpnPrefixModel.applyOpenVPNPrefixes(req.dbCon, req.body.fwcloud, req.prefix.openvpn);

		res.status(204).end();
	} catch(error) { res.status(400).json(error) }
});


/**
 * Get OpenVPN configuration metadata.
 */
router.put('/info/get', async(req, res) => {
	try {
		const data = await openvpnPrefixModel.getPrefixOpenvpnInfo(req.dbCon,req.body.fwcloud,req.body.prefix);
		res.status(200).json(data[0]);
	} catch(error) { res.status(400).json(error) }
});


/**
 * Delete a CRT prefix container.
 */
router.put('/del', 
restrictedCheck.openvpn_prefix,
async (req, res) => {
	try {
		// Delete prefix.
		await openvpnPrefixModel.deletePrefix(req.dbCon,req.body.prefix);

		// Regenerate prefixes.
		await openvpnPrefixModel.applyOpenVPNPrefixes(req.dbCon,req.body.fwcloud,req.prefix.openvpn);
	
		res.status(204).end();
	} catch(error) { res.status(400).json(error) }
});


// API call for check deleting restrictions.
router.put('/restricted', restrictedCheck.openvpn_prefix, (req, res) => res.status(204).end());


router.put('/where', async (req, res) => {
	try {
		const data = await openvpnPrefixModel.searchPrefixUsage(req.dbCon,req.body.fwcloud,req.body.prefix);
		res.status(200).json(data);
	} catch(error) { res.status(400).json(error) }
});

module.exports = router;