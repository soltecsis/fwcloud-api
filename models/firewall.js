var db = require('../db.js');


//creamos un objeto para ir almacenando todo lo que necesitemos
var firewallModel = {};
var tableModel = "firewall";


//obtenemos todos los firewall por usuario
firewallModel.getFirewalls = function (iduser, callback) {

    db.get(function (error, connection) {
        if (error)
            return done('Database problem');
        var sql = 'SELECT T.* FROM ' + tableModel + ' T INNER JOIN user__firewall U ON T.id=U.id_firewall AND U.id_user=' + connection.escape(iduser) + ' ORDER BY id';
        console.log(sql);
        connection.query(sql, function (error, rows) {
            if (error)
                callback(error, null);
            else
                callback(null, rows);
        });
    });
};





//obtenemos un firewall por su id y usuario
firewallModel.getFirewall = function (iduser, id, callback) {
    db.get(function (error, connection) {
        if (error)
            return done('Database problem');
        var sql = 'SELECT T.* FROM ' + tableModel + ' T INNER JOIN user__firewall U ON T.id=U.id_firewall AND U.id_user=' + connection.escape(iduser) + ' WHERE id = ' + connection.escape(id);
        connection.query(sql, function (error, row) {
            if (error)
                callback(error, null);
            else
                callback(null, row);
        });
    });
};

//obtenemos un firewall por su nombre y usuario
firewallModel.getFirewallName = function (iduser, name, callback) {
    db.get(function (error, connection) {
        if (error)
            return done('Database problem');
        var namesql = '%' + name + '%';
        var sql = 'SELECT T.* FROM ' + tableModel + ' T INNER JOIN user__firewall U ON T.id=U.id_firewall AND U.id_user=' + connection.escape(iduser) + ' WHERE name like  ' + connection.escape(namesql) + '';
        console.log(sql);
        connection.query(sql, function (error, row) {
            if (error)
                callback(error, null);
            else
                callback(null, row);
        });
    });
};

//obtenemos un firewall por cluster y usuario
firewallModel.getFirewallCluster = function (iduser, idcluster, callback) {
    db.get(function (error, connection) {
        if (error)
            return done('Database problem');        
        var sql = 'SELECT T.* FROM ' + tableModel + ' T INNER JOIN user__firewall U ON T.id=U.id_firewall AND U.id_user=' + connection.escape(iduser) + ' WHERE cluster =  ' + connection.escape(idcluster) + '';
        console.log(sql);
        connection.query(sql, function (error, row) {
            if (error)
                callback(error, null);
            else
                callback(null, row);
        });
    });
};

//añadir un nuevo firewall de usuario
firewallModel.insertFirewall = function (iduser, firewallData, callback) {
    db.get(function (error, connection) {
        if (error)
            return done('Database problem');
        connection.query('INSERT INTO ' + tableModel + ' SET ?', firewallData, function (error, result) {
            if (error) {
                callback(error, null);
            } else {
                var fwid=result.insertId;
                connection.query('INSERT INTO  user__firewall  SET id_firewall=' +  connection.escape(fwid) + ' , id_user=' +  connection.escape(iduser), function (error, result) {
                    if (error) {
                        callback(error, null);
                    } else {
                        //devolvemos la última id insertada
                        callback(null, {"insertId": fwid});
                    }
                });
            }
        });
    });
};

//actualizar un firewall de usuario
firewallModel.updateFirewall = function (iduser, firewallData, callback) {

    db.get(function (error, connection) {
        if (error)
            return done('Database problem');
        var sql = 'UPDATE ' + tableModel + ' SET name = ' + connection.escape(firewallData.name) + ',' +
                'cluster = ' + connection.escape(firewallData.cluster) + ',' +
                'user = ' + connection.escape(firewallData.user) + ',' +
                'comment = ' + connection.escape(firewallData.comment) + ' ' +
                ' WHERE id = ' + firewallData.id;
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

//eliminar un firewall pasando la id a eliminar
firewallModel.deleteFirewall = function (iduser, id, callback) {
    db.get(function (error, connection) {
        if (error)
            return done('Database problem');
        var sqlExists = 'SELECT T.* FROM ' + tableModel + ' T INNER JOIN user__firewall U ON T.id=U.id_firewall AND U.id_user=' + connection.escape(iduser) + ' WHERE id = ' + connection.escape(id);
        connection.query(sqlExists, function (error, row) {
            //si existe la id del firewall a eliminar
            if (row) {
                db.get(function (error, connection) {
                    var sql = 'DELETE FROM ' + tableModel + ' WHERE id = ' + connection.escape(id);
                    connection.query(sql, function (error, result) {
                        if (error) {
                            callback(error, null);
                        } else {
                            var sql = 'DELETE FROM use_firewall WHERE id_firewall = ' + connection.escape(id) + ' AND id_user=' + connection.escape(iduser);
                            connection.query(sql, function (error, result) {
                                if (error) {
                                    callback(error, null);
                                } else {
                                    callback(null, {"msg": "deleted"});
                                }
                            });
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
module.exports = firewallModel;