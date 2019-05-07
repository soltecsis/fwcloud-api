var express = require('express');
var router = express.Router();

const fwcError = require('../../../utils/error_table');
const pkiCAModel = require('../../../models/vpn/pki/ca');
const fwcTreeModel = require('../../../models/tree/tree');
const config = require('../../../config/config');
const utilsModel = require('../../../utils/utils');
const restrictedCheck = require('../../../middleware/restricted');


/**
 * Create a new CA (Certification Authority).
 */
router.post('/', async(req, res) => {
	try {
		// Check that the tree node in which we will create a new node for the CA is a valid node for it.
		if (req.tree_node.node_type !== 'FCA' && req.tree_node.node_type !== 'FD') throw (new Error('Bad node tree type'));

		// Add the new CA to the database.
		req.caId = await pkiCAModel.createCA(req);
		// Create the new CA directory structure.
		await pkiCAModel.runEasyRsaCmd(req, 'init-pki');
		await pkiCAModel.runEasyRsaCmd(req, 'build-ca');
		await pkiCAModel.runEasyRsaCmd(req, 'gen-crl');

		// Don't wait for the finish of this process because it takes several minutes.
		pkiCAModel.runEasyRsaCmd(req, 'gen-dh')
			.then(() => {
				req.dbCon.query(`update ca set status=0 where id=${req.caId}`, (error, result) => {
					const socket = req.app.get('socketio').sockets.connected[req.body.socketid];
					if (socket) socket.emit('ca:dh:created', { caId: req.caId, caCn: req.body.cn });
				});
			});

		// Create new CA tree node.
		const nodeId = await fwcTreeModel.newNode(req.dbCon, req.body.fwcloud, req.body.cn, req.body.node_id, 'CA', req.caId, 300);

		api_resp.getJson({ insertId: req.caId, TreeinsertId: nodeId }, api_resp.ACR_OK, 'CERTIFICATION AUTHORITY CREATED', objModel, null, jsonResp => res.status(200).json(jsonResp));
	} catch (error) { return api_resp.getJson(null, api_resp.ACR_ERROR, 'Error creating CA', objModel, error, jsonResp => res.status(200).json(jsonResp)) }
});


/* Get CA information */
router.put('/get', (req, res) => {
	// We have already obtained the CA information in the access control middleware.
	api_resp.getJson(req.ca, api_resp.ACR_OK, '', 'CA', null, jsonResp => res.status(200).json(jsonResp));
});


/**
 * Delete ca.
 */
router.put('/del', 
restrictedCheck.ca,
async(req, res) => {
	try {
		// Check that the ca can be deleted and delete it from the database.
		await pkiCAModel.deleteCA(req);

		// Delete the ca directory structure.
		await utilsModel.deleteFolder(config.get('pki').data_dir + '/' + req.body.fwcloud + '/' + req.body.ca);

		// Delete the ca node into the tree.
		await fwcTreeModel.deleteObjFromTree(req.body.fwcloud, req.body.ca, 300);

		// Answer to the API request.
		api_resp.getJson(null, api_resp.ACR_OK, 'CERTIFICATE DELETED', objModel, null, jsonResp => res.status(200).json(jsonResp));
	} catch (error) { return api_resp.getJson(null, api_resp.ACR_ERROR, 'Error deleting CA', objModel, error, jsonResp => res.status(200).json(jsonResp)) }
});

// API call for check deleting restrictions.
router.put('/restricted',
	restrictedCheck.ca,
	(req, res) => api_resp.getJson(null, api_resp.ACR_OK, '', objModel, null, jsonResp => res.status(200).json(jsonResp)));

module.exports = router;
