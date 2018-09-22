var express = require('express');
var router = express.Router();
var fwcTreeRepairModel = require('../../models/tree/repair');
var api_resp = require('../../utils/api_response');
var objModel = 'FWC TREE REPAIR';


/* Rpair tree */
router.put("/", (req, res) =>{
	try {
    const rootNodes = await fwcTreeRepairModel.createFolderNode(req.fwcloud);
    api_resp.getJson(rootNodes, api_resp.ACR_OK, 'REPAIR PROCESS COMPLETED', objModel, null, jsonResp => res.status(200).json(jsonResp));
  } catch(error) { api_resp.getJson(null, api_resp.ACR_ERROR, 'Error repairing folder', objModel, error, jsonResp => res.status(200).json(jsonResp)) }
});