//create object
var accessAuth = {};
//Export the object
module.exports = accessAuth;

var UserModel = require('../models/user/user');
const fwcError = require('../utils/error_table');
var logger = require('log4js').getLogger("app");

accessAuth.check = async (req, res, next) => {
  // Exclude the login route.
	if (req.method==='POST' && req.path==='/user/login') return next();

  /////////////////////////////////////////////////////////////////////////////////
  // WARNING!!!!: If you enable the next two code lines, then you disable
  // the authorization mechanism for access the API and it will be accesible
  // without autorization.
  //req.session.destroy(err => {} );
  //return next();
  /////////////////////////////////////////////////////////////////////////////////
  
	try {
		if (req.session.cookie.maxAge < 1) { // See if the session has expired.
			req.session.destroy(err => {} );
			throw fwcError.SESSION_EXPIRED;
		}
	
		if (!req.session.customer_id || !req.session.user_id || !req.session.username) {
			req.session.destroy(err => {} );
			throw fwcError.SESSION_BAD;
		}
	
		const data = await UserModel.getUserName(req.session.customer_id, req.session.username);
		if (data.length===0) {
			req.session.destroy(err => {} );
			throw fwcError.SESSION_BAD;
		}

		// If we arrive here, then the session is correct.
		logger.debug("USER AUTHORIZED (customer_id: "+req.session.customer_id+", user_id: "+req.session.user_id+", username: "+req.session.username+")");     
		next(); 
	} catch(error) { res.status(400).json(error) }
};
