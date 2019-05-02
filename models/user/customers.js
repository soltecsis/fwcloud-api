//create object
var customerModel = {};
var tableModel="customer";

//Add new customer
customerModel.insert = req => {
	return new Promise(async (resolve, reject) => {
		//New object with customer data
		var customerData = {
			id: req.body.customer,
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


customerModel.exists = req => {
	return new Promise(async (resolve, reject) => {
		// Make sure that we don't have another customer with the same name.
		req.dbCon.query(`select id from ${tableModel} where name=${req.dbCon.escape(req.body.name)}`, (error, result) => {
			if (error) return reject(error);
			if (result.length>0) return resolve(true);

			// If we have a customer id in the body, make sure that we don't have any other customer with the same id.
			if (req.body.customer) {
				req.dbCon.query(`select id from ${tableModel} where id=${req.body.customer}`, (error, result) => {
					if (error) return reject(error);
					if (result.length>0) return resolve(true);
					resolve(false);
				});
			} else resolve(false);
		});
	});
};


//Update customer
customerModel.update = req => {
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




//Get customer by  id
customerModel.getCustomer = function (id, callback) {
	db.get(function (error, connection) {
		if (error) callback(error, null);
		var sql = 'SELECT * FROM ' + tableModel + ' WHERE id = ' + connection.escape(id);
		connection.query(sql, function (error, row) {
			if (error)
				callback(error, null);
			else
				callback(null, row);
		});
	});
};



//Get All customer
customerModel.getCustomers = function (callback) {

	db.get(function (error, connection) {
		if (error) callback(error, null);
		connection.query('SELECT * FROM ' + tableModel + ' ORDER BY id', function (error, rows) {
			if (error)
				callback(error, null);
			else
				callback(null, rows);
		});
	});
};





//Get customer by  id
customerModel.getCustomer = function (id, callback) {
	db.get(function (error, connection) {
		if (error) callback(error, null);
		var sql = 'SELECT * FROM ' + tableModel + ' WHERE id = ' + connection.escape(id);
		connection.query(sql, function (error, row) {
			if (error)
				callback(error, null);
			else
				callback(null, row);
		});
	});
};

//Get customer by name
customerModel.getCustomerName = function (name, callback) {
	db.get(function (error, connection) {
		if (error) callback(error, null);
		var sql = 'SELECT * FROM ' + tableModel + ' WHERE name like  "%' + connection.escape(name) + '%"';
		connection.query(sql, function (error, row) {
			if (error)
				callback(error, null);
			else
				callback(null, row);
		});
	});
};

//Update customer
customerModel.updateCustomer = function (customerData, callback) {

	db.get(function (error, connection) {
		if (error) callback(error, null);
		var sql = 'UPDATE ' + tableModel + ' SET name = ' + connection.escape(customerData.name) + ',' +
			'email = ' + connection.escape(customerData.email) + ',' +
			'address = ' + connection.escape(customerData.address) + ',' +
			'CIF = ' + connection.escape(customerData.cif) + ',' +
			'telephone = ' + connection.escape(customerData.telephone) + ',' +
			'web = ' + connection.escape(customerData.web) + 
			' WHERE id = ' + customerData.id;
		connection.query(sql, function (error, result) {
			if (error) {
				callback(error, null);
			}
			else {
				callback(null, { "result": true });
			}
		});
	});
};

//Remove customer with id to remove
customerModel.deleteCustomer = function (id, callback) {
	db.get(function (error, connection) {
		if (error) callback(error, null);
		var sqlExists = 'SELECT * FROM ' + tableModel + ' WHERE id = ' + connection.escape(id);
		connection.query(sqlExists, function (error, row) {
			//If exists Id from customer to remove
			if (row) {
				db.get(function (error, connection) {
					var sql = 'DELETE FROM ' + tableModel + ' WHERE id = ' + connection.escape(id);
					connection.query(sql, function (error, result) {
						if (error) {
							callback(error, null);
						}
						else {
							callback(null, { "result": true });
						}
					});
				});
			}
			else {
				callback(null, { "result": false });
			}
		});
	});
};

//Export the object
module.exports = customerModel;