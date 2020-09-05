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


var express = require('express');
var router = express.Router();

import { Repair } from '../../models/tree/Repair';
import { OpenVPN } from '../../models/vpn/openvpn/OpenVPN';
import { OpenVPNPrefix } from '../../models/vpn/openvpn/OpenVPNPrefix';
import { Tree } from '../../models/tree/Tree';
import { ProgressErrorPayload, ProgressInfoPayload, ProgressNoticePayload, ProgressPayload } from '../../sockets/messages/socket-message';
import { Channel } from '../../sockets/channels/channel';
import { logger } from '../../fonaments/abstract-application';
const fwcError = require('../../utils/error_table');


/* Rpair tree */
router.put('/', async (req, res) =>{
  const channel = await Channel.fromRequest(req);
  channel.emit('message', new ProgressPayload('start', 'Repairing tree'));

  try {
    if (req.body.type==='FDF') {
      channel.emit('message', new ProgressInfoPayload(`REPAIRING FIREWALLS/CLUSTERS TREE FOR CLOUD WITH ID: ${req.body.fwcloud}\n`, true));
    } else if (req.body.type==='FDO') {
      channel.emit('message', new ProgressInfoPayload(`REPAIRING OBJECTS TREE FOR CLOUD WITH ID: ${req.body.fwcloud}\n`, true));
    } else if (req.body.type==='FDS') {
      channel.emit('message', new ProgressInfoPayload(`REPAIRING SERVICES TREE FOR CLOUD WITH ID: ${req.body.fwcloud}\n`, true));
    } else {
      throw fwcError.BAD_TREE_NODE_TYPE;
    }

    await Repair.initData(req);

    const rootNodes = await Repair.checkRootNodes(req.dbCon, channel);

    // Verify that all tree not root nodes are part of a tree.
    channel.emit('message', new ProgressInfoPayload(`Checking tree structure.\n`));
    await Repair.checkNotRootNodes(rootNodes, channel);

    for (let rootNode of rootNodes) {
      if (rootNode.node_type==='FDF' && req.body.type==='FDF') { 
        // Firewalls and clusters tree.
        channel.emit('message', new ProgressInfoPayload(`Checking folders.\n`));
        
        await Repair.checkFirewallsFoldersContent(rootNode, channel);
        channel.emit('message', new ProgressInfoPayload(`Checking firewalls and clusters tree.\n`));
        
        await Repair.checkFirewallsInTree(rootNode, channel);
        await Repair.checkClustersInTree(rootNode, channel);
        
        channel.emit('message', new ProgressInfoPayload(`Applying OpenVPN server prefixes.\n`));
        
        const openvpn_srv_list = await OpenVPN.getOpenvpnServersByCloud(req.dbCon,req.body.fwcloud);
        for (let openvpn_srv of openvpn_srv_list) {
          channel.emit('message', new ProgressNoticePayload(`OpenVPN server: ${openvpn_srv.cn}\n`));
          await OpenVPNPrefix.applyOpenVPNPrefixes(req.dbCon,req.body.fwcloud,openvpn_srv.id);
        }
        break;
      }
      else if (rootNode.node_type==='FDO' && req.body.type==='FDO') { 
        // Objects tree.
        
        channel.emit('message', new ProgressNoticePayload(`Checking objects tree.\n`));
        
        // Remove the full tree an create it again from scratch.
        await Tree.deleteFwc_TreeFullNode({id: rootNode.id, fwcloud: req.body.fwcloud});
        const ids = await Tree.createObjectsTree(req.dbCon,req.body.fwcloud);

        channel.emit('message', new ProgressNoticePayload(`Checking addresses objects.\n`));
        await Repair.checkNonStdIPObj(ids.Addresses,'OIA',5);

        channel.emit('message', new ProgressNoticePayload(`Checking address ranges objects.\n`));
        await Repair.checkNonStdIPObj(ids.AddressesRanges,'OIR',6);

        channel.emit('message', new ProgressNoticePayload(`Checking network objects.\n`));
        await Repair.checkNonStdIPObj(ids.Networks,'OIN',7);

        channel.emit('message', new ProgressNoticePayload(`Checking DNS objects.\n`));
        await Repair.checkNonStdIPObj(ids.DNS,'ONS',9);

        channel.emit('message', new ProgressNoticePayload(`Checking host objects.\n`));
        rootNode.id = ids.OBJECTS;
        await Repair.checkHostObjects(rootNode);

        channel.emit('message', new ProgressNoticePayload(`Checking mark objects.\n`));
        await Repair.checkNonStdIPObj(ids.Marks,'MRK',30);

        channel.emit('message', new ProgressNoticePayload(`Checking objects groups.\n`));
        await Repair.checkNonStdIPObjGroup(ids.Groups,'OIG',20);
        break;
      }
      else if (rootNode.node_type==='FDS' && req.body.type==='FDS') { 
        // Services tree.
        channel.emit('message', new ProgressNoticePayload(`Checking services tree.\n`));
        
        // Remove the full tree an create it again from scratch.
        await Tree.deleteFwc_TreeFullNode({id: rootNode.id, fwcloud: req.body.fwcloud});
        const ids = await Tree.createServicesTree(req.dbCon,req.body.fwcloud);

        channel.emit('message', new ProgressNoticePayload(`Checking IP services.\n`));
        await Repair.checkNonStdIPObj(ids.IP,'SOI',1);

        channel.emit('message', new ProgressNoticePayload(`Checking ICMP services.\n`));
        await Repair.checkNonStdIPObj(ids.ICMP,'SOM',3);

        channel.emit('message', new ProgressNoticePayload(`Checking TCP services.\n`));
        await Repair.checkNonStdIPObj(ids.TCP,'SOT',2);

        channel.emit('message', new ProgressNoticePayload(`Checking UDP services.\n`));
        await Repair.checkNonStdIPObj(ids.UDP,'SOU',4);

        channel.emit('message', new ProgressNoticePayload(`Checking services groups.\n`));
        
        await Repair.checkNonStdIPObjGroup(ids.Groups,'SOG',21);
        break;
      }
    }

    // Remove orphan nodes.
    await Repair.deleteOrphanNodes(channel);

    channel.emit('message', new ProgressPayload('end', false, 'Repairing tree'));

    res.status(200).send({"channel_id": channel.id});
  } catch(error) { 
    channel.emit('message', new ProgressErrorPayload(`\nERROR: ${error}\n`, true));
    logger().error('Error repairing tree: ' + JSON.stringify(error));
    res.status(400).json(error);
  }
});

module.exports = router;
