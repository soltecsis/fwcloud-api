var db = require('../../db.js');


//create object
var firewallsclusterModel = {};
var tableModel="firewall_cluster";


var logger = require('log4js').getLogger("app");

//Get All firewallclusters
firewallsclusterModel.getFirewallsClusters = function (idcluster ,callback) {

    db.get(function (error, connection) {
        if (error) callback(error, null);
        connection.query('SELECT * FROM ' + tableModel + 
                ' WHERE idcluster= ' +  connection.escape(idcluster) + 
                ' ORDER BY id', function (error, rows) {
            if (error)
                callback(error, null);
            else
                callback(null, rows);
        });
    });
};





//Get cluster by  id
firewallsclusterModel.getFirewallsCluster = function (idcluster, id, callback) {
    db.get(function (error, connection) {
        if (error) callback(error, null);
        var sql = 'SELECT * FROM ' + tableModel + ' WHERE id = ' + connection.escape(id) + 
                ' AND idcluster= ' +  connection.escape(idcluster)  ;
        connection.query(sql, function (error, row) {
            if (error)
                callback(error, null);
            else
                callback(null, row);
        });
    });
};

//Get cluster by  idfirewall
firewallsclusterModel.getFirewallsClusterFirewall = function (idcluster, idfirewall, callback) {
    db.get(function (error, connection) {
        if (error) callback(error, null);
        var sql = 'SELECT * FROM ' + tableModel + ' WHERE firewall= ' + connection.escape(idfirewall) + 
                ' AND idcluster= ' +  connection.escape(idcluster)  ;
        connection.query(sql, function (error, row) {
            if (error)
                callback(error, null);
            else
                callback(null, row);
        });
    });
};

//Get clusters by firewallname
firewallsclusterModel.getFirewallsClusterName = function (idcluster, name, callback) {
    db.get(function (error, connection) {
        if (error) callback(error, null);
        var sql = 'SELECT * FROM ' + tableModel + ' WHERE firewall_name like  "%' + connection.escape(name) + '%"' +
                ' AND idcluster= ' +  connection.escape(idcluster)  ;;
        connection.query(sql, function (error, row) {
            if (error)
                callback(error, null);
            else
                callback(null, row);
        });
    });
};

//Add new cluster
firewallsclusterModel.insertFirewallCluster = function (FCData, callback) {
    db.get(function (error, connection) {
        if (error) callback(error, null);
        connection.query('INSERT INTO ' + tableModel + ' SET ?', FCData, function (error, result) {
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
firewallsclusterModel.updateFirewallCluster = function (FCData, callback) {

    db.get(function (error, connection) {
        if (error) callback(error, null);
        var sql = 'UPDATE ' + tableModel + ' SET name = ' + connection.escape(FCData.name) + ', ' +
                ' firewall=' + connection.escape(FCData.firewall) + ', ' +
                ' firewall_name=' + connection.escape(FCData.firewall_name) + ', ' +
                ' sshuser=' + connection.escape(FCData.sshuser) + ', ' +
                ' sshpass=' + connection.escape(FCData.sshpass) + ', ' +
                ' interface=' + connection.escape(FCData.interface) + ', ' +
                ' ipobj=' + connection.escape(FCData.ipobj) + ' ' +
            ' WHERE id = ' + FCData.id;
            
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
firewallsclusterModel.deleteFirewallCluster = function (id, callback) {
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
module.exports = firewallsclusterModel;