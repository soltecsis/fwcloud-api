var express = require('express');
var router = express.Router();
var fwcTreeRepairModel = require('../../models/tree/repair');
var api_resp = require('../../utils/api_response');
var utils = require('../../utils/utils');

var objModel = 'FWC TREE REPAIR';


/* Rpair tree */
router.put("/", async (req, res) =>{
	try {
    await fwcTreeRepairModel.initData(req);
    const rootNodes = await fwcTreeRepairModel.checkRootNodes(req.fwcloud);

    // Verify that all tree not root nodes are part of a tree.
    await fwcTreeRepairModel.checkNotRootNodes(rootNodes);

    for (let rootNode of rootNodes) {
      if (rootNode.node_type==='FDF') {
        await fwcTreeRepairModel.checkFirewallsFoldersContent(rootNode);
        await fwcTreeRepairModel.checkFirewallsInTree(rootNode);
        await fwcTreeRepairModel.checkClustersInTree(rootNode);
      }
    }

    api_resp.getJson(rootNodes, api_resp.ACR_OK, 'REPAIR PROCESS COMPLETED', objModel, null, jsonResp => res.status(200).json(jsonResp));
  } catch(error) { api_resp.getJson(null, api_resp.ACR_ERROR, 'Error repairing tree', objModel, error, jsonResp => res.status(200).json(jsonResp)) }
});

module.exports = router;