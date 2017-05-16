var db = require('../db.js');


//creamos un objeto para ir almacenando todo lo que necesitemos
var routing_positionModel = {};
var tableModel="routing_position";


//obtenemos todos los routing_position
routing_positionModel.getRouting_positions = function (callback) {

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





//obtenemos un routing_position por su id
routing_positionModel.getRouting_position = function (id, callback) {
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

//obtenemos un routing_position por su nombre
routing_positionModel.getRouting_positionName = function (name, callback) {
    db.get(function (error, connection) {
        if (error) return done('Database problem');
        var namesql = '%' + name + '%';
        var sql = 'SELECT * FROM ' + tableModel + ' WHERE name like  ' + connection.escape(namesql) ;
        connection.query(sql, function (error, row) {
            if (error)
                callback(error, null);
            else
                callback(null, row);
        });
    });
};



//añadir un nuevo routing_position
routing_positionModel.insertRouting_position = function (routing_positionData, callback) {
    db.get(function (error, connection) {
        if (error) return done('Database problem');
        connection.query('INSERT INTO ' + tableModel + ' SET ?', routing_positionData, function (error, result) {
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

//actualizar un routing_position
routing_positionModel.updateRouting_position = function (routing_positionData, callback) {

    db.get(function (error, connection) {
        if (error) return done('Database problem');
        var sql = 'UPDATE ' + tableModel + ' SET name = ' + connection.escape(routing_positionData.name) + ' ' +            
            ' WHERE id = ' + routing_positionData.id;
            console.log(sql);
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

//eliminar un routing_position pasando la id a eliminar
routing_positionModel.deleteRouting_position = function (id, callback) {
    db.get(function (error, connection) {
        if (error) return done('Database problem');
        var sqlExists = 'SELECT * FROM ' + tableModel + ' WHERE id = ' + connection.escape(id);
        connection.query(sqlExists, function (error, row) {
            //si existe la id del routing_position a eliminar
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
module.exports = routing_positionModel;