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
 * Property Model to manage Policy Compiled Data
 *
 * @property Policy_cModel
 * @type /models/policy_c
 */
var Policy_cModel = require('../../models/policy_c');

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
 * @type /models/api_response
 *
 */
var api_resp = require('../../utils/api_response');

/**
 * Property Model to manage compilation process
 *
 * @property RuleCompileModel
 * @type /models/compile/
 */
var RuleCompileModel = require('../../models/policy/rule_compile');


/*----------------------------------------------------------------------------------------------------------------------*/
/* Get  policy_r by id and  by Id */
/*----------------------------------------------------------------------------------------------------------------------*/
router.get('/:user/:cloud/:fw/:type/:rule', (req, res) => {
  var user = req.params.user;
	var cloud = req.params.cloud;
	var fw = req.params.fw;
	var type = req.params.type;
	var rule = req.params.rule;
	
  RuleCompileModel.rule_compile(cloud, fw, type, rule, (cs) => {
    //Save compilation
    var policy_cData = {
      rule: rule,
      firewall: fw,
      rule_compiled: cs,
      status_compiled: 1
    };
        
    Policy_cModel.insertPolicy_c(policy_cData, (error, data) => {
    });

    // End of compilation process.
    cs = "echo \"Rule ID: " + rule + "\"\r\n" + cs;
    res.status(220).send(cs);
  });
});
/*----------------------------------------------------------------------------------------------------------------------*/

module.exports = router;

