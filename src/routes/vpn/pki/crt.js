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

const fwcError = require('../../../utils/error_table');
import { Ca } from '../../../models/vpn/pki/Ca';
import { Crt } from '../../../models/vpn/pki/Crt';
import { CaPrefix } from '../../../models/vpn/pki/CaPrefix';
import { Tree } from '../../../models/tree/Tree';
import { logger } from '../../../fonaments/abstract-application';
const config = require('../../../config/config');
const utilsModel = require('../../../utils/utils');
const restrictedCheck = require('../../../middleware/restricted');


/**
 * Create a new certificate.
 */
router.post('/', async(req, res) => {
	try {
		// Check that the tree node in which we will create a new node for the CA is a valid node for it.
		if (req.tree_node.node_type !== 'CA' && req.tree_node.node_type !== 'PRE') 
			throw fwcError.BAD_TREE_NODE_TYPE;

    // Verify that we are not creating a cert that already exists for the same CA.
		if (await Crt.existsCRT(req.dbCon,req.body.ca,req.body.cn)) 
			throw fwcError.ALREADY_EXISTS;

		// Add the new certificate to the database.
		const id = await Crt.createCRT(req);

		req.caId = req.body.ca;
		await Ca.runEasyRsaCmd(req, (req.body.type===1) ? 'build-client-full' : 'build-server-full');

		// Apply prefixes to the newly created certificate.
		await CaPrefix.applyCrtPrefixes(req,req.body.ca);

		res.status(200).json({insertId: id});
	} catch(error) {
		logger().error('Error creating a certificate: ' + JSON.stringify(error));
		res.status(400).json(error);
	}
});

/* Get certificate information */
router.put('/get', (req, res) => {
	// We have already obtained the CA information in the access control middleware.
	res.status(200).json(req.crt);
});


/* Verify if already exist a certificate with the indicated CN. */
router.put('/exists', async (req, res) => {
	try {
		if (await Crt.existsCRT(req.dbCon,req.body.ca,req.body.cn)) 
			res.status(200).end();
		else 
			res.status(404).end();
	} catch(error) {
		logger().error('Error checking a certificate existence: ' + JSON.stringify(error));
		res.status(400).json(error);
	}
});


/**
 * Delete certificate.
 */
router.put('/del', 
restrictedCheck.crt,
async(req, res) => {
	try {
		// Check that the certificate can be deleted and remove it from the database.
		await Crt.deleteCRT(req);

		// Delete the files that make the certificate.
		const base_dir = config.get('pki').data_dir + '/' + req.body.fwcloud + '/' + req.crt.ca;
		await utilsModel.deleteFile(base_dir + '/reqs', req.crt.cn + '.req');
		await utilsModel.deleteFile(base_dir + '/issued', req.crt.cn + '.crt');
		await utilsModel.deleteFile(base_dir + '/private', req.crt.cn + '.key');
		const serial = await Ca.delFromIndex(base_dir, req.crt.cn);
		await utilsModel.deleteFile(base_dir + '/certs_by_serial', serial + '.pem');

		// Delete the certificate node into the tree.
		await Tree.deleteObjFromTree(req.body.fwcloud, req.body.crt, ((req.crt.type===1) ? 301 : 302));

		// Answer to the API request.
		res.status(204).end();
	} catch(error) {
		logger().error('Error removing a certificate: ' + JSON.stringify(error));
		res.status(400).json(error);
	}
});

// API call for check deleting restrictions.
router.put('/restricted', restrictedCheck.crt, (req, res) => res.status(204).end());

module.exports = router;
