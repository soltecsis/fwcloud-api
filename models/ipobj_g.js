var db = require('../db.js');


//create object
var ipobj_gModel = {};
var tableModel="ipobj_g";

/**
* Property Logger to manage App logs
*
* @property logger
* @type log4js/app
* 
*/
var logger = require('log4js').getLogger("app");

//Get All ipobj_g
ipobj_gModel.getIpobj_gs = function (fwcloud,callback) {

    db.get(function (error, connection) {
        if (error) return done('Database problem');
        connection.query('SELECT * FROM ' + tableModel + ' WHERE fwcloud= ' + connection.escape(fwcloud) + ' ORDER BY id', function (error, rows) {
            if (error)
                callback(error, null);
            else
                callback(null, rows);
        });
    });
};





//Get ipobj_g by  id
ipobj_gModel.getIpobj_g = function (fwcloud,id, callback) {
    db.get(function (error, connection) {
        if (error) return done('Database problem');
        var sql = 'SELECT * FROM ' + tableModel + ' WHERE id = ' + connection.escape(id) + ' AND  fwcloud= ' + connection.escape(fwcloud) ;
        connection.query(sql, function (error, row) {
            if (error)
                callback(error, null);
            else
                callback(null, row);
        });
    });
};

//Get ipobj_g by name
ipobj_gModel.getIpobj_gName = function (fwcloud,name, callback) {
    db.get(function (error, connection) {
        if (error) return done('Database problem');
        var namesql = '%' + name + '%';
        var sql = 'SELECT * FROM ' + tableModel + ' WHERE name like  ' + connection.escape(namesql) + ' AND  fwcloud= ' + connection.escape(fwcloud) ;
        connection.query(sql, function (error, row) {
            if (error)
                callback(error, null);
            else
                callback(null, row);
        });
    });
};

//Get ipobj_g by  tipo
ipobj_gModel.getIpobj_gType = function (fwcloud,type, callback) {
    db.get(function (error, connection) {
        if (error) return done('Database problem');
        var sql = 'SELECT * FROM ' + tableModel + ' WHERE type =  ' + connection.escape(type) + ' AND  fwcloud= ' + connection.escape(fwcloud) ;
        connection.query(sql, function (error, row) {
            if (error)
                callback(error, null);
            else
                callback(null, row);
        });
    });
};

//Add new ipobj_g
ipobj_gModel.insertIpobj_g = function (ipobj_gData, callback) {
    db.get(function (error, connection) {
        if (error) return done('Database problem');
        connection.query('INSERT INTO ' + tableModel + ' SET ?', ipobj_gData, function (error, result) {
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

//Update ipobj_g
ipobj_gModel.updateIpobj_g = function (ipobj_gData, callback) {

    db.get(function (error, connection) {
        if (error) return done('Database problem');
        var sql = 'UPDATE ' + tableModel + ' SET name = ' + connection.escape(ipobj_gData.name) + ' ' +
            ' ,type = ' + connection.escape(ipobj_gData.type) + ',' +    
            ' ,fwcloud = ' + connection.escape(ipobj_gData.fwcloud) + ' ' +    
            ' WHERE id = ' + ipobj_gData.id;
            
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

//Remove ipobj_g with id to remove
ipobj_gModel.deleteIpobj_g = function (id, callback) {
    db.get(function (error, connection) {
        if (error) return done('Database problem');
        var sqlExists = 'SELECT * FROM ' + tableModel + ' WHERE id = ' + connection.escape(id);
        connection.query(sqlExists, function (error, row) {
            //If exists Id from ipobj_g to remove
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

//Export the object
module.exports = ipobj_gModel;