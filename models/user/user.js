//create object
var userModel = {};
var tableModel="user";

var db = require('../../db.js');

//Get user by  username
userModel.getUserName = function (customer, username) {
	return new Promise((resolve,reject) => {
		db.get(function (error, connection) {
			if (error) return reject(error);
			
			var sql = 'SELECT * FROM user '+
				'WHERE customer='+connection.escape(customer)+' AND username ='+connection.escape(username);
	
			connection.query(sql, function (error, row) {
				if (error)
					reject(error);
				else
					resolve(row);
			});
		});
	});
};


//Update user confirmation_token
userModel.updateUserCT = function (iduser, token, callback) {
	return new Promise((resolve, reject) => {
		db.get(function (error, connection) {
			if (error)
				reject(error);
			var sql = 'UPDATE user SET ' +
					' confirmation_token =  ' + connection.escape(token) +
					' WHERE id = ' + connection.escape(iduser);
			connection.query(sql, function (error, result) {
				if (error) {
					reject(error);
				} else {
					resolve(true);
				}
			});
		});
	});
};



//Add new customer
userModel.insert = req => {
	return new Promise(async (resolve, reject) => {
		//New object with customer data
		var userData = {
			id: null,
			customer: req.body.customer,
			name: req.body.name,
			email: req.body.email,
			username: req.body.username,
			password: req.body.password,
			enabled: req.body.enabled,
			role: req.body.role,
			allowed_from: req.body.allowed_from
		};

		req.dbCon.query(`INSERT INTO ${tableModel} SET ?`, userData, (error, result) => {			
			if (error) return reject(error);
			resolve(result.insertId);
		});
	});
};


userModel.existsId = (dbCon, customer) => {
	return new Promise(async (resolve, reject) => {
		dbCon.query(`select id from ${tableModel} where id=${customer}`, (error, result) => {
			if (error) return reject(error);
			if (result.length>0) return resolve(true);
			resolve(false);
		});
	});
};


userModel.existsCustomerUserName = (dbCon, customer, username) => {
	return new Promise(async (resolve, reject) => {
		dbCon.query(`select id from ${tableModel} where customer=${customer} and username=${dbCon.escape(username)}`, (error, result) => {
			if (error) return reject(error);
			if (result.length>0) return resolve(true);
			resolve(false);
		});
	});
};

userModel.existsCustomerUserId = (dbCon, customer, user) => {
	return new Promise(async (resolve, reject) => {
		dbCon.query(`select id from ${tableModel} where customer=${customer} and id=${user}`, (error, result) => {
			if (error) return reject(error);
			if (result.length>0) return resolve(true);
			resolve(false);
		});
	});
};


userModel.update = req => {
	return new Promise(async (resolve, reject) => {
		let sql = `UPDATE ${tableModel} SET customer=${req.body.customer},
			name=${req.dbCon.escape(req.body.name)},
			email=${req.dbCon.escape(req.body.email)},
			username=${req.dbCon.escape(req.body.username)},
			password=${req.dbCon.escape(req.body.password)},
			enabled=${req.body.enabled},
			role=${req.body.role},
			allowed_from=${req.dbCon.escape(req.body.allowed_from)}
			WHERE id=${req.body.user}`;
		req.dbCon.query(sql, (error, result) => {
			if (error) return reject(error);
			resolve();
		});
	});
};


userModel.get = req => {
	return new Promise(async (resolve, reject) => {
		let sql = '';
		
		if (req.body.user)
			sql = `select * from ${tableModel} where customer=${req.body.customer} and id=${req.body.user}`;
		else
			sql = `select id,customer,name from ${tableModel} where customer=${req.body.customer}`;
		req.dbCon.query(sql, (error, result) => {
			if (error) return reject(error);
			resolve(result);
		});
	});
};


userModel.delete = req => {
	return new Promise(async (resolve, reject) => {
		req.dbCon.query(`delete from ${tableModel} where customer=${req.body.customer} and id=${req.body.user}`, (error, result) => {
			if (error) return reject(error);
			resolve();
		});
	});
};


userModel.lastAdminUser = req => {
	return new Promise((resolve, reject) => {
    req.dbCon.query(`select count(*) as n from ${tableModel} where role=1`, async (error, result) => {
      if (error) return reject(error);

      if (result[0].n < 2)
        resolve({result: true, restrictions: { LastCustomer: true}});
      else
        resolve({result: false});
    });
  });
};

//Export the object
module.exports = userModel;