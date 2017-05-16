var db = require('../db.js');


//creamos un objeto para ir almacenando todo lo que necesitemos
var customerModel = {};
var tableModel="customer";


//obtenemos todos los customer
customerModel.getCustomers = function (callback) {

    db.get(function (error, connection) {
        if (error) return done('Database problem');
        connection.query('SELECT * FROM ' + tableModel + ' ORDER BY id', function (error, rows) {
            if (error)
                callback(error, null);
            else
                callback(null, rows);
        });
    });
};





//obtenemos un customer por su id
customerModel.getCustomer = function (id, callback) {
    db.get(function (error, connection) {
        if (error) return done('Database problem');
        var sql = 'SELECT * FROM ' + tableModel + ' WHERE id = ' + connection.escape(id);
        connection.query(sql, function (error, row) {
            if (error)
                callback(error, null);
            else
                callback(null, row);
        });
    });
};

//obtenemos un customer por su nombre
customerModel.getCustomerName = function (name, callback) {
    db.get(function (error, connection) {
        if (error) return done('Database problem');
        var sql = 'SELECT * FROM ' + tableModel + ' WHERE name like  "%' + connection.escape(name) + '%"';
        connection.query(sql, function (error, row) {
            if (error)
                callback(error, null);
            else
                callback(null, row);
        });
    });
};

//añadir un nuevo customer
customerModel.insertCustomer = function (customerData, callback) {
    db.get(function (error, connection) {
        if (error) return done('Database problem');
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

//actualizar un customer
customerModel.updateCustomer = function (customerData, callback) {

    db.get(function (error, connection) {
        if (error) return done('Database problem');
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
                callback(null, { "msg": "success" });
            }
        });
    });
};

//eliminar un customer pasando la id a eliminar
customerModel.deleteCustomer = function (id, callback) {
    db.get(function (error, connection) {
        if (error) return done('Database problem');
        var sqlExists = 'SELECT * FROM ' + tableModel + ' WHERE id = ' + connection.escape(id);
        connection.query(sqlExists, function (error, row) {
            //si existe la id del customer a eliminar
            if (row) {
                db.get(function (error, connection) {
                    var sql = 'DELETE FROM ' + tableModel + ' WHERE id = ' + connection.escape(id);
                    connection.query(sql, function (error, result) {
                        if (error) {
                            callback(error, null);
                        }
                        else {
                            callback(null, { "msg": "deleted" });
                        }
                    });
                });
            }
            else {
                callback(null, { "msg": "notExist" });
            }
        });
    });
};

//exportamos el objeto para tenerlo disponible en la zona de rutas
module.exports = customerModel;