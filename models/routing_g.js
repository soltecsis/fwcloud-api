var db = require('../db.js');


//creamos un objeto para ir almacenando todo lo que necesitemos
var routing_gModel = {};
var tableModel = "routing_g";


//obtenemos todos los routing_g por firewall
routing_gModel.getRouting_gs = function (idfirewall, callback) {

    db.get(function (error, connection) {
        if (error)
            return done('Database problem');
        var sql = 'SELECT * FROM ' + tableModel + ' WHERE firewall=' + connection.escape(idfirewall) + ' ORDER BY id';
        connection.query(sql, function (error, rows) {
            if (error)
                callback(error, null);
            else
                callback(null, rows);
        });
    });
};

//obtenemos todos los routing_g por firewall y grupo padre
routing_gModel.getRouting_gs_group = function (idfirewall, idgroup, callback) {

    db.get(function (error, connection) {
        if (error)
            return done('Database problem');
        var sql = 'SELECT * FROM ' + tableModel + ' WHERE firewall=' + connection.escape(idfirewall) + ' AND idgroup=' + connection.escape(idgroup) +  ' ORDER BY id';
        connection.query(sql, function (error, rows) {
            if (error)
                callback(error, null);
            else
                callback(null, rows);
        });
    });
};



//obtenemos un routing_g por su id y routing_g
routing_gModel.getRouting_g = function (idfirewall, id, callback) {
    db.get(function (error, connection) {
        if (error)
            return done('Database problem');
        var sql = 'SELECT * FROM ' + tableModel + ' WHERE id = ' + connection.escape(id) + ' AND firewall=' + connection.escape(idfirewall);
        connection.query(sql, function (error, row) {
            if (error)
                callback(error, null);
            else
                callback(null, row);
        });
    });
};

//obtenemos un routing por su nombre y routing_g
routing_gModel.getRouting_gName = function (idfirewall, name, callback) {
    db.get(function (error, connection) {
        if (error)
            return done('Database problem');
        var namesql = '%' + name + '%';
        var sql = 'SELECT * FROM ' + tableModel + ' WHERE name like  ' + connection.escape(namesql) + ' AND  firewall=' + connection.escape(idfirewall);
        console.log(sql);
        connection.query(sql, function (error, row) {
            if (error)
                callback(error, null);
            else
                callback(null, row);
        });
    });
};



//añadir un nuevo routing_g de usuario
routing_gModel.insertRouting_g = function (routing_gData, callback) {
    db.get(function (error, connection) {
        if (error)
            return done('Database problem');
        connection.query('INSERT INTO ' + tableModel + ' SET ?', routing_gData, function (error, result) {
            if (error) {
                callback(error, null);
            } else {
                //devolvemos la última id insertada
                callback(null, {"insertId": result.insertId});
            }
        });
    });
};

//actualizar un routing_g de usuario
routing_gModel.updateRouting_g = function ( routing_gData, callback) {

    db.get(function (error, connection) {
        if (error)
            return done('Database problem');
        var sql = 'UPDATE ' + tableModel + ' SET name = ' + connection.escape(routing_gData.name) + ',' +
                'firewall = ' + connection.escape(routing_gData.firewall) + ',' +
                'idgroup = ' + connection.escape(routing_gData.idgroup) + ',' +
                'comment = ' + connection.escape(routing_gData.comment) + ' ' +
                ' WHERE id = ' + routing_gData.id;
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

//eliminar un routing_g pasando la id a eliminar
//FALTA BORRADO EN CASCADA ROUTING_R
routing_gModel.deleteRouting_g = function (idfirewall, id, callback) {
    db.get(function (error, connection) {
        if (error)
            return done('Database problem');
        var sqlExists = 'SELECT * FROM ' + tableModel + '  WHERE id = ' + connection.escape(id) + ' AND firewall=' +  connection.escape(idfirewall);
        connection.query(sqlExists, function (error, row) {
            //si existe la id del routing_g a eliminar
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

//exportamos el objeto para tenerlo disponible en la zona de rutas
module.exports = routing_gModel;