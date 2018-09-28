var express = require('express');
var router = express.Router();
var fwcTreeRepairModel = require('../../models/tree/repair');
var api_resp = require('../../utils/api_response');
const streamModel = require('../../models/stream/stream');

var objModel = 'FWC TREE REPAIR';


/* Rpair tree */
router.put("/:type", async (req, res) =>{
	try {
    if (req.params.type!=='FDF' && req.params.type!=='FDO' && req.params.type!=='FDS')
      return api_resp.getJson(null, api_resp.ACR_ERROR, 'Invalid tree node type', objModel, null, jsonResp => res.status(200).json(jsonResp));
    
    accessData = {sessionID: req.sessionID, iduser: req.iduser, fwcloud: req.fwcloud};
    await fwcTreeRepairModel.initData(accessData);

    streamModel.pushMessageCompile(accessData,'<font color="blue">REPAIRING TREE FOR CLOUD WITH ID: '+req.fwcloud+'</font>\n');
    const rootNodes = await fwcTreeRepairModel.checkRootNodes();

    // Verify that all tree not root nodes are part of a tree.
    streamModel.pushMessageCompile(accessData,'<font color="blue">Checking tree struture.</font>\n');
    await fwcTreeRepairModel.checkNotRootNodes(rootNodes);

    for (let rootNode of rootNodes) {
      if (rootNode.node_type==='FDF' && req.params.type==='FDF') { // Firewalls and clusters tree.
        streamModel.pushMessageCompile(accessData,'<font color="blue">Checking folders.</font>\n');
        await fwcTreeRepairModel.checkFirewallsFoldersContent(rootNode);
        streamModel.pushMessageCompile(accessData,'<font color="blue">Checking firewalls and clusters tree.</font>\n');
        await fwcTreeRepairModel.checkFirewallsInTree(rootNode);
        await fwcTreeRepairModel.checkClustersInTree(rootNode);
        break;
      }
      else if (rootNode.node_type==='FDO' && req.params.type==='FDO') { // Objects tree.
        streamModel.pushMessageCompile(accessData,'<font color="blue">Checking host objects.</font>\n');
        await fwcTreeRepairModel.checkHostObjects(rootNode);
        break;
      }
      else if (rootNode.node_type==='FDS' && req.params.type==='FDS') { // Services tree.
        streamModel.pushMessageCompile(accessData,'<font color="blue">Checking services tree.</font>\n');
        break;
      }
    }

    api_resp.getJson(rootNodes, api_resp.ACR_OK, 'REPAIR PROCESS COMPLETED', objModel, null, jsonResp => res.status(200).json(jsonResp));
  } catch(error) { api_resp.getJson(null, api_resp.ACR_ERROR, 'Error repairing tree', objModel, error, jsonResp => res.status(200).json(jsonResp)) }
});

module.exports = router;