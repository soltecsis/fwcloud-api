var express = require('express');
var router = express.Router();

var api_resp = require('../../utils/api_response');

var objModel = 'IptablesMark';

const markModel = require('../../models/vpn/openvpn/prefix');
const restrictedCheck = require('../../middleware/restricted');


/**
 * Create a new iptables mark.
 */
router.post('/', async (req, res) => {
	try {
		if (req.tree_node.node_type !== 'MRK')
			return api_resp.getJson(null, api_resp.ACR_ERROR, 'Bad tree node type', objModel, null, jsonResp => res.status(200).json(jsonResp));

    // Verify that we are not creating an iptables mark that already exists for this fwcloud.
		if (await markModel.existsMark(req.dbCon,req.body.fwcloud,req.body.mark)) 
			return api_resp.getJson(null, api_resp.ACR_ALREADY_EXISTS, 'Iptables mark already exists', objModel, null, jsonResp => res.status(200).json(jsonResp));

		// Create the new iptables mark for the indicated fwcloud.
		const id = await markModel.createMark(req);

		// Create the iptables mark node in the ipobj tree.
		let nodeId = await fwcTreeModel.newNode(req.dbCon, req.body.fwcloud, req.body.name, req.body.node_id, 'MRK', id, 30);

		api_resp.getJson({insertId: id, TreeinsertId: nodeId}, api_resp.ACR_INSERTED_OK, 'INSERTED OK', objModel, null, jsonResp => res.status(200).json(jsonResp));
  } catch(error) { api_resp.getJson(null, api_resp.ACR_ERROR, 'Error creating iptables mark', objModel, error, jsonResp => res.status(200).json(jsonResp)) }
});


/**
 * Modify an OpenVPN client prefix container.
 */
router.put('/', async (req, res) => {
	try {
		// Verify that the new prefix name doesn't already exists.
		req.body.ca = req.prefix.ca;
		if (await openvpnPrefixModel.existsPrefix(req.dbCon,req.prefix.openvpn,req.body.name))
			return api_resp.getJson(null, api_resp.ACR_ALREADY_EXISTS, 'OpenVPN prefix name already exists', objModel, null, jsonResp => res.status(200).json(jsonResp));

		// If we modify a prefix used in a rule or group, and the new prefix name has no openvpn clients, then don't allow it.
		const search = await openvpnPrefixModel.searchPrefixUsage(req.dbCon,req.body.fwcloud,req.body.prefix);
		if (search.result && (await openvpnPrefixModel.getOpenvpnClientesUnderPrefix(req.dbCon,req.prefix.openvpn,req.body.name)).length < 1)
			return api_resp.getJson(null, api_resp.ACR_EMPTY_CONTAINER, 'It is not possible to leave empty prefixes into rule positions', objModel, null, jsonResp => res.status(200).json(jsonResp));

		// Invalidate the compilation of the rules that use this prefix.
		await policy_cModel.deleteRulesCompilation(req.body.fwcloud,search.restrictions.PrefixInRule);

		// Invalidate the compilation of the rules that use a group that use this prefix.
		await policy_cModel.deleteGroupsInRulesCompilation(req.dbCon,req.body.fwcloud,search.restrictions.PrefixInGroup);

   	// Modify the prefix name.
		await openvpnPrefixModel.modifyPrefix(req);

		// Apply the new CRT prefix container.
		await openvpnPrefixModel.applyOpenVPNPrefixes(req.dbCon, req.body.fwcloud, req.prefix.openvpn);

		api_resp.getJson(null, api_resp.ACR_OK, 'UPDATE OK', objModel, null, jsonResp => res.status(200).json(jsonResp));
  } catch(error) { api_resp.getJson(null, api_resp.ACR_ERROR, 'Error modifying prefix container', objModel, error, jsonResp => res.status(200).json(jsonResp)) }
});

module.exports = router;