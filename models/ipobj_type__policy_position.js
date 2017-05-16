var db = require('../db.js');


//creamos un objeto para ir almacenando todo lo que necesitemos
var ipobj_type__policy_positionModel = {};
var tableModel="ipobj_type__policy_position";


//obtenemos todos los ipobj_type__policy_position
ipobj_type__policy_positionModel.getIpobj_type__policy_positions = function (callback) {

    db.get(function (error, connection) {
        if (error) return done('Database problem');
        connection.query('SELECT * FROM ' + tableModel + ' ORDER BY position', function (error, rows) {
            if (error)
                callback(error, null);
            else
                callback(null, rows);
        });
    });
};





//obtenemos un ipobj_type__policy_position por su id
ipobj_type__policy_positionModel.getIpobj_type__policy_position = function (type, position, callback) {
    db.get(function (error, connection) {
        if (error) return done('Database problem');
        var sql = 'SELECT * FROM ' + tableModel + ' WHERE type = ' + connection.escape(type) + ' position = ' + connection.escape(position);
        connection.query(sql, function (error, row) {
            if (error)
                callback(error, null);
            else
                callback(null, row);
        });
    });
};


//añadir un nuevo ipobj_type__policy_position
ipobj_type__policy_positionModel.insertIpobj_type__policy_position = function (ipobj_type__policy_positionData, callback) {
    db.get(function (error, connection) {
        if (error) return done('Database problem');
        connection.query('INSERT INTO ' + tableModel + ' SET ?', ipobj_type__policy_positionData, function (error, result) {
            if (error) {
                callback(error, null);
            }
            else {
                //devolvemos la última id insertada
                callback(null, { "insertId": 'success' });
            }
        });
    });
};

//actualizar un ipobj_type__policy_position
ipobj_type__policy_positionModel.updateIpobj_type__policy_position = function (ipobj_type__policy_positionData, callback) {

    db.get(function (error, connection) {
        if (error) return done('Database problem');
        var sql = 'UPDATE ' + tableModel + ' SET type = ' + connection.escape(ipobj_type__policy_positionData.type) + ' ' +            
            ' WHERE type = ' + connection.escape(ipobj_type__policy_positionData.type) + ' position = ' + connection.escape(ipobj_type__policy_positionData.position);
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

//eliminar un ipobj_type__policy_position pasando la id a eliminar
ipobj_type__policy_positionModel.deleteIpobj_type__policy_position = function (type, position, callback) {
    db.get(function (error, connection) {
        if (error) return done('Database problem');
        var sqlExists = 'SELECT * FROM ' + tableModel + ' WHERE type = ' + connection.escape(type) + ' position = ' + connection.escape(position);
        connection.query(sqlExists, function (error, row) {
            //si existe la id del ipobj_type__policy_position a eliminar
            if (row) {
                db.get(function (error, connection) {
                    var sql = 'DELETE FROM ' + tableModel + ' WHERE type = ' + connection.escape(type) + ' position = ' + connection.escape(position);
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
module.exports = ipobj_type__policy_positionModel;