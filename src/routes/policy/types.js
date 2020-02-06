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
import { PolicyType } from '../../models/policy/PolicyType';
const fwcError = require('../../utils/error_table');


/* Get all policy_types*/
router.get('', (req, res) => {
	PolicyType.getPolicy_types((error, data) => {
    if (data && data.length > 0)
      res.status(200).json(data);
    else
			res.status(204).end();
	});
});



/* Get  policy_type by type */
router.get('/:type', function (req, res)
{
	var type = req.params.type;
	PolicyType.getPolicy_type(type, function (error, data)
	{
    if (data && data.length > 0)
      res.status(200).json(data);
    else
			res.status(400).json(fwcError.NOT_FOUND);
	});
});

/* Get all policy_types by name */
router.get('/name/:name', function (req, res)
{
	var name = req.params.name;
	PolicyType.getPolicy_typeName(name, function (error, data)
	{
    if (data && data.length > 0)
      res.status(200).json(data);
    else
			res.status(400).json(fwcError.NOT_FOUND);
	});
});


module.exports = router;