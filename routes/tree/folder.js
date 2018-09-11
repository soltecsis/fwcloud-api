var express = require('express');
var router = express.Router();
var fwcTreeFoldermodel = require('../../models/tree/folder');
var api_resp = require('../../utils/api_response');
var objModel = 'FWC TREE FOLDER';


/* Create new folder */
router.post("/", (req, res) =>{
	var nodeData = {
		id: null,
		name: req.body.name,
		id_parent: req.body.id_parent,
		node_order: req.body.node_order,
		node_icon: null,
		expanded: 0,
		node_type: 'FD',
		api_call: null,
		obj_type: null,
		id_obj: null,
		node_level: req.body.node_level,
		fwcloud: req.fwcloud,
		comment: req.body.comment,
		fwcloud_tree: req.fwcloud
	};

	fwcTreeFoldermodel.createFolderNode(nodeData)
	.then(data => api_resp.getJson(data, api_resp.ACR_INSERTED_OK, 'INSERTED OK', objModel, null, jsonResp => res.status(200).json(jsonResp)))
	.catch(error => api_resp.getJson(null, api_resp.ACR_ERROR, 'Error creating folder', objModel, error, jsonResp => res.status(200).json(jsonResp)));
});

/* Rename folder */
router.put("/", (req, res) =>{
	fwcTreeFoldermodel.renameFolderNode(req.fwcloud,req.body.id,req.body.old_name,req.body.new_name)
	.then(() => api_resp.getJson(null, api_resp.ACR_OK, 'RENAMED OK', objModel, null, jsonResp => res.status(200).json(jsonResp)))
	.catch(error => api_resp.getJson(null, api_resp.ACR_ERROR, 'Error renaming folder', objModel, error, jsonResp => res.status(200).json(jsonResp)));
});

/* Delete folder */
router.put("/del", (req, res) =>{
	fwcTreeFoldermodel.deleteFolderNode(req.fwcloud,req.body.id)
	.then(() => api_resp.getJson(null, api_resp.ACR_OK, 'DELETED OK', objModel, null, jsonResp => res.status(200).json(jsonResp)))
	.catch(error => api_resp.getJson(null, api_resp.ACR_ERROR, 'Error deleting folder', objModel, error, jsonResp => res.status(200).json(jsonResp)));
});

/* Drop to folder */
router.put("/drop", (req, res) =>{
	fwcTreeFoldermodel.moveToFolder(req.fwcloud,parseInt(req.body.src),parseInt(req.body.dst))
	.then(() => api_resp.getJson(null, api_resp.ACR_OK, 'MOVED INTO FOLDER OK', objModel, null, jsonResp => res.status(200).json(jsonResp)))
	.catch(error => api_resp.getJson(null, api_resp.ACR_ERROR, 'Error moving to folder', objModel, error, jsonResp => res.status(200).json(jsonResp)));
});

module.exports = router;