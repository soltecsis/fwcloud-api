//create object
var customerModel = {};
var tableModel="customer";

//Add new customer
customerModel.insertCustomer = req => {
	return new Promise(async (resolve, reject) => {
		//New object with customer data
		var customerData = {
			id: null,
			name: req.body.name,
			email: req.body.email,
			address: req.body.address,
			cif: req.body.cif,
			telephone: req.body.telephone,
			web: req.body.web
		};

		req.dbCon.query(`INSERT INTO ${tableModel} SET ?`, customerData, (error, result) => {			
			if (error) return reject(error);
			resolve(result.insertId);
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