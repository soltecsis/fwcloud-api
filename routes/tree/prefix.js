var express = require('express');
var router = express.Router();
var treePrefixModel = require('../../models/tree/prefix');
var api_resp = require('../../utils/api_response');
var objModel = 'FWC TREE PREFIX';


/* Create new prefix container */
router.post("/", async (req, res) =>{
	var nodeData = {
		id: null,
		name: req.body.name,
		id_parent: req.body.id_parent,
		node_type: 'FD',
		obj_type: null,
		id_obj: null,
		fwcloud: req.body.fwcloud
  };
  
  try {
    // It is only possible to create prefix containers into tree CA nodes.
    if (req.tree_node.node_type !== 'CA')
      throw (new Error('Parent tree node is not a CA node'));

    // Create the tree node.
    await treePrefixModel.createPrefixNode(nodeData);
    
    // Move all the affected nodes into the prefix container.

    api_resp.getJson(data, api_resp.ACR_INSERTED_OK, 'INSERTED OK', objModel, null, jsonResp => res.status(200).json(jsonResp));
  } catch(error) { api_resp.getJson(null, api_resp.ACR_ERROR, 'Error creating prefix container', objModel, error, jsonResp => res.status(200).json(jsonResp)) }
});

module.exports = router;