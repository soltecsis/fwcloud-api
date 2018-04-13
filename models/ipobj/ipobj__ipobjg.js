var db = require('../../db.js');
var Policy_r__ipobjModel = require('../../models/policy/policy_r__ipobj');

//create object
var ipobj__ipobjgModel = {};

//Export the object
module.exports = ipobj__ipobjgModel;

var tableModel = "ipobj__ipobjg";


var logger = require('log4js').getLogger("app");

//Get All ipobj__ipobjg by group
ipobj__ipobjgModel.getIpobj__ipobjgs = function (ipobjg, callback) {

    db.get(function (error, connection) {
        if (error)
            callback(error, null);
        connection.query('SELECT * FROM ' + tableModel + ' WHERE ipobj_g=' + connection.escape(ipobjg) + ' ORDER BY ipobj', function (error, rows) {
            if (error)
                callback(error, null);
            else
                callback(null, rows);
        });
    });
};



//Get ipobj__ipobjg by  id
ipobj__ipobjgModel.getIpobj__ipobjg = function (ipobjg, ipobj, callback) {
    db.get(function (error, connection) {
        if (error)
            callback(error, null);
        var sql = 'SELECT * FROM ' + tableModel + ' WHERE ipobj_g = ' + connection.escape(ipobjg) + ' AND ipobj = ' + connection.escape(ipobj);
        connection.query(sql, function (error, row) {
            if (error)
                callback(error, null);
            else
                callback(null, row);
        });
    });
};



//Add new ipobj__ipobjg
ipobj__ipobjgModel.insertIpobj__ipobjg = function (ipobj__ipobjgData, callback) {
    db.get(function (error, connection) {
        if (error)
            callback(error, null);
        connection.query('INSERT INTO ' + tableModel + ' SET ?', ipobj__ipobjgData, function (error, result) {
            if (error) {
                logger.error(error);
                callback(error, null);
            } else {
                if (result.affectedRows > 0) {
                    //devolvemos la última id insertada
                    callback(null, {"insertId": result.insertId});
                } else
                    callback(error, null);
            }
        });
    });
};

//Add new ipobj__ipobjg by OBJREF_FWB
ipobj__ipobjgModel.insertIpobj__ipobjg_objref = function (idgroup, objref, callback) {
    db.get(function (error, connection) {
        if (error)
            callback(error, null);
        var sql = 'INSERT INTO ' + tableModel + ' SET ipobj_g=' + connection.escape(idgroup) + ', ipobj=(select id from ipobj where id_fwb=' + connection.escape(objref) + ')';

        connection.query(sql, function (error, result) {
            if (error) {
                callback(error, null);
            } else {
                //devolvemos la última id insertada
                callback(null, {"result": true});
            }
        });
    });
};

//Update ipobj__ipobjg
ipobj__ipobjgModel.updateIpobj__ipobjg = function (ipobj_g, ipobj, ipobj__ipobjgData, callback) {

    db.get(function (error, connection) {
        if (error)
            callback(error, null);
        var sql = 'UPDATE ' + tableModel + ' SET ipobj_g = ' + connection.escape(ipobj__ipobjgData.ipobj_g) + ' ' +
                ' ,ipobj = ' + connection.escape(ipobj__ipobjgData.ipobj) + ' ' +
                ' WHERE ipobj_g = ' + connection.escape(ipobj_g) + ' AND ipobj=' + connection.escape(ipobj);

        connection.query(sql, function (error, result) {
            if (error) {
                callback(error, null);
            } else {
                callback(null, {"result": true});
            }
        });
    });
};

//FALTA comprobar si el Grupo está en alguna Regla
//Remove ipobj__ipobjg with id to remove
ipobj__ipobjgModel.deleteIpobj__ipobjg = function (fwcloud,ipobj_g, ipobj, callback) {
    //CHECK IPOBJ OR GROUP IN RULE
    Policy_r__ipobjModel.checkGroupInRule(ipobj_g,  fwcloud, function (error, data) {
        if (error) {
            callback(error, null);
        } else {
            if (!data.result) {
                db.get(function (error, connection) {
                    if (error)
                        callback(error, null);
                    var sqlExists = 'SELECT * FROM ' + tableModel + ' WHERE ipobj_g = ' + connection.escape(ipobj_g) + ' AND ipobj=' + connection.escape(ipobj);
                    connection.query(sqlExists, function (error, row) {
                        //If exists Id from ipobj__ipobjg to remove
                        if (row) {
                            db.get(function (error, connection) {
                                var sql = 'DELETE FROM ' + tableModel + ' WHERE ipobj_g = ' + connection.escape(ipobj_g) + ' AND ipobj=' + connection.escape(ipobj);
                                connection.query(sql, function (error, result) {
                                    if (error) {
                                        callback(error, null);
                                    } else {
                                        if (result.affectedRows > 0)
                                            callback(null, {"result": true, "msg": "deleted"});
                                        else
                                            callback(null, {"result": false, "msg": "notExist"});
                                    }
                                });
                            });
                        } else {
                            callback(null, {"result": false, "msg": "notExist"});
                        }
                    });
                });
            }
            else
                callback(null, {"msg": "Restricted"});
        }
    });
};

//Remove ipobj__ipobjg with id to remove
ipobj__ipobjgModel.deleteIpobj__ipobjgAll = function (ipobj_g, callback) {
    db.get(function (error, connection) {

        var sql = 'DELETE FROM ' + tableModel + ' WHERE ipobj_g = ' + connection.escape(ipobj_g);
        connection.query(sql, function (error, result) {
            if (error) {
                callback(error, null);
            } else {
                callback(null, {"result": true, "msg": "deleted"});
            }
        });


    });
};

//check if IPOBJ Exists in GROUP 
ipobj__ipobjgModel.searchIpobjGroup = function (ipobj, type, fwcloud, callback) {

    logger.debug("SEARCH GROUP ipobj:" + ipobj + " Type:" + type + "  fwcloud:" + fwcloud);
    db.get(function (error, connection) {
        if (error)
            callback(error, null);

        var sql = 'SELECT I.id obj_id,I.name obj_name, I.type obj_type_id,T.type obj_type_name, ' +
                'C.id cloud_id, C.name cloud_name, GR.id group_id, GR.name group_name, GR.type group_type ' +
                'FROM ' + tableModel + ' G  ' +
                'INNER JOIN ipobj_g GR ON GR.id=G.ipobj_g ' +
                'INNER JOIN  ipobj I on I.id=G.ipobj ' +
                'inner join ipobj_type T on T.id=I.type ' +
                'left join fwcloud C on C.id=I.fwcloud ' +
                ' WHERE I.id=' + connection.escape(ipobj) + ' AND I.type=' + connection.escape(type) + ' AND (I.fwcloud=' + connection.escape(fwcloud) + ' OR I.fwcloud IS NULL)';

        logger.debug(sql);
        connection.query(sql, function (error, rows) {
            if (!error) {
                if (rows.length > 0) {
                    logger.debug("FOUND ipobj IN  GROUP :" + ipobj + " type: " + type + " fwcloud:" + fwcloud + " --> FOUND IN " + rows.length + " GROUPS");
                    //logger.debug(rows);
                    callback(null, {"found": rows});

                } else
                    callback(null, {"found": ""});
            } else
                callback(error, null);
        });
    });
};

