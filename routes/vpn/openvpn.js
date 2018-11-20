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


/**
 * Create a new OpenVPN configuration in firewall.
 */
router.post('/cfg', async (req, res) => {
	try {
		const cfg = await openvpnModel.addCfg(req);

		// Now create all the options for the OpenVPN configuration.
		var order = 1;
		for (let opt of req.body.options) {
			opt.cfg = cfg;
			opt.order = order++;
			await openvpnModel.addCfgOpt(req,opt);
		}
	} catch(error) { return api_resp.getJson(null, api_resp.ACR_ERROR, 'Error creating OpenVPN configuration', objModel, error, jsonResp => res.status(200).json(jsonResp)) }

  api_resp.getJson(null,api_resp.ACR_OK, 'OpenVPN configuration created', objModel, null, jsonResp => res.status(200).json(jsonResp));
});


/**
 * Update configuration options.
 */
router.put('/cfg', async (req, res) => {
	try {
		// First remove all the current configuration options.
		await openvpnModel.removeCfgOptAll(req);

		// Now create all the new options for the OpenVPN configuration.
		const cfg = await openvpnModel.getCfgId(req);
		var order = 1;
		for (let opt of req.body.options) {
			opt.cfg = cfg;
			opt.order = order++;
			await openvpnModel.addCfgOpt(req,opt);
		}
	} catch(error) { return api_resp.getJson(null, api_resp.ACR_ERROR, 'Error updating OpenVPN configuration', objModel, error, jsonResp => res.status(200).json(jsonResp)) }

  api_resp.getJson(null,api_resp.ACR_OK, 'OpenVPN configuration updated', objModel, null, jsonResp => res.status(200).json(jsonResp));
});


/**
 * Install OpenVPN configuration in the destination firewall.
 */
router.post('/install', async (req, res) => {
	try {
		const data = await FirewallModel.getFirewallSSH(req);

		// Next we have to activate the OpenVPN configuration in the destination firewall/cluster.
		if (req.crt.type===1) // Client certificate
			openvpnModel.installCfg(req,cfg,0); // 0=ccd file
		else // Server certificate
			openvpnModel.installCfg(req,cfg,1); // 1=Config file

	} catch(error) { return api_resp.getJson(null, api_resp.ACR_ERROR, 'Error creating OpenVPN configuration', objModel, error, jsonResp => res.status(200).json(jsonResp)) }

  api_resp.getJson(null,api_resp.ACR_OK, 'OpenVPN configuration created', objModel, null, jsonResp => res.status(200).json(jsonResp));
});

module.exports = router;