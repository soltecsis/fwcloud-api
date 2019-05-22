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
var policyScript = require('../../models/policy/policy_script');
var firewallModel = require('../../models/firewall/firewall');


/*----------------------------------------------------------------------------------------------------------------------*/
router.post('/', async (req, res) => {
  try {
    const data = await firewallModel.getFirewallSSH(req);

    await policyScript.install(req,data.SSHconn,((data.id_fwmaster) ? data.id_fwmaster : data.id))
    await firewallModel.updateFirewallStatus(req.body.fwcloud,req.body.firewall,"&~2");
    await firewallModel.updateFirewallInstallDate(req.body.fwcloud,req.body.firewall);
    
		res.status(204).end();
	} catch(error) { res.status(400).json(error) }
});
/*----------------------------------------------------------------------------------------------------------------------*/

module.exports = router;