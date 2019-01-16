var express = require('express');
var router = express.Router();
var UserModel = require('../../models/user/user');
var api_resp = require('../../utils/api_response');
var objModel = 'USER';

var parseFile = require('./parse_file.js');

var bcrypt = require('bcrypt');

var logger = require('log4js').getLogger("app");

var cp = require("child_process");


//BLOQUEAR ACCESOS. SOLO ACCESO PARA ADMINISTRACION


/*---------------------------------------------------------------------------*/
/* AUTHENTICATION: Validate the user credentials and initialize data in the session file. */
/*---------------------------------------------------------------------------*/
router.post('/login',async (req, res) => {
  // Verify that we have all the required parameters for autenticate the user.
  if (!req.body.customer || !req.body.username || !req.body.password) {
		req.session.destroy(err => {} );
		api_resp.getJson(null, api_resp.ACR_ERROR, 'Bad data', objModel, null, jsonResp => { res.status(200).json(jsonResp) });
		return;
  }

  logger.debug("LOGIN: customer="+req.body.customer+", user="+req.body.username);

	try {
		const data = await UserModel.getUserName(req.body.customer, req.body.username);
		if (data.length===0) {
			req.session.destroy(err => {});
			logger.debug("USER NOT FOUND: customer="+req.body.customer+", user="+req.body.username);
			throw null;
		}
		
		// Validate credentials.
		/* WARNING: As recomended in the bcrypt manual:
		Why is async mode recommended over sync mode?
		If you are using bcrypt on a simple script, using the sync mode is perfectly fine.
		However, if you are using bcrypt on a server, the async mode is recommended.
		This is because the hashing done by bcrypt is CPU intensive, so the sync version
		will block the event loop and prevent your application from servicing any other
		inbound requests or events.
		*/
		if (await bcrypt.compare(req.body.customer+req.body.username+req.body.password, data[0].password)) {
			// Return authorization token.
			req.session.customer_id = data[0].customer;
			req.session.user_id = data[0].id;
			req.session.username = data[0].username;
			api_resp.getJson({user_id: req.session.user_id}, api_resp.ACR_OK, 'User loged in.', objModel, null, jsonResp => res.status(200).json(jsonResp));
		} else {
			req.session.destroy(err => {} );
			logger.debug("INVALID PASSWORD: customer="+req.body.customer+", user="+req.body.username);
			throw null;
		}
	} catch(error) {
		api_resp.getJson(null, api_resp.ACR_ERROR, 'Invalid username or password.', objModel, error, jsonResp => res.status(200).json(jsonResp));
	} 
});
/*---------------------------------------------------------------------------*/

/*---------------------------------------------------------------------------*/
router.post('/logout',(req, res) => {
  logger.debug("DESTROYING SESSION (customer_id: "+req.session.customer_id+", user_id: "+req.session.user_id+", username: "+req.session.username+")");
  req.session.destroy(err => {});
  api_resp.getJson(null, api_resp.ACR_OK, 'Session destroyed.', objModel, null, jsonResp => { res.status(200).json(jsonResp) });
});
/*---------------------------------------------------------------------------*/



/* Get all users by customer*/
/* router.get('/:customer', function (req, res)
{
	var customer = req.params.customer;
	UserModel.getUsers(customer, function (error, data)
	{
		//show user form
		if (data && data.length > 0)
		{
			api_resp.getJson(data, api_resp.ACR_OK, '', objModel, null, function (jsonResp) {
				res.status(200).json(jsonResp);
			});
		}
		//other we show an error
		else
		{
			api_resp.getJson(data, api_resp.ACR_NOTEXIST, 'not found', objModel, null, function (jsonResp) {
				res.status(200).json(jsonResp);
			});
		}
	});
});*/

/* Get all users from Custormer and username*/
/*router.get('/:customer/username/:username', (req, res) => {
	UserModel.getUserName(req.params.customer, req.params.username)
	.then(data => {
		if (data && data.length > 0)
			api_resp.getJson(data, api_resp.ACR_OK, '', objModel, null, jsonResp => res.status(200).json(jsonResp));
	})
	.catch(err => api_resp.getJson(null, api_resp.ACR_NOTEXIST, 'not found', objModel, err, jsonResp => res.status(200).json(jsonResp)));
});*/


/* new user */
/*router.post("/user", (req, res) => {
  //Objet to create new user
  var userData = {
	id: null,
	customer: req.body.customer,
	username: req.body.username.toLowerCase(),
	allowed_ip: req.body.allowed_ip,
	name: req.body.name,
	email: req.body.email,
	password: req.body.password,
	role: req.body.role
  };

  /* WARNING: As recomended in the bcrypt manual:
  Why is async mode recommended over sync mode?
  If you are using bcrypt on a simple script, using the sync mode is perfectly fine.
  However, if you are using bcrypt on a server, the async mode is recommended.
  This is because the hashing done by bcrypt is CPU intensive, so the sync version
  will block the event loop and prevent your application from servicing any other
  inbound requests or events.
  */
 /* bcrypt.genSalt(10, (error,salt) => {
	bcrypt.hash(req.body.customer+req.body.username+req.body.password, salt, null, (error, hash) => {
	  if (error) api_resp.getJson(data, api_resp.ACR_ERROR, 'Error generating password hash.', '', error, jsonResp => { res.status(200).json(jsonResp) });
	  logger.debug("HASH: "+hash);
	  userData.password = hash;

	  UserModel.insertUser(userData, function (error, data)
	  {
		if (error)
		  api_resp.getJson(data, api_resp.ACR_ERROR, 'SQL ERRROR', '', error, function (jsonResp) {
			res.status(200).json(jsonResp);
		  });
		else {
		  //User created  ok
		  if (data && data.insertId)
		  {
			//res.redirect("/users/user/" + data.insertId);
			var dataresp = {"insertId": data.insertId};
			api_resp.getJson(dataresp, api_resp.ACR_INSERTED_OK, 'INSERTED OK', objModel, null, function (jsonResp) {
			  res.status(200).json(jsonResp);
		  });
		  } else
		  {
			api_resp.getJson(data, api_resp.ACR_ERROR, 'Error', objModel, error, function (jsonResp) {
			  res.status(200).json(jsonResp);
			});
		  }
		}
	  });
	})
  });
});*/

/* udate user */
/*router.put('/user/', function (req, res)
{
	//Save user data into objet
	var userData = {id: req.param('id'), customer: req.param('customer'), username: req.param('username'), allowed_ip: req.param('allowed_ip'), name: req.param('name'), email: req.param('email'), password: req.param('password'), role: req.param('role')};
	UserModel.updateUser(userData, function (error, data)
	{
		if (error)
			api_resp.getJson(data, api_resp.ACR_ERROR, 'SQL ERRROR', '', error, function (jsonResp) {
				res.status(200).json(jsonResp);
			});
		else {
			//Message if user ok
			if (data && data.result)
			{
				//res.redirect("/users/user/" + req.param('id'));
				api_resp.getJson(null, api_resp.ACR_UPDATED_OK, 'UPDATED OK', objModel, null, function (jsonResp) {
					res.status(200).json(jsonResp);
				});
			} else
			{
				api_resp.getJson(data, api_resp.ACR_ERROR, 'Error', objModel, error, function (jsonResp) {
					res.status(200).json(jsonResp);
				});
			}
		}
	});
});*/

/* Get User by id */
/*router.get('/:customer/user/:id', function (req, res)
{
	var customer = req.params.customer;
	var id = req.params.id;
	//
	if (!isNaN(id))
	{
		UserModel.getUser(customer, id, function (error, data)
		{
			//If exists show de form
			if (data && data.length > 0)
			{
				api_resp.getJson(data, api_resp.ACR_OK, '', objModel, null, function (jsonResp) {
					res.status(200).json(jsonResp);
				});

			}
			//Error
			else
			{
				api_resp.getJson(data, api_resp.ACR_NOTEXIST, 'not found', objModel, null, function (jsonResp) {
					res.status(200).json(jsonResp);
				});
			}
		});
	}
	//Id must be numeric
	else
	{
		api_resp.getJson(null, api_resp.ACR_DATA_ERROR, '', objModel, null, function (jsonResp) {
			res.status(200).json(jsonResp);
		});
	}
});*/


/* remove the user */
/*router.put("/del/user/", function (req, res)
{
	//User id
	var id = req.param('id');
	UserModel.deleteUser(id, function (error, data)
	{
		if (error)
			api_resp.getJson(data, api_resp.ACR_ERROR, 'SQL ERRROR', '', error, function (jsonResp) {
				res.status(200).json(jsonResp);
			});
		else {
			if (data && data.result)
			{
				//res.redirect("/users/");
				api_resp.getJson(null, api_resp.ACR_UPDATED_OK, 'DELETED OK', objModel, null, function (jsonResp) {
					res.status(200).json(jsonResp);
				});
			} else
			{
				api_resp.getJson(data, api_resp.ACR_ERROR, 'Error', objModel, error, function (jsonResp) {
					res.status(200).json(jsonResp);
				});
			}
		}
	});
});*/

module.exports = router;