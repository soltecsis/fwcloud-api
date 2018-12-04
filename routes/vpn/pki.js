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
 * @type ../../models/api_response
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
const fwcTreemodel = require('../../models/tree/tree');
const config = require('../../config/config');
const utilsModel = require('../../utils/utils');


/**
 * Create a new CA (Certification Authority).
 */
router.post('/ca',async (req, res) => {
	try {
		// Check that the tree node in which we will create a new node for the CA is a valid node for it.
		if (req.tree_node.node_type!=='FCA' && req.tree_node.node_type!=='FD') throw(new Error('Bad node tree type'));

		// Add the new CA to the database.
		req.caId = await pkiModel.createCA(req);
		// Create the new CA directory structure.
		await pkiModel.runEasyRsaCmd(req,'init-pki');
		await pkiModel.runEasyRsaCmd(req,'build-ca');
		await pkiModel.runEasyRsaCmd(req,'gen-crl');

		// Create new CA tree node.
		const nodeId = await fwcTreemodel.newNode(req.dbCon,req.body.fwcloud,req.body.cn,req.body.node_id,'CA',req.caId,300);

		api_resp.getJson({insertId: req.caId, TreeinsertId: nodeId}, api_resp.ACR_OK, 'CERTIFICATION AUTHORITY CREATED', objModel, null, jsonResp => res.status(200).json(jsonResp));
	} catch(error) { return api_resp.getJson(null, api_resp.ACR_ERROR, 'Error creating CA', objModel, error, jsonResp => res.status(200).json(jsonResp)) }
});


/* Get CA information */
router.put('/ca/get', (req, res) => {
	// We have already obtained the CA information in the access control middleware.
	api_resp.getJson(req.ca, api_resp.ACR_OK, '', 'CA', null, jsonResp => res.status(200).json(jsonResp));
});


/**
 * Delete ca.
 */
router.put('/ca/del',async (req, res) => {
	try {
		// Check that the ca can be deleted and delete it from the database.
		await pkiModel.deleteCA(req);

		// Delete the ca directory structure.
		await utilsModel.deleteFolder(config.get('pki').data_dir+'/'+req.body.fwcloud+'/'+req.body.ca);

		// Delete the ca node into the tree.
		await fwcTreemodel.deleteObjFromTree(req.body.fwcloud, req.body.ca);

		// Answer to the API request.
		api_resp.getJson(null,api_resp.ACR_OK, 'CERTIFICATE DELETED', objModel, null, jsonResp => res.status(200).json(jsonResp));
	} catch(error) { return api_resp.getJson(null, api_resp.ACR_ERROR, 'Error deleting CA', objModel, error, jsonResp => res.status(200).json(jsonResp)) }
});





/**
 * Create a new certificate.
 */
router.post('/crt',async (req, res) => {
	try {
		// Check that the tree node in which we will create a new node for the CA is a valid node for it.
		if (req.tree_node.node_type!=='CA' && req.tree_node.node_type!=='FD') throw(new Error('Bad node tree type'));

		// Add the new certificate to the database.
		const crtId = await pkiModel.createCRT(req);
		// Create the new certificate in the CA directory.
		var cmd = '';
		if (req.body.type===1) // Client certificate
			cmd = 'build-client-full';
		else // Server certificate
			cmd = 'build-server-full';
		req.caId = req.body.ca;
		await pkiModel.runEasyRsaCmd(req,cmd);

		// Create new CRT tree node.
		const nodeId = await fwcTreemodel.newNode(req.dbCon,req.body.fwcloud,req.body.cn,req.body.node_id,'CRT',crtId,301);

		api_resp.getJson({insertId: crtId, TreeinsertId: nodeId}, api_resp.ACR_OK, 'CERTIFICATE CREATED', objModel, null, jsonResp => res.status(200).json(jsonResp));
	} catch(error) { return api_resp.getJson(null, api_resp.ACR_ERROR, 'Error creating CRT', objModel, error, jsonResp => res.status(200).json(jsonResp)) }
});

/* Get certificate information */
router.put('/crt/get', (req, res) => {
	// We have already obtained the CA information in the access control middleware.
	api_resp.getJson(req.crt, api_resp.ACR_OK, '', 'CRT', null, jsonResp => res.status(200).json(jsonResp));
});

/**
 * Delete certificate.
 */
router.put('/crt/del',async (req, res) => {
	try {
		// Check that the certificate can be deleted and remove it from the database.
		await pkiModel.deleteCRT(req);	

		// Delete the files that make the certificate.
		const base_dir = config.get('pki').data_dir+'/'+req.body.fwcloud+'/'+req.crt.ca;
		await utilsModel.deleteFile(base_dir+'/reqs',req.crt.cn+'.req');
		await utilsModel.deleteFile(base_dir+'/issued',req.crt.cn+'.crt');
		await utilsModel.deleteFile(base_dir+'/private',req.crt.cn+'.key');

		// Delete the certificate node into the tree.
		await fwcTreemodel.deleteObjFromTree(req.body.fwcloud, req.body.crt);

		// Answer to the API request.
		api_resp.getJson(null,api_resp.ACR_OK, 'CERTIFICATE DELETED', objModel, null, jsonResp => res.status(200).json(jsonResp));
	} catch(error) { return api_resp.getJson(null, api_resp.ACR_ERROR, 'Error deleting CRT', objModel, error, jsonResp => res.status(200).json(jsonResp)) }
});

module.exports = router;