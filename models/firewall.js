var db = require('../db.js');


//create object
var firewallModel = {};
var tableModel = "firewall";


//Get All firewall by user
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





//Get firewall by  id and user
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

//Get firewall by name and user
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

//Get firewall by cluster and user
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

//Add new firewall from user
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

//Update firewall from user
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

//Remove firewall with id to remove
firewallModel.deleteFirewall = function (iduser, id, callback) {
    db.get(function (error, connection) {
        if (error)
            return done('Database problem');
        var sqlExists = 'SELECT T.* FROM ' + tableModel + ' T INNER JOIN user__firewall U ON T.id=U.id_firewall AND U.id_user=' + connection.escape(iduser) + ' WHERE id = ' + connection.escape(id);
        connection.query(sqlExists, function (error, row) {
            //If exists Id from firewall to remove
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

//Export the object
module.exports = firewallModel;