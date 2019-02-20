var express = require('express');
var router = express.Router();

var api_resp = require('../../../utils/api_response');

var objModel = 'OpenvpnPrefix';

const openvpnPrefixModel = require('../../../models/vpn/openvpn/prefix');
const restrictedCheck = require('../../../middleware/restricted');

/**
 * Create a new crt prefix container.
 */
router.post('/', async (req, res) => {
	try {
    // Verify that we are not creating a prefix that already exists for the same CA.
		if (await pkiModel.existsCrtPrefix(req)) 
			return api_resp.getJson(null, api_resp.ACR_ALREADY_EXISTS, 'CRT prefix name already exists', objModel, null, jsonResp => res.status(200).json(jsonResp));

   	// Create the tree node.
		await pkiModel.createCrtPrefix(req);

		// Apply the new CRT prefix container.
		await pkiModel.applyCrtPrefixes(req,req.body.ca);

		api_resp.getJson(null, api_resp.ACR_INSERTED_OK, 'INSERTED OK', objModel, null, jsonResp => res.status(200).json(jsonResp));
  } catch(error) { api_resp.getJson(null, api_resp.ACR_ERROR, 'Error creating prefix container', objModel, error, jsonResp => res.status(200).json(jsonResp)) }
});


/**
 * Modify a CRT prefix container.
 */
router.put('/', async (req, res) => {
	try {
		// Verify that the new prefix name doesn't already exists.
		req.body.ca = req.prefix.ca;
		if (await pkiModel.existsCrtPrefix(req,req.prefix.ca)) 
			return api_resp.getJson(null, api_resp.ACR_ALREADY_EXISTS, 'CRT prefix name already exists', objModel, null, jsonResp => res.status(200).json(jsonResp));

   	// Modify the prefix name.
		await pkiModel.modifyCrtPrefix(req);

		// Apply the new CRT prefix container.
		await pkiModel.applyCrtPrefixes(req,req.prefix.ca);

		api_resp.getJson(null, api_resp.ACR_OK, 'UPDATE OK', objModel, null, jsonResp => res.status(200).json(jsonResp));
  } catch(error) { api_resp.getJson(null, api_resp.ACR_ERROR, 'Error modifying prefix container', objModel, error, jsonResp => res.status(200).json(jsonResp)) }
});


/**
 * Delete a CRT prefix container.
 */
router.put('/del', 
restrictedCheck.openvpn_prefix,
async (req, res) => {
	try {
		// Delete prefix.
		await pkiModel.deleteCrtPrefix(req);

		// Regenerate prefixes.
		await pkiModel.applyCrtPrefixes(req,req.prefix.ca);
	
		api_resp.getJson(null, api_resp.ACR_OK, 'REMOVED OK', objModel, null, jsonResp => res.status(200).json(jsonResp));
  } catch(error) { api_resp.getJson(null, api_resp.ACR_ERROR, 'Error removing prefix container', objModel, error, jsonResp => res.status(200).json(jsonResp)) }
});


// API call for check deleting restrictions.
router.put('/restricted',
	restrictedCheck.openvpn_prefix,
	(req, res) => api_resp.getJson(null, api_resp.ACR_OK, '', objModel, null, jsonResp => res.status(200).json(jsonResp)));


module.exports = router;