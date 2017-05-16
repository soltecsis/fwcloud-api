var db = require('../db.js');


//creamos un objeto para ir almacenando todo lo que necesitemos
var policy_gModel = {};
var tableModel = "policy_g";


//obtenemos todos los policy_g por firewall
policy_gModel.getPolicy_gs = function (idfirewall, callback) {

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

//obtenemos todos los policy_g por firewall y grupo padre
policy_gModel.getPolicy_gs_group = function (idfirewall, idgroup, callback) {

    db.get(function (error, connection) {
        if (error)
            return done('Database problem');
        var sql = 'SELECT * FROM ' + tableModel + ' WHERE firewall=' + connection.escape(idfirewall) + ' AND idgroup=' + connection.escape(idgroup) + ' ORDER BY id';
        connection.query(sql, function (error, rows) {
            if (error)
                callback(error, null);
            else
                callback(null, rows);
        });
    });
};



//obtenemos un policy_g por su id y firewall
policy_gModel.getPolicy_g = function (idfirewall, id, callback) {
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

//obtenemos un routing por su nombre y firewall
policy_gModel.getPolicy_gName = function (idfirewall, name, callback) {
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



//añadir un nuevo policy_g de usuario
policy_gModel.insertPolicy_g = function (policy_gData, callback) {
    db.get(function (error, connection) {
        if (error)
            return done('Database problem');
        connection.query('INSERT INTO ' + tableModel + ' SET ?', policy_gData, function (error, result) {
            if (error) {
                callback(error, null);
            } else {
                //devolvemos la última id insertada
                callback(null, {"insertId": result.insertId});
            }
        });
    });
};

//actualizar un policy_g de usuario
policy_gModel.updatePolicy_g = function ( policy_gData, callback) {

    db.get(function (error, connection) {
        if (error)
            return done('Database problem');
        var sql = 'UPDATE ' + tableModel + ' SET name = ' + connection.escape(policy_gData.name) + ',' +
                'firewall = ' + connection.escape(policy_gData.firewall) + ',' +
                'comment = ' + connection.escape(policy_gData.comment) + ' ' +
                ' WHERE id = ' + policy_gData.id;
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

//eliminar un policy_g pasando la id a eliminar
//FALTA BORRADO EN CASCADA 
policy_gModel.deletePolicy_g = function (idfirewall, id, callback) {
    db.get(function (error, connection) {
        if (error)
            return done('Database problem');
        var sqlExists = 'SELECT * FROM ' + tableModel + '  WHERE id = ' + connection.escape(id) + ' AND firewall=' +  connection.escape(idfirewall);
        connection.query(sqlExists, function (error, row) {
            //si existe la id del policy_g a eliminar
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
module.exports = policy_gModel;