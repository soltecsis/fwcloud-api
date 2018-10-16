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

var utilsModel = require("../../utils/utils.js");

var config = require('../../config/config');
const spawn = require('child-process-promise').spawn;



/**
 * My method description.  Like other pieces of your comment blocks, 
 * this can span multiple lines.
 * ROUTE CALL:  /
 *
 */
router.post('/ca',(req, res) => {
	var cmd = config.get('pki').easy_rsa_cmd;
	var pki_dir = '--pki-dir="' + config.get('pki').data_dir + '/' + req.headers.x_fwc_fwcloud +'"';

	//var promise = spawn('echo', ['hello']);
	var promise = spawn(cmd, ['--batch',pki_dir,'init-pki']);
	var childProcess = promise.childProcess;

	console.log('[spawn] childProcess.pid: ', childProcess.pid);
	childProcess.stdout.on('data', function (data) {
		console.log('[spawn] stdout: ', data.toString());
	});
	childProcess.stderr.on('data', function (data) {
		console.log('[spawn] stderr: ', data.toString());
	});

	promise.then(function () {
		console.log('[spawn] done!');
	})
	.catch(function (err) {
		console.error('[spawn] ERROR: ', err);
	});

  api_resp.getJson(null,api_resp.ACR_OK, 'CERTIFICATE AUTORITY CREATED', objModel, null, jsonResp => res.status(200).json(jsonResp));
});

module.exports = router;