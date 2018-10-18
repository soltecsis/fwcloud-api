//create object
var accessAuth = {};
//Export the object
module.exports = accessAuth;

var api_resp = require('../utils/api_response');
var UserModel = require('../models/user/user');
var logger = require('log4js').getLogger("app");

accessAuth.chek = function (req, res, next) {
  // Exclude the login route.
	if (req.path==='/users/login') return next();

  /////////////////////////////////////////////////////////////////////////////////
  // WARNING!!!!: If you enable the next two code lines, then you disable
  // the authorization mechanism for access the API and it will be accesible
  // without autorization.
  //req.session.destroy(err => {} );
  //return next();
  /////////////////////////////////////////////////////////////////////////////////
  
  if (req.session.cookie.maxAge < 1) { // See if the session has expired.
		req.session.destroy(err => {} );
		api_resp.getJson(null, api_resp.ACR_SESSION_ERROR, 'Session expired.', '', null, jsonResp => { res.status(200).json(jsonResp) });
		return;
  }

  if (!req.session.customer_id || !req.session.user_id || !req.session.username) {
		req.session.destroy(err => {} );
		api_resp.getJson(null, api_resp.ACR_SESSION_ERROR, 'Invalid session.', '', null, jsonResp => res.status(200).json(jsonResp));
		return;
  }

	UserModel.getUserName(req.session.customer_id, req.session.username)
	.then(data => {
		if (data.length===0) {
			req.session.destroy(err => {} );
			throw null;
		}

		// If we arrive here, then the session is correct.
		logger.debug("USER AUTHORIZED (customer_id: "+req.session.customer_id+", user_id: "+req.session.user_id+", username: "+req.session.username+")");     
		next(); 
	})
	.catch(error => api_resp.getJson(null, api_resp.ACR_SESSION_ERROR, 'Bad session data.', '', error, jsonResp => res.status(200).json(jsonResp)));
};
