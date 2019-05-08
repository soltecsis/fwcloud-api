var express = require('express');
var router = express.Router();

const fwcError = require('../../../utils/error_table');
const pkiPrefixModel = require('../../../models/vpn/pki/prefix');

/**
 * Create a new crt prefix container.
 */
router.post('/', async (req, res) => {
	try {
    // Verify that we are not creating a prefix that already exists for the same CA.
		if (await pkiPrefixModel.existsCrtPrefix(req)) 
			throw fwcError.ALREADY_EXISTS;

   	// Create the tree node.
		const id = await pkiPrefixModel.createCrtPrefix(req);

		// Apply the new CRT prefix container.
		await pkiPrefixModel.applyCrtPrefixes(req,req.body.ca);

		res.status(200).json({insertId: id});
	} catch(error) { res.status(400).json(error) }
});


/**
 * Modify a CRT prefix container.
 */
router.put('/', async (req, res) => {
	try {
		// Verify that the new prefix name doesn't already exists.
		req.body.ca = req.prefix.ca;
		if (await pkiPrefixModel.existsCrtPrefix(req,req.prefix.ca)) 
			throw fwcError.ALREADY_EXISTS;

   	// Modify the prefix name.
		await pkiPrefixModel.modifyCrtPrefix(req);

		// Apply the new CRT prefix container.
		await pkiPrefixModel.applyCrtPrefixes(req,req.prefix.ca);

		res.status(204).end();
	} catch(error) { res.status(400).json(error) }
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
	
		res.status(204).end();
	} catch(error) { res.status(400).json(error) }
});

module.exports = router;