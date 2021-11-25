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
import { Firewall, FirewallInstallCommunication } from '../../models/firewall/Firewall';
import { Channel } from '../../sockets/channels/channel';
import { ProgressPayload } from '../../sockets/messages/socket-message';
import { logger } from '../../fonaments/abstract-application';
import { getRepository } from 'typeorm';
var config = require('../../config/config');
import * as path from 'path';
import { HttpException } from '../../fonaments/exceptions/http/http-exception';

/*----------------------------------------------------------------------------------------------------------------------*/
router.post('/', async (req, res, next) => {
  try {
    const firewall = await getRepository(Firewall).findOneOrFail(req.body.firewall);
    let nodeId = firewall.id;
    if (firewall.clusterId && firewall.clusterId > 0) {
      const masterNode = await getRepository(Firewall).createQueryBuilder('firewall')
        .where('firewall.clusterId = :cluster', {cluster: firewall.clusterId})
        .andWhere('firewall.fwmaster = 1')
        .getOneOrFail();

      nodeId = masterNode.id;
    }
    const channel = await Channel.fromRequest(req);
    
    let communication = await firewall.getCommunication({sshuser: req.body.sshuser, sshpassword: req.body.sshpass});

    await communication.installFirewallPolicy(path.join(config.get('policy').data_dir, req.body.fwcloud.toString(), nodeId.toString(), config.get('policy').script_name), channel);
    await Firewall.updateFirewallStatus(req.body.fwcloud,req.body.firewall,"&~2");
    await Firewall.updateFirewallInstallDate(req.body.fwcloud,req.body.firewall);
    
    channel.emit('message', new ProgressPayload('end', false, 'Firewall installed'));
		res.status(204).end();
	} catch(error) {
    logger().error(`Installing policy script${error.message ? ': '+error.message : JSON.stringify(error)}`);

    if (error instanceof HttpException) {
      return next(error);
    }

    if (error.message)
      res.status(400).json({message: error.message});
    else
      res.status(400).json(error);
  }
});
/*----------------------------------------------------------------------------------------------------------------------*/

module.exports = router;