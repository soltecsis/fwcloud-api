/**
 * Module to generate and install policy script
 * <br>BASE ROUTE CALL: <b>/policy/compile</b>
 *
 * @module Compile
 *
 * @requires express
 * @requires Policy_rModel
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
 * Property Logger to manage App logs
 *
 * @property logger
 * @type log4js/app
 *
 */
var logger = require('log4js').getLogger("compiler");
/**
 * Property Model to manage API RESPONSE data
 *
 * @property api_resp
 * @type ../../models/api_response
 *
 */
var api_resp = require('../../utils/api_response');

/**
 * Property Model to manage policy script generation and install process
 *
 * @property PolicyScript
 * @type ../../models/compile/
 */
var PolicyScript = require('../../models/policy/policy_script');


/*----------------------------------------------------------------------------------------------------------------------*/
router.get('/:user/:cloud/:fw/:sshuser/:sshpass', async (req, res) => {
  var user = req.params.user;
  var cloud = req.params.cloud;
  var fw = req.params.fw;
  var sshuser = req.params.sshuser;
  var sshpass = req.params.sshpass;

  /* The get method of the RuleCompile model returns a promise. */
  await PolicyScript.install(cloud,fw,sshuser,sshpass)
  .then(data => api_resp.getJson({"result": true, "output": data}, api_resp.ACR_OK,'','POLICY_INSTALL', null,jsonResp => res.status(200).json(jsonResp)))
  .catch(error => api_resp.getJson(error,api_resp.ACR_ERROR,'','POLICY_INSTALL', error,jsonResp => res.status(200).json(jsonResp)))
});
/*----------------------------------------------------------------------------------------------------------------------*/

module.exports = router;