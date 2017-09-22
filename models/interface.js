var db = require('../db.js');
var Policy_r__ipobjModel = require('../models/policy_r__ipobj');
var Policy_r__interfaceModel = require('../models/policy_r__interface');


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
interfaceModel.getInterfaces = function (idfirewall, callback) {

    db.get(function (error, connection) {
        if (error)
            return done('Database problem');
        var sql = 'SELECT * FROM ' + tableModel + ' WHERE firewall=' + connection.escape(idfirewall) + ' ORDER BY id';
        connection.query(sql, function (error, rows) {
            if (error)
                callback(error, null);
            else
                callback(null, rows);
        });
    });
};





//Get interface by  id and interface
interfaceModel.getInterface = function (idfirewall, id, callback) {
    db.get(function (error, connection) {
        if (error)
            return done('Database problem');
        var sql = 'SELECT * FROM ' + tableModel + ' WHERE id = ' + connection.escape(id) + ' AND firewall=' + connection.escape(idfirewall);
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
        var sql = 'SELECT * FROM ' + tableModel + ' WHERE id_fwb = ' + connection.escape(id_fwb) + ' AND firewall=' + connection.escape(idfirewall);
        connection.query(sql, function (error, row) {
            if (error)
                callback(error, null);
            else
                callback(null, row);
        });
    });
};

//Get interfaz by name and interface
interfaceModel.getInterfaceName = function (idfirewall, name, callback) {
    db.get(function (error, connection) {
        if (error)
            return done('Database problem');
        var namesql = '%' + name + '%';
        var sql = 'SELECT * FROM ' + tableModel + ' WHERE name like  ' + connection.escape(namesql) + ' AND  firewall=' + connection.escape(idfirewall);

        connection.query(sql, function (error, row) {
            if (error)
                callback(error, null);
            else
                callback(null, row);
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