var db = require('../../db.js');

//create object
var interfaceModel = {};
//Export the object
module.exports = interfaceModel;


var Policy_r__ipobjModel = require('../../models/policy/policy_r__ipobj');
var Policy_r__interfaceModel = require('../../models/policy/policy_r__interface');
var Interface__ipobjModel = require('../../models/interface/interface__ipobj');
var utilsModel = require("../../utils/utils.js");
var IpobjModel = require('../../models/ipobj/ipobj');

var data_policy_position_ipobjs = require('../../models/data/data_policy_position_ipobjs');



var tableModel = "interface";


var logger = require('log4js').getLogger("app");

//Get All interface by firewall
interfaceModel.getInterfaces = function (idfirewall, fwcloud, callback) {

    db.get(function (error, connection) {
        if (error)
            callback(error, null);
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

//Get All interface by firewall and IPOBJ UNDER Interfaces
interfaceModel.getInterfacesFull = function (idfirewall, fwcloud, callback) {

    db.get(function (error, connection) {
        if (error)
            callback(error, null);
        //var sql = 'SELECT * FROM ' + tableModel + ' WHERE (firewall=' + connection.escape(idfirewall) + ' OR firewall is NULL) ' + ' ORDER BY id';
        var sql = 'SELECT ' + fwcloud + ' as fwcloud, I.*,  T.id id_node, T.id_parent id_parent_node   FROM ' + tableModel + ' I ' +
                ' inner join fwc_tree T on T.id_obj=I.id and T.obj_type=I.interface_type AND (T.fwcloud=' + connection.escape(fwcloud) + ' OR T.fwcloud IS NULL) ' +
                ' WHERE (I.firewall=' + connection.escape(idfirewall) + ') ';
        logger.debug(sql);
        connection.query(sql, function (error, rows) {
            if (error)
                callback(error, null);
            else {
                logger.debug("-----> BUSCANDO INTERFACES FIREWALL: ", idfirewall, " CLOUD: ", fwcloud);
                //Bucle por interfaces
                Promise.all(rows.map(IpobjModel.getAllIpobjsInterfacePro))
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

//Get All interface by HOST
interfaceModel.getInterfacesHost = function (idhost, fwcloud, callback) {

    db.get(function (error, connection) {
        if (error)
            callback(error, null);
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

//Get All interface by HOST and IPOBJECTS UNDER INTERFACES
interfaceModel.getInterfacesHost_Full_Pro = function (idhost, fwcloud) {
    return new Promise((resolve, reject) => {
        db.get(function (error, connection) {
            if (error)
                reject(error);
            //SELECT INTERFACES UNDER HOST
            var sql = 'SELECT I.*,  T.id id_node, T.id_parent id_parent_node, J.fwcloud  FROM ' + tableModel + ' I ' +
                    ' inner join fwc_tree T on T.id_obj=I.id and T.obj_type=I.interface_type AND (T.fwcloud=' + connection.escape(fwcloud) + ' OR T.fwcloud IS NULL) ' +
                    ' inner join interface__ipobj O on O.interface=I.id left join ipobj J ON J.id=O.ipobj' +
                    ' WHERE (O.ipobj=' + connection.escape(idhost) + ')';

            connection.query(sql, function (error, rows) {
                if (error)
                    reject(error);
                else {
                    //BUCLE DE INTERFACES del HOST -> Obtenemos IPOBJS por cada Interface
                    Promise.all(rows.map(interfaceModel.getInterfaceFullProData))
                            .then(dataI => {
                                //dataI es una Inteface y sus ipobjs
                                //logger.debug("-------------------------> FINAL INTERFACES UNDER HOST : ");
                                resolve(dataI);
                            })
                            .catch(e => {
                                reject(e);
                            });
                }
            });
        });
    });
};

//Get interface by  id and interface
interfaceModel.getInterfaceHost = function (idhost, fwcloud, id, callback) {
    db.get(function (error, connection) {
        if (error)
            callback(error, null);
        var sql = 'SELECT I.*,  T.id id_node, T.id_parent id_parent_node, ' +
                ' IF(I.interface_type=10,  F.fwcloud , J.fwcloud) as fwcloud, ' +
                ' F.id as firewall_id, F.name as firewall_name, F.cluster as cluster_id, C.name as cluster_name, ' +
                ' J.id as host_id, J.name as host_name ' +
                ' FROM ' + tableModel + ' I ' +
                ' inner join fwc_tree T on T.id_obj=I.id and T.obj_type=I.interface_type ' +
                ' AND (T.fwcloud=' + connection.escape(fwcloud) + ' OR T.fwcloud IS NULL) ' +
                ' left join interface__ipobj O on O.interface=I.id ' +
                ' left join ipobj J ON J.id=O.ipobj ' +
                ' left join firewall F on F.id=I.firewall ' +
                ' left join cluster C on C.id=F.cluster ' +
                ' WHERE I.id = ' + connection.escape(id) ;
                
        //logger.debug("INTERFACE SQL: " + sql);
        connection.query(sql, function (error, row) {
            if (error){
                logger.debug("ERROR getinterface: " , error, "\n", sql);
                callback(error, null);
            }
            else
                callback(null, row);
        });
    });
};

//Get interface by  id and interface
interfaceModel.getInterface = function (idfirewall, fwcloud, id, callback) {
    db.get(function (error, connection) {
        if (error)
            callback(error, null);
        var sql = 'SELECT I.*,  T.id id_node, T.id_parent id_parent_node, ' +
                ' IF(I.interface_type=10,  F.fwcloud , J.fwcloud) as fwcloud, ' +
                ' F.id as firewall_id, F.name as firewall_name, F.cluster as cluster_id, C.name as cluster_name, ' +
                ' J.id as host_id, J.name as host_name ' +
                ' FROM ' + tableModel + ' I ' +
                ' inner join fwc_tree T on T.id_obj=I.id and T.obj_type=I.interface_type ' +
                ' AND (T.fwcloud=' + connection.escape(fwcloud) + ' OR T.fwcloud IS NULL) ' +
                ' left join interface__ipobj O on O.interface=I.id ' +
                ' left join ipobj J ON J.id=O.ipobj ' +
                ' left join firewall F on F.id=I.firewall ' +
                ' left join cluster C on C.id=F.cluster ' +
                ' WHERE I.id = ' + connection.escape(id) ;
                //Quitamos filtro de firewall
                //' AND (I.firewall=' + connection.escape(idfirewall) + ' OR I.firewall is NULL)';
        //logger.debug("INTERFACE SQL: " + sql);
        connection.query(sql, function (error, row) {
            if (error){
                logger.debug("ERROR getinterface: " , error, "\n", sql);
                callback(error, null);
            }
            else
                callback(null, row);
        });
    });
};

//Get interface by  id and interface
interfaceModel.getInterfacePro = function (idfirewall, fwcloud, id) {
    return new Promise((resolve, reject) => {
        db.get(function (error, connection) {
            if (error)
                reject(error);
            var sql = 'SELECT I.*,  T.id id_node, T.id_parent id_parent_node, ' +
                    ' IF(I.interface_type=10,  F.fwcloud , J.fwcloud) as fwcloud ' +
                    ' FROM ' + tableModel + ' I ' +
                    ' inner join fwc_tree T on T.id_obj=I.id and T.obj_type=I.interface_type ' +
                    ' AND (T.fwcloud=' + connection.escape(fwcloud) + ' OR T.fwcloud IS NULL) ' +
                    ' left join interface__ipobj O on O.interface=I.id ' +
                    ' left join ipobj J ON J.id=O.ipobj ' +
                    ' left join firewall F on F.id=I.firewall ' +
                    ' WHERE I.id = ' + connection.escape(id) ;
                    //' AND (I.firewall=' + connection.escape(idfirewall) + ' OR I.firewall is NULL)';
            connection.query(sql, function (error, row) {
                if (error)
                    reject(error);
                else
                    resolve(row);
            });
        });
    });
};

interfaceModel.getInterfaceFullProData = function (data) {
    return new Promise((resolve, reject) => {
        interfaceModel.getInterfaceFullPro(data.idfirewall, data.fwcloud, data.id)
                .then(dataI => {
                    resolve(dataI);
                })
                .catch(e => {
                    reject(e);
                });
    });
};

//Get interface by  id and interface
interfaceModel.getInterfaceFullPro = function (idfirewall, fwcloud, id) {
    return new Promise((resolve, reject) => {
        db.get(function (error, connection) {
            if (error)
                reject(error);
            //SELECT INTERFACE
            var sql = 'SELECT I.*,  T.id id_node, T.id_parent id_parent_node, ' +
                    ' IF(I.interface_type=10,  F.fwcloud , J.fwcloud) as fwcloud ' +
                    ' FROM ' + tableModel + ' I ' +
                    ' inner join fwc_tree T on T.id_obj=I.id and T.obj_type=I.interface_type ' +
                    ' AND (T.fwcloud=' + connection.escape(fwcloud) + ' OR T.fwcloud IS NULL) ' +
                    ' left join interface__ipobj O on O.interface=I.id ' +
                    ' left join ipobj J ON J.id=O.ipobj ' +
                    ' left join firewall F on F.id=I.firewall ' +
                    ' WHERE I.id = ' + connection.escape(id) ;
                    //' AND (I.firewall=' + connection.escape(idfirewall) + ' OR I.firewall is NULL)';
            //logger.debug("getInterfaceFullPro ->", sql);
            connection.query(sql, function (error, row) {
                if (error)
                    reject(error);
                else {
                    //GET ALL IPOBJ UNDER INTERFACE
                    //logger.debug("INTERFACE -> " , row[0]);
                    IpobjModel.getAllIpobjsInterfacePro(row[0])
                            .then(dataI => {                                
                                Promise.all(dataI.ipobjs.map(IpobjModel.getIpobjPro))
                                        .then(dataO => {
                                            //dataI.ipobjs = dataO;
                                            //logger.debug("-------------------------> FINAL de IPOBJS UNDER INTERFACE : " + id + " ----");
                                            //resolve({"id": position.id, "name": position.name, "position_order": position.position_order, "ipobjs": dataI});
                                            var interface = new data_policy_position_ipobjs(row[0], 0, 0, 'I');
                                            interface.ipobjs = dataO;
                                            resolve(interface);
                                            //resolve(dataO);
                                        })
                                        .catch(e => {
                                            reject(e);
                                        });
                            })
                            .catch(e => {
                                resolve({});
                            });
                }
            });
        });
    });
};

//Get interface by  id fwb
interfaceModel.getInterface_fwb = function (idfirewall, id_fwb, callback) {
    db.get(function (error, connection) {
        if (error)
            callback(error, null);
        var sql = 'SELECT * FROM ' + tableModel + ' WHERE id_fwb = ' + connection.escape(id_fwb) + ' AND (firewall=' + connection.escape(idfirewall) + ' OR firewall is NULL)';
        connection.query(sql, function (error, row) {
            if (error)
                callback(error, null);
            else
                callback(null, row);
        });
    });
};

//Get data of interface 
interfaceModel.getInterface_data = function (id, type, callback) {
    db.get(function (error, connection) {
        if (error)
            callback(error, null);
        var sql = 'SELECT * FROM ' + tableModel + ' WHERE id = ' + connection.escape(id) + ' AND interface_type=' + connection.escape(type);

        connection.query(sql, function (error, row) {
            if (error || (row.length === 0))
                callback(error, null);
            else
                callback(null, row);
        });
    });
};

//Get interface by name and interface
interfaceModel.getInterfaceName = function (idfirewall, fwcloud, name, callback) {
    db.get(function (error, connection) {
        if (error)
            callback(error, null);
        var namesql = '%' + name + '%';
        //var sql = 'SELECT * FROM ' + tableModel + ' WHERE name like  ' + connection.escape(namesql) + ' AND  (firewall=' + connection.escape(idfirewall) + ' OR firewall is NULL)';

        var sql = 'SELECT I.*,  T.id id_node, T.id_parent id_parent_node, J.fwcloud  FROM ' + tableModel + ' I ' +
                ' inner join fwc_tree T on T.id_obj=I.id and T.obj_type=I.interface_type AND (T.fwcloud=' + connection.escape(fwcloud) + ' OR T.fwcloud IS NULL) ' +
                ' left join interface__ipobj O on O.interface=I.id left join ipobj J ON J.id=O.ipobj ' +
                ' WHERE I.name like ' + connection.escape(namesql) ;
                //' AND (I.firewall=' + connection.escape(idfirewall) + ' OR I.firewall is NULL)';

        connection.query(sql, function (error, row) {
            if (error)
                callback(error, null);
            else
                callback(null, row);
        });
    });
};


interfaceModel.checkRestrictionsOtherFirewall = function (req, res, next) {
    req.restricted = {"result": true, "msg": "", "restrictions": ""};

    interfaceModel.searchInterfaceInrulesOtherFirewall(req.fwcloud, req.params.idfirewall)
            .then(found_resp => {
                if (found_resp.found) {
                    logger.debug("RESTRICTED FIREWALL: " + req.params.idfirewall + "  Fwcloud: " + req.fwcloud);
                    //callback(null, {"result": false, "msg": "restricted", "search": found_resp});
                    req.restricted = {"result": false, "msg": "Restricted", "restrictions": found_resp};
                }
                next();
            })
            .catch(e => next());
};


/* Search where is in RULES ALL interfaces from OTHER FIREWALL  */
interfaceModel.searchInterfaceInrulesOtherFirewall = function (fwcloud, idfirewall) {
    return new Promise((resolve, reject) => {
        var found = false;
        var found_resp = "";

        interfaceModel.getInterfaces(idfirewall, fwcloud, async (error, data) => {
            if (error)
                return reject(error);
            for (i = 0; i < data.length; i++) {
                await interfaceModel.searchInterfaceInrulesPro(data[i].id, data[i].interface_type, fwcloud, idfirewall)
                        .then(resp => {
                            if (resp.result) {
                                var respI = {resp};
                                found = true;
                                var obj = "";
                                if (!utilsModel.isEmptyObject(found_resp)) {
                                    if (!utilsModel.isEmptyObject(respI))
                                        obj = utilsModel.mergeObj(found_resp, respI);
                                    else
                                        obj = found_resp;
                                } else {
                                    obj = respI;
                                }
                                found_resp = obj;
                            }
                        })
                        .catch();
            }
            if (!found)
                found_resp = "";
            else
                found_resp = {"found": true, "search": found_resp};
            //logger.debug("FINAL RESP: " + JSON.stringify(found_resp));
            resolve(found_resp);
        });

    });
};

interfaceModel.checkRestrictions = function (req, res, next) {
    req.restricted = {"result": true, "msg": "", "restrictions": ""};
    //Check interface in RULE O POSITIONS
    interfaceModel.searchInterfaceInrulesPro(req.params.id, req.params.type, req.fwcloud, '')
            .then(data =>
            {
                //CHECK RESULTS
                if (data.result) {
                    logger.debug("RESTRICTED INTERFACE: " + req.params.id + "  Type: " + req.params.type + "  Fwcloud: " + req.fwcloud);
                    req.restricted = {"result": false, "msg": "Restricted", "restrictions": data.search};
                }
                next();
            })
            .catch(e => next());
};


/* Search where is in RULES interface in OTHER FIREWALLS  */
interfaceModel.searchInterfaceInrulesPro = function (id, type, fwcloud, diff_firewall) {
    return new Promise((resolve, reject) => {
        logger.debug("SEARCHING INTERFACE: " + id + " - " + type + "  DIFF FW: " + diff_firewall);
        //SEARCH INTERFACE DATA
        interfaceModel.getInterface_data(id, type, function (error, data) {
            if (error) {
                reject(error);
            } else {
                if (data && data.length > 0) {
                    //FALTA REVISAR CONTROL de FIREWALL de INTERFAZ
                    //var firewall = data[0].firewall;
                    //logger.debug("firewall interface: " + firewall);
                    var firewall = null;

                    //SEARCH INTERFACE IN RULES I POSITIONS
                    Policy_r__interfaceModel.SearchInterfaceInRules(id, type, fwcloud, firewall, diff_firewall, function (error, data_rules_I) {
                        if (error) {
                            reject(error);
                        } else {
                            //SEARCH INTERFACE IN RULES O POSITIONS
                            Policy_r__ipobjModel.searchInterfaceInRule(id, type, fwcloud, firewall, diff_firewall, function (error, data_rules_O) {
                                if (error) {
                                    reject(error);
                                } else {
                                    //SEARCH IPOBJ UNDER INTERFACES WITH IPOBJ IN RULES
                                    Policy_r__ipobjModel.searchIpobjInterfacesInRules(id, type, fwcloud, firewall, diff_firewall, function (error, data_ipobj_interfaces) {
                                        if (error) {
                                            reject(error);
                                        } else {
                                            //SEARCH HOST with INTERFACE UNDER IPOBJ HOST WITH HOST IN RULES
                                            Policy_r__ipobjModel.searchHostInterfacesHostInRule(id, type, fwcloud, firewall, diff_firewall, function (error, data_host_interfaces) {
                                                if (error) {
                                                    reject(error);
                                                } else {
                                                    //logger.debug(data_ipobj);
                                                    if (data_rules_I.found !== "" || data_rules_O.found !== "" || data_host_interfaces.found !== "" || data_ipobj_interfaces.found !== "") {
                                                        var resp = {"result": true, "msg": "INTERFACE FOUND", "search": {}};
                                                        if (data_rules_I.found !== "")
                                                            resp.search["InterfaceInRules_I"] = data_rules_I;
                                                        if (data_rules_O.found !== "")
                                                            resp.search["InterfaceInRules_O"] = data_rules_O;
                                                        if (data_host_interfaces.found !== "")
                                                            resp.search["HostInterfaceInRules"] = data_host_interfaces;
                                                        if (data_ipobj_interfaces.found !== "")
                                                            resp.search["IpobjInterfaceInrules"] = data_ipobj_interfaces;



                                                        //var resp={"result": true, "msg": "INTERFACE FOUND", "search": {
                                                        //        "InterfaceInRules_I": data_rules_I, "InterfaceInRules_O": data_rules_O, "HostInterfaceInRules": data_host_interfaces,
                                                        //        "IpobjInterfaceInrules": data_ipobj_interfaces}};
                                                        resolve(resp);
                                                    } else {
                                                        //resolve({"result": false, "msg": "INTERFACE NOT FOUND", "search": {
                                                        //        "InterfaceInRules_I": "", "InterfaceInRules_O": "", "HostInterfaceInRules": "", "IpobjInterfaceInrules": ""}});
                                                        resolve({"result": false, "msg": "INTERFACE NOT FOUND", "search": {}});
                                                    }
                                                }
                                            });
                                        }
                                    });
                                }
                            });
                        }
                    });
                } else
                    resolve({"result": false, "msg": "INTERFACE NOT FOUND", "search": {}});
            }
        });
    });
};


/* Search where is used interface  */
interfaceModel.searchInterface = function (id, type, fwcloud, callback) {
    //SEARCH INTERFACE DATA
    interfaceModel.getInterface_data(id, type, function (error, data) {
        if (error) {
            callback(error, null);
        } else {
            logger.debug(data);
            if (data && data.length > 0) {
                //var firewall = data[0].firewall;
                //logger.debug("firewall interface: " + firewall);
                var firewall = null;

                //SEARCH INTERFACE IN RULES I POSITIONS
                Policy_r__interfaceModel.SearchInterfaceInRules(id, type, fwcloud, firewall, '', function (error, data_rules_I) {
                    if (error) {
                        callback(error, null);
                    } else {
                        //SEARCH INTERFACE IN RULES O POSITIONS
                        Policy_r__ipobjModel.searchInterfaceInRule(id, type, fwcloud, firewall, '', function (error, data_rules_O) {
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
                                                if (data_rules_I.found !== "" || data_rules_O.found !== "" || data_firewalls.found !== "" || data_hosts.found !== "") {
                                                    callback(null, {"result": true, "msg": "INTERFACE FOUND", "search": {
                                                            "InterfaceInRules_I": data_rules_I, "InterfaceInRules_O": data_rules_O, "InterfaceInFirewalls": data_firewalls, "InterfaceInHosts": data_hosts}});
                                                } else {
                                                    callback(null, {"result": false, "msg": "INTERFACE NOT FOUND", "search": {
                                                            "InterfaceInRules_I": "", "InterfaceInRules_O": "", "InterfaceInFirewalls": "", "InterfaceInHosts": ""}});
                                                }

                                            }
                                        });
                                    }
                                });
                            }
                        });
                    }
                });
            } else {
                callback(null, {"result": false, "msg": "INTERFACE NOT FOUND", "search": {
                        "InterfaceInRules_I": "", "InterfaceInRules_O": "", "InterfaceInFirewalls": "", "InterfaceInHosts": ""}});
            }
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
                ' WHERE I.id=' + connection.escape(interface) + ' AND I.interface_type=' + connection.escape(type) +
                ' AND F.fwcloud=' + connection.escape(fwcloud);
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
            callback(error, null);
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
            callback(error, null);
        var sql = 'UPDATE ' + tableModel + ' SET name = ' + connection.escape(interfaceData.name) + ',' +
                'labelName = ' + connection.escape(interfaceData.labelName) + ', ' +
                'type = ' + connection.escape(interfaceData.type) + ', ' +
                'comment = ' + connection.escape(interfaceData.comment) + ', ' +
                'mac = ' + connection.escape(interfaceData.mac) + ' ' +
                ' WHERE id = ' + interfaceData.id;
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

//Remove interface with id to remove
//FALTA BORRADO EN CASCADA 
interfaceModel.deleteInterface = function (fwcloud, idfirewall, id, type, callback) {

    db.get(function (error, connection) {
        if (error)
            callback(error, null);
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

};



//Remove all IPOBJ UNDER INTERFACES UNDER FIREWALL
interfaceModel.deleteInterfacesIpobjFirewall = function (fwcloud, idfirewall) {
    return new Promise((resolve, reject) => {
        db.get(function (error, connection) {
            if (error)
                reject(error);
            var sql = 'SELECT ' + fwcloud + ' as fwc, I.*   FROM ' + tableModel + ' I ' +
                    ' WHERE (I.firewall=' + connection.escape(idfirewall) + ') ';

            connection.query(sql, function (error, rows) {
                if (error)
                    reject(error);
                else {
                    logger.debug("-----> DELETING IPOBJ UNDER INTERFACE");
                    //Bucle por interfaces
                    Promise.all(rows.map(IpobjModel.deleteIpobjInterface))
                            .then(data => {
                                resolve(data);
                            })
                            .catch(e => {
                                reject(e);
                            });
                }
            });
        });
    });
};


//Remove ALL interface from Firewall
interfaceModel.deleteInterfaceFirewall = function (fwcloud, idfirewall) {
    return new Promise((resolve, reject) => {
        db.get(function (error, connection) {
            var sql = 'DELETE FROM ' + tableModel + ' WHERE firewall = ' + connection.escape(idfirewall);
            connection.query(sql, function (error, result) {
                if (error) {
                    logger.debug(error);
                    reject(error);
                } else {
                    if (result.affectedRows > 0)
                        resolve({"result": true, "msg": "deleted"});
                    else
                        resolve({"result": false, "msg": "notExist"});
                }
            });
        });

    });
};
