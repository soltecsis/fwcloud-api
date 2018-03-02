var db = require('../../db.js');


//create object
var firewallsclusterModel = {};
var tableModel = "firewall_cluster";


var logger = require('log4js').getLogger("app");
var utilsModel = require("../../utils/utils.js");

//Get All firewallclusters by idCluster
firewallsclusterModel.getFirewallsClusters = function (idcluster, callback) {

    db.get(function (error, connection) {
        if (error)
            callback(error, null);
        connection.query('SELECT * FROM ' + tableModel +
                ' WHERE idcluster= ' + connection.escape(idcluster) +
                ' ORDER BY id', function (error, rows) {
                    if (error)
                        callback(error, null);
                    else
                        callback(null, rows);
                });
    });
};

//Get All firewallclusters by idCluster with IP Data
firewallsclusterModel.getFirewallsClustersIPData = function (idcluster, callback) {

    db.get(function (error, connection) {
        if (error)
            callback(error, null);
        var sql = "SELECT C.id,C.idcluster,C.firewall,C.firewall_name, C.install_user, '' as install_pass, save_user_pass, I.name as interface_name, O.name as ip_name, O.address as ip " +
                " FROM " + tableModel + " C " +
                " LEFT join interface I on I.id=C.interface " +
                " LEFT join ipobj O on O.id=C.ipobj and O.interface=I.id " +
                " WHERE C.idcluster= " + connection.escape(idcluster) +
                " ORDER BY C.id ";

        connection.query(sql, function (error, rows) {
            if (error)
                callback(error, null);
            else
                callback(null, rows);
        });
    });
};

//Get All firewallclusters by idCluster with IP Data for INSTALL
firewallsclusterModel.getFirewallsClustersIPData_id = function (idcluster, id, callback) {
    db.get(function (error, connection) {
        if (error)
            callback(error, null);
        var sql = "SELECT C.id,C.idcluster,C.firewall,C.firewall_name, C.install_user, C.install_pass, save_user_pass, I.name as interface_name, O.name as ip_name, O.address as ip " +
                " FROM " + tableModel + " C " +
                " LEFT join interface I on I.id=C.interface " +
                " LEFT join ipobj O on O.id=C.ipobj and O.interface=I.id " +
                " WHERE C.idcluster= " + connection.escape(idcluster) + " AND C.id=" + connection.escape(id);
        " ORDER BY C.id ";
        logger.debug(sql);
        connection.query(sql, function (error, rows) {
            if (error)
                callback(error, null);
            else {
                Promise.all(rows.map(utilsModel.decryptDataUserPass))
                        .then(data => {
                            callback(null, data);
                        })
                        .catch(e => {
                            callback(e, null);
                        });
            }
        });
    });
};




//Get firewallclusters by cluster and  id
firewallsclusterModel.getFirewallsCluster = function (idcluster, id, callback) {
    db.get(function (error, connection) {
        if (error)
            callback(error, null);
        var sql = 'SELECT * FROM ' + tableModel + ' WHERE id = ' + connection.escape(id) +
                ' AND idcluster= ' + connection.escape(idcluster);
        connection.query(sql, function (error, row) {
            if (error)
                callback(error, null);
            else
                callback(null, row);
        });
    });
};


//Get firewallclusters by cluster and idfirewall
firewallsclusterModel.getFirewallsClusterFirewall = function (idcluster, idfirewall, callback) {
    db.get(function (error, connection) {
        if (error)
            callback(error, null);
        var sql = 'SELECT * FROM ' + tableModel + ' WHERE firewall= ' + connection.escape(idfirewall) +
                ' AND idcluster= ' + connection.escape(idcluster);
        connection.query(sql, function (error, row) {
            if (error)
                callback(error, null);
            else
                callback(null, row);
        });
    });
};

//Get firewallclusters by cluster and firewallname
firewallsclusterModel.getFirewallsClusterName = function (idcluster, name, callback) {
    db.get(function (error, connection) {
        if (error)
            callback(error, null);
        var sql = 'SELECT * FROM ' + tableModel + ' WHERE firewall_name =  ' + connection.escape(name) +
                ' AND idcluster= ' + connection.escape(idcluster);
        ;
        connection.query(sql, function (error, row) {
            if (error)
                callback(error, null);
            else
                callback(null, row);
        });
    });
};

//Add new firewallclusters
firewallsclusterModel.insertFirewallCluster = function (FCData, callback) {
    db.get(function (error, connection) {
        if (error)
            callback(error, null);
        connection.query('INSERT INTO ' + tableModel + ' SET ?', FCData, function (error, result) {
            if (error) {
                callback(error, null);
            } else {
                //devolvemos la última id insertada
                callback(null, {"insertId": result.insertId});
            }
        });
    });
};

//Update firewallclusters
firewallsclusterModel.updateFirewallCluster = function (FCData, callback) {

    db.get(function (error, connection) {
        if (error)
            callback(error, null);
        var sql = 'UPDATE ' + tableModel + ' SET ' +
                ' firewall=' + connection.escape(FCData.firewall) + ', ' +
                ' firewall_name=' + connection.escape(FCData.firewall_name) + ', ' +
                ' install_user=' + connection.escape(FCData.install_user) + ', ' +
                ' install_pass=' + connection.escape(FCData.install_pass) + ', ' +
                ' save_user_pass=' + connection.escape(FCData.save_user_pass) + ', ' +
                ' interface=' + connection.escape(FCData.interface) + ', ' +
                ' ipobj=' + connection.escape(FCData.ipobj) + ' ' +
                ' WHERE id = ' + FCData.id;

        connection.query(sql, function (error, result) {
            if (error) {
                callback(error, null);
            } else {
                callback(null, {"result": true});
            }
        });
    });
};

//Remove firewallclusters with id to remove
firewallsclusterModel.deleteFirewallCluster = function (id, callback) {
    db.get(function (error, connection) {
        if (error)
            callback(error, null);
        var sqlExists = 'SELECT * FROM ' + tableModel + ' WHERE id = ' + connection.escape(id);
        connection.query(sqlExists, function (error, row) {
            //If exists Id from cluster to remove
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
module.exports = firewallsclusterModel;