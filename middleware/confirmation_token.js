//create object
var confirmToken = {};
//Export the object
module.exports = confirmToken;

var api_resp = require('../utils/api_response');
var utilsModel = require('../utils/utils');
var userModel = require('../models/user/user');

confirmToken.check = async (req, res, next) => {
  if (req.url.split('/').pop()==='get' || req.url.split('/').pop()==='restricted' 
      || req.method==='GET' || (req.method==='POST' && req.path==='/user/login'))
    return next();

  try {
    const test = await confirmToken.validate(req);
    if (test.result) // Confirmation token successfully validated.
      next();
    else // Need confirmation, send new token
      api_resp.getJson({"fwc_confirm_token": test.token}, api_resp.ACR_CONFIRM_ASK, 'Need to confirm action', 'ACTION', null, jsonResp => res.status(200).json(jsonResp));
  } catch(error) { api_resp.getJson(null, api_resp.ACR_ERROR, 'Checking confirmation token', 'CONFIRM TOKEN', error, jsonResp => res.status(200).json(jsonResp)) }
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
          const reqCT = req.headers.x_fwc_confirm_token; // Confirmation token present in the request headers.
          
          if (reqCT===undefined || reqCT!==dbCT) {
            //generate new token
            const new_token = req.sessionID + "_" + utilsModel.getRandomString(20);
            await userModel.updateUserCT(req.session.user_id, new_token)
            resolve({"result": false, "token": new_token});
          } else {
            //token valid
            //REMOVE token
            await userModel.updateUserCT(req.session.user_id, "")
            resolve({"result": true, "token": ""});
          }
        } else reject({"result": false, "token": ""});
      } catch(error) { reject(error) }
    });
	});
};

  