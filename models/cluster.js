var db = require('../db.js');


//creamos un objeto para ir almacenando todo lo que necesitemos
var clusterModel = {};
var tableModel="cluster";


//obtenemos todos los cluster
clusterModel.getClusters = function (callback) {

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





//obtenemos un cluster por su id
clusterModel.getCluster = function (id, callback) {
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

//obtenemos un cluster por su nombre
clusterModel.getClusterName = function (name, callback) {
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

//añadir un nuevo cluster
clusterModel.insertCluster = function (clusterData, callback) {
    db.get(function (error, connection) {
        if (error) return done('Database problem');
        connection.query('INSERT INTO ' + tableModel + ' SET ?', clusterData, function (error, result) {
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

//actualizar un cluster
clusterModel.updateCluster = function (clusterData, callback) {

    db.get(function (error, connection) {
        if (error) return done('Database problem');
        var sql = 'UPDATE ' + tableModel + ' SET name = ' + connection.escape(clusterData.name) + ' ' +
            ' WHERE id = ' + clusterData.id;
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

//eliminar un cluster pasando la id a eliminar
clusterModel.deleteCluster = function (id, callback) {
    db.get(function (error, connection) {
        if (error) return done('Database problem');
        var sqlExists = 'SELECT * FROM ' + tableModel + ' WHERE id = ' + connection.escape(id);
        connection.query(sqlExists, function (error, row) {
            //si existe la id del cluster a eliminar
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
module.exports = clusterModel;