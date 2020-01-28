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