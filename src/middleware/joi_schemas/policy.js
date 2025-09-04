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


var schema = {};
module.exports = schema;
const fwcError = require('../../utils/error_table');

schema.validate = req => {
  return new Promise(async (resolve, reject) => {
    const item2 = req.path.split('/')[2];
    if (item2 === 'rule' || item2 === 'compile' || item2 === 'install' || item2 === 'ipobj' || item2 === 'interface'
      || item2 === 'group' || item2 === 'openvpn' || item2 === 'prefix' || item2 === 'positions' || item2 === 'wireguard' || item2 === 'ipsec')
      try {
        const item1 = req.url.split('/')[1];
        return resolve(await require('./' + item1 + '/' + item2).validate(req));
      } catch (error) { return reject(error) }

    return reject(fwcError.BAD_API_CALL);
  });
};
