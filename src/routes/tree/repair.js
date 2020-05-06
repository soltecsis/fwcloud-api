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
import { app } from '../../fonaments/abstract-application';
import { WebSocketService } from '../../sockets/web-socket.service';
import { ProgressErrorPayload, ProgressInfoPayload } from '../../sockets/messages/socket-message';
const fwcError = require('../../utils/error_table');


/* Rpair tree */
router.put('/', async (req, res) =>{
  const channel = (await app().getService(WebSocketService.name)).createChannel();

  try {
    if (req.body.type==='FDF') {
      channel.addMessage(new ProgressInfoPayload(`<font color="blue">REPAIRING FIREWALLS/CLUSTERS TREE FOR CLOUD WITH ID: ${req.body.fwcloud}</font>\n`));
    } else if (req.body.type==='FDO') {
      channel.addMessage(new ProgressInfoPayload(`<font color="blue">REPAIRING OBJECTS TREE FOR CLOUD WITH ID: ${req.body.fwcloud}</font>\n`));
    } else if (req.body.type==='FDS') {
      channel.addMessage(new ProgressInfoPayload(`<font color="blue">REPAIRING SERVICES TREE FOR CLOUD WITH ID: '+req.body.fwcloud+'</font>\n`));
    } else {
      throw fwcError.BAD_TREE_NODE_TYPE;
    }

    await Repair.initData(req);

    channel.addMessage(new ProgressInfoPayload(`<font color="blue">REPAIRING TREE FOR CLOUD WITH ID: '+req.body.fwcloud+'</font>\n`));
    
    const rootNodes = await Repair.checkRootNodes(req.dbCon, channel);

    // Verify that all tree not root nodes are part of a tree.
    channel.addMessage(new ProgressInfoPayload(`<font color="blue">Checking tree struture.</font>\n`));
    await Repair.checkNotRootNodes(rootNodes, channel);

    for (let rootNode of rootNodes) {
      if (rootNode.node_type==='FDF' && req.body.type==='FDF') { 
        // Firewalls and clusters tree.
        channel.addMessage(new ProgressInfoPayload(`<font color="blue">Checking folders.</font>\n`));
        
        await Repair.checkFirewallsFoldersContent(rootNode, channel);
        channel.addMessage(new ProgressInfoPayload(`<font color="blue">Checking firewalls and clusters tree.</font>\n`));
        
        await Repair.checkFirewallsInTree(rootNode, channel);
        await Repair.checkClustersInTree(rootNode, channel);
        
        channel.addMessage(new ProgressInfoPayload(`<font color="blue">Applying OpenVPN server prefixes.</font>\n`));
        
        const openvpn_srv_list = await OpenVPN.getOpenvpnServersByCloud(req.dbCon,req.body.fwcloud);
        for (let openvpn_srv of openvpn_srv_list) {
          channel.addMessage(new ProgressInfoPayload(`OpenVPN server: ${openvpn_srv.cn}\n`));
          await OpenVPNPrefix.applyOpenVPNPrefixes(req.dbCon,req.body.fwcloud,openvpn_srv.id);
        }
        break;
      }
      else if (rootNode.node_type==='FDO' && req.body.type==='FDO') { 
        // Objects tree.
        
        channel.addMessage(new ProgressInfoPayload(`<font color="blue">Checking objects tree.</font>\n`));
        
        // Remove the full tree an create it again from scratch.
        await Tree.deleteFwc_TreeFullNode({id: rootNode.id, fwcloud: req.body.fwcloud});
        const ids = await Tree.createObjectsTree(req.dbCon,req.body.fwcloud);

        channel.addMessage(new ProgressInfoPayload(`<font color="blue">Checking addresses objects.</font>\n`));
        await Repair.checkNonStdIPObj(ids.Addresses,'OIA',5);

        channel.addMessage(new ProgressInfoPayload(`<font color="blue">Checking address ranges objects.</font>\n`));
        await Repair.checkNonStdIPObj(ids.AddressesRanges,'OIR',6);

        channel.addMessage(new ProgressInfoPayload(`<font color="blue">Checking network objects.</font>\n`));
        await Repair.checkNonStdIPObj(ids.Networks,'OIN',7);

        channel.addMessage(new ProgressInfoPayload(`<font color="blue">Checking DNS objects.</font>\n`));
        await Repair.checkNonStdIPObj(ids.DNS,'ONS',9);

        channel.addMessage(new ProgressInfoPayload(`<font color="blue">Checking host objects.</font>\n`));
        rootNode.id = ids.OBJECTS;
        await Repair.checkHostObjects(rootNode);

        channel.addMessage(new ProgressInfoPayload(`<font color="blue">Checking mark objects.</font>\n`));
        await Repair.checkNonStdIPObj(ids.Marks,'MRK',30);

        channel.addMessage(new ProgressInfoPayload(`<font color="blue">Checking objects groups.</font>\n`));
        await Repair.checkNonStdIPObjGroup(ids.Groups,'OIG',20);
        break;
      }
      else if (rootNode.node_type==='FDS' && req.body.type==='FDS') { 
        // Services tree.
        channel.addMessage(new ProgressInfoPayload(`<font color="blue">Checking services tree.</font>\n`));
        
        // Remove the full tree an create it again from scratch.
        await Tree.deleteFwc_TreeFullNode({id: rootNode.id, fwcloud: req.body.fwcloud});
        const ids = await Tree.createServicesTree(req.dbCon,req.body.fwcloud);

        channel.addMessage(new ProgressInfoPayload(`<font color="blue">Checking IP services.</font>\n`));
        await Repair.checkNonStdIPObj(ids.IP,'SOI',1);

        channel.addMessage(new ProgressInfoPayload(`<font color="blue">Checking ICMP services.</font>\n`));
        await Repair.checkNonStdIPObj(ids.ICMP,'SOM',3);

        channel.addMessage(new ProgressInfoPayload(`<font color="blue">Checking TCP services.</font>\n`));
        await Repair.checkNonStdIPObj(ids.TCP,'SOT',2);

        channel.addMessage(new ProgressInfoPayload(`<font color="blue">Checking UDP services.</font>\n`));
        await Repair.checkNonStdIPObj(ids.UDP,'SOU',4);

        channel.addMessage(new ProgressInfoPayload(`<font color="blue">Checking services groups.</font>\n`));
        
        await Repair.checkNonStdIPObjGroup(ids.Groups,'SOG',21);
        break;
      }
    }

    channel.close(30000);
    res.status(204).send({"channel_id": channel.id}).end();
  } catch(error) { 
    channel.addMessage(new ProgressErrorPayload(`\nERROR: ${error}\n`));
    res.status(400).json(error);
  }
});

module.exports = router;
