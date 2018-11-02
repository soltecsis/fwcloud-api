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

var streamModel = require('../../models/stream/stream');

var utilsModel = require("../../utils/utils.js");

var FirewallModel = require('../../models/firewall/firewall');


/*----------------------------------------------------------------------------------------------------------------------*/
router.post('/', 
utilsModel.checkFirewallAccess, 
(req, res) => {
  FirewallModel.getFirewall(req.session.user_id, req.body.fwcloud, req.body.idfirewall, async (error, data) => {
    if (error) {
      api_resp.getJson(error,api_resp.ACR_ERROR,'','POLICY_INSTALL', error,jsonResp => res.status(200).json(jsonResp));
      return;
    }

    // Obtain SSH connSettings for the firewall to which we want install the policy.
    var SSHconn = {
		  host: data[0].ip,
		  port: data[0].install_port,
		  username: data[0].install_user,
		  password: data[0].install_pass
    }

    // If we have ssh user and pass in the body of the request, then these data have preference over the data stored in database.
    if (req.body.sshuser && req.body.sshpass) {
      SSHconn.username = req.body.sshuser;
      SSHconn.password = req.body.sshpass;
    }  
    
    var accessData = {sessionID: req.sessionID, iduser: req.session.user_id, fwcloud: req.body.fwcloud};

    // If we have no user or password for the ssh connection, then error.
    if (!SSHconn.username || !SSHconn.password) {
      api_resp.getJson({"Msg": "User or password for the SSH connection not found."},api_resp.ACR_ERROR,'','POLICY_INSTALL', error,jsonResp => res.status(200).json(jsonResp));
      return;
    }

    /* The get method of the RuleCompile model returns a promise. */
    await PolicyScript.install(accessData,SSHconn,((data[0].id_fwmaster) ? data[0].id_fwmaster : data[0].id))
      .then(data => {return FirewallModel.updateFirewallStatus(req.body.fwcloud,req.body.idfirewall,"&~2")})
      .then(data => api_resp.getJson(null, api_resp.ACR_OK,'','POLICY_INSTALL', null,jsonResp => res.status(200).json(jsonResp)))
      .catch(error => api_resp.getJson(error,api_resp.ACR_ERROR,'','POLICY_INSTALL', error,jsonResp => res.status(200).json(jsonResp)))
  });
});
/*----------------------------------------------------------------------------------------------------------------------*/

module.exports = router;