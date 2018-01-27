/**
 * Module to routing COMPILE requests
 * <br>BASE ROUTE CALL: <b>/policy/compile</b>
 *
 * @module Compile
 *
 * @requires express
 * @requires Policy_rModel
 *
 */


/**
 * Class to manage Compile Policy
 *
 * @class CompileRouter
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
 * Property Model to manage compilation process
 *
 * @property RuleCompileModel
 * @type ../../models/compile/
 */
var RuleCompile = require('../../models/policy/rule_compile');

/**
 * Property Model to manage policy script generation and install process
 *
 * @property PolicyScript
 * @type ../../models/compile/
 */
var PolicyScript = require('../../models/policy/policy_script');

const POLICY_TYPE = ['', 'INPUT', 'OUTPUT', 'FORWARD', 'SNAT', 'DNAT'];

/*----------------------------------------------------------------------------------------------------------------------*/
/* Compile a firewall rule. */
/*----------------------------------------------------------------------------------------------------------------------*/
router.get('/:user/:cloud/:fw/:type/:rule', (req, res) => {
  var user = req.params.user;
	var cloud = req.params.cloud;
	var fw = req.params.fw;
	var type = req.params.type;
	var rule = req.params.rule;

  /* The get method of the RuleCompile model returns a promise. */
  RuleCompile.get(cloud, fw, type, rule)
    .then((data) => {
      api_resp.getJson(data, api_resp.ACR_OK, '', 'COMPILE', null, (jsonResp) => { res.status(200).json(jsonResp)})
    })
    .catch((error,data) => {
      api_resp.getJson(data, api_resp.ACR_ERROR, '', 'COMPILE', error, (jsonResp) => { res.status(200).json(jsonResp)})
    });
});
/*----------------------------------------------------------------------------------------------------------------------*/

/*----------------------------------------------------------------------------------------------------------------------*/
/* Compile a firewall. */
/*----------------------------------------------------------------------------------------------------------------------*/
router.get('/:user/:cloud/:fw', async (req, res) => {
  var user = req.params.user;
  var cloud = req.params.cloud;
  var fw = req.params.fw;
  var code="";

  /* Generate the policy script. */
  for(var type=1; type<6; type++) {
    code += "\r\n\r\n# " + POLICY_TYPE[type] + " TABLE \r\n#-------------\r\n";
    await PolicyScript.dump(cloud,fw,type)
      .then(data => code+=data)
      .catch(error => api_resp.getJson(null,api_resp.ACR_ERROR,'','COMPILE',error,(jsonResp) => { res.status(200).json(jsonResp)}))
  }
  res.status(200).send(code);
});
/*----------------------------------------------------------------------------------------------------------------------*/

module.exports = router;

