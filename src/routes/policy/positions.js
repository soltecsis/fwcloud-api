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
import { PolicyPosition } from '../../models/policy/PolicyPosition';
import { logger } from '../../fonaments/abstract-application';
const fwcError = require('../../utils/error_table');

/* Get all policy_positions by Type*/
router.put('/get', async(req, res) => {
    try {
        const data = await PolicyPosition.getPolicyPositionsByType(req.dbCon, req.body.type);
        //If exists policy_position get data
        if (data && data.length > 0)
            res.status(200).json(data);
        else {
            logger().error('Error getting policy_positions by Type: ' + JSON.stringify(fwcError.NOT_FOUND));
            res.status(400).json(fwcError.NOT_FOUND);
        }
    } catch (error) {
        logger().error('Error getting policy_positions by Type: ' + JSON.stringify(error));
        res.status(400).json(error);
    }
});

module.exports = router;