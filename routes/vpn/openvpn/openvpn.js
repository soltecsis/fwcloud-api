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
var api_resp = require('../../../utils/api_response');

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
const openvpnModel = require('../../../models/vpn/openvpn/openvpn');
const policyOpenvpnModel = require('../../../models/policy/openvpn');
const policy_cModel = require('../../../models/policy/policy_c');

const fwcTreeModel = require('../../../models/tree/tree');
const restrictedCheck = require('../../../middleware/restricted');
const pkiCRTModel = require('../../../models/vpn/pki/crt');
const openvpnPrefixModel = require('../../../models/vpn/openvpn/prefix');
const ipobjModel = require('../../../models/ipobj/ipobj');
const firewallModel = require('../../../models/firewall/firewall');


/**
 * Create a new OpenVPN configuration in firewall.
 */
router.post('/', async(req, res) => {
	try {
		// Verify that the node tree type is correct.
		if (req.tree_node.node_type !== 'OPN' && req.tree_node.node_type !== 'OSR')
			throw (new Error('Bad node tree type'));

		// Verify that the OpenVPN configuration is the same indicated in the tree node.
		if (req.body.openvpn && req.body.openvpn != req.tree_node.id_obj)
			throw (new Error('Information in node tree and in API request don\'t match'));

		// Verify that we are using the correct type of certificate.
		// 1=Client certificate, 2=Server certificate.
		if (req.crt.type===1 && !req.body.openvpn)
			throw (new Error('When using client certificates you must indicate the OpenVPN server configuration'));
		if (req.crt.type===2 && req.body.openvpn)
			throw (new Error('When using server certificates you must not indicate the OpenVPN server configuration'));

		// The client certificate for a new OpenVPN client configuration must belong to the same CA
		// that the OpenVPN server configuration to which we are vinculationg this new client VPN.
		if (req.crt.type===1 && req.crt.ca!==req.openvpn.ca) 
			throw (new Error('CRT for a new client OpenVPN configuration must has the same CA that the server OpenVPN configuration to which it belongs'));

		// The firewall id for the new OpenVPN client configuration must be the same firewall id of
		// the server OpenVPN configuration.
		if (req.crt.type===1 && req.body.firewall!==req.openvpn.firewall) 
			throw (new Error('Firewall ID for the new client OpenVPN configuration must match server OpenVPN configuration'));

		const cfg = await openvpnModel.addCfg(req);

		// Now create all the options for the OpenVPN configuration.
		var order = 1;
		for (let opt of req.body.options) {
			opt.openvpn = cfg;
			opt.order = order++;
			await openvpnModel.addCfgOpt(req, opt);
		}

		// Create the OpenVPN configuration node in the tree.
		let nodeId;
		if (req.tree_node.node_type === 'OPN') // This will be an OpenVPN server configuration.
			nodeId = await fwcTreeModel.newNode(req.dbCon, req.body.fwcloud, req.crt.cn, req.body.node_id, 'OSR', cfg, 312);
		else if (req.tree_node.node_type === 'OSR') { // This will be an OpenVPN client configuration.
			//nodeId = await fwc_treeModel.newNode(req.dbCon, req.body.fwcloud, req.crt.cn, req.body.node_id, 'OCL', cfg, 311);
			await openvpnPrefixModel.applyOpenVPNPrefixes(req.dbCon,req.body.fwcloud,req.body.openvpn);
		}

		api_resp.getJson({ insertId: cfg, TreeinsertId: nodeId }, api_resp.ACR_OK, 'OpenVPN configuration created', objModel, null, jsonResp => res.status(200).json(jsonResp));
	} catch (error) { return api_resp.getJson(null, api_resp.ACR_ERROR, 'Error creating OpenVPN configuration', objModel, error, jsonResp => res.status(200).json(jsonResp)) }
});


/**
 * Update configuration options.
 */
router.put('/', async(req, res) => {
	try {
		await openvpnModel.updateCfg(req);

		// First remove all the current configuration options.
		await openvpnModel.delCfgOptAll(req);

		// Now create all the new options for the OpenVPN configuration.
		var order = 1;
		for (let opt of req.body.options) {
			opt.openvpn = req.body.openvpn;
			opt.order = order++;
			await openvpnModel.addCfgOpt(req, opt);
		}

		// Update the status flag for the OpenVPN configuration.
		await openvpnModel.updateOpenvpnStatus(req.dbCon,req.body.openvpn,"|1");

		// Update the compile flag of the rules using this OpenVPN configuration.
		const rules = await policyOpenvpnModel.searchOpenvpnInRule(req.dbCon,req.body.fwcloud,req.body.openvpn);
		for (let rule of rules) {
			await policy_cModel.deletePolicy_c(rule.firewall, rule.id);
			await firewallModel.updateFirewallStatus(req.body.fwcloud,rule.firewall,"|3")
		}
		
		// The same for the rules that have groups that have this OpenVPN configuration.
		// PENDING!!!!!!!!
		

		api_resp.getJson(null, api_resp.ACR_OK, 'OpenVPN configuration updated', objModel, null, jsonResp => res.status(200).json(jsonResp));
	} catch (error) { return api_resp.getJson(null, api_resp.ACR_ERROR, 'Error updating OpenVPN configuration', objModel, error, jsonResp => res.status(200).json(jsonResp)) }
});


/**
 * Get OpenVPN configuration data.
 */
router.put('/get', async(req, res) => {
	try {
		const data = await openvpnModel.getCfg(req);
		api_resp.getJson(data, api_resp.ACR_OK, 'OpenVPN configuration sent', objModel, null, jsonResp => res.status(200).json(jsonResp));
	} catch (error) { return api_resp.getJson(null, api_resp.ACR_ERROR, 'Error getting OpenVPN configuration', objModel, error, jsonResp => res.status(200).json(jsonResp)) }
});


/**
 * Get OpenVPN configuration files.
 */
router.put('/file/get', async(req, res) => {
	try {
		const cfgDump = await openvpnModel.dumpCfg(req.dbCon,req.body.fwcloud,req.body.openvpn);
		api_resp.getJson(cfgDump, api_resp.ACR_OK, 'OpenVPN configuration file sent', objModel, null, jsonResp => res.status(200).json(jsonResp));
	} catch (error) { return api_resp.getJson(null, api_resp.ACR_ERROR, 'Error getting OpenVPN file configuration', objModel, error, jsonResp => res.status(200).json(jsonResp)) }
});


/**
 * Get OpenVPN ipobj data.
 */
router.put('/ipobj/get', async(req, res) => {
	try {
		const cfgData = await openvpnModel.getCfg(req);
		let data = [];
		for (let openvpn_opt of cfgData.options) {
			if (openvpn_opt.ipobj)
				data.push(await ipobjModel.getIpobjInfo(req.dbCon,req.body.fwcloud,openvpn_opt.ipobj));
		}
		api_resp.getJson(data, api_resp.ACR_OK, 'OpenVPN ipobj array sent', objModel, null, jsonResp => res.status(200).json(jsonResp));
	} catch (error) { return api_resp.getJson(null, api_resp.ACR_ERROR, 'Error getting OpenVPN ipobj array', objModel, error, jsonResp => res.status(200).json(jsonResp)) }
});


/**
 * Get next VPN LAN free IP.
 */
router.put('/ip/get', async(req, res) => {
	try {
		const freeIP = await openvpnModel.freeVpnIP(req);
		api_resp.getJson(freeIP, api_resp.ACR_OK, 'OpenVPN free IP sent', objModel, null, jsonResp => res.status(200).json(jsonResp));
	} catch (error) { return api_resp.getJson(null, api_resp.ACR_ERROR, 'Error getting free OpenVPN IP', objModel, error, jsonResp => res.status(200).json(jsonResp)) }
});


/**
 * Get OpenVPN configuration metadata.
 */
router.put('/info/get', async(req, res) => {
	try {
		const data = await openvpnModel.getOpenvpnInfo(req.dbCon,req.body.fwcloud,req.body.openvpn,req.openvpn.type);
		api_resp.getJson(data[0], api_resp.ACR_OK, 'OpenVPN info sent', objModel, null, jsonResp => res.status(200).json(jsonResp));
	} catch (error) { return api_resp.getJson(null, api_resp.ACR_ERROR, 'Error getting OpenVPN info', objModel, error, jsonResp => res.status(200).json(jsonResp)) }
});



/**
 * Delete OpenVPN configuration.
 */
router.put('/del',
restrictedCheck.openvpn,
async(req, res) => {
	try {
		// Delete the configuration from de database.
		await openvpnModel.delCfg(req.dbCon, req.body.fwcloud, req.body.openvpn);

		// Delete the openvpn node from the tree.
		await fwcTreeModel.deleteObjFromTree(req.body.fwcloud, req.body.openvpn, (req.openvpn.type === 1 ? 311 : 312));
		if (req.openvpn.type === 1) { // Client OpenVPN configuration.
			// Regenerate the tree under the OpenVPN server to which the client OpenVPN configuration belongs.
			// This is necesary for avoid empty prefixes if we remove all the OpenVPN client configurations for a prefix.
			await openvpnPrefixModel.applyOpenVPNPrefixes(req.dbCon,req.body.fwcloud,req.body.openvpn);
		}
	
		api_resp.getJson(null, api_resp.ACR_OK, 'OpenVPN configuration deleted', objModel, null, jsonResp => res.status(200).json(jsonResp));
	} catch (error) { return api_resp.getJson(null, api_resp.ACR_ERROR, 'Error deleting OpenVPN configuration', objModel, error, jsonResp => res.status(200).json(jsonResp)) }
});

// API call for check deleting restrictions.
router.put('/restricted',
	restrictedCheck.openvpn,
	(req, res) => api_resp.getJson(null, api_resp.ACR_OK, '', objModel, null, jsonResp => res.status(200).json(jsonResp)));


/**
 * Install OpenVPN configuration in the destination firewall.
 */
router.put('/install', async(req, res) => {
	try {
		const cfgDump = await openvpnModel.dumpCfg(req.dbCon,req.body.fwcloud,req.body.openvpn);
		const crt = await pkiCRTModel.getCRTdata(req.dbCon,req.openvpn.crt);

		// Next we have to activate the OpenVPN configuration in the destination firewall/cluster.
		if (crt.type === 1) { // Client certificate
			// Obtain de configuration directory in the client-config-dir configuration option.
			// req.openvpn.openvpn === ID of the server's OpenVPN configuration to which this OpenVPN client config belongs.
			const openvpn_opt = await openvpnModel.getOptData(req.dbCon,req.openvpn.openvpn,'client-config-dir');
			await openvpnModel.installCfg(req,cfgDump.ccd,openvpn_opt.arg,crt.cn,1);
		}
		else { // Server certificate
			if (!req.openvpn.install_dir || !req.openvpn.install_name)
				throw(new Error('Empty install dir or install name'));
			await openvpnModel.installCfg(req,cfgDump.cfg,req.openvpn.install_dir,req.openvpn.install_name,2);
		}

		// Update the status flag for the OpenVPN configuration.
		await openvpnModel.updateOpenvpnStatus(req.dbCon,req.body.openvpn,"&~1");

		api_resp.getJson(null, api_resp.ACR_OK, 'OpenVPN configuration installed', objModel, null, jsonResp => res.status(200).json(jsonResp));
	} catch (error) { return api_resp.getJson(null, api_resp.ACR_ERROR, 'Error installing OpenVPN configuration', objModel, error, jsonResp => res.status(200).json(jsonResp)) }
});


/**
 * Uninstall OpenVPN configuration from the destination firewall.
 */
router.put('/uninstall', 
restrictedCheck.openvpn,
async(req, res) => {
	try {
		const crt = await pkiCRTModel.getCRTdata(req.dbCon,req.openvpn.crt);

		if (crt.type === 1) { // Client certificate
			// Obtain de configuration directory in the client-config-dir configuration option.
			// req.openvpn.openvpn === ID of the server's OpenVPN configuration to which this OpenVPN client config belongs.
			const openvpn_opt = await openvpnModel.getOptData(req.dbCon,req.openvpn.openvpn,'client-config-dir');
			await openvpnModel.uninstallCfg(req,openvpn_opt.arg,crt.cn);
		}
		else { // Server certificate
			if (!req.openvpn.install_dir || !req.openvpn.install_name)
				throw(new Error('Empty install dir or install name'));
			await openvpnModel.uninstallCfg(req,req.openvpn.install_dir,req.openvpn.install_name);
		}

		api_resp.getJson(null, api_resp.ACR_OK, 'OpenVPN configuration uninstalled', objModel, null, jsonResp => res.status(200).json(jsonResp));
	} catch (error) { return api_resp.getJson(null, api_resp.ACR_ERROR, 'Error uninstalling OpenVPN configuration', objModel, error, jsonResp => res.status(200).json(jsonResp)) }
});

/**
 * Sync all CCD file configurations.
 * Remove first all the server CCD files and then install all the CCD files.
 * ROUTE CALL:  /vpn/openvpn/ccdsync
 */
router.put('/ccdsync', async(req, res) => {
	try {
		const crt = await pkiCRTModel.getCRTdata(req.dbCon,req.openvpn.crt);
		if (crt.type !== 2) // This action only can be done in server OpenVPN configurations.
			throw (new Error('This is not an OpenVPN server configuration'));

		// Obtain de configuration directory in the client-config-dir configuration option of the opevpn
		// server configuration.
		const openvpn_opt = await openvpnModel.getOptData(req.dbCon,req.body.openvpn,'client-config-dir');
		const client_config_dir = openvpn_opt.arg;

		// Get all client configurations for this OpenVPN server configuration.
		const clients = await openvpnModel.getOpenvpnClients(req.dbCon,req.body.openvpn);

		for (let client of clients) {
			let cfgDump = await openvpnModel.dumpCfg(req.dbCon,req.body.fwcloud,client.id);
			await openvpnModel.installCfg(req,cfgDump.ccd,client_config_dir,client.cn,1);

			// Update the status flag for the OpenVPN configuration.
			await openvpnModel.updateOpenvpnStatus(req.dbCon,client.id,"&~1");
		}

		// Get the list of files into the client-config-dir directory.
		// If we have files in the client-config-dir with no corresponding OpenVPN configuration inform the user.
		await openvpnModel.ccdCompare(req,client_config_dir,clients)

		api_resp.getJson(null, api_resp.ACR_OK, 'CCD configuration files installed', objModel, null, jsonResp => res.status(200).json(jsonResp));
	} catch (error) { return api_resp.getJson(null, api_resp.ACR_ERROR, 'Error installing CCD configuration files', objModel, error, jsonResp => res.status(200).json(jsonResp)) }
});

module.exports = router;