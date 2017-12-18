var db = require('../db.js');


//create object
var policy_gModel = {};
var tableModel = "policy_g";


var logger = require('log4js').getLogger("app");

//Get All policy_g by firewall
policy_gModel.getPolicy_gs = function (idfirewall, callback) {

    db.get(function (error, connection) {
        if (error)
            callback(error, null);
        var sql = 'SELECT * FROM ' + tableModel + ' WHERE firewall=' + connection.escape(idfirewall) + ' ORDER BY id';
        connection.query(sql, function (error, rows) {
            if (error)
                callback(error, null);
            else
                callback(null, rows);
        });
    });
};

//Get All policy_g by firewall and group father
policy_gModel.getPolicy_gs_group = function (idfirewall, idgroup, callback) {

    db.get(function (error, connection) {
        if (error)
            callback(error, null);
        var sql = 'SELECT * FROM ' + tableModel + ' WHERE firewall=' + connection.escape(idfirewall) + ' AND idgroup=' + connection.escape(idgroup) + ' ORDER BY id';
        connection.query(sql, function (error, rows) {
            if (error)
                callback(error, null);
            else
                callback(null, rows);
        });
    });
};



//Get policy_g by  id and firewall
policy_gModel.getPolicy_g = function (idfirewall, id, callback) {
    db.get(function (error, connection) {
        if (error)
            callback(error, null);
        var sql = 'SELECT * FROM ' + tableModel + ' WHERE id = ' + connection.escape(id) + ' AND firewall=' + connection.escape(idfirewall);
        connection.query(sql, function (error, row) {
            if (error)
                callback(error, null);
            else
                callback(null, row);
        });
    });
};

//Get routing by name and firewall
policy_gModel.getPolicy_gName = function (idfirewall, name, callback) {
    db.get(function (error, connection) {
        if (error)
            callback(error, null);
        var namesql = '%' + name + '%';
        var sql = 'SELECT * FROM ' + tableModel + ' WHERE name like  ' + connection.escape(namesql) + ' AND  firewall=' + connection.escape(idfirewall);
        logger.debug(sql);
        connection.query(sql, function (error, row) {
            if (error)
                callback(error, null);
            else
                callback(null, row);
        });
    });
};



//Add new policy_g from user
policy_gModel.insertPolicy_g = function (policy_gData, callback) {
    db.get(function (error, connection) {
        if (error)
            callback(error, null);
        var sqlExists = 'SELECT * FROM ' + tableModel + '  WHERE id = ' + connection.escape(policy_gData.id) + ' AND firewall=' + connection.escape(policy_gData.firewall);
        logger.debug(sqlExists);
        connection.query(sqlExists, function (error, row) {                        
            if (row &&  row.length>0) {
                logger.debug("GRUPO Existente: " + policy_gData.id );
                callback(null, {"insertId": policy_gData.id});

            } else {
                sqlInsert='INSERT INTO ' + tableModel + ' SET firewall=' + policy_gData.firewall + ", name=" +  connection.escape(policy_gData.name) + ", comment=" + connection.escape(policy_gData.comment);
                connection.query(sqlInsert, function (error, result) {
                    if (error) {
                        callback(error, null);
                    } else {
                        //devolvemos la última id insertada
                        logger.debug("CREADO nuevo GRUPO: " + result.insertId );
                        callback(null, {"insertId": result.insertId});
                    }
                });
            }
        });
    });
};

//Update policy_g from user
policy_gModel.updatePolicy_g = function (policy_gData, callback) {

    db.get(function (error, connection) {
        if (error)
            callback(error, null);
        var sql = 'UPDATE ' + tableModel + ' SET name = ' + connection.escape(policy_gData.name) + ',' +
                'firewall = ' + connection.escape(policy_gData.firewall) + ',' +
                'comment = ' + connection.escape(policy_gData.comment) + ' ' +
                ' WHERE id = ' + policy_gData.id;
        logger.debug(sql);
        connection.query(sql, function (error, result) {
            if (error) {
                callback(error, null);
            } else {
                callback(null, {"result": true});
            }
        });
    });
};

//Remove policy_g with id to remove
//FALTA BORRADO EN CASCADA 
policy_gModel.deletePolicy_g = function (idfirewall, id, callback) {
    db.get(function (error, connection) {
        if (error)
            callback(error, null);
        var sqlExists = 'SELECT * FROM ' + tableModel + '  WHERE id = ' + connection.escape(id) + ' AND firewall=' + connection.escape(idfirewall);
        connection.query(sqlExists, function (error, row) {
            //If exists Id from policy_g to remove
            if (row) {
                db.get(function (error, connection) {
                    var sql = 'DELETE FROM ' + tableModel + ' WHERE id = ' + connection.escape(id);
                    connection.query(sql, function (error, result) {
                        if (error) {
                            callback(error, null);
                        } else {
                            callback(null, {"result": true, "msg": "deleted"});
                        }
                    });
                });
            } else {
                callback(null, {"result": false});
            }
        });
    });
};

//Export the object
module.exports = policy_gModel;