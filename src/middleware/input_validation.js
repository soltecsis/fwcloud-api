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


//create object
var inputValidation = {};
//Export the object
module.exports = inputValidation;

const fwcError = require('../utils/error_table');

inputValidation.check = async(req, res, next) => {
	// The FWCloud.net API only supports these HTTP methods.
	if (req.method!=='POST' && req.method!=='GET' && req.method!=='PUT' && req.method!=='DELETE')
		return res.status(400).json(fwcError.NOT_ACCEPTED_METHOD);

	if ((req.method==='GET' || req.method==='DELETE') && Object.keys(req.body).length!==0)
		return res.status(400).json(fwcError.BODY_MUST_BE_EMPTY);
	
	const item1 = req.url.split('/')[1];
	const item1_valid_list = [ 'user', 'customer', 'fwcloud', 'firewall', 'cluster', 'policy', 'interface', 
														 'ipobj', 'tree', 'vpn', 'backup' ];
	// Verify that item1 is in the valid list.
	if (!item1_valid_list.includes(item1))
		return res.status(404).json(fwcError.BAD_API_CALL);

	// URLs excluded of the input data validation process because don't have any data to be validated.
	if ((req.method==='GET' && req.url==='/fwcloud/all/get') ||
		(req.method==='GET' && req.url==='/firewall/all/get') ||
		(req.method==='GET' && req.url==='/cluster/all/get') ||
		(req.method==='GET' && req.url==='/ipobj/types') ||
		(req.method==='GET' && req.url==='/ipobj/positions/policy') ||
		(req.method==='GET' && req.url==='/policy/types') ||
		(req.method==='GET' && req.url==='/stream') ||
		(req.method==='PUT' && req.url==='/updates/updater'))
		return next();

	try {
		// Validate input.
		await require(`./joi_schemas/${item1}`).validate(req);

		// If we arrive here then input data has been sucessfully validated.  
		next();
	} catch (error) {
		if (error instanceof Error && error.code==="MODULE_NOT_FOUND")
			res.status(400).json(fwcError.MODULE_NOT_FOUND);
		else
			res.status(400).json(error);
	}
};