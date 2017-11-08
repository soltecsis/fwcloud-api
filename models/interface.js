var db = require('../db.js');
var Policy_r__ipobjModel = require('../models/policy_r__ipobj');
var Policy_r__interfaceModel = require('../models/policy_r__interface');
var Interface__ipobjModel = require('../models/interface__ipobj');


//create object
var interfaceModel = {};
var tableModel = "interface";

/**
 * Property Logger to manage App logs
 *
 * @property logger
 * @type log4js/app
 * 
 */
var logger = require('log4js').getLogger("app");

//Get All interface by firewall
interfaceModel.getInterfaces = function (idfirewall, fwcloud, callback) {

    db.get(function (error, connection) {
        if (error)
            return done('Database problem');
        //var sql = 'SELECT * FROM ' + tableModel + ' WHERE (firewall=' + connection.escape(idfirewall) + ' OR firewall is NULL) ' + ' ORDER BY id';
        var sql = 'SELECT I.*,  T.id id_node, T.id_parent id_parent_node, J.fwcloud   FROM ' + tableModel + ' I ' +  
                ' inner join fwc_tree T on T.id_obj=I.id and T.obj_type=I.interface_type AND (T.fwcloud=' + connection.escape(fwcloud) + ' OR T.fwcloud IS NULL) ' +
                ' left join interface__ipobj O on O.interface=I.id left join ipobj J ON J.id=O.ipobj ' +
                ' WHERE (I.firewall=' + connection.escape(idfirewall) + ')';
        
        
        connection.query(sql, function (error, rows) {
            if (error)
                callback(error, null);
            else
                callback(null, rows);
        });
    });
};

//Get All interface by HOST
interfaceModel.getInterfacesHost = function (idhost, fwcloud, callback) {

    db.get(function (error, connection) {
        if (error)
            return done('Database problem');
        //var sql = 'SELECT * FROM ' + tableModel + ' WHERE (firewall=' + connection.escape(idfirewall) + ' OR firewall is NULL) ' + ' ORDER BY id';
        var sql = 'SELECT I.*,  T.id id_node, T.id_parent id_parent_node, J.fwcloud  FROM ' + tableModel + ' I ' +  
                ' inner join fwc_tree T on T.id_obj=I.id and T.obj_type=I.interface_type AND (T.fwcloud=' + connection.escape(fwcloud) + ' OR T.fwcloud IS NULL) ' +
                ' inner join interface__ipobj O on O.interface=I.id left join ipobj J ON J.id=O.ipobj' +
                ' WHERE (O.ipobj=' + connection.escape(idhost) + ')';
        
        
        connection.query(sql, function (error, rows) {
            if (error)
                callback(error, null);
            else
                callback(null, rows);
        });
    });
};




//Get interface by  id and interface
interfaceModel.getInterface = function (idfirewall,fwcloud, id, callback) {
    db.get(function (error, connection) {
        if (error)
            return done('Database problem');
        var sql = 'SELECT I.*,  T.id id_node, T.id_parent id_parent_node, J.fwcloud  FROM ' + tableModel + ' I ' +  
                ' inner join fwc_tree T on T.id_obj=I.id and T.obj_type=I.interface_type AND (T.fwcloud=' + connection.escape(fwcloud) + ' OR T.fwcloud IS NULL) ' +
                ' left join interface__ipobj O on O.interface=I.id left join ipobj J ON J.id=O.ipobj ' +
                ' WHERE I.id = ' + connection.escape(id) + ' AND (I.firewall=' + connection.escape(idfirewall) + ' OR I.firewall is NULL)';
        logger.debug(sql);
        connection.query(sql, function (error, row) {
            if (error)
                callback(error, null);
            else
                callback(null, row);
        });
    });
};

//Get interface by  id fwb
interfaceModel.getInterface_fwb = function (idfirewall, id_fwb, callback) {
    db.get(function (error, connection) {
        if (error)
            return done('Database problem');
        var sql = 'SELECT * FROM ' + tableModel + ' WHERE id_fwb = ' + connection.escape(id_fwb) + ' AND (firewall=' + connection.escape(idfirewall)+ ' OR firewall is NULL)';
        connection.query(sql, function (error, row) {
            if (error)
                callback(error, null);
            else
                callback(null, row);
        });
    });
};

//Get interface by name and interface
interfaceModel.getInterfaceName = function (idfirewall,fwcloud, name, callback) {
    db.get(function (error, connection) {
        if (error)
            return done('Database problem');
        var namesql = '%' + name + '%';
        //var sql = 'SELECT * FROM ' + tableModel + ' WHERE name like  ' + connection.escape(namesql) + ' AND  (firewall=' + connection.escape(idfirewall) + ' OR firewall is NULL)';

        var sql = 'SELECT I.*,  T.id id_node, T.id_parent id_parent_node, J.fwcloud  FROM ' + tableModel + ' I ' +  
                ' inner join fwc_tree T on T.id_obj=I.id and T.obj_type=I.interface_type AND (T.fwcloud=' + connection.escape(fwcloud) + ' OR T.fwcloud IS NULL) ' +
                ' left join interface__ipobj O on O.interface=I.id left join ipobj J ON J.id=O.ipobj ' +
                ' WHERE I.name like ' + connection.escape(namesql) + ' AND (I.firewall=' + connection.escape(idfirewall) + ' OR I.firewall is NULL)';
        
        connection.query(sql, function (error, row) {
            if (error)
                callback(error, null);
            else
                callback(null, row);
        });
    });
};

interfaceModel.searchInterfaceInrules = function (id, type, fwcloud, callback) {
    //SEARCH INTERFACE IN RULES
    Policy_r__ipobjModel.searchIpobjInRule(id, type, fwcloud, function (error, data_ipobj) {
        if (error) {
            callback(error, null);
        } else {
            //SEARCH IPOBJ IN GROUPS
            Policy_r__ipobjModel.searchIpobjGroup(id, type, fwcloud, function (error, data_group) {
                if (error) {
                    callback(error, null);
                } else {
                    //SEARCH IPOBJ UNDER INTERFACES UNDER IPOBJ HOST IN RULES
                    Policy_r__ipobjModel.searchIpobjInterfaces(id, type, fwcloud, function (error, data_ipobj_interfaces) {
                        if (error) {
                            callback(error, null);
                        } else {
                            //logger.debug(data_ipobj);
                            if (data_ipobj.found !== "" || data_group.found !== "" || data_ipobj_interfaces.found !== "") {
                                callback(null, {"result": true, "msg": "IPOBJ FOUND",
                                    "IpobjInRules": data_ipobj, "IpobjInGroup": data_group, "IpobjInterfaces": data_ipobj_interfaces});
                            } else {
                                callback(null, {"result": false, "msg": "IPOBJ NOT FOUND", "IpobjInRules": "", "IpobjInGroup": "", "IpobjInterfaces": ""});
                            }
                        }
                    });
                }
            });
        }
    });
};

interfaceModel.searchInterface = function (id, type, fwcloud, callback) {
    //SEARCH INTERFACE IN RULES
    Policy_r__interfaceModel.SearchInterfaceInRules(id, type, fwcloud, function (error, data_rules) {
        if (error) {
            callback(error, null);
        } else {
            //SEARCH INTERFACE IN FIREWALL
            interfaceModel.searchInterfaceInFirewalls(id, type, fwcloud, function (error, data_firewalls) {
                if (error) {
                    callback(error, null);
                } else {
                    //SEARCH INTERFACE IN HOSTS
                    Interface__ipobjModel.getInterface__ipobj_hosts(id, fwcloud, function (error, data_hosts) {
                        if (error) {
                            callback(error, null);
                        } else {

                            //logger.debug(data_ipobj);
                            if (data_rules.found !== "" || data_firewalls.found !== "" || data_hosts.found !== "") {
                                callback(null, {"result": true, "msg": "IPOBJ FOUND",
                                    "InterfaceInRules": data_rules, "InterfaceInFirewalls": data_firewalls, "InterfaceInHosts": data_hosts});
                            } else {
                                callback(null, {"result": false, "msg": "IPOBJ NOT FOUND", "InterfaceInRules": "", "InterfaceInFirewalls": "", "InterfaceInHosts": ""});
                            }

                        }
                    });
                }
            });
        }
    });

};

//Search Interfaces in Firewalls
interfaceModel.searchInterfaceInFirewalls = function (interface, type, fwcloud, callback) {

    db.get(function (error, connection) {

        var sql = 'SELECT I.id obj_id,I.name obj_name, I.interface_type obj_type_id,T.type obj_type_name, ' +
                'C.id cloud_id, C.name cloud_name, F.id firewall_id, F.name firewall_name   ' +
                'from interface I ' +
                'inner join ipobj_type T on T.id=I.interface_type ' +
                'INNER JOIN firewall F on F.id=I.firewall   ' +
                'inner join fwcloud C on C.id=F.fwcloud ' +
                ' WHERE I.id=' + connection.escape(interface) + ' AND I.interface_type=' + connection.escape(type) + ' AND F.fwcloud=' + connection.escape(fwcloud);
        logger.debug(sql);
        connection.query(sql, function (error, rows) {
            if (!error) {
                if (rows.length > 0) {                                            
                        callback(null, {"found": rows});
                    
                } else
                    callback(null, {"found": ""});
            } else {
                logger.error(error);
                callback(null, {"found": ""});
            }
        });
    });

};


//Add new interface from user
interfaceModel.insertInterface = function (interfaceData, callback) {
    db.get(function (error, connection) {
        if (error)
            return done('Database problem');
        connection.query('INSERT INTO ' + tableModel + ' SET ?', interfaceData, function (error, result) {
            if (error) {
                logger.debug(error);
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

//Update interface from user
interfaceModel.updateInterface = function (interfaceData, callback) {

    db.get(function (error, connection) {
        if (error)
            return done('Database problem');
        var sql = 'UPDATE ' + tableModel + ' SET name = ' + connection.escape(interfaceData.name) + ',' +
                'firewall = ' + connection.escape(interfaceData.firewall) + ',' +
                'labelName = ' + connection.escape(interfaceData.labelName) + ', ' +
                'type = ' + connection.escape(interfaceData.type) + ', ' +
                'interface_type = ' + connection.escape(interfaceData.interface_type) + ', ' +
                'comment = ' + connection.escape(interfaceData.comment) + ', ' +
                'securityLevel = ' + connection.escape(interfaceData.securityLevel) + ' ' +
                ' WHERE id = ' + interfaceData.id + ' AND firewall=' + connection.escape(interfaceData.firewall);
        logger.debug(sql);
        connection.query(sql, function (error, result) {
            if (error) {
                logger.debug(error);
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

//Remove interface with id to remove
//FALTA BORRADO EN CASCADA 
interfaceModel.deleteInterface = function (fwcloud, idfirewall, id, type, callback) {

    //Check interface in RULE O POSITIONS
    Policy_r__ipobjModel.checkInterfaceInRule(id, type, fwcloud, idfirewall, function (error, data) {
        if (error) {
            callback(error, null);
        } else {
            logger.debug(data);
            if (!data.result) {
                //Check interface in RULE I POSITIONS
                Policy_r__interfaceModel.checkInterfaceInRule(id, type, fwcloud, idfirewall, function (error, data) {
                    if (error) {
                        callback(error, null);
                    } else {
                        logger.debug(data);
                        if (!data.result) {
                            //CHECK IPOBJ UNDER INTEFACE in RULE
                            Policy_r__ipobjModel.checkOBJInterfaceInRule(id, fwcloud, function (error, data) {
                                if (error) {
                                    callback(error, null);
                                } else {
                                    logger.debug(data);
                                    if (!data.result) {

                                        //CHECK HOST INTEFACE in RULE
                                        Policy_r__ipobjModel.checkHOSTInterfaceInRule(id, type, fwcloud, idfirewall, function (error, data) {
                                            if (error) {
                                                callback(error, null);
                                            } else {
                                                logger.debug(data);
                                                if (!data.result) {
                                                    db.get(function (error, connection) {
                                                        if (error)
                                                            return done('Database problem');
                                                        var sqlExists = 'SELECT * FROM ' + tableModel + '  WHERE id = ' + connection.escape(id) + ' AND interface_type=' + connection.escape(type) + ' AND firewall=' + connection.escape(idfirewall);
                                                        connection.query(sqlExists, function (error, row) {
                                                            //If exists Id from interface to remove
                                                            if (row) {
                                                                db.get(function (error, connection) {
                                                                    var sql = 'DELETE FROM ' + tableModel + ' WHERE id = ' + connection.escape(id) + ' AND interface_type=' + connection.escape(type) + ' AND firewall=' + connection.escape(idfirewall);
                                                                    connection.query(sql, function (error, result) {
                                                                        if (error) {
                                                                            logger.debug(error);
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
                                                } else
                                                    callback(null, {"msg": "Restricted","by":"by HOST"});
                                            }
                                        });
                                    } else
                                        callback(null, {"msg": "Restricted","by":"by IPOBJ"});
                                }
                            });
                        } else
                            callback(null, {"msg": "Restricted","by":"by Inteface I"});
                    }
                });
            } else
                callback(null, {"msg": "Restricted","by":"by Interface O"});
        }
    });
};
//Export the object
module.exports = interfaceModel;