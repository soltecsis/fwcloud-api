/**
 * DATA Module to manage IPOBJ Data
 *
 * @module Ipobjs
 * 
 * @requires db
 */

/**
 * ## Class to manage IPOBJ DATA
 *
 * @class IpobjModel
 * 
 */
var ipobjModel = {};

//Export the object
module.exports = ipobjModel;

/**
 * Property  to manage Dabase Access
 *
 * @property db
 * @type db 
 */
var db = require('../../db.js');

/**
 * Property  to manage Ipobj in Rules
 *
 * @property Policy_r__ipobjModel
 * @type models.policy_r__ipobj
 */
var Policy_r__ipobjModel = require('../../models/policy/policy_r__ipobj');
/**
 * Property  to manage Interfaces in Rules
 *
 * @property Policy_r__interfaceModel
 * @type models.policy_r__interface
 */
var Policy_r__interfaceModel = require('../../models/policy/policy_r__interface');
/**
 * Property manage async process
 *
 * @property async
 * @type async
 */
var asyncMod = require('async');
/**
 * Property  to manage Interfaces Data
 *
 * @property InterfaceModel
 * @type models.interface
 */
var InterfaceModel = require('../../models/interface/interface');
/**
 * Property  to manage Ipobj host data
 *
 * @property host_Data
 * @type models.data_ipobj_host
 */
var host_Data = require('../../models/data/data_ipobj_host');
/**
 * Property  to manage Interface data
 *
 * @property interface_Data
 * @type models.data_interface
 */
var interface_Data = require('../../models/data/data_interface');
/**
 * Property  to manage Ipobj  data
 *
 * @property ipobj_Data
 * @type models.data_ipobj
 */
var ipobj_Data = require('../../models/data/data_ipobj');
/**
 * Property  to manage Ipobj in Groups
 *
 * @property Ipobj__ipobjgModel
 * @type models.ipobj__ipobjg
 */
var Ipobj__ipobjgModel = require('../../models/ipobj/ipobj__ipobjg');




/**
 * Property Table
 *
 * @property tableModel
 * @type "ipobj"
 * @private
 * 
 */
var tableModel = "ipobj";

/**
 * Property Logger to manage App logs
 *
 * @attribute logger
 * @type log4js/app
 * 
 */
var logger = require('log4js').getLogger("app");


/**
 * Get ipobj by Ipobj id
 * 
 * @method getIpobj
 * 
 * @param {Integer} fwcloud FwCloud identifier
 * @param {Integer} id Ipobj identifier
 * 
 * @return {ROW} Returns ROW Data from Ipobj and FWC_TREE
 * */
ipobjModel.getIpobj = function (fwcloud, id, callback) {
    db.get(function (error, connection) {
        if (error)
            callback(error, null);

        var sql = 'SELECT I.*, T.id id_node, T.id_parent id_parent_node  FROM ' + tableModel + ' I ' +
                ' inner join fwc_tree T on T.id_obj=I.id and T.obj_type=I.type AND (T.fwcloud=' + connection.escape(fwcloud) + ' OR T.fwcloud IS NULL)' +
                ' inner join fwc_tree P on P.id=T.id_parent  and P.obj_type<>20 and P.obj_type<>21' +
                ' WHERE I.id = ' + connection.escape(id) + ' AND (I.fwcloud=' + connection.escape(fwcloud) + ' OR I.fwcloud IS NULL)';

        connection.query(sql, function (error, row) {
            if (error) {
                callback(error, null);
            } else {
                //CHECK IF IPOBJ IS a HOST
                if (row.length > 0) {
                    if (row[0].type === 8) {
                        ipobjModel.getIpobj_Host_Full(fwcloud, id, function (errorhost, datahost) {
                            if (errorhost) {
                                callback(errorhost, null);
                            } else {
                                callback(null, datahost);
                            }
                        });

                    } else
                        callback(null, row);
                } else
                    callback(null, row);


            }
        });
    });
};

//Get ipobj HOST by  id and ALL IPOBjs
/**
 * Get ipobj HOST DATA and Interfaces and Ipobj bellow Interfaces
 * 
 * @method getIpobj_Host_Full
 * 
 * @param {Integer} fwcloud FwCloud identifier
 * @param {Integer} id Ipobj identifier
 * 
 * @return {ROW} Returns ROW Data from Ipobj_Host/Interfaces/Ipobjs
 * */
ipobjModel.getIpobj_Host_Full = function (fwcloud, id, AllDone) {

    var hosts = [];
    var host_cont = 0;
    var ipobjs_cont = 0;
    var interfaces_cont = 0;

    db.get(function (error, connection) {
        if (error)
            callback(error, null);

        var sqlId = '';
        if (id !== '')
            sqlId = ' AND G.id = ' + connection.escape(id);
        var sql = 'SELECT G.*,  T.id id_node, T.id_parent id_parent_node FROM ' + tableModel + ' G ' +
                'inner join fwc_tree T on T.id_obj=G.id and T.obj_type=G.type AND (T.fwcloud=' + connection.escape(fwcloud) + ' OR T.fwcloud IS NULL) ' +
                ' WHERE  (G.fwcloud= ' + connection.escape(fwcloud) + ' OR G.fwcloud is null) ' + sqlId;
        logger.debug(sql);
        connection.query(sql, function (error, rows) {
            if (error)
                callback(error, null);
            else if (rows.length > 0) {
                host_cont = rows.length;
                var row = rows[0];
                asyncMod.map(rows, function (row, callback1) {

                    var host_node = new host_Data(row);

                    logger.debug(" ---> DENTRO de HOST: " + row.id + " NAME: " + row.name);
                    var idhost = row.id;
                    host_node.interfaces = new Array();

                    //GET ALL HOST INTERFACES
                    InterfaceModel.getInterfacesHost(idhost, fwcloud, function (error, data_interfaces) {
                        if (data_interfaces.length > 0) {
                            interfaces_cont = data_interfaces.length;

                            asyncMod.map(data_interfaces, function (data_interface, callback2) {
                                //GET INTERFACES
                                logger.debug("--> DENTRO de INTERFACE id:" + data_interface.id + "  Name:" + data_interface.name + "  Type:" + data_interface.interface_type)

                                var interface_node = new interface_Data(data_interface);
                                var idinterface = data_interface.id;

                                interface_node.ipobjs = new Array();

                                //GET ALL INTERFACE OBJECTs
                                ipobjModel.getAllIpobjsInterface(fwcloud, idinterface, function (error, data_ipobjs) {
                                    if (data_ipobjs.length > 0) {
                                        ipobjs_cont = data_ipobjs.length;

                                        asyncMod.map(data_ipobjs, function (data_ipobj, callback2) {
                                            //GET OBJECTS
                                            logger.debug("--> DENTRO de OBJECT id:" + data_ipobj.id + "  Name:" + data_ipobj.name + "  Type:" + data_ipobj.type);

                                            var ipobj_node = new ipobj_Data(data_ipobj);
                                            //Añadimos ipobj a array Interfaces
                                            interface_node.ipobjs.push(ipobj_node);
                                            callback2();
                                        }, //Fin de bucle de IPOBJS
                                                function (err) {

                                                    if (interface_node.ipobjs.length >= ipobjs_cont) {
                                                        host_node.interfaces.push(interface_node);
                                                        if (host_node.interfaces.length >= interfaces_cont) {
                                                            hosts.push(host_node);
                                                            if (hosts.length >= host_cont) {
                                                                AllDone(null, hosts);
                                                            }
                                                        }
                                                    }
                                                }
                                        );
                                    } else {
                                        host_node.interfaces.push(interface_node);
                                        if (host_node.interfaces.length >= interfaces_cont) {
                                            hosts.push(host_node);
                                            if (hosts.length >= host_cont) {
                                                AllDone(null, hosts);
                                            }
                                        }
                                    }
                                }
                                );

                                callback2();
                            }, //Fin de bucle de INTERFACES
                                    function (err) {

//                                        if (host_node.interfaces.length >= interfaces_cont) {
//                                            hosts.push(host_node);
//                                            if (hosts.length >= host_cont) {
//                                                AllDone(null, hosts);
//                                            }
//                                        }
                                    }
                            );
                        } else {
                            hosts.push(host_node);
                            if (hosts.length >= host_cont) {
                                AllDone(null, hosts);
                            }
                        }
                    }
                    );
                    callback1();
                }, //Fin de bucle de GROUPS
                        function (err) {
                            if (hosts.length >= host_cont) {

                                AllDone(null, hosts);
                            }
                        }
                );
            } else {
                AllDone("", null);
            }
        });
    });
};

/**
 * Get ipobj by id_fwb
 * 
 * @method getIpobj_fwb
 * 
 * @param {Integer} id_fwb id firewall Builder identifier
 * 
 * @return {ROW} Returns ROW Data from Ipobj
 * */
ipobjModel.getIpobj_fwb = function (id_fwb, callback) {
    db.get(function (error, connection) {
        if (error)
            callback(error, null);

        var sql = 'SELECT * FROM ' + tableModel + ' WHERE id_fwb = ' + connection.escape(id_fwb);
        connection.query(sql, function (error, row) {
            if (error)
                callback(error, null);
            else
                callback(null, row);
        });
    });
};

/**
 * Get All ipobj by Group
 * 
 * @method getAllIpobjsGroup
 * 
 * @param {Integer} fwcloud FwCloud identifier
 * @param {Integer} idgroup Group identifier
 * 
 * @return {ROWS} Returns ROWS Data from Ipobj and FWC_TREE
 * */
ipobjModel.getAllIpobjsGroup = function (fwcloud, idgroup, callback) {

    db.get(function (error, connection) {
        if (error)
            callback(error, null);

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

/**
 * Get All ipobj by Interface
 * 
 * @method getAllIpobjsInterface
 * 
 * @param {Integer} fwcloud FwCloud identifier
 * @param {Integer} idinterface Interface identifier
 * 
 * @return {ROWS} Returns ROWS Data from Ipobj and FWC_TREE
 * */
ipobjModel.getAllIpobjsInterface = function (fwcloud, idinterface, callback) {

    db.get(function (error, connection) {
        if (error)
            callback(error, null);



        var sql = 'SELECT I.*, T.id id_node, T.id_parent id_parent_node  FROM ' + tableModel + ' I ' +
                ' inner join fwc_tree T on T.id_obj=I.id and T.obj_type=I.type AND (T.fwcloud=' + connection.escape(fwcloud) + ' OR T.fwcloud IS NULL)' +
                ' inner join fwc_tree P on P.id=T.id_parent  and P.obj_type<>20 and P.obj_type<>21' +
                ' WHERE I.interface=' + connection.escape(idinterface) + ' AND (I.fwcloud=' + connection.escape(fwcloud) + ' OR I.fwcloud IS NULL)' +
                ' ORDER BY I.id';
        logger.debug(sql);

        connection.query(sql, function (error, rows) {
            if (error)
                callback(error, null);
            else
                callback(null, rows);
        });
    });
};

/**
 * Get All ipobj by Interface PROMISE
 * 
 * @method getAllIpobjsInterface
 * 
 * @param {Integer} fwcloud FwCloud identifier
 * @param {Integer} idinterface Interface identifier
 * 
 * @return {ROWS} Returns ROWS Data from Ipobj and FWC_TREE
 * */
ipobjModel.getAllIpobjsInterfacePro = function (data) {
    var fwcloud = data.fwc;

    return new Promise((resolve, reject) => {
        db.get(function (error, connection) {
            if (error)
                reject(error);

            var sql = 'SELECT I.*, T.id id_node, T.id_parent id_parent_node  FROM ' + tableModel + ' I ' +
                    ' inner join fwc_tree T on T.id_obj=I.id and T.obj_type=I.type AND (T.fwcloud=' + connection.escape(fwcloud) + ' OR T.fwcloud IS NULL)' +
                    ' inner join fwc_tree P on P.id=T.id_parent  and P.obj_type<>20 and P.obj_type<>21' +
                    ' WHERE I.interface=' + connection.escape(data.id) + ' AND (I.fwcloud=' + connection.escape(fwcloud) + ' OR I.fwcloud IS NULL)' +
                    ' ORDER BY I.id';
            logger.debug(sql);

            connection.query(sql, function (error, rows) {
                if (error)
                    reject(error);
                else
                    resolve({"interface": data, "ipobjs": rows});
            });
        });
    });
};

/**
 * Get ipobj by id and Group
 * 
 * @method getIpobjGroup
 * 
 * @param {Integer} fwcloud FwCloud identifier
 * @param {Integer} idgroup id Group identifier
 * @param {Integer} id id ipobj identifier
 * 
 * @return {ROW} Returns ROW Data from Ipobj
 * */
ipobjModel.getIpobjGroup = function (fwcloud, idgroup, id, callback) {
    db.get(function (error, connection) {
        if (error)
            callback(error, null);

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

/**
 * Get ipobj by name
 * 
 * @method getIpobjName
 * 
 * @param {Integer} fwcloud FwCloud identifier
 * @param {String} name name ipobj identifier
 * 
 * @return {ROW} Returns ROW Data from Ipobj
 * */
ipobjModel.getIpobjName = function (fwcloud, name, callback) {
    db.get(function (error, connection) {
        if (error)
            callback(error, null);
        var namesql = '%' + name + '%';

        var sql = 'SELECT I.*, T.id id_node, T.id_parent id_parent_node  FROM ' + tableModel + ' I ' +
                ' inner join fwc_tree T on T.id_obj=I.id and T.obj_type=I.type AND (T.fwcloud=' + connection.escape(fwcloud) + ' OR T.fwcloud IS NULL)' +
                ' inner join fwc_tree P on P.id=T.id_parent  and P.obj_type<>20 and P.obj_type<>21' +
                ' WHERE I.name like  = ' + connection.escape(namesql) + ' AND (I.fwcloud=' + connection.escape(fwcloud) + ' OR I.fwcloud IS NULL)';

        //var sql = 'SELECT * FROM ' + tableModel + ' WHERE name like  ' + connection.escape(namesql) + ' AND (T.fwcloud=' + connection.escape(fwcloud) + ' OR T.fwcloud IS NULL) ';

        connection.query(sql, function (error, row) {
            if (error)
                callback(error, null);
            else
                callback(null, row);
        });
    });
};



/**
 * Add ipobj
 * 
 * @method insertIpobj
 * 
 * @param {Object} ipobjData Ipobj Data
 * 
 * @return {JSON} Returns JSON result
 * @example 
 * #### JSON RESPONSE OK:
 *      {result: true, "insertId": result.insertId}
 * 
 * #### JSON RESPONSE ERROR:
 *      {result: false, "insertId": ''}
 * */
ipobjModel.insertIpobj = function (ipobjData, callback) {
    db.get(function (error, connection) {
        if (error)
            callback(error, null);
        connection.query('INSERT INTO ' + tableModel + ' SET ?', ipobjData, function (error, result) {
            if (error) {
                callback(error, null);
            } else {
                if (result.affectedRows > 0) {
                    //devolvemos la última id insertada
                    callback(null, {result: true, "insertId": result.insertId});
                } else
                    callback(null, {result: false, "insertId": ''});
            }
        });
    });
};

/**
 * Update ipobj
 * 
 * @method updateIpobj
 * 
 * @param {Object} ipobjData Ipobj Data
 * 
 * @return {JSON} Returns JSON result
 * @example 
 * #### JSON RESPONSE OK:
 *      {result: true}
 * 
 * #### JSON RESPONSE ERROR:
 *      {result: false}
 * */
ipobjModel.updateIpobj = function (ipobjData, callback) {

    db.get(function (error, connection) {
        if (error)
            callback(error, null);
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
                    callback(null, {"result": true});
                } else {
                    callback(null, {"result": false});
                }
            }
        });
    });
};

/**
 * ### Delete ipobj
 * 
 * @method deleteIpobj
 * 
 * @param {Integer} id id ipobj identifier
 * @param {Integer} type ipobj type
 * @param {Integer} fwcloud FwCloud identifier
 * 
 * @return {JSON} Returns JSON result
 * @example 
 * #### JSON RESPONSE OK:
 * 
 *      {"result": true, "msg": "deleted"}
 * 
 * #### JSON RESPONSE ERROR NOT EXIST:
 * 
 *      {"result": false, "msg": "notExist"}
 *      
 * #### JSON RESPONSE RESTRICTED:
 * 
 *      {"result": false, "msg": "Restricted", "restrictions": data.search}
 * */
ipobjModel.deleteIpobj = function (id, type, fwcloud, callback) {

    db.get(function (error, connection) {
        if (error)
            callback(error, null);
        var sql = 'DELETE FROM ' + tableModel + ' WHERE id = ' + connection.escape(id) + ' AND fwcloud=' + connection.escape(fwcloud) + ' AND type=' + connection.escape(type);
        logger.debug(sql);
        connection.query(sql, function (error, result) {
            if (error) {
                logger.debug(error);
                callback(error, null);
            } else {
                if (result.affectedRows > 0) {
                    logger.debug("OK DELETED IPOBJ: " + id + "  Type: " + type + "  Fwcloud: " + fwcloud);
                    callback(null, {"result": true, "msg": "deleted"});
                } else {
                    callback(null, {"result": false, "msg": "notExist"});
                }
            }
        });
    });

};


/**
 * ### check if IPOBJ Exists in any Group
 * 
 * @method checkIpobjInGroup
 * 
 * @param {Integer} ipobj id ipobj identifier
 * @param {Integer} type ipobj type
 * @param {Integer} fwcloud FwCloud identifier
 * 
 * @return {JSON} Returns JSON result
 * @example 
 * #### JSON RESPONSE OK:
 * 
 *      {"result": true};
 * 
 * #### JSON RESPONSE ERROR NOT EXIST:
 * 
 *      {"result": false};
 *      
 * */
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
            } else {
                logger.error(error);
                callback(null, {"result": false});
            }
        });
    });

};

ipobjModel.checkRestrictions = function (req, res, next) {
    req.restricted = {"result": true, "msg": "", "restrictions": ""};

    ipobjModel.searchIpobjInRules(req.params.id, req.params.type, req.fwcloud)
            .then(data => {
                if (data.result) {
                    logger.debug("RESTRICTED IPOBJ: " + req.params.id + "  Type: " + req.params.type + "  Fwcloud: " + req.fwcloud);
                    req.restricted = {"result": false, "msg": "Restricted", "restrictions": data.search};
                }
                next();
            })
            .catch(e => next());
};

/**
 * ### searchIpobjInRules
 * Search where is used IPOBJ in RULES
 * 
 * @method searchIpobjInRules
 * 
 * @param {Integer} id id ipobj identifier
 * @param {Integer} type ipobj type
 * @param {Integer} fwcloud FwCloud identifier
 * 
 * @return {JSON} Returns JSON result
 * @example #### JSON RESPONSE OK
 * 
 *          {"result": true, "msg": "IPOBJ FOUND", 
 *              "search":
 *                  {   "IpobjInRules": data_ipobj, 
 *                      "GroupInRules": data_grouprule, 
 *                      "IpobjInGroup": data_group,
 *                      "InterfacesIpobjInRules": data_interfaces, 
 *                      "InterfacesFIpobjInRules": data_interfaces_f,
 *                      "InterfacesAboveIpobjInRules": data_interfaces_above,
 *                      "HostIpobjInterfacesIpobjInRules": data_ipobj_host, 
 *                      "IpobjInterfacesIpobjInRules": data_ipobj_ipobj
 *                  }
 *          }
 * 
 * #### JSON RESPONSE ERROR NOT EXIST:
 * 
 *      {"result": false, "msg": "IPOBJ NOT FOUND", 
 *          "search": {
 "IpobjInRules": "", 
 "GroupInRules": "",
 "IpobjInGroup": "", 
 "InterfacesIpobjInRules": "", 
 "InterfacesFIpobjInRules": "",
 "InterfacesAboveIpobjInRules": "",
 "HostIpobjInterfacesIpobjInRules": "", 
 "IpobjInterfacesIpobjInRules": ""
 }
 }
 *      
 * */
ipobjModel.searchIpobjInRules = function (id, type, fwcloud) {
    return new Promise((resolve, reject) => {
        //SEARCH IPOBJ IN RULES
        Policy_r__ipobjModel.searchIpobjInRule(id, type, fwcloud, function (error, data_ipobj) {
            if (error) {
                reject(error);
            } else {
                //SEARCH IPOBJ GROUP IN RULES
                Policy_r__ipobjModel.searchIpobjGroupInRule(id, type, fwcloud, function (error, data_grouprule) {
                    if (error) {
                        reject(error);
                    } else {
                        //SEARCH IPOBJ IN GROUPS
                        Ipobj__ipobjgModel.searchIpobjGroup(id, type, fwcloud, function (error, data_group) {
                            if (error) {
                                reject(error);
                            } else {
                                //SEARCH INTERFACES UNDER IPOBJ HOST IN RULES  'O'  POSITIONS
                                Policy_r__ipobjModel.searchInterfacesIpobjHostInRule(id, type, fwcloud, function (error, data_interfaces) {
                                    if (error) {
                                        reject(error);
                                    } else {
                                        //SEARCH INTERFACES ABOVE IPOBJ  IN RULES  'O'  POSITIONS
                                        Policy_r__ipobjModel.searchInterfacesAboveIpobjInRule(id, type, fwcloud, function (error, data_interfaces_above) {
                                            if (error) {
                                                reject(error);
                                            } else {
                                                //SEARCH INTERFACES WITH IPOBJ UNDER  IN RULES  'I'  POSITIONS
                                                Policy_r__interfaceModel.searchInterfacesInRule(id, fwcloud, function (error, data_interfaces_f) {
                                                    if (error) {
                                                        reject(error);
                                                    } else {
                                                        //SEARCH IF IPOBJ UNDER INTERFACES UNDER IPOBJ HOST Has HOST IN RULES 'O' POSITIONS                                            
                                                        Policy_r__ipobjModel.searchIpobjInterfacesIpobjHostInRule(id, type, fwcloud, function (error, data_ipobj_host) {
                                                            if (error) {
                                                                reject(error);
                                                            } else {
                                                                //SEARCH IF IPOBJ UNDER INTERFACES UNDER IPOBJ HOST Has HOST IN RULES 'O' POSITIONS                                            
                                                                Policy_r__ipobjModel.searchIpobjInterfacesIpobjInRule(id, type, fwcloud, function (error, data_ipobj_ipobj) {
                                                                    if (error) {
                                                                        reject(error);
                                                                    } else {
                                                                        if (data_ipobj.found !== "" || data_grouprule.found !== "" || data_group.found !== ""
                                                                                || data_interfaces.found !== "" || data_ipobj_host.found !== "" || data_ipobj_ipobj.found !== ""
                                                                                || data_interfaces_f.found !== "") {
                                                                            resolve({"result": true, "msg": "IPOBJ FOUND", "search":
                                                                                        {"IpobjInRules": data_ipobj, "GroupInRules": data_grouprule, "IpobjInGroup": data_group,
                                                                                            "InterfacesIpobjInRules": data_interfaces, "InterfacesFIpobjInRules": data_interfaces_f,
                                                                                            "InterfacesAboveIpobjInRules": data_interfaces_above,
                                                                                            "HostIpobjInterfacesIpobjInRules": data_ipobj_host, "IpobjInterfacesIpobjInRules": data_ipobj_ipobj
                                                                                        }});
                                                                        } else {
                                                                            resolve({"result": false, "msg": "IPOBJ NOT FOUND", "search": {
                                                                                    "IpobjInRules": "", "GroupInRules": "",
                                                                                    "IpobjInGroup": "", "InterfacesIpobjInRules": "", "InterfacesFIpobjInRules": "",
                                                                                    "InterfacesAboveIpobjInRules": "",
                                                                                    "HostIpobjInterfacesIpobjInRules": "", "IpobjInterfacesIpobjInRules": ""}});
                                                                        }
                                                                    }
                                                                });
                                                            }
                                                        });
                                                    }
                                                });
                                            }
                                        });
                                    }
                                });
                            }
                        });
                    }
                });
            }

        });
    });
};

/**
 * ### searchIpobj
 * Search where is used IPOBJ
 * 
 * @method searchIpobj
 * 
 * @param {Integer} id id ipobj identifier
 * @param {Integer} type ipobj type
 * @param {Integer} fwcloud FwCloud identifier
 * 
 * @return {JSON} Returns JSON result
 * @example #### JSON RESPONSE OK
 * 
 *          {"result": true, "msg": "IPOBJ FOUND", 
 *              "search": {
 *                  "IpobjInRules": data_ipobj, 
 *                  "IpobjInGroup": data_group, 
 *                  "IpobjInterfaces": data_ipobj_interfaces
 *                  }
 *          }
 * 
 * #### JSON RESPONSE ERROR NOT EXIST:
 * 
 *      {"result": false, "msg": "IPOBJ NOT FOUND", 
 *              "search": {
 *                  "IpobjInRules": "", 
 *                  "IpobjInGroup": "", 
 *                  "IpobjInterfaces": ""
 *               }
 *      }
 *      
 * */
ipobjModel.searchIpobj = function (id, type, fwcloud, callback) {
    //SEARCH IPOBJ IN RULES
    Policy_r__ipobjModel.searchIpobjInRule(id, type, fwcloud, function (error, data_ipobj) {
        if (error) {
            callback(error, null);
        } else {
            //SEARCH IPOBJ IN GROUPS
            Ipobj__ipobjgModel.searchIpobjGroup(id, type, fwcloud, function (error, data_group) {
                if (error) {
                    callback(error, null);
                } else {
                    //SEARCH IPOBJ UNDER INTERFACES UNDER IPOBJ HOST IN RULES 'O' POSITONS
                    Policy_r__ipobjModel.searchIpobjInterfaces(id, type, fwcloud, function (error, data_ipobj_interfaces) {
                        if (error) {
                            callback(error, null);
                        } else {

                            //logger.debug(data_ipobj);
                            if (data_ipobj.found !== "" || data_group.found !== "" || data_ipobj_interfaces.found !== "") {
                                callback(null, {"result": true, "msg": "IPOBJ FOUND", "search": {
                                        "IpobjInRules": data_ipobj, "IpobjInGroup": data_group, "IpobjInterfaces": data_ipobj_interfaces}});
                            } else {
                                callback(null, {"result": false, "msg": "IPOBJ NOT FOUND", "search": {
                                        "IpobjInRules": "", "IpobjInGroup": "", "IpobjInterfaces": ""}});
                            }

                        }
                    });
                }
            });
        }
    });

};
