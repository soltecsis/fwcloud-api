var db = require('../db.js');
var Policy_r__ipobjModel = require('../models/policy_r__ipobj');
var Policy_r__interfaceModel = require('../models/policy_r__interface');

//create object
var ipobjModel = {};
var tableModel = "ipobj";

/**
 * Property Logger to manage App logs
 *
 * @property logger
 * @type log4js/app
 * 
 */
var logger = require('log4js').getLogger("app");


//Get ipobj by  id 
ipobjModel.getIpobj = function (fwcloud, id, callback) {
    db.get(function (error, connection) {
        if (error)
            return done('Database problem');

        var sql = 'SELECT I.*, T.id id_node, T.id_parent id_parent_node  FROM ' + tableModel + ' I ' +
                ' inner join fwc_tree T on T.id_obj=I.id and T.obj_type=I.type AND (T.fwcloud=' + connection.escape(fwcloud) + ' OR T.fwcloud IS NULL)' +
                ' inner join fwc_tree P on P.id=T.id_parent  and P.obj_type<>20 and P.obj_type<>21' +
                ' WHERE I.id = ' + connection.escape(id) + ' AND (I.fwcloud=' + connection.escape(fwcloud) + ' OR I.fwcloud IS NULL)' ;
                
        connection.query(sql, function (error, row) {
            if (error) {
                callback(error, null);
            } else {
                callback(null, row);
            }
        });
    });
};

//Get ipobj by  id_fwb
ipobjModel.getIpobj_fwb = function (id_fwb, callback) {
    db.get(function (error, connection) {
        if (error)
            return done('Database problem');

        var sql = 'SELECT * FROM ' + tableModel + ' WHERE id_fwb = ' + connection.escape(id_fwb);
        connection.query(sql, function (error, row) {
            if (error)
                callback(error, null);
            else
                callback(null, row);
        });
    });
};

//Get All ipobj by group
ipobjModel.getAllIpobjsGroup = function (fwcloud, idgroup, callback) {

    db.get(function (error, connection) {
        if (error)
            return done('Database problem');

        var innergroup = ' INNER JOIN ipobj__ipobjg G on G.ipobj=I.id ';
        //var sql = 'SELECT * FROM ' + tableModel + ' I ' + innergroup + ' WHERE  G.ipobj_g=' + connection.escape(idgroup) + ' AND (I.fwcloud=' + connection.escape(fwcloud) + ' OR I.fwcloud IS NULL) ORDER BY G.id_gi';
        
        var sql = 'SELECT I.*, T.id id_node, T.id_parent id_parent_node  FROM ' + tableModel + ' I ' + innergroup +
                ' inner join fwc_tree T on T.id_obj=I.id and T.obj_type=I.type AND (T.fwcloud=' + connection.escape(fwcloud) + ' OR T.fwcloud IS NULL)' +
                ' inner join fwc_tree P on P.id=T.id_parent  and P.obj_type<>20 and P.obj_type<>21' +
                ' WHERE G.ipobj_g=' + connection.escape(idgroup) + ' AND (I.fwcloud=' + connection.escape(fwcloud) + ' OR I.fwcloud IS NULL)' +
                ' ORDER BY G.id_gi';
        logger.debug(sql);

        connection.query(sql, function (error, rows) {
            if (error)
                callback(error, null);
            else
                callback(null, rows);
        });
    });
};

//Get ipobj by  id and group 
ipobjModel.getIpobjGroup = function (fwcloud, idgroup, id, callback) {
    db.get(function (error, connection) {
        if (error)
            return done('Database problem');

        var innergroup = ' T INNER JOIN ipobj__ipobjg G on G.ipobj=T.id ';
        var sql = 'SELECT * FROM ' + tableModel + innergroup + ' WHERE id = ' + connection.escape(id) + ' AND G.ipobj_g=' + connection.escape(idgroup) + ' AND (T.fwcloud=' + connection.escape(fwcloud) + ' OR T.fwcloud IS NULL) ';

        connection.query(sql, function (error, rows) {
            if (error)
                callback(error, null);
            else
                callback(null, rows[0]);
        });
    });
};

//Get ipobj by name 
ipobjModel.getIpobjName = function (fwcloud, name, callback) {
    db.get(function (error, connection) {
        if (error)
            return done('Database problem');
        var namesql = '%' + name + '%';

        var sql = 'SELECT I.*, T.id id_node, T.id_parent id_parent_node  FROM ' + tableModel + ' I ' +
                ' inner join fwc_tree T on T.id_obj=I.id and T.obj_type=I.type AND (T.fwcloud=' + connection.escape(fwcloud) + ' OR T.fwcloud IS NULL)' +
                ' inner join fwc_tree P on P.id=T.id_parent  and P.obj_type<>20 and P.obj_type<>21' +
                ' WHERE I.name like  = ' + connection.escape(namesql) + ' AND (I.fwcloud=' + connection.escape(fwcloud) + ' OR I.fwcloud IS NULL)' ;
        
        //var sql = 'SELECT * FROM ' + tableModel + ' WHERE name like  ' + connection.escape(namesql) + ' AND (T.fwcloud=' + connection.escape(fwcloud) + ' OR T.fwcloud IS NULL) ';

        connection.query(sql, function (error, row) {
            if (error)
                callback(error, null);
            else
                callback(null, row);
        });
    });
};



//Add new ipobj from user
ipobjModel.insertIpobj = function (ipobjData, callback) {
    db.get(function (error, connection) {
        if (error)
            return done('Database problem');
        connection.query('INSERT INTO ' + tableModel + ' SET ?', ipobjData, function (error, result) {
            if (error) {
                callback(error, null);
            } else {
                if (result.affectedRows > 0) {
                    //devolvemos la última id insertada
                    callback(null, {"insertId": result.insertId});
                } else
                    callback(null, {"insertId": 0});
            }
        });
    });
};

//Update ipobj from user
ipobjModel.updateIpobj = function (ipobjData, callback) {

    db.get(function (error, connection) {
        if (error)
            return done('Database problem');
        var sql = 'UPDATE ' + tableModel + ' SET ' +
                'fwcloud = ' + connection.escape(ipobjData.fwcloud) + ',' +
                'interface = ' + connection.escape(ipobjData.interface) + ',' +
                'name = ' + connection.escape(ipobjData.name) + ',' +
                'type = ' + connection.escape(ipobjData.type) + ',' +
                'protocol = ' + connection.escape(ipobjData.protocol) + ',' +
                'address = ' + connection.escape(ipobjData.address) + ',' +
                'netmask = ' + connection.escape(ipobjData.netmask) + ',' +
                'diff_serv = ' + connection.escape(ipobjData.diff_serv) + ',' +
                'ip_version = ' + connection.escape(ipobjData.ip_version) + ',' +
                'code = ' + connection.escape(ipobjData.code) + ',' +
                'tcp_flags_mask = ' + connection.escape(ipobjData.tcp_flags_mask) + ',' +
                'tcp_flags_settings = ' + connection.escape(ipobjData.tcp_flags_settings) + ',' +
                'range_start = ' + connection.escape(ipobjData.range_start) + ',' +
                'range_end = ' + connection.escape(ipobjData.range_end) + ',' +
                'source_port_start = ' + connection.escape(ipobjData.source_port_start) + ',' +
                'source_port_end = ' + connection.escape(ipobjData.source_port_end) + ',' +
                'destination_port_start = ' + connection.escape(ipobjData.destination_port_start) + ',' +
                'destination_port_end = ' + connection.escape(ipobjData.destination_port_end) + ',' +
                'options = ' + connection.escape(ipobjData.options) + ',' +
                'comment = ' + connection.escape(ipobjData.comment) + ' ' +
                ' WHERE id = ' + ipobjData.id + ' AND fwcloud=' + connection.escape(ipobjData.fwcloud);
        logger.debug(sql);
        connection.query(sql, function (error, result) {
            if (error) {
                callback(error, null);
            } else {
                if (result.affectedRows > 0) {
                    callback(null, {"msg": "success"});
                } else {
                    callback(null, {"msg": "nothing"});
                }
            }
        });
    });
};

//FALTA DELETE INTERFACE y OBJETOS de HOST
//Remove ipobj with id to remove
ipobjModel.deleteIpobj = function (id, type, fwcloud, callback) {

    //CHECK IPOBJ IN GROUP 
    this.checkIpobjInGroup(id, type, fwcloud, function (error, data) {
        if (error) {
            callback(error, null);
        } else {
            if (!data.result) {
                //CHECK IPOBJ OR GROUP IN RULE
                Policy_r__ipobjModel.checkIpobjInRule(id, type, fwcloud, function (error, data) {
                    if (error) {
                        callback(error, null);
                    } else {
                        if (!data.result) {
                            //CHECK INTERFACES UNDER HOST "O" Positions
                            Policy_r__ipobjModel.checkHostAllInterfacesInRule(id, fwcloud, function (error, data) {
                                if (error) {
                                    logger.debug(error);
                                    callback(error, null);
                                } else {
                                    if (!data.result) {
                                        //CHECK INTERFACES UNDER HOST "I" Positions
                                        Policy_r__interfaceModel.checkHostAllInterfacesInRule(id, fwcloud, function (error, data) {
                                            if (error) {
                                                logger.debug(error);
                                                callback(error, null);
                                            } else {
                                                if (!data.result) {
                                                    //CHECK ALL IPOBJ FROM ALL INTERFACES 
                                                    Policy_r__ipobjModel.checkHostAllInterfaceAllIpobjInRule(id, fwcloud, function (error, data) {
                                                        if (error) {
                                                            logger.debug(error);
                                                            callback(error, null);
                                                        } else {
                                                            if (!data.result) {
                                                                db.get(function (error, connection) {
                                                                    if (error)
                                                                        return done('Database problem');
                                                                    var sql = 'DELETE FROM ' + tableModel + ' WHERE id = ' + connection.escape(id) + ' AND fwcloud=' + connection.escape(fwcloud) + ' AND type=' + connection.escape(type);
                                                                    logger.debug(sql);
                                                                    connection.query(sql, function (error, result) {
                                                                        if (error) {
                                                                            logger.debug(error);
                                                                            callback(error, null);
                                                                        } else {
                                                                            if (result.affectedRows > 0) {
                                                                                callback(null, {"msg": "deleted"});
                                                                            } else {
                                                                                callback(null, {"msg": "notExist"});
                                                                            }
                                                                        }
                                                                    });

                                                                });
                                                            } else
                                                                callback(null, {"msg": "Restricted", "by": "by Interface IPOBJ"});
                                                        }
                                                    });
                                                } else
                                                    callback(null, {"msg": "Restricted", "by": "by Interface I"});
                                            }
                                        });
                                    } else
                                        callback(null, {"msg": "Restricted", "by": "by Interface O"});
                                }
                            });

                        } else
                            callback(null, {"msg": "Restricted", "by": "by IPOBJ or GROUP"});
                    }
                });
            } else
                callback(null, {"msg": "Restricted", "by": "by IPOBJ IN GROUP"});
        }
    });
};


//check if IPOBJ Exists in any Group
ipobjModel.checkIpobjInGroup = function (ipobj, type, fwcloud, callback) {

    logger.debug("CHECK DELETING FROM GROUP ipobj:" + ipobj + " Type:" + type + "  fwcloud:" + fwcloud);
    db.get(function (error, connection) {

        var sql = 'SELECT count(*) as n FROM ' + tableModel + ' I ' +
                ' INNER JOIN ipobj__ipobjg G on G.ipobj=I.id ' +
                ' WHERE I.id=' + connection.escape(ipobj) + ' AND I.type=' + connection.escape(type) + ' AND I.fwcloud=' + connection.escape(fwcloud);
        logger.debug(sql);
        connection.query(sql, function (error, rows) {
            if (!error) {
                if (rows.length > 0) {
                    if (rows[0].n > 0) {
                        logger.debug("ALERT DELETING ipobj IN GROUP:" + ipobj + " type: " + type + " fwcloud:" + fwcloud + " --> FOUND IN " + rows[0].n + " GROUPS");
                        callback(null, {"result": true});
                    } else {
                        callback(null, {"result": false});
                    }
                } else
                    callback(null, {"result": false});
            } else{
                logger.error(error);
                callback(null, {"result": false});
            }
        });
    });

};
//Export the object
module.exports = ipobjModel;