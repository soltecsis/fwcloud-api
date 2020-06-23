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
import { IPObjTypeToPolicyPosition } from '../../models/ipobj/IPObjTypeToPolicyPosition';
import { logger } from '../../fonaments/abstract-application';
const fwcError = require('../../utils/error_table');

/* Get all ipobj_type__policy_positions*/
router.get('/policy', (req, res) => {
	IPObjTypeToPolicyPosition.getIpobj_type__policy_positions((error, data) => {
		if (error) {
            logger().error('Error getting all ipobj_type__policy_positions: ' + JSON.stringify(error));
            return res.status(400).json(error);
        }

		if (data && data.length > 0)
			res.status(200).json(data);
		else
			res.status(204).end();
	});
});

module.exports = router;