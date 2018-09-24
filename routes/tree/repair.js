var express = require('express');
var router = express.Router();
var fwcTreeRepairModel = require('../../models/tree/repair');
var api_resp = require('../../utils/api_response');
var utils = require('../../utils/utils');

var objModel = 'FWC TREE REPAIR';


/* Rpair tree */
router.put("/", async (req, res) =>{
	try {
    const accessData = {sessionID: req.sessionID, iduser: req.iduser, fwcloud: req.fwcloud};
    const dbCon = await utils.getDbConnection();
    const rootNodes = await fwcTreeRepairModel.getRootNodes(accessData,dbCon,req.fwcloud);

    // Verify that all tree not root nodes are part of a tree.
    await fwcTreeRepairModel.checkNotRootNodes(accessData,dbCon,req.fwcloud,rootNodes);

    for (let node of rootNodes) {
      if (node.node_type==='FDF') {
        //await fwcTreeRepairModel.checkFirewallNodes(accessData,dbCon,node);
        await fwcTreeRepairModel.checkClustersInTree(accessData,dbCon,req.fwcloud,node);
      }
    }

    api_resp.getJson(rootNodes, api_resp.ACR_OK, 'REPAIR PROCESS COMPLETED', objModel, null, jsonResp => res.status(200).json(jsonResp));
  } catch(error) { api_resp.getJson(null, api_resp.ACR_ERROR, 'Error repairing tree', objModel, error, jsonResp => res.status(200).json(jsonResp)) }
});

module.exports = router;