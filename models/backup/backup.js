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
var backupModel = {};


// Validate new prefix container.
backupModel.existsPrefix = (dbCon,openvpn,name) => {
	return new Promise((resolve, reject) => {
    dbCon.query(`SELECT id FROM ${tableModel} WHERE openvpn=${openvpn} AND name=${dbCon.escape(name)}`, (error, result) => {
      if (error) return reject(error);
      resolve((result.length>0) ? true : false);
    });
  });
};

//Export the object
module.exports = backupModel;

