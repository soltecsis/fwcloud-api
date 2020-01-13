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

const fwcError = require('../../utils/error_table');
const userModel = require('../../models/user/user');
const backupModel = require('../../models/backup/backup');


/**
 * Create a new full system backup.
 */
router.post('/', async (req, res) => {
	try {
    // Only admin users can create a new backup.
    if (!(await userModel.isLoggedUserAdmin(req)))
		  throw fwcError.NOT_ADMIN_USER;

    /*
    // Verify that we are not creating a prefix that already exists for the same CA.
		if (await openvpnPrefixModel.existsPrefix(req.dbCon,req.body.openvpn,req.body.name)) 
			throw fwcError.ALREADY_EXISTS;

   	// Create the tree node.
		const id = await openvpnPrefixModel.createPrefix(req);

		// Apply the new CRT prefix container.
    await openvpnPrefixModel.applyOpenVPNPrefixes(req.dbCon,req.body.fwcloud,req.body.openvpn);
    */

    res.status(200).json({backupId: id});
	} catch(error) { res.status(400).json(error) }
});

module.exports = router;
