var db = require('../../db.js');


//create object
var ipobj_typeModel = {};
var tableModel="ipobj_type";


var logger = require('log4js').getLogger("app");

//Get All ipobj_type
ipobj_typeModel.getIpobj_types = function (callback) {

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





//Get ipobj_type by  id
ipobj_typeModel.getIpobj_type = function (id, callback) {
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

//Get ipobj_type by name
ipobj_typeModel.getIpobj_typeName = function (name, callback) {
    db.get(function (error, connection) {
        if (error) callback(error, null);
        var namesql = '%' + name + '%';
        var sql = 'SELECT * FROM ' + tableModel + ' WHERE type like  ' + connection.escape(namesql) ;
        connection.query(sql, function (error, row) {
            if (error)
                callback(error, null);
            else
                callback(null, row);
        });
    });
};



//Add new ipobj_type
ipobj_typeModel.insertIpobj_type = function (ipobj_typeData, callback) {
    db.get(function (error, connection) {
        if (error) callback(error, null);
        connection.query('INSERT INTO ' + tableModel + ' SET ?', ipobj_typeData, function (error, result) {
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

//Update ipobj_type
ipobj_typeModel.updateIpobj_type = function (ipobj_typeData, callback) {

    db.get(function (error, connection) {
        if (error) callback(error, null);
        var sql = 'UPDATE ' + tableModel + ' SET type = ' + connection.escape(ipobj_typeData.type) + ' ' +            
            ' WHERE id = ' + ipobj_typeData.id;
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

//Remove ipobj_type with id to remove
ipobj_typeModel.deleteIpobj_type = function (id, callback) {
    db.get(function (error, connection) {
        if (error) callback(error, null);
        var sqlExists = 'SELECT * FROM ' + tableModel + ' WHERE id = ' + connection.escape(id);
        connection.query(sqlExists, function (error, row) {
            //If exists Id from ipobj_type to remove
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
module.exports = ipobj_typeModel;