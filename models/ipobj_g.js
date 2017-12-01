var db = require('../db.js');
//var Ipobj__ipobjgModel = require('../models/ipobj__ipobjg');
var IpobjModel = require('../models/ipobj');
var async = require('async');
var ipobj_g_Data = require('../models/data_ipobj_g');
var ipobj_Data = require('../models/data_ipobj');
var Policy_r__ipobjModel = require('../models/policy_r__ipobj');
var Ipobj__ipobjgModel = require('../models/ipobj__ipobjg');

//create object
var ipobj_gModel = {};
var tableModel = "ipobj_g";

/**
 * Property Logger to manage App logs
 *
 * @property logger
 * @type log4js/app
 * 
 */
var logger = require('log4js').getLogger("app");

//Get All ipobj_g
ipobj_gModel.getIpobj_gs = function (fwcloud, callback) {

    db.get(function (error, connection) {
        if (error)
            callback(error, null);
        connection.query('SELECT * FROM ' + tableModel + ' WHERE (fwcloud= ' + connection.escape(fwcloud) + '  OR fwcloud is null) ORDER BY id', function (error, rows) {
            if (error)
                callback(error, null);
            else
                callback(null, rows);
        });
    });
};





//Get ipobj_g by  id
ipobj_gModel.getIpobj_g = function (fwcloud, id, callback) {
    db.get(function (error, connection) {
        if (error)
            callback(error, null);
        var sql = 'SELECT * FROM ' + tableModel + ' WHERE id = ' + connection.escape(id) + ' AND  (fwcloud= ' + connection.escape(fwcloud) + ' OR fwcloud is null) ';
        connection.query(sql, function (error, row) {
            if (error)
                callback(error, null);
            else {
                callback(null, row);
            }
        });
    });
};

//Get ipobj_g by  id AND ALL IPOBjs
ipobj_gModel.getIpobj_g_Full = function (fwcloud, id, AllDone) {

    var groups = [];
    var group_cont = 0;
    var ipobjs_cont = 0;

    db.get(function (error, connection) {
        if (error)
            callback(error, null);

        var sqlId = '';
        if (id !== '')
            sqlId = ' AND G.id = ' + connection.escape(id);
        var sql = 'SELECT G.*,  T.id id_node, T.id_parent id_parent_node FROM ' + tableModel + ' G ' +
                'inner join fwc_tree T on T.id_obj=G.id and T.obj_type=G.type AND (T.fwcloud=' + connection.escape(fwcloud) + ' OR T.fwcloud IS NULL) ' +
                ' WHERE  (G.fwcloud= ' + connection.escape(fwcloud) + ' OR G.fwcloud is null) ' + sqlId;
        //logger.debug(sql);
        connection.query(sql, function (error, rows) {
            if (error)
                callback(error, null);
            else if (rows.length > 0) {
                group_cont = rows.length;
                var row = rows[0];
                async.map(rows, function (row, callback1) {

                    var group_node = new ipobj_g_Data(row);

                    logger.debug(" ---> DENTRO de GRUPO: " + row.id + " NAME: " + row.name);
                    var idgroup = row.id;
                    group_node.ipobjs = new Array();
                    //GET ALL GROUP OBJECTs
                    IpobjModel.getAllIpobjsGroup(fwcloud, idgroup, function (error, data_ipobjs) {
                        if (data_ipobjs.length > 0) {
                            ipobjs_cont = data_ipobjs.length;

                            async.map(data_ipobjs, function (data_ipobj, callback2) {
                                //GET OBJECTS
                                logger.debug("--> DENTRO de OBJECT id:" + data_ipobj.id + "  Name:" + data_ipobj.name + "  Type:" + data_ipobj.type);

                                var ipobj_node = new ipobj_Data(data_ipobj);
                                //Añadimos ipobj a array Grupo
                                group_node.ipobjs.push(ipobj_node);
                                callback2();
                            }, //Fin de bucle de IPOBJS
                                    function (err) {

                                        if (group_node.ipobjs.length >= ipobjs_cont) {
                                            groups.push(group_node);
                                            if (groups.length >= group_cont) {
                                                AllDone(null, groups);
                                            }


                                        }
                                    }
                            );
                        } else {
                            groups.push(group_node);
                            if (groups.length >= group_cont) {
                                AllDone(null, groups);
                            }
                        }
                    }
                    );
                    callback1();
                }, //Fin de bucle de GROUPS
                        function (err) {
                            if (groups.length >= group_cont) {

                                AllDone(null, groups);
                            }
                        }
                );
            } else {
                AllDone("", null);
            }
        });
    });
};
//Get ipobj_g by name
ipobj_gModel.getIpobj_gName = function (fwcloud, name, callback) {
    db.get(function (error, connection) {
        if (error)
            callback(error, null);
        var namesql = '%' + name + '%';
        var sql = 'SELECT * FROM ' + tableModel + ' WHERE name like  ' + connection.escape(namesql) + ' AND  fwcloud= ' + connection.escape(fwcloud);
        connection.query(sql, function (error, row) {
            if (error)
                callback(error, null);
            else
                callback(null, row);
        });
    });
};
//Get ipobj_g by  tipo
ipobj_gModel.getIpobj_gType = function (fwcloud, type, callback) {
    db.get(function (error, connection) {
        if (error)
            callback(error, null);
        var sql = 'SELECT * FROM ' + tableModel + ' WHERE type =  ' + connection.escape(type) + ' AND  fwcloud= ' + connection.escape(fwcloud);
        connection.query(sql, function (error, row) {
            if (error)
                callback(error, null);
            else
                callback(null, row);
        });
    });
};


/* Search where is used GROUP  */
ipobj_gModel.searchGroup = function (id, fwcloud, callback) {
    //SEARCH IPOBJ GROUP IN RULES
    Policy_r__ipobjModel.searchGroupInRule(id, fwcloud, function (error, data_grouprule) {
        if (error) {
            callback(error, null);
        } else {

            if (data_grouprule.found !== "") {
                callback(null, {"result": true, "msg": "GROUP FOUND", "search": {
                            "groupInRules": data_grouprule}});
            } else {
                callback(null, {"result": false, "msg": "GROUP NOT FOUND", "search": {
                            "groupInRules": ""}});
            }

        }
    });

};

/* Search where is used GROUP IN RULES AND MEMBERS */
ipobj_gModel.searchGroupInRules = function (id, fwcloud, callback) {
    //SEARCH IPOBJ GROUP IN RULES
    Policy_r__ipobjModel.searchGroupInRule(id, fwcloud, function (error, data_grouprule) {
        if (error) {
            callback(error, null);
        } else {
            //SEARCH IPOBJ GROUP IN RULES
            Policy_r__ipobjModel.searchIpobjInGroupInRule(id, fwcloud, function (error, data_ipobjrule) {
                if (error) {
                    callback(error, null);
                } else {

                    if (data_grouprule.found !== "" || data_ipobjrule.found !== "") {
                        callback(null, {"result": true, "msg": "GROUP FOUND", "search": [{
                                    "groupInRules": data_grouprule, "ipobjInGroupInRules": data_ipobjrule}]});
                    } else {
                        callback(null, {"result": false, "msg": "GROUP NOT FOUND", "search": [{
                                    "groupInRules": "", "ipobjInGroupInRules": ""}]});
                    }
                }
            });
        }
    });

};

//Add new ipobj_g
ipobj_gModel.insertIpobj_g = function (ipobj_gData, callback) {
    db.get(function (error, connection) {
        if (error)
            callback(error, null);
        connection.query('INSERT INTO ' + tableModel + ' SET ?', ipobj_gData, function (error, result) {
            if (error) {
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
//Update ipobj_g
ipobj_gModel.updateIpobj_g = function (ipobj_gData, callback) {

    db.get(function (error, connection) {
        if (error)
            callback(error, null);
        var sql = 'UPDATE ' + tableModel + ' SET name = ' + connection.escape(ipobj_gData.name) + ' ' +
                ' ,type = ' + connection.escape(ipobj_gData.type) + ' ' +
                ' ,comment = ' + connection.escape(ipobj_gData.comment) + ' ' +
                ' WHERE id = ' + ipobj_gData.id + ' AND fwcloud=' + connection.escape(ipobj_gData.fwcloud);
        connection.query(sql, function (error, result) {
            if (error) {
                logger.debug(sql);
                logger.debug(error);
                callback(error, null);
            } else {
                callback(null, {"result": true});
            }
        });
    });
};
//Remove ipobj_g with id to remove
ipobj_gModel.deleteIpobj_g = function (fwcloud, id, type, callback) {
    //CHECK IPOBJ OR GROUP IN RULE
    this.searchGroupInRules(id, fwcloud, function (error, data) {
        if (error) {
            logger.error(error);
            callback(error, null);
        } else {
            //CHECK RESULTS
            if (data.result) {
                logger.debug("RESTRICTED GROUP: " + id + "  Type: " + type + "  Fwcloud: " + fwcloud);
                callback(null, {"result": false, "msg": "Restricted", "restrictions": data.search});
            } else {
                db.get(function (error, connection) {
                    if (error)
                        callback(error, null);
                    var sqlExists = 'SELECT * FROM ' + tableModel + ' WHERE id = ' + connection.escape(id) + ' AND fwcloud=' + connection.escape(fwcloud) + ' AND type=' + connection.escape(type);
                    connection.query(sqlExists, function (error, row) {
                        //If exists Id from ipobj_g to remove
                        if (row) {
                            db.get(function (error, connection) {
                                //DELETE CHILDREN
                                Ipobj__ipobjgModel.deleteIpobj__ipobjgAll(id, function (error, data) {
                                    if (error) {
                                        logger.error(error);
                                        callback(error, null);
                                    } else {
                                        var sql = 'DELETE FROM ' + tableModel + ' WHERE id = ' + connection.escape(id) + ' AND fwcloud=' + connection.escape(fwcloud) + ' AND type=' + connection.escape(type);
                                        connection.query(sql, function (error, result) {
                                            if (error) {
                                                logger.error(error);
                                                callback(error, null);
                                            } else {
                                                if (result.affectedRows > 0)
                                                    callback(null, {"result": true,"msg": "deleted"});
                                                else
                                                    callback(null, {"result": false,"msg": "notExist"});
                                            }
                                        });
                                    }
                                });
                            });
                        } else {
                            callback(null, {"result": false,"msg": "notExist"});
                        }
                    });
                });
            }            
        }
    });

};
//Export the object
module.exports = ipobj_gModel;