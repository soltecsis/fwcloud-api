var express = require('express');
var router = express.Router();
var fwcTreeFoldermodel = require('../../models/tree/folder');
const fwcError = require('../../utils/error_table');


/* Create new folder */
router.post('/', async (req, res) =>{
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
		res.status(200).json(await fwcTreeFoldermodel.createFolderNode(nodeData)); 
	} catch(error) { res.status(400).json(error) }
});

/* Rename folder */
router.put('/', async (req, res) =>{
	try {
		await fwcTreeFoldermodel.renameFolderNode(req.body.fwcloud,req.body.id,req.body.old_name,req.body.new_name);
		res.status(204).end(); 
	} catch(error) { res.status(400).json(error) }
});

/* Delete folder */
router.put('/del', async (req, res) =>{
	try {
		await fwcTreeFoldermodel.deleteFolderNode(req.body.fwcloud,req.body.id);
		res.status(204).end(); 
	} catch(error) { res.status(400).json(error) }
});

/* Drop to folder */
router.put('/drop', async (req, res) =>{
	try {
		await fwcTreeFoldermodel.moveToFolder(req.body.fwcloud,req.body.src,req.body.dst);
		res.status(204).end(); 
	} catch(error) { res.status(400).json(error) }
});

module.exports = router;