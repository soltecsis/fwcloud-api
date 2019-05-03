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
		var customerData = {
			id: null,
			addr: req.body.address,
			phone: req.body.telephone,
			name: req.body.name,
			email: req.body.email,
			web: req.body.web
		};

		req.dbCon.query(`INSERT INTO ${tableModel} SET ?`, customerData, (error, result) => {			
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


userModel.existsName = (dbCon, name) => {
	return new Promise(async (resolve, reject) => {
		dbCon.query(`select id from ${tableModel} where name=${dbCon.escape(name)}`, (error, result) => {
			if (error) return reject(error);
			if (result.length>0) return resolve(true);
			resolve(false);
		});
	});
};


userModel.update = req => {
	return new Promise(async (resolve, reject) => {
		let sql = `UPDATE ${tableModel} SET name=${req.db.escape(req.body.name)},
			email=${req.db.escape(req.body.email)},
			address=${req.db.escape(req.body.address)},
			CIF=${req.db.escape(req.body.cif)},
			telephone=${req.db.escape(req.body.telephone)},
			web=${req.db.escape(req.body.web)}
			WHERE id=${req.body.customer}`;
		req.db.query(sql, (error, result) => {
			if (error) return reject(error);
			resolve();
		});
	});
};


userModel.get = req => {
	return new Promise(async (resolve, reject) => {
		let sql = (req.body.customer) ? `select * from ${tableModel} WHERE id=${req.body.customer}` : `select id,name from customer`;
		req.dbCon.query(sql, (error, result) => {
			if (error) return reject(error);
			resolve(result);
		});
	});
};


userModel.delete = req => {
	return new Promise(async (resolve, reject) => {
		req.dbCon.query(`delete from ${tableModel} where id=${req.body.customer}`, (error, result) => {
			if (error) return reject(error);
			resolve();
		});
	});
};


userModel.searchUsers = req => {
	return new Promise((resolve, reject) => {
    req.dbCon.query(`select count(*) as n from user where customer =${req.body.customer}`, async (error, result) => {
      if (error) return reject(error);

      if (result[0].n > 0)
        resolve({result: true, restrictions: { CustomerHasUsers: true}});
      else
        resolve({result: false});
    });
  });
};

userModel.lastCustomer = req => {
	return new Promise((resolve, reject) => {
    req.dbCon.query(`select count(*) as n from ${tableModel}`, async (error, result) => {
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