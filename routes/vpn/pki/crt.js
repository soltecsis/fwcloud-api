var express = require('express');
var router = express.Router();

const fwcError = require('../../../utils/error_table');
const pkiCAModel = require('../../../models/vpn/pki/ca');
const pkiCRTModel = require('../../../models/vpn/pki/crt');
const pkiPrefixModel = require('../../../models/vpn/pki/prefix');
const fwcTreeModel = require('../../../models/tree/tree');
const config = require('../../../config/config');
const utilsModel = require('../../../utils/utils');
const restrictedCheck = require('../../../middleware/restricted');


/**
 * Create a new certificate.
 */
router.post('/', async(req, res) => {
	try {
		// Check that the tree node in which we will create a new node for the CA is a valid node for it.
		if (req.tree_node.node_type !== 'CA' && req.tree_node.node_type !== 'PRE') 
			throw fwcError.BAD_TREE_NODE_TYPE;

		// Add the new certificate to the database.
		const id = await pkiCRTModel.createCRT(req);

		req.caId = req.body.ca;
		await pkiCAModel.runEasyRsaCmd(req, (req.body.type===1) ? 'build-client-full' : 'build-server-full');

		// Apply prefixes to the newly created certificate.
		await pkiPrefixModel.applyCrtPrefixes(req,req.body.ca);

		res.status(200).json({insertId: id});
	} catch(error) { res.status(400).json(error) }
});

/* Get certificate information */
router.put('/get', (req, res) => {
	// We have already obtained the CA information in the access control middleware.
	res.status(200).json(req.crt);
});

/**
 * Delete certificate.
 */
router.put('/del', 
restrictedCheck.crt,
async(req, res) => {
	try {
		// Check that the certificate can be deleted and remove it from the database.
		await pkiCRTModel.deleteCRT(req);

		// Delete the files that make the certificate.
		const base_dir = config.get('pki').data_dir + '/' + req.body.fwcloud + '/' + req.crt.ca;
		await utilsModel.deleteFile(base_dir + '/reqs', req.crt.cn + '.req');
		await utilsModel.deleteFile(base_dir + '/issued', req.crt.cn + '.crt');
		await utilsModel.deleteFile(base_dir + '/private', req.crt.cn + '.key');
		const serial = await pkiCAModel.delFromIndex(base_dir, req.crt.cn);
		await utilsModel.deleteFile(base_dir + '/certs_by_serial', serial + '.pem');

		// Delete the certificate node into the tree.
		await fwcTreeModel.deleteObjFromTree(req.body.fwcloud, req.body.crt, ((req.crt.type===1) ? 301 : 302));

		// Answer to the API request.
		res.status(204).end();
	} catch(error) { res.status(400).json(error) }
});

// API call for check deleting restrictions.
router.put('/restricted', restrictedCheck.crt, (req, res) => res.status(204).end());

module.exports = router;
