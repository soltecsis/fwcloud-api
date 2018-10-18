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
var objModel = 'OpenVPN';

/**
 * Property Model to manage OpenVPN Data
 *
 * @property ClusterModel
 * @type ../../models/vpn/openvpn
 */
var openvpnModel = require('../../models/vpn/openvpn');

var logger = require('log4js').getLogger("app");



/**
 * Create a new CA (Certification Authority).
 */
router.post('/ca',async (req, res) => {
	try {
		await openvpnModel.runEasyRsaCmd(req.headers.x_fwc_fwcloud,{cmd:'init-pki'});
		await openvpnModel.runEasyRsaCmd(req.headers.x_fwc_fwcloud,{cmd:'build-ca', days:req.body.days, cn:req.body.cn, nopass:true});
		await openvpnModel.runEasyRsaCmd(req.headers.x_fwc_fwcloud,{cmd:'gen-crl'});
	} catch(error) { api_resp.getJson(null, api_resp.ACR_ERROR, 'Error creating CA', objModel, error, jsonResp => res.status(200).json(jsonResp)) }

  api_resp.getJson(null,api_resp.ACR_OK, 'CERTIFICATION AUTHORITY CREATED', objModel, null, jsonResp => res.status(200).json(jsonResp));
});

/**
 * Create a new certificate.
 */
router.post('/cert',async (req, res) => {
	try {
		var cmd = '';
		if (req.body.type==='server')
			cmd = 'build-server-full';
		else
			cmd = 'build-client-full';
		await openvpnModel.runEasyRsaCmd(req.headers.x_fwc_fwcloud,{cmd:cmd, days:req.body.days, cn:req.body.cn, nopass:true});
	} catch(error) { api_resp.getJson(null, api_resp.ACR_ERROR, 'Error creating CA', objModel, error, jsonResp => res.status(200).json(jsonResp)) }

  api_resp.getJson(null,api_resp.ACR_OK, 'CERTIFICATE CREATED', objModel, null, jsonResp => res.status(200).json(jsonResp));
});

module.exports = router;