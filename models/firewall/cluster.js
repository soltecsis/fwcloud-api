var db = require('../../db.js');
//create object
var clusterModel = {};

//Export the object
module.exports = clusterModel;

var tableModel = "cluster";

var FirewallModel = require('../../models/firewall/firewall');
var fwcTreemodel = require('../../models/tree/fwc_tree');
var InterfaceModel = require('../../models/interface/interface');

var logger = require('log4js').getLogger("app");

//Get All clusters
clusterModel.getClusters = function (callback) {

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





//Get cluster by  id
clusterModel.getCluster = function (id, callback) {
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

//Get FULL cluster by  id
clusterModel.getClusterFullPro = function (iduser, fwcloud, idcluster) {
    return new Promise((resolve, reject) => {
        db.get(function (error, connection) {
            if (error)
                reject(error);
            var sql = 'SELECT * FROM ' + tableModel + ' WHERE id = ' + connection.escape(idcluster) + ' AND fwcloud=' + connection.escape(fwcloud);
            connection.query(sql, function (error, row) {
                if (error)
                    reject(error);
                else {
                    if (row && row.length > 0) {
                        var dataCluster = row[0];
                        //SEARCH FIREWALL NODES
                        FirewallModel.getFirewallCluster(iduser, idcluster, function (error, dataFw)
                        {
                            //get data
                            if (dataFw && dataFw.length > 0)
                            {
                                dataCluster.nodes = dataFw;
                                //SEARCH INTERFACES FW-MASTER
                                FirewallModel.getFirewallClusterMaster(iduser, idcluster, function (error, dataFwM)
                                {
                                    if (dataFwM && dataFwM.length > 0) {
                                        var idFwMaster = dataFwM[0].id;
                                        InterfaceModel.getInterfacesFull(idFwMaster, fwcloud, function (error, dataI) {
                                            if (dataI && dataI.length>0){
                                                dataCluster.interfaces = dataI;
                                            }
                                            else
                                                dataCluster.interfaces = [];
                                            resolve({"cluster": dataCluster});
                                        });
                                    }
                                    else
                                        resolve({"cluster": dataCluster});
                                });
                            }
                            else{
                                dataCluster.nodes = [];
                                resolve({"cluster": dataCluster});
                            }
                            
                        });

                    } else
                        resolve(null);

                }
            });
        });
    });
};

//Get clusters by name
clusterModel.getClusterName = function (name, callback) {
    db.get(function (error, connection) {
        if (error)
            callback(error, null);
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
        if (error)
            callback(error, null);
        logger.debug(clusterData);
        connection.query('INSERT INTO ' + tableModel + ' SET ?', clusterData, function (error, result) {
            if (error) {
                callback(error, null);
            } else {
                //devolvemos la última id insertada
                callback(null, {"insertId": result.insertId});
            }
        });
    });
};

//Update cluster
clusterModel.updateCluster = function (clusterData, callback) {

    db.get(function (error, connection) {
        if (error)
            callback(error, null);
        var sql = 'UPDATE ' + tableModel + ' SET name = ' + connection.escape(clusterData.name) + ' ' +
                ' WHERE id = ' + clusterData.id;

        connection.query(sql, function (error, result) {
            if (error) {
                callback(error, null);
            } else {
                callback(null, {"result": true});
            }
        });
    });
};

//Remove cluster with id to remove
clusterModel.deleteCluster = function (id, iduser, fwcloud, callback) {
    var restrictions = false;
    db.get(function (error, connection) {
        if (error)
            callback(error, null);

        //BUCLE de FIREWALL en CLUSTER
        var sqlfw = ' SELECT ' + iduser + ' as iduser, F.* ' +
                ' FROM firewall F ' +
                ' WHERE F.cluster=' + connection.escape(id) + ' AND F.fwcloud=' + connection.escape(fwcloud) +
                ' ORDER BY fwmaster desc';
        connection.query(sqlfw, async (error, rowfw) => {
            for (let row of rowfw) {
                //Promise.all(rowfw.map(FirewallModel.deleteFirewallPro))
                if (!restrictions) {
                    await FirewallModel.deleteFirewallPro(row)
                            .then(data => {
                                if (data.result) {
                                    logger.debug("<<<<<<<<<<<<<<< FIREWALL DELETED FROM CLUSTER >>>>>>>>>>>>>>>");
                                    logger.debug("FIREWALL: ", row.id, " - ", row.name);
                                    logger.debug("DATA: ", data);


                                } else {
                                    logger.debug("DETECTED RESTRICTIONS in FIREWALL: ", row.id, " - ", row.name);
                                    restrictions = true;
                                    //callback(null, {"result": false});
                                }
                            })
                            .catch(e => {
                                restrictions = true;
                            });
                }
            }
            ;

            if (!restrictions) {
                logger.debug("------>>>> DELETING CLUSTER: ", id);
                var sqlExists = 'SELECT T.* , A.id as idnode FROM ' + tableModel + ' T ' +
                        ' INNER JOIN fwc_tree A ON A.id_obj = T.id AND A.obj_type=100 ' +
                        ' WHERE T.id = ' + connection.escape(id);
                logger.debug("SQL DELETE CLUSTER: ", sqlExists);
                connection.query(sqlExists, function (error, row) {
                    //If exists Id from cluster to remove
                    if (row.length > 0) {
                        var dataNode = {id: row[0].idnode, fwcloud: fwcloud, iduser: iduser};
                        fwcTreemodel.deleteFwc_TreeFullNode(dataNode)
                                .then(resp => {
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
                                });
                    } else {
                        callback(null, {"result": false});
                    }
                });

            } else {
                logger.debug("------>>>> FOUND RESTRICTIONS, CLUSTER NOT DELETED: ", id);
                callback(null, {"result": false});
            }

        });


    });
};

//Remove cluster with id to remove
clusterModel.deleteClusterSimple = function (id, iduser, fwcloud, callback) {

    db.get(function (error, connection) {
        if (error)
            callback(error, null);
        logger.debug("------>>>> DELETING CLUSTER: ", id);
        var sqlExists = 'SELECT T.* , A.id as idnode FROM ' + tableModel + ' T ' +
                ' INNER JOIN fwc_tree A ON A.id_obj = T.id AND A.obj_type=100 ' +
                ' WHERE T.id = ' + connection.escape(id);
        logger.debug("SQL DELETE CLUSTER: ", sqlExists);
        connection.query(sqlExists, function (error, row) {
            //If exists Id from cluster to remove
            if (row.length > 0) {
                var dataNode = {id: row[0].idnode, fwcloud: fwcloud, iduser: iduser};
                fwcTreemodel.deleteFwc_TreeFullNode(dataNode)
                        .then(resp => {
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
                        });
            } else {
                callback(null, {"result": false});
            }
        });

    });
};

