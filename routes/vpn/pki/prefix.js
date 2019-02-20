var express = require('express');
var router = express.Router();

var api_resp = require('../../../utils/api_response');

const objModel = 'CRT PREFIX';

const pkiPrefixModel = require('../../../models/vpn/pki/prefix');

/**
 * Create a new crt prefix container.
 */
router.post('/', async (req, res) => {
	try {
    // Verify that we are not creating a prefix that already exists for the same CA.
		if (await pkiPrefixModel.existsCrtPrefix(req)) 
			return api_resp.getJson(null, api_resp.ACR_ALREADY_EXISTS, 'CRT prefix name already exists', objModel, null, jsonResp => res.status(200).json(jsonResp));

   	// Create the tree node.
		await pkiPrefixModel.createCrtPrefix(req);

		// Apply the new CRT prefix container.
		await pkiPrefixModel.applyCrtPrefixes(req,req.body.ca);

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
		if (await pkiPrefixModel.existsCrtPrefix(req,req.prefix.ca)) 
			return api_resp.getJson(null, api_resp.ACR_ALREADY_EXISTS, 'CRT prefix name already exists', objModel, null, jsonResp => res.status(200).json(jsonResp));

   	// Modify the prefix name.
		await pkiPrefixModel.modifyCrtPrefix(req);

		// Apply the new CRT prefix container.
		await pkiPrefixModel.applyCrtPrefixes(req,req.prefix.ca);

		api_resp.getJson(null, api_resp.ACR_OK, 'UPDATE OK', objModel, null, jsonResp => res.status(200).json(jsonResp));
  } catch(error) { api_resp.getJson(null, api_resp.ACR_ERROR, 'Error modifying prefix container', objModel, error, jsonResp => res.status(200).json(jsonResp)) }
});


/**
 * Delete a CRT prefix container.
 */
router.put('/del', async (req, res) => {
	try {
		// Delete prefix.
		await pkiPrefixModel.deleteCrtPrefix(req);

		// Regenerate prefixes.
		await pkiPrefixModel.applyCrtPrefixes(req,req.prefix.ca);
	
		api_resp.getJson(null, api_resp.ACR_OK, 'REMOVED OK', objModel, null, jsonResp => res.status(200).json(jsonResp));
  } catch(error) { api_resp.getJson(null, api_resp.ACR_ERROR, 'Error removing prefix container', objModel, error, jsonResp => res.status(200).json(jsonResp)) }
});

module.exports = router;