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
import { Tree } from '../../../models/tree/Tree';
import { app, logger } from '../../../fonaments/abstract-application';
import { WebSocketService } from '../../../sockets/web-socket.service';
const config = require('../../../config/config');
const utilsModel = require('../../../utils/utils');
const restrictedCheck = require('../../../middleware/restricted');


/**
 * Create a new CA (Certification Authority).
 */
router.post('/', async(req, res) => {
	try {
		// Check that the tree node in which we will create a new node for the CA is a valid node for it.
		if (req.tree_node.node_type !== 'FCA' && req.tree_node.node_type !== 'FD')
			throw fwcError.BAD_TREE_NODE_TYPE;

		// Add the new CA to the database.
		req.caId = await Ca.createCA(req);
		// Create the new CA directory structure.
		await Ca.runEasyRsaCmd(req, 'init-pki');
		await Ca.runEasyRsaCmd(req, 'build-ca');
		await Ca.runEasyRsaCmd(req, 'gen-crl');

		// Don't wait for the finish of this process because it takes several minutes.
		Ca.runEasyRsaCmd(req, 'gen-dh')
			.then(() => {
				req.dbCon.query(`update ca set status=0 where id=${req.caId}`, async (error, result) => {
					try {
						const webSocketService = await app().getService(WebSocketService.name);

						if (webSocketService.hasSocket(req.session.socketId)) {
							const socket = webSocketService.getSocket(req.session.socketId);
							socket.emit('ca:dh:created', { caId: req.caId, caCn: req.body.cn });
						}
					} catch (error) { logger().error('Error sending ca created notification: ' + JSON.stringify(error)); }
				});
			});

		// Create new CA tree node.
		const nodeId = await Tree.newNode(req.dbCon, req.body.fwcloud, req.body.cn, req.body.node_id, 'CA', req.caId, 300);

		res.status(200).json({insertId: req.caId, TreeinsertId: nodeId});
	} catch(error) {
		logger().error('Error creating a ca: ' + JSON.stringify(error));
		res.status(400).json(error);
	}
});


/* Get CA information */
router.put('/get', (req, res) => {
	// We have already obtained the CA information in the access control middleware.
	res.status(200).json(req.ca);
});


/**
 * Delete ca.
 */
router.put('/del', 
restrictedCheck.ca,
async(req, res) => {
	try {
		// Check that the ca can be deleted and delete it from the database.
		await Ca.deleteCA(req);

		// Delete the ca directory structure.
		await utilsModel.deleteFolder(config.get('pki').data_dir + '/' + req.body.fwcloud + '/' + req.body.ca);

		// Delete the ca node into the tree.
		await Tree.deleteObjFromTree(req.body.fwcloud, req.body.ca, 300);

		// Answer to the API request.
		res.status(204).end();
	} catch(error) {
		logger().error('Error removing a ca: ' + JSON.stringify(error));
		res.status(400).json(error);
	}
});

// API call for check deleting restrictions.
router.put('/restricted', restrictedCheck.ca, (req, res) => res.status(204).end());

module.exports = router;
