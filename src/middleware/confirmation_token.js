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
var confirmToken = {};
//Export the object
export default confirmToken;

const randomString = require('random-string');
import { User } from '../models/user/User';

confirmToken.check = async (req, res, next) => {
  if (req.url.split('/').pop()==='get' || req.url.split('/').pop()==='restricted' || req.url.split('/').pop()==='where' 
      || req.method==='GET' || (req.method==='POST' && req.path==='/user/login'))
    return next();

  try {
    const test = await confirmToken.validate(req);
    if (test.result) // Confirmation token successfully validated.
      next();
    else // Need confirmation, send new token
      res.status(403).json({"fwc_confirm_token": test.token});
  } catch(error) { res.status(400).json(error) }
};

//Check User CONFIRMATION TOKEN
confirmToken.validate = req => {
	return new Promise((resolve, reject) => {
    var sql = 'SELECT confirmation_token FROM user WHERE id=' + req.session.user_id;
    req.dbCon.query(sql, async (error, row) => {
      if (error) return reject(error);

      try {
        if (row) {                        
          const dbCT = row[0].confirmation_token; // Confirmation token stored in the data base.
          const reqCT = req.headers['x-fwc-confirm-token']; // Confirmation token present in the request headers.
          
          if (reqCT===undefined || reqCT!==dbCT) {
            //generate new token
            const new_token = req.sessionID + "_" + randomString({length: 20});
            await User.updateUserCT(req.session.user_id, new_token)
            resolve({"result": false, "token": new_token});
          } else {
            //token valid
            //REMOVE token
            await User.updateUserCT(req.session.user_id, "")
            resolve({"result": true, "token": ""});
          }
        } else reject({"result": false, "token": ""});
      } catch(error) { reject(error) }
    });
	});
};

  