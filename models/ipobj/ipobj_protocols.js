var db = require('../../db.js');


//create object
var ipobj_protocolsModel = {};
var tableModel = "ipobj_protocols";


var logger = require('log4js').getLogger("app");

//Get All ipobj_protocols
ipobj_protocolsModel.getIpobj_protocols = function (callback) {
    db.get(function (error, connection) {
        if (error)
            callback(error, null);
        
        connection.query('SELECT * FROM ' + tableModel + ' ORDER BY id', function (error, rows) {
            if (error)
                callback(error, null);
            else
                callback(null, rows);
        });
    });
};





//Get ipobj_protocols by  id
ipobj_protocolsModel.getIpobj_protocolsId = function (id, callback) {
    db.get(function (error, connection) {
        if (error)
            callback(error, null);
        var sql = 'SELECT * FROM ' + tableModel + ' WHERE id = ' + connection.escape(id);
        connection.query(sql, function (error, row) {
            if (error)
                callback(error, null);
            else
                callback(null, row);
        });
    });
};

//Get ipobj_protocols by name
ipobj_protocolsModel.getIpobj_protocolsName = function (name, callback) {
    db.get(function (error, connection) {
        if (error)
            callback(error, null);
        var namesql = '%' + name + '%';
        var sql = 'SELECT * FROM ' + tableModel + ' WHERE keyword like  ' + connection.escape(namesql);
        connection.query(sql, function (error, row) {
            if (error)
                callback(error, null);
            else
                callback(null, row);
        });
    });
};



//Add new ipobj_protocols
ipobj_protocolsModel.insertIpobj_type = function (ipobj_protocolsData, callback) {
    db.get(function (error, connection) {
        if (error)
            callback(error, null);
        connection.query('INSERT INTO ' + tableModel + ' SET ?', ipobj_protocolsData, function (error, result) {
            if (error) {
                callback(error, null);
            } else {
                //devolvemos la última id insertada
                callback(null, {"insertId": result.insertId});
            }
        });
    });
};

//Update ipobj_protocols
ipobj_protocolsModel.updateIpobj_type = function (ipobj_protocolsData, callback) {

    db.get(function (error, connection) {
        if (error)
            callback(error, null);
        var sql = 'UPDATE ' + tableModel + ' SET keyword = ' + connection.escape(ipobj_protocolsData.keyword) + ', ' +
                ' id=' + connection.escape(ipobj_protocolsData.id) + ', ' +
                ' description=' + connection.escape(ipobj_protocolsData.description) + ', ' +
                ' WHERE id = ' + ipobj_protocolsData.id;
        connection.query(sql, function (error, result) {
            if (error) {
                callback(error, null);
            } else {
                callback(null, {"result": true});
            }
        });
    });
};

//Remove ipobj_protocols with id to remove
ipobj_protocolsModel.deleteIpobj_type = function (id, callback) {
    db.get(function (error, connection) {
        if (error)
            callback(error, null);
        var sqlExists = 'SELECT * FROM ' + tableModel + ' WHERE id = ' + connection.escape(id);
        connection.query(sqlExists, function (error, row) {
            //If exists Id from ipobj_protocols to remove
            if (row) {
                db.get(function (error, connection) {
                    var sql = 'DELETE FROM ' + tableModel + ' WHERE id = ' + connection.escape(id);
                    connection.query(sql, function (error, result) {
                        if (error) {
                            callback(error, null);
                        } else {
                            callback(null, {"result": true});
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
module.exports = ipobj_protocolsModel;