var express = require('express');
var router = express.Router();
var fwcTreeRepairModel = require('../../models/tree/repair');
var api_resp = require('../../utils/api_response');
const streamModel = require('../../models/stream/stream');

var objModel = 'FWC TREE REPAIR';


/* Rpair tree */
router.put("/", async (req, res) =>{
	try {
    accessData = {sessionID: req.sessionID, iduser: req.iduser, fwcloud: req.fwcloud};
    await fwcTreeRepairModel.initData(accessData);

    streamModel.pushMessageCompile(accessData,'<font color="blue">REPAIRING TREES FOR CLOUD WITH ID: '+req.fwcloud+'</font>\n');
    const rootNodes = await fwcTreeRepairModel.checkRootNodes();

    // Verify that all tree not root nodes are part of a tree.
    streamModel.pushMessageCompile(accessData,'<font color="blue">Checking tree struture.</font>\n');
    await fwcTreeRepairModel.checkNotRootNodes(rootNodes);

    for (let rootNode of rootNodes) {
      if (rootNode.node_type==='FDF') { // Firewalls and clusters tree.
        streamModel.pushMessageCompile(accessData,'<font color="blue">Checking folders.</font>\n');
        await fwcTreeRepairModel.checkFirewallsFoldersContent(rootNode);
        streamModel.pushMessageCompile(accessData,'<font color="blue">Checking firewalls and clusters tree.</font>\n');
        await fwcTreeRepairModel.checkFirewallsInTree(rootNode);
        await fwcTreeRepairModel.checkClustersInTree(rootNode);
      }
      else if (rootNode.node_type==='FDO') { // Objects tree.
        streamModel.pushMessageCompile(accessData,'<font color="blue">Checking host objects.</font>\n');
        await fwcTreeRepairModel.checkHostObjects(rootNode);
      }
    }

    api_resp.getJson(rootNodes, api_resp.ACR_OK, 'REPAIR PROCESS COMPLETED', objModel, null, jsonResp => res.status(200).json(jsonResp));
  } catch(error) { api_resp.getJson(null, api_resp.ACR_ERROR, 'Error repairing tree', objModel, error, jsonResp => res.status(200).json(jsonResp)) }
});

module.exports = router;