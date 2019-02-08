/**
 * Module to routing OpenVPN requests
 * <br>BASE ROUTE CALL: <b>/vpn/openvpn</b>
 *
 * @module OpenVPN
 * 
 * @requires express
 * @requires openvpnModel
 * 
 */

/**
 * Property  to manage express
 *
 * @property express
 * @type express
 */
var express = require('express');
/**
 * Property  to manage  route
 *
 * @property router
 * @type express.Router 
 */
var router = express.Router();


/**
 * Property Model to manage API RESPONSE data
 *
 * @property api_resp
 * 
 */
var api_resp = require('../../utils/api_response');

/**
 * Property to identify Data Object
 *
 * @property objModel
 * @type text
 */
const objModel = 'PKI';

const pkiModel = require('../../models/vpn/pki');
const fwcTreeModel = require('../../models/tree/tree');
const config = require('../../config/config');
const utilsModel = require('../../utils/utils');
const restrictedCheck = require('../../middleware/restricted');


/**
 * Create a new CA (Certification Authority).
 */
router.post('/ca', async(req, res) => {
	try {
		// Check that the tree node in which we will create a new node for the CA is a valid node for it.
		if (req.tree_node.node_type !== 'FCA' && req.tree_node.node_type !== 'FD') throw (new Error('Bad node tree type'));

		// Add the new CA to the database.
		req.caId = await pkiModel.createCA(req);
		// Create the new CA directory structure.
		await pkiModel.runEasyRsaCmd(req, 'init-pki');
		await pkiModel.runEasyRsaCmd(req, 'build-ca');
		await pkiModel.runEasyRsaCmd(req, 'gen-crl');

		// Don't wait for the finish of this process because it takes several minutes.
		pkiModel.runEasyRsaCmd(req, 'gen-dh')
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
router.put('/ca/get', (req, res) => {
	// We have already obtained the CA information in the access control middleware.
	api_resp.getJson(req.ca, api_resp.ACR_OK, '', 'CA', null, jsonResp => res.status(200).json(jsonResp));
});


/**
 * Delete ca.
 */
router.put('/ca/del', 
restrictedCheck.ca,
async(req, res) => {
	try {
		// Check that the ca can be deleted and delete it from the database.
		await pkiModel.deleteCA(req);

		// Delete the ca directory structure.
		await utilsModel.deleteFolder(config.get('pki').data_dir + '/' + req.body.fwcloud + '/' + req.body.ca);

		// Delete the ca node into the tree.
		await fwcTreeModel.deleteObjFromTree(req.body.fwcloud, req.body.ca, 300);

		// Answer to the API request.
		api_resp.getJson(null, api_resp.ACR_OK, 'CERTIFICATE DELETED', objModel, null, jsonResp => res.status(200).json(jsonResp));
	} catch (error) { return api_resp.getJson(null, api_resp.ACR_ERROR, 'Error deleting CA', objModel, error, jsonResp => res.status(200).json(jsonResp)) }
});

// API call for check deleting restrictions.
router.put('/ca/restricted',
	restrictedCheck.ca,
	(req, res) => api_resp.getJson(null, api_resp.ACR_OK, '', objModel, null, jsonResp => res.status(200).json(jsonResp)));


/**
 * Create a new certificate.
 */
router.post('/crt', async(req, res) => {
	try {
		// Check that the tree node in which we will create a new node for the CA is a valid node for it.
		if (req.tree_node.node_type !== 'CA' && req.tree_node.node_type !== 'FD') throw (new Error('Bad node tree type'));

		// Add the new certificate to the database.
		const crtId = await pkiModel.createCRT(req);

		// Create the new certificate in the CA directory.
		var cmd = 'build-client-full'; // Client certificate
		var obj_type = 301;
		if (req.body.type === 2) { // Server certificate
			cmd = 'build-server-full';
			obj_type = 302;
		}
		req.caId = req.body.ca;
		await pkiModel.runEasyRsaCmd(req, cmd);

		// Create new CRT tree node.
		const nodeId = await fwcTreeModel.newNode(req.dbCon, req.body.fwcloud, req.body.cn, req.body.node_id, 'CRT', crtId, obj_type);

		api_resp.getJson({ insertId: crtId, TreeinsertId: nodeId }, api_resp.ACR_OK, 'CERTIFICATE CREATED', objModel, null, jsonResp => res.status(200).json(jsonResp));
	} catch (error) { return api_resp.getJson(null, api_resp.ACR_ERROR, 'Error creating CRT', objModel, error, jsonResp => res.status(200).json(jsonResp)) }
});

/* Get certificate information */
router.put('/crt/get', (req, res) => {
	// We have already obtained the CA information in the access control middleware.
	api_resp.getJson(req.crt, api_resp.ACR_OK, '', 'CRT', null, jsonResp => res.status(200).json(jsonResp));
});

/**
 * Delete certificate.
 */
router.put('/crt/del', 
restrictedCheck.crt,
async(req, res) => {
	try {
		// Check that the certificate can be deleted and remove it from the database.
		await pkiModel.deleteCRT(req);

		// Delete the files that make the certificate.
		const base_dir = config.get('pki').data_dir + '/' + req.body.fwcloud + '/' + req.crt.ca;
		await utilsModel.deleteFile(base_dir + '/reqs', req.crt.cn + '.req');
		await utilsModel.deleteFile(base_dir + '/issued', req.crt.cn + '.crt');
		await utilsModel.deleteFile(base_dir + '/private', req.crt.cn + '.key');
		const serial = await pkiModel.delFromIndex(base_dir, req.crt.cn);
		await utilsModel.deleteFile(base_dir + '/certs_by_serial', serial + '.pem');

		// Delete the certificate node into the tree.
		await fwcTreeModel.deleteObjFromTree(req.body.fwcloud, req.body.crt, ((req.crt.type===1) ? 301 : 302));

		// Answer to the API request.
		api_resp.getJson(null, api_resp.ACR_OK, 'CERTIFICATE DELETED', objModel, null, jsonResp => res.status(200).json(jsonResp));
	} catch (error) { return api_resp.getJson(null, api_resp.ACR_ERROR, 'Error deleting CRT', objModel, error, jsonResp => res.status(200).json(jsonResp)) }
});

// API call for check deleting restrictions.
router.put('/crt/restricted',
	restrictedCheck.crt,
	(req, res) => api_resp.getJson(null, api_resp.ACR_OK, '', objModel, null, jsonResp => res.status(200).json(jsonResp)));


/**
 * Create a new crt prefix container.
 */
router.post('/crt/prefix', async(req, res) => {
	try {
    // It is only possible to create prefix containers into tree CA nodes.
    if (req.tree_node.node_type !== 'CA')
      throw (new Error('Parent tree node is not a CA node'));

    // The supplied CA id must match the tree node referenced object id.
		if (req.tree_node.id_obj !== req.body.ca)
			throw (new Error('Node object id and CA id doesn\'t match'));
		
    // Verify that we are not creating a prefix of a prefix that already exists for the same CA.
    // Even check that we are not creating a prefix that shadows any existing prefix.
		if (!(await pkiModel.validateCrtPrefix(req))) 
			throw (new Error('Invalid prefix name'));

   	// Create the tree node and move all affected nodes into the prefix container.
		await pkiModel.createCrtPrefix(req);
		api_resp.getJson(null, api_resp.ACR_INSERTED_OK, 'INSERTED OK', objModel, null, jsonResp => res.status(200).json(jsonResp));
  } catch(error) { api_resp.getJson(null, api_resp.ACR_ERROR, 'Error creating prefix container', objModel, error, jsonResp => res.status(200).json(jsonResp)) }
});


module.exports = router;
