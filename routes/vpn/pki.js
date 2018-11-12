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
var objModel = 'CRT';

/**
 * Property Model to manage OpenVPN Data
 *
 * @property ClusterModel
 * @type ../../models/vpn/openvpn
 */
var crtModel = require('../../models/vpn/pki');



/**
 * Create a new CA (Certification Authority).
 */
router.post('/ca',async (req, res) => {
	try {
		// Add the new CA to the database.
		req.caId = await crtModel.createNewCA(req);
		// Create the new CA directory structure.
		await crtModel.runEasyRsaCmd(req,'init-pki');
		await crtModel.runEasyRsaCmd(req,'build-ca');
		await crtModel.runEasyRsaCmd(req,'gen-crl');
	} catch(error) { return api_resp.getJson(null, api_resp.ACR_ERROR, 'Error creating CA', objModel, error, jsonResp => res.status(200).json(jsonResp)) }

  api_resp.getJson(null,api_resp.ACR_OK, 'CERTIFICATION AUTHORITY CREATED', objModel, null, jsonResp => res.status(200).json(jsonResp));
});

/**
 * Create a new certificate.
 */
router.post('/crt',async (req, res) => {
	try {
		// Add the new certificate to the database.
		await crtModel.createNewCert(req);
		// Create the new certificate in the CA directory.
		var cmd = '';
		if (req.body.type===1) // Client
			cmd = 'build-client-full';
		else // Server
			cmd = 'build-server-full';
		req.caId = req.body.ca;
		await crtModel.runEasyRsaCmd(req,cmd);
	} catch(error) { return api_resp.getJson(null, api_resp.ACR_ERROR, 'Error creating CA', objModel, error, jsonResp => res.status(200).json(jsonResp)) }

  api_resp.getJson(null,api_resp.ACR_OK, 'CERTIFICATE CREATED', objModel, null, jsonResp => res.status(200).json(jsonResp));
});

module.exports = router;