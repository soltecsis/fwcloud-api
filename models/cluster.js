var db = require('../db.js');


//create object
var clusterModel = {};
var tableModel="cluster";

/**
* Property Logger to manage App logs
*
* @property logger
* @type log4js/app
* 
*/
var logger = require('log4js').getLogger("app");

//Get All clusters
clusterModel.getClusters = function (callback) {

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





//Get cluster by  id
clusterModel.getCluster = function (id, callback) {
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

//Get clusters by name
clusterModel.getClusterName = function (name, callback) {
    db.get(function (error, connection) {
        if (error) callback(error, null);
        var sql = 'SELECT * FROM ' + tableModel + ' WHERE name like  "%' + connection.escape(name) + '%"';
        connection.query(sql, function (error, row) {
            if (error)
                callback(error, null);
            else
                callback(null, row);
        });
    });
};

//Add new cluster
clusterModel.insertCluster = function (clusterData, callback) {
    db.get(function (error, connection) {
        if (error) callback(error, null);
        connection.query('INSERT INTO ' + tableModel + ' SET ?', clusterData, function (error, result) {
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

//Update cluster
clusterModel.updateCluster = function (clusterData, callback) {

    db.get(function (error, connection) {
        if (error) callback(error, null);
        var sql = 'UPDATE ' + tableModel + ' SET name = ' + connection.escape(clusterData.name) + ' ' +
            ' WHERE id = ' + clusterData.id;
            
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

//Remove cluster with id to remove
clusterModel.deleteCluster = function (id, callback) {
    db.get(function (error, connection) {
        if (error) callback(error, null);
        var sqlExists = 'SELECT * FROM ' + tableModel + ' WHERE id = ' + connection.escape(id);
        connection.query(sqlExists, function (error, row) {
            //If exists Id from cluster to remove
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
module.exports = clusterModel;