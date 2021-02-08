/*
    Copyright 2019 SOLTECSIS SOLUCIONES TECNOLOGICAS, SLU
    https://soltecsis.com
    info@soltecsis.com


    This file is part of FWCloud (https://fwcloud.net).

    FWCloud is free software: you can redistribute it and/or modify
    it under the terms of the GNU Affero General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    FWCloud is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU General Public License for more details.

    You should have received a copy of the GNU General Public License
    along with FWCloud.  If not, see <https://www.gnu.org/licenses/>.
*/


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
import { PolicyScript } from '../../compiler/PolicyScript';
import { Firewall } from '../../models/firewall/Firewall';
import { Channel } from '../../sockets/channels/channel';
import { ProgressPayload } from '../../sockets/messages/socket-message';
import { logger } from '../../fonaments/abstract-application';


/*----------------------------------------------------------------------------------------------------------------------*/
router.post('/', async (req, res) => {
  try {
    const data = await Firewall.getFirewallSSH(req);

    const channel = await Channel.fromRequest(req);

    await PolicyScript.install(req,data.SSHconn,((data.id_fwmaster) ? data.id_fwmaster : data.id), channel)
    await Firewall.updateFirewallStatus(req.body.fwcloud,req.body.firewall,"&~2");
    await Firewall.updateFirewallInstallDate(req.body.fwcloud,req.body.firewall);
    
    channel.emit('message', new ProgressPayload('end', false, 'Firewall installed'));
		res.status(204).end();
	} catch(error) {
    logger().error(`Installing policy script${error.message ? ': '+error.message : JSON.stringify(error)}`);
    if (error.message)
      res.status(400).json({message: error.message});
    else
      res.status(400).json(error);
  }
});
/*----------------------------------------------------------------------------------------------------------------------*/

module.exports = router;