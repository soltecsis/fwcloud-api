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
 * Property Model to manage policy script generation and install process
 *
 * @property PolicyScript
 * @type ../../models/compile/
 */
var PolicyScript = require('../../models/policy/policy_script');
var FirewallModel = require('../../models/firewall/firewall');
const fwcError = require('../../utils/error_table');


/*----------------------------------------------------------------------------------------------------------------------*/
router.post('/', async (req, res) => {
  try {
    const data = await FirewallModel.getFirewallSSH(req);

    await PolicyScript.install(req,data.SSHconn,((data[0].id_fwmaster) ? data[0].id_fwmaster : data[0].id))
    await FirewallModel.updateFirewallStatus(req.body.fwcloud,req.body.firewall,"&~2");
    
    api_resp.getJson(null, api_resp.ACR_OK,'','POLICY_INSTALL', null,jsonResp => res.status(200).json(jsonResp));
  } catch(error) { api_resp.getJson(error,api_resp.ACR_ERROR,'','POLICY_INSTALL', error,jsonResp => res.status(200).json(jsonResp)) }
});
/*----------------------------------------------------------------------------------------------------------------------*/

module.exports = router;