var db = require('../../db.js');


//create object
var routing_positionModel = {};
var tableModel="routing_position";


var logger = require('log4js').getLogger("app");

//Get All routing_position
routing_positionModel.getRouting_positions = function (callback) {

    db.get(function (error, connection) {
        if (error) callback(error, null);
        connection.query('SELECT * FROM ' + tableModel + ' ORDER BY id', function (error, rows) {
            if (error)
                callback(error, null);
            else
                callback(null, rows);
        });
    });
};





//Get routing_position by  id
routing_positionModel.getRouting_position = function (id, callback) {
    db.get(function (error, connection) {
        if (error) callback(error, null);
        var sql = 'SELECT * FROM ' + tableModel + ' WHERE id = ' + connection.escape(id);
        connection.query(sql, function (error, row) {
            if (error)
                callback(error, null);
            else
                callback(null, row);
        });
    });
};

//Get routing_position by name
routing_positionModel.getRouting_positionName = function (name, callback) {
    db.get(function (error, connection) {
        if (error) callback(error, null);
        var namesql = '%' + name + '%';
        var sql = 'SELECT * FROM ' + tableModel + ' WHERE name like  ' + connection.escape(namesql) ;
        connection.query(sql, function (error, row) {
            if (error)
                callback(error, null);
            else
                callback(null, row);
        });
    });
};



//Add new routing_position
routing_positionModel.insertRouting_position = function (routing_positionData, callback) {
    db.get(function (error, connection) {
        if (error) callback(error, null);
        connection.query('INSERT INTO ' + tableModel + ' SET ?', routing_positionData, function (error, result) {
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

//Update routing_position
routing_positionModel.updateRouting_position = function (routing_positionData, callback) {

    db.get(function (error, connection) {
        if (error) callback(error, null);
        var sql = 'UPDATE ' + tableModel + ' SET name = ' + connection.escape(routing_positionData.name) + ' ' +            
            ' WHERE id = ' + routing_positionData.id;
            logger.debug(sql);
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

//Remove routing_position with id to remove
routing_positionModel.deleteRouting_position = function (id, callback) {
    db.get(function (error, connection) {
        if (error) callback(error, null);
        var sqlExists = 'SELECT * FROM ' + tableModel + ' WHERE id = ' + connection.escape(id);
        connection.query(sqlExists, function (error, row) {
            //If exists Id from routing_position to remove
            if (row) {
                db.get(function (error, connection) {
                    var sql = 'DELETE FROM ' + tableModel + ' WHERE id = ' + connection.escape(id);
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
module.exports = routing_positionModel;