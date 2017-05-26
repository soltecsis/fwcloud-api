var db = require('../db.js');


//create object
var macModel = {};
var tableModel = "mac";


//Get All interface by interface
macModel.getMacs = function (interface, callback) {

    db.get(function (error, connection) {
        if (error)
            return done('Database problem');
        var sql = 'SELECT * FROM ' + tableModel + ' WHERE interface=' + connection.escape(interface) + ' ORDER BY id';
        connection.query(sql, function (error, rows) {
            if (error)
                callback(error, null);
            else
                callback(null, rows);
        });
    });
};





//Get interface by  id and interface
macModel.getMac = function (interface, id, callback) {
    db.get(function (error, connection) {
        if (error)
            return done('Database problem');
        var sql = 'SELECT * FROM ' + tableModel + ' WHERE id = ' + connection.escape(id) + ' AND interface=' + connection.escape(interface);
        connection.query(sql, function (error, row) {
            if (error)
                callback(error, null);
            else
                callback(null, row);
        });
    });
};

//Get routing by name and interface
macModel.getMacName = function (interface, name, callback) {
    db.get(function (error, connection) {
        if (error)
            return done('Database problem');
        var namesql = '%' + name + '%';
        var sql = 'SELECT * FROM ' + tableModel + ' WHERE name like  ' + connection.escape(namesql) + ' AND  interface=' + connection.escape(interface);
        console.log(sql);
        connection.query(sql, function (error, row) {
            if (error)
                callback(error, null);
            else
                callback(null, row);
        });
    });
};

//Get routing by  address and interface
macModel.getMacAddress = function (interface, address, callback) {
    db.get(function (error, connection) {
        if (error)
            return done('Database problem');
        var addresssql = '%' + address + '%';
        var sql = 'SELECT * FROM ' + tableModel + ' WHERE address like  ' + connection.escape(addresssql) + ' AND  interface=' + connection.escape(interface);
        console.log(sql);
        connection.query(sql, function (error, row) {
            if (error)
                callback(error, null);
            else
                callback(null, row);
        });
    });
};



//Add new interface from user
macModel.insertMac = function (interfaceData, callback) {
    db.get(function (error, connection) {
        if (error)
            return done('Database problem');
        connection.query('INSERT INTO ' + tableModel + ' SET ?', interfaceData, function (error, result) {
            if (error) {
                callback(error, null);
            } else {
                //devolvemos la última id insertada
                callback(null, {"insertId": result.insertId});
            }
        });
    });
};

//Update interface from user
macModel.updateMac = function ( interfaceData, callback) {

    db.get(function (error, connection) {
        if (error)
            return done('Database problem');
        var sql = 'UPDATE ' + tableModel + ' SET name = ' + connection.escape(interfaceData.name) + ',' +
                'interface = ' + connection.escape(interfaceData.interface) + ',' +
                'address = ' + connection.escape(interfaceData.address) + ' ' +
                'comment = ' + connection.escape(interfaceData.comment) + ' ' +
                ' WHERE id = ' + interfaceData.id;
        console.log(sql);
        connection.query(sql, function (error, result) {
            if (error) {
                callback(error, null);
            } else {
                callback(null, {"msg": "success"});
            }
        });
    });
};

//Remove interface with id to remove
//FALTA BORRADO EN CASCADA ROUTING_R
macModel.deleteMac = function (interface, id, callback) {
    db.get(function (error, connection) {
        if (error)
            return done('Database problem');
        var sqlExists = 'SELECT * FROM ' + tableModel + '  WHERE id = ' + connection.escape(id) + ' AND interface=' +  connection.escape(interface);
        connection.query(sqlExists, function (error, row) {
            //If exists Id from interface to remove
            if (row) {
                db.get(function (error, connection) {
                    var sql = 'DELETE FROM ' + tableModel + ' WHERE id = ' + connection.escape(id);
                    connection.query(sql, function (error, result) {
                        if (error) {
                            callback(error, null);
                        } else {
                            callback(null, {"msg": "deleted"});
                        }
                    });
                });
            } else {
                callback(null, {"msg": "notExist"});
            }
        });
    });
};

//Export the object
module.exports = macModel;