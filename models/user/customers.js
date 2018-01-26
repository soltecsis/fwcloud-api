var db = require('../../db.js');


//create object
var customerModel = {};
var tableModel="customer";


var logger = require('log4js').getLogger("app");

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

//Add new customer
customerModel.insertCustomer = function (customerData, callback) {
    db.get(function (error, connection) {
        if (error) callback(error, null);
        connection.query('INSERT INTO ' + tableModel + ' SET ?', customerData, function (error, result) {
            if (error) {
                callback(error, null);
            }
            else {
                //devolvemos la última id insertada
                callback(null, { "insertId": result.insertId });
            }
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