var express = require('express');
var router = express.Router();
var treePrefixModel = require('../../models/tree/prefix');
var api_resp = require('../../utils/api_response');
var objModel = 'FWC TREE PREFIX';


/* Create new prefix container */
router.post("/", async (req, res) =>{
  try {
    // It is only possible to create prefix containers into tree CA nodes.
    if (req.tree_node.node_type !== 'CA')
      throw (new Error('Parent tree node is not a CA node'));

    // Create the tree node and move all affected nodes into the prefix container.
    await treePrefixModel.createPrefixNode(req);
    api_resp.getJson(null, api_resp.ACR_INSERTED_OK, 'INSERTED OK', objModel, null, jsonResp => res.status(200).json(jsonResp));
  } catch(error) { api_resp.getJson(null, api_resp.ACR_ERROR, 'Error creating prefix container', objModel, error, jsonResp => res.status(200).json(jsonResp)) }
});

module.exports = router;