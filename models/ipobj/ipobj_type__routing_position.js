var db = require('../../db.js');


//create object
var ipobj_type__routing_positionModel = {};
var tableModel="ipobj_type__routing_position";


var logger = require('log4js').getLogger("app");

//Get All ipobj_type__routing_position
ipobj_type__routing_positionModel.getIpobj_type__routing_positions = function (callback) {

    db.get(function (error, connection) {
        if (error) callback(error, null);
        connection.query('SELECT * FROM ' + tableModel + ' ORDER BY position', function (error, rows) {
            if (error)
                callback(error, null);
            else
                callback(null, rows);
        });
    });
};





//Get ipobj_type__routing_position by  id
ipobj_type__routing_positionModel.getIpobj_type__routing_position = function (type, position, callback) {
    db.get(function (error, connection) {
        if (error) callback(error, null);
        var sql = 'SELECT * FROM ' + tableModel + ' WHERE type = ' + connection.escape(type) + ' position = ' + connection.escape(position);
        connection.query(sql, function (error, row) {
            if (error)
                callback(error, null);
            else
                callback(null, row);
        });
    });
};


//Add new ipobj_type__routing_position
ipobj_type__routing_positionModel.insertIpobj_type__routing_position = function (ipobj_type__routing_positionData, callback) {
    db.get(function (error, connection) {
        if (error) callback(error, null);
        connection.query('INSERT INTO ' + tableModel + ' SET ?', ipobj_type__routing_positionData, function (error, result) {
            if (error) {
                callback(error, null);
            }
            else {
                //devolvemos la última id insertada
                callback(null, { "insertId": 'success' });
            }
        });
    });
};

//Update ipobj_type__routing_position
ipobj_type__routing_positionModel.updateIpobj_type__routing_position = function (ipobj_type__routing_positionData, callback) {

    db.get(function (error, connection) {
        if (error) callback(error, null);
        var sql = 'UPDATE ' + tableModel + ' SET type = ' + connection.escape(ipobj_type__routing_positionData.type) + ' ' +            
            ' WHERE type = ' + connection.escape(ipobj_type__routing_positionData.type) + ' position = ' + connection.escape(ipobj_type__routing_positionData.position);
        connection.query(sql, function (error, result) {
            if (error) {
                callback(error, null);
            }
            else {
                callback(null, { "result": true });
            }
        });
    });
};

//Remove ipobj_type__routing_position with id to remove
ipobj_type__routing_positionModel.deleteIpobj_type__routing_position = function (type, position, callback) {
    db.get(function (error, connection) {
        if (error) callback(error, null);
        var sqlExists = 'SELECT * FROM ' + tableModel + ' WHERE type = ' + connection.escape(type) + ' position = ' + connection.escape(position);
        connection.query(sqlExists, function (error, row) {
            //If exists Id from ipobj_type__routing_position to remove
            if (row) {
                db.get(function (error, connection) {
                    var sql = 'DELETE FROM ' + tableModel + ' WHERE type = ' + connection.escape(type) + ' position = ' + connection.escape(position);
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
                callback(null, { "result": false });
            }
        });
    });
};

//Export the object
module.exports = ipobj_type__routing_positionModel;