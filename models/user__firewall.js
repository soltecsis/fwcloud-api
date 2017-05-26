var db = require('../db.js');


//create object
var user__firewallModel = {};



//Get All firewall del user
user__firewallModel.getUser__firewalls = function (id_user, callback) {

    db.get(function (error, connection) {
        if (error) return done('Database problem');
        connection.query('SELECT * FROM user__firewall WHERE id_user=' + connection.escape(id_user) + ' ORDER BY id_firewall', function (error, rows) {
            if (error)
                callback(error, null);
            else
                callback(null, rows);
        });
    });
};

//Get by id
user__firewallModel.getUser__firewalls = function (id_user,id_firewall, callback) {

    db.get(function (error, connection) {
        if (error) return done('Database problem');
        connection.query('SELECT * FROM user__firewall WHERE id_user=' + connection.escape(id_user) + ' AND id_firewall=' + connection.escape(id_firewall), function (error, row) {
            if (error)
                callback(error, null);
            else
                callback(null, row);
        });
    });
};



//Add new user
user__firewallModel.insertUser__firewall = function (user__firewallData, callback) {
    db.get(function (error, connection) {
        if (error) return done('Database problem');
        connection.query('INSERT INTO user__firewall SET ?', user__firewallData, function (error, result) {
            if (error) {
                callback(error, {"error": "error"});
            }
            else {
                //devolvemos la última id insertada
                callback(null, { "insertId": "success" });
            }
        });
    });
};

//actualizar
user__firewallModel.updateUser__firewall = function (user__firewallData, callback) {

    db.get(function (error, connection) {
        if (error) return done('Database problem');
        var sql = 'UPDATE user__firewall SET ' +
            'id_firewall = ' + connection.escape(user__firewallData.id_firewall) + ',' +
            'id_user = ' + connection.escape(user__firewallData.id_user) + ' ' +            
            'WHERE id_user = ' + connection.escape(user__firewallData.id_user) + 
            ' AND id_firewall='  + connection.escape(user__firewallData.id_firewall) ;
        connection.query(sql, function (error, result) {
            if (error) {
                callback(error, {"error": error});
            }
            else {
                callback(null, { "msg": "success" });
            }
        });
    });
};

//Remove user with id to remove
user__firewallModel.deleteUser__firewall = function (id_user, id_firewall, callback) {
    db.get(function (error, connection) {
        if (error) return done('Database problem');
        var sqlExists = 'SELECT * FROM user__firewall WHERE id_user = ' + connection.escape(id_user) + 
            ' AND id_firewall='  + connection.escape(id_firewall) ;
        connection.query(sqlExists, function (error, row) {
            //If exists Id from user to remove
            if (row) {
                db.get(function (error, connection) {
                    var sql = 'DELETE FROM user__firewall  WHERE id_user = ' + connection.escape(id_user) + 
            ' AND id_firewall='  + connection.escape(id_firewall) ;
                    connection.query(sql, function (error, result) {
                        if (error) {
                            callback(error, {"error": "error"});
                        }
                        else {
                            callback(null, { "msg": "deleted" });
                        }
                    });
                });
            }
            else {
                callback(null, { "error": "notExist" });
            }
        });
    });
};

//Export the object
module.exports = user__firewallModel;