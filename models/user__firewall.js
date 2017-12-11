var db = require('../db.js');


//create object
var user__firewallModel = {};


var logger = require('log4js').getLogger("app");

//Get All firewalls from user and cloud
user__firewallModel.getUser__firewalls = function (id_user, fwcloud, access, callback) {

    db.get(function (error, connection) {
        if (error) callback(error, null);
        var sql= 'SELECT * FROM user__firewall U inner join firewall F on F.id=U.id_firewall ' + 
                ' WHERE U.id_user=' + connection.escape(id_user) + ' AND F.fwcloud=' + connection.escape(fwcloud) +
                ' AND U.allow_access=' +  connection.escape(access)  +  
                ' ORDER BY F.name';
        logger.debug(sql);
        connection.query(sql, function (error, rows) {
            if (error)
                callback(error, null);
            else
                callback(null, rows);
        });
    });
};

//Get firewall from user an firewall id
user__firewallModel.getUser__firewall = function (id_user, fwcloud, idfirewall, access, callback) {

    db.get(function (error, connection) {
        if (error) callback(error, null);
        var sql= 'SELECT * FROM user__firewall U inner join firewall F on F.id=U.id_firewall ' + 
                ' WHERE U.id_user=' + connection.escape(id_user) + ' AND F.fwcloud=' + connection.escape(fwcloud) +
                ' AND U.allow_access=' +  connection.escape(access)  +  ' AND F.id=' + connection.escape(idfirewall) +
                ' ORDER BY F.name';
        logger.debug(sql);
        connection.query(sql, function (error, rows) {
            if (error)
                callback(error, null);
            else
                callback(null, rows);
        });
    });
};

//Get cloud list
user__firewallModel.getUser__firewall_clouds = function (id_user, callback) {

    db.get(function (error, connection) {
        if (error) callback(error, null);
        var sql= 'SELECT distinctrow C.id, C.name FROM user__firewall U ' + 
                ' inner join firewall F on F.id=U.id_firewall ' + 
                ' inner join fwcloud C On C.id=F.fwcloud ' +
                ' WHERE U.id_user=' + connection.escape(id_user) + 
                ' AND U.allow_access=1' + 
                ' ORDER BY C.name';                
        logger.debug(sql);
        connection.query(sql, function (error, rows) {
            if (error)
                callback(error, null);
            else
                callback(null, rows);
        });
    });
};



//Add new user
user__firewallModel.insertUser__firewall = function (user__firewallData, callback) {
    db.get(function (error, connection) {
        if (error) callback(error, null);
        connection.query('INSERT INTO user__firewall SET ?', user__firewallData, function (error, result) {
            if (error) {
                callback(error, null);
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
        if (error) callback(error, null);
        var sql = 'UPDATE user__firewall SET ' +
            'id_firewall = ' + connection.escape(user__firewallData.id_firewall) + ',' +
            'id_user = ' + connection.escape(user__firewallData.id_user) + ' ' +            
            'WHERE id_user = ' + connection.escape(user__firewallData.id_user) + 
            ' AND id_firewall='  + connection.escape(user__firewallData.id_firewall) ;
        connection.query(sql, function (error, result) {
            if (error) {
                callback(error, {"result": false});
            }
            else {
                callback(null, { "result": true });
            }
        });
    });
};

//Remove user with id to remove
user__firewallModel.deleteUser__firewall = function (id_user, id_firewall, callback) {
    db.get(function (error, connection) {
        if (error) callback(error, null);
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
                            callback(error, null);
                        }
                        else {
                            callback(null, { "result": true });
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