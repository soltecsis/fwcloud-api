var db = require('../db.js');
//var Ipobj__ipobjgModel = require('../models/ipobj__ipobjg');
var IpobjModel = require('../models/ipobj');
var async = require('async');
var ipobj_g_Data = require('../models/data_ipobj_g');
var ipobj_Data = require('../models/data_ipobj');

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
            return done('Database problem');
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
            return done('Database problem');
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
            return done('Database problem');

        var sqlId = '';
        if (id !== '')
            sqlId = ' AND id = ' + connection.escape(id);
        var sql = 'SELECT * FROM ' + tableModel + ' WHERE  (fwcloud= ' + connection.escape(fwcloud) + ' OR fwcloud is null) ' + sqlId;
        logger.debug(sql);
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
                    IpobjModel.getIpobjsGroup(fwcloud, idgroup, function (error, data_ipobjs) {
                        if (data_ipobjs.length > 0) {
                            ipobjs_cont = data_ipobjs.length;
                            logger.debug("CONTADOR de IPOBJ: " + ipobjs_cont);

                            async.map(data_ipobjs, function (data_ipobj, callback2) {
                                //GET OBJECTS
                                logger.debug("--> DENTRO de OBJECT id:" + data_ipobj.id + "  Name:" + data_ipobj.name + "  Type:" + data_ipobj.type)

                                var ipobj_node = new ipobj_Data(data_ipobj);
                                //Añadimos ipobj a array Grupo
                                group_node.ipobjs.push(ipobj_node);
                                callback2();
                            }, //Fin de bucle de IPOBJS
                                    function (err) {
                                        logger.debug("FIN DE BUCLE IPOBJS  Groups length:" + groups.length + "  Count:" + group_cont);

                                        if (group_node.ipobjs.length >= ipobjs_cont) {
                                            groups.push(group_node);
                                            if (groups.length >= group_cont) {
                                                logger.debug("-------------------- HEMOS LLLEGADO aL FINAL BUCLE IPOJS ----------------");
                                                AllDone(null, groups);
                                            }


                                        }
                                    }
                            );
                        } else {
                            logger.debug("SIN DATOS de GRUPO: " + row.id);
                            groups.push(group_node);
                            logger.debug("SIN DATOS  Groups length:" + groups.length + "  Count:" + group_cont);
                            if (groups.length >= group_cont) {
                                logger.debug("-------------------- HEMOS LLLEGADO aL FINAL SIN DATOS ----------------");
                                AllDone(null, groups);
                            }
                        }
                    }
                    );
                    callback1();
                }, //Fin de bucle de GROUPS
                        function (err) {
                            logger.debug("FIN DE BUCLE GROUPS  Groups length:" + groups.length + "  Count:" + group_cont);

                            if (groups.length >= group_cont) {
                                logger.debug("-------------------- HEMOS LLLEGADO aL FINAL BUCLE GROUPS ----------------");

                                AllDone(null, groups);
                            }
                        }
                );
            } else {
                logger.debug("SIN GRUPOS");
                AllDone("", null);
            }
        });
    });
};
//Get ipobj_g by name
ipobj_gModel.getIpobj_gName = function (fwcloud, name, callback) {
    db.get(function (error, connection) {
        if (error)
            return done('Database problem');
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
            return done('Database problem');
        var sql = 'SELECT * FROM ' + tableModel + ' WHERE type =  ' + connection.escape(type) + ' AND  fwcloud= ' + connection.escape(fwcloud);
        connection.query(sql, function (error, row) {
            if (error)
                callback(error, null);
            else
                callback(null, row);
        });
    });
};
//Add new ipobj_g
ipobj_gModel.insertIpobj_g = function (ipobj_gData, callback) {
    db.get(function (error, connection) {
        if (error)
            return done('Database problem');
        connection.query('INSERT INTO ' + tableModel + ' SET ?', ipobj_gData, function (error, result) {
            if (error) {
                callback(error, null);
            } else {
                //devolvemos la última id insertada
                callback(null, {"insertId": result.insertId});
            }
        });
    });
};
//Update ipobj_g
ipobj_gModel.updateIpobj_g = function (ipobj_gData, callback) {

    db.get(function (error, connection) {
        if (error)
            return done('Database problem');
        var sql = 'UPDATE ' + tableModel + ' SET name = ' + connection.escape(ipobj_gData.name) + ' ' +
                ' ,type = ' + connection.escape(ipobj_gData.type) + ',' +
                ' ,fwcloud = ' + connection.escape(ipobj_gData.fwcloud) + ' ' +
                ' WHERE id = ' + ipobj_gData.id;
        connection.query(sql, function (error, result) {
            if (error) {
                callback(error, null);
            } else {
                callback(null, {"msg": "success"});
            }
        });
    });
};
//Remove ipobj_g with id to remove
ipobj_gModel.deleteIpobj_g = function (fwcloud, id, type, callback) {
    db.get(function (error, connection) {
        if (error)
            return done('Database problem');
        var sqlExists = 'SELECT * FROM ' + tableModel + ' WHERE id = ' + connection.escape(id) + ' AND fwcloud=' + connection.escape(fwcloud) + ' AND type=' + connection.escape(type);
        connection.query(sqlExists, function (error, row) {
            //If exists Id from ipobj_g to remove
            if (row) {
                db.get(function (error, connection) {
                    var sql = 'DELETE FROM ' + tableModel + ' WHERE id = ' + connection.escape(id) + ' AND fwcloud=' + connection.escape(fwcloud) + ' AND type=' + connection.escape(type);
                    connection.query(sql, function (error, result) {
                        if (error) {
                            callback(error, null);
                        } else {
                            if (result.affectedRows > 0)
                                callback(null, {"msg": "deleted"});
                            else
                                callback(null, {"msg": "notExist"});
                        }
                    });
                });
            } else {
                callback(null, {"msg": "notExist"});
            }
        });
    });
};
//Export the object
module.exports = ipobj_gModel;