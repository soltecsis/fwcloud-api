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
var userModel = {};
var tableModel = "user";

var db = require('../../db.js');
const fwcError = require('../../utils/error_table');

var bcrypt = require('bcrypt');


//Get user by  username
userModel.getUserName = function(customer, username) {
	return new Promise((resolve, reject) => {
		db.get(function(error, connection) {
			if (error) return reject(error);

			var sql = 'SELECT * FROM user ' +
				'WHERE customer=' + connection.escape(customer) + ' AND username =' + connection.escape(username);

			connection.query(sql, function(error, row) {
				if (error)
					reject(error);
				else
					resolve(row);
			});
		});
	});
};


userModel.getAllAdminUserIds = req => {
	return new Promise((resolve, reject) => {
		req.dbCon.query(`select id from ${tableModel} where role=1`, (error, result) => {
			if (error) return reject(error);
			resolve(result);
		});
	});
};



//Update user confirmation_token
userModel.updateUserCT = function(iduser, token, callback) {
	return new Promise((resolve, reject) => {
		db.get(function(error, connection) {
			if (error)
				reject(error);
			var sql = 'UPDATE user SET ' +
				' confirmation_token =  ' + connection.escape(token) +
				' WHERE id = ' + connection.escape(iduser);
			connection.query(sql, function(error, result) {
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
	return new Promise(async(resolve, reject) => {
		//New object with customer data
		var salt = bcrypt.genSaltSync(10);
		var userData = {
			id: null,
			customer: req.body.customer,
			name: req.body.name,
			email: req.body.email,
			username: req.body.username,
			password: bcrypt.hashSync(req.body.customer + req.body.username + req.body.password, salt),
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


userModel.existsCustomerUserName = (dbCon, customer, username) => {
	return new Promise(async(resolve, reject) => {
		dbCon.query(`select id from ${tableModel} where customer=${customer} and username=${dbCon.escape(username)}`, (error, result) => {
			if (error) return reject(error);
			if (result.length > 0) return resolve(true);
			resolve(false);
		});
	});
};

userModel.existsCustomerUserNameOtherId = (dbCon, customer, username, user) => {
	return new Promise(async(resolve, reject) => {
		dbCon.query(`select id from ${tableModel} where customer=${customer} and username=${dbCon.escape(username)} and id!=${user}`, (error, result) => {
			if (error) return reject(error);
			if (result.length > 0) return resolve(true);
			resolve(false);
		});
	});
};


userModel.existsCustomerUserId = (dbCon, customer, user) => {
	return new Promise(async(resolve, reject) => {
		dbCon.query(`select id from ${tableModel} where customer=${customer} and id=${user}`, (error, result) => {
			if (error) return reject(error);
			if (result.length > 0) return resolve(true);
			resolve(false);
		});
	});
};

userModel.isAdmin = req => {
	return new Promise(async(resolve, reject) => {
		req.dbCon.query(`select role from ${tableModel} where customer=${req.body.customer} and id=${req.body.user}`, (error, result) => {
			if (error) return reject(error);
			if (result.length === 0) return reject(fwcError.NOT_FOUND);

			resolve(result[0].role === 1 ? true : false);
		});
	});
};

userModel.isLoggedUserAdmin = req => {
	return new Promise(async(resolve, reject) => {
		req.dbCon.query(`select role from ${tableModel} where id=${req.session.user_id}`, (error, result) => {
			if (error) return reject(error);
			if (result.length === 0) return reject(fwcError.NOT_FOUND);

			resolve(result[0].role === 1 ? true : false);
		});
	});
};


userModel.update = req => {
		return new Promise(async(resolve, reject) => {
		let crypt_pass = '';
		if (req.body.password) {
			var salt = bcrypt.genSaltSync(10);
			crypt_pass = bcrypt.hashSync(req.body.customer + req.body.username + req.body.password, salt);
		}

		let sql = `UPDATE ${tableModel} SET customer=${req.body.customer},
			name=${req.dbCon.escape(req.body.name)},
			email=${req.dbCon.escape(req.body.email)},
			username=${req.dbCon.escape(req.body.username)},
			${(crypt_pass) ? `password=${req.dbCon.escape(crypt_pass)},`: ``}
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

userModel.changeLoggedUserPass = req => {
	return new Promise(async (resolve, reject) => {
		var salt = bcrypt.genSaltSync(10);
		crypt_pass = bcrypt.hashSync(req.session.customer_id+req.session.username+req.body.password, salt);

		req.dbCon.query(`UPDATE ${tableModel} SET password=${req.dbCon.escape(crypt_pass)} WHERE id=${req.session.user_id}`, (error, result) => {
			if (error) return reject(error);
			resolve();
		});
	});
};


userModel.get = req => {
	return new Promise(async (resolve, reject) => {
		let sql = '';
		
		if (req.body.user)
			sql = `select id,customer,name,email,username,enabled,role,allowed_from,last_login from ${tableModel} where customer=${req.body.customer} and id=${req.body.user}`;
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
		req.dbCon.query(`delete from user__fwcloud where user=${req.body.user}`, (error, result) => {
			if (error) return reject(error);

			req.dbCon.query(`delete from ${tableModel} where customer=${req.body.customer} and id=${req.body.user}`, (error, result) => {
				if (error) return reject(error);
				resolve();
			});
		});
	});
};


userModel.lastAdminUser = req => {
	return new Promise((resolve, reject) => {
	req.dbCon.query(`select count(*) as n from ${tableModel} where role=1`, async (error, result) => {
	  if (error) return reject(error);

	  if (result[0].n < 2)
			resolve({result: true, restrictions: { LastAdminUser: true}});
	  else
			resolve({result: false});
	});
  });
};


userModel.allowFwcloudAccess = (dbCon,user,fwcloud) => {
	return new Promise(async (resolve, reject) => {
		dbCon.query(`INSERT IGNORE user__fwcloud values(${user},${fwcloud})`,(error, result) => {			
			if (error) return reject(error);
			resolve(result.insertId);
		});
	});
};

userModel.allowAllFwcloudAccess = (dbCon,user) => {
	return new Promise(async (resolve, reject) => {
		dbCon.query(`select id from fwcloud`,async (error, result) => {			
			if (error) return reject(error);

			try {
				for(let fwcloud of result) {
					await userModel.allowFwcloudAccess(dbCon,user,fwcloud.id);
				}

				resolve();
			} catch(error) { reject(error) }
		});
	});
};

userModel.disableFwcloudAccess = (dbCon,user,fwcloud)  => {
	return new Promise(async (resolve, reject) => {
		dbCon.query(`delete from user__fwcloud where user=${user} and fwcloud=${fwcloud}`,(error, result) => {			
			if (error) return reject(error);
			resolve();
		});
	});
};

//Export the object
module.exports = userModel;