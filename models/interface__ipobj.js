var db = require('../db.js');


//create object
var interface__ipobjModel = {};
var tableModel = "interface__ipobj";

/**
 * Property Logger to manage App logs
 *
 * @property logger
 * @type log4js/app
 * 
 */
var logger = require('log4js').getLogger("app");


//Get All interface__ipobj by interface
interface__ipobjModel.getInterface__ipobjs_interface = function (interface, callback) {

    db.get(function (error, connection) {
        if (error)
            return done('Database problem');
        var sql = 'SELECT * FROM ' + tableModel + ' WHERE interface=' + connection.escape(interface) + ' ORDER BY interface_order';
        connection.query(sql, function (error, rows) {
            if (error)
                callback(error, null);
            else
                callback(null, rows);
        });
    });
};

//Get All interface__ipobj by ipobj
interface__ipobjModel.getInterface__ipobjs_ipobj = function (ipobj, callback) {

    db.get(function (error, connection) {
        if (error)
            return done('Database problem');
        var sql = 'SELECT * FROM ' + tableModel + ' WHERE ipobj=' + connection.escape(ipobj) + ' ORDER BY interface_order';
        connection.query(sql, function (error, rows) {
            if (error)
                callback(error, null);
            else
                callback(null, rows);
        });
    });
};



//Get interface__ipobj by interface and ipobj
interface__ipobjModel.getInterface__ipobj = function (interface, ipobj, callback) {
    db.get(function (error, connection) {
        if (error)
            return done('Database problem');
        var sql = 'SELECT * FROM ' + tableModel + ' WHERE interface = ' + connection.escape(interface) + ' AND ipobj=' + connection.escape(ipobj);
        connection.query(sql, function (error, row) {
            if (error)
                callback(error, null);
            else
                callback(null, row);
        });
    });
};

//Search Interface in hosts
interface__ipobjModel.getInterface__ipobj_hosts = function (interface, fwcloud, callback) {

    db.get(function (error, connection) {
        if (error)
            return done('Database problem');
        var sql = 'SELECT I.id obj_id,I.name obj_name, I.interface_type obj_type_id,T.type obj_type_name, ' +
                'C.id cloud_id, C.name cloud_name, H.id host_id, H.name host_name ' +
                'FROM fwcloud_db.interface__ipobj O ' +
                'inner join  interface I on I.id=O.interface ' +
                'inner join ipobj_type T on T.id=I.interface_type ' +
                'inner join ipobj H on H.id=O.ipobj ' +
                'inner join fwcloud C on C.id=H.fwcloud ' +
                ' WHERE O.interface=' + connection.escape(interface) + ' AND H.fwcloud=' + connection.escape(fwcloud) + ' ORDER BY interface_order';
        logger.debug(sql);
        connection.query(sql, function (error, rows) {
            if (error)
                callback(null, {"found": ""});
            else {
                if (rows.length > 0) {                    
                    callback(null, {"found": rows});                    
                }
                else
                    callback(null, {"found": ""});
            }
        });
    });
};

//Add new interface__ipobj 
interface__ipobjModel.insertInterface__ipobj = function (interface__ipobjData, callback) {
    db.get(function (error, connection) {
        if (error)
            return done('Database problem');
        connection.query('INSERT INTO ' + tableModel + ' SET ?', interface__ipobjData, function (error, result) {
            if (error) {
                //throw error;
                callback(error, null);
            } else {
                //devolvemos la última id insertada
                callback(null, {"msg": "success"});
            }
        });
    });
};

//Update interface__ipobj 
interface__ipobjModel.updateInterface__ipobj = function (get_interface, get_ipobj, get_interface_order, interface__ipobjData, callback) {

    OrderList(interface__ipobjData.interface_order, get_interface, get_interface_order);

    db.get(function (error, connection) {
        if (error)
            return done('Database problem');
        var sql = 'UPDATE ' + tableModel + ' SET ' +
                'interface = ' + connection.escape(interface__ipobjData.interface) + ',' +
                'ipobj = ' + connection.escape(interface__ipobjData.ipobj) + ',' +
                'interface_order = ' + connection.escape(interface__ipobjData.interface_order) + ' ' +
                ' WHERE interface = ' + connection.escape(get_interface) + ' AND ipobj=' + connection.escape(get_ipobj);
        connection.query(sql, function (error, result) {
            if (error) {
                callback(error, null);
            } else {
                callback(null, {"msg": "success"});
            }
        });
    });
};

//Update ORDER interface__ipobj
interface__ipobjModel.updateInterface__ipobj_order = function (new_order, interface__ipobjData, callback) {

    OrderList(new_order, interface__ipobjData.interface, interface__ipobjData.interface_order);

    db.get(function (error, connection) {
        if (error)
            return done('Database problem');
        var sql = 'UPDATE ' + tableModel + ' SET ' +
                'interface_order = ' + connection.escape(new_order) + ' ' +
                ' WHERE interface = ' + connection.escape(interface__ipobjData.interface) + ' AND ipobj=' + connection.escape(interface__ipobjData.ipobj);
        connection.query(sql, function (error, result) {
            if (error) {
                callback(error, null);
            } else {
                callback(null, {"msg": "success"});
            }
        });
    });
};


function OrderList(new_order, interface, old_order) {
    var increment = '+1';
    var order1 = new_order;
    var order2 = old_order;
    if (new_order > old_order) {
        increment = '-1';
        order1 = old_order;
        order2 = new_order;
    }

    db.get(function (error, connection) {
        if (error)
            return done('Database problem');
        var sql = 'UPDATE ' + tableModel + ' SET ' +
                'interface_order = interface_order' + increment +
                ' WHERE interface = ' + connection.escape(interface) +
                ' AND interface_order>=' + order1 + ' AND interface_order<=' + order2;
        connection.query(sql);

    });

}


//Remove interface__ipobj with id to remove
//FALTA BORRADO EN CASCADA 
interface__ipobjModel.deleteInterface__ipobj = function (interface, ipobj, callback) {
    db.get(function (error, connection) {
        if (error)
            return done('Database problem');
        var sqlwhere = '';
        if (interface !== null)
            sqlwhere = ' interface =' + connection.escape(interface);
        if (ipobj !== null) {
            if (sqlwhere !== '')
                sqlwhere = sqlwhere + ' AND ';
            sqlwhere = sqlwhere + ' ' + ' AND ipobj=' + connection.escape(ipobj);
        }

        var sqlExists = 'SELECT * FROM ' + tableModel + '  WHERE ' + sqlwhere;
        connection.query(sqlExists, function (error, row) {
            //If exists Id from interface__ipobj to remove
            if (row) {
                db.get(function (error, connection) {
                    var sql = 'DELETE FROM ' + tableModel + ' WHERE ' + sqlwhere;
                    connection.query(sql, function (error, result) {
                        if (error) {
                            callback(error, null);
                        } else {
                            callback(null, {"msg": "deleted"});
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
module.exports = interface__ipobjModel;