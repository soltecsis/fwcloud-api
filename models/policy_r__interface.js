var db = require('../db.js');


//create object
var policy_r__interfaceModel = {};
var tableModel = "policy_r__interface";

/**
* Property Logger to manage App logs
*
* @property logger
* @type log4js/app
* 
*/
var logger = require('log4js').getLogger("app");

//Get All policy_r__interface by policy_r
policy_r__interfaceModel.getPolicy_r__interfaces_rule = function (interface, callback) {

    db.get(function (error, connection) {
        if (error)
            return done('Database problem');
        var sql = 'SELECT * FROM ' + tableModel + ' WHERE interface = ' + connection.escape(interface) + ' ORDER by interface_order';
        connection.query(sql, function (error, rows) {
            if (error)
                callback(error, null);
            else
                callback(null, rows);
        });
    });
};

//Get All policy_r__interface by policy_r
policy_r__interfaceModel.getPolicy_r__interfaces_interface = function (rule, callback) {

    db.get(function (error, connection) {
        if (error)
            return done('Database problem');
        var sql = 'SELECT * FROM ' + tableModel + ' WHERE rule = ' + connection.escape(rule) + ' ORDER by interface_order';
        connection.query(sql, function (error, rows) {
            if (error)
                callback(error, null);
            else
                callback(null, rows);
        });
    });
};




//Get policy_r__interface by  rule and  interface
policy_r__interfaceModel.getPolicy_r__interface = function (interface, rule, callback) {
    db.get(function (error, connection) {
        if (error)
            return done('Database problem');
        var sql = 'SELECT * FROM ' + tableModel + ' WHERE rule = ' + connection.escape(rule) + ' AND interface = ' + connection.escape(interface);
        connection.query(sql, function (error, row) {
            if (error)
                callback(error, null);
            else
                callback(null, row);
        });
    });
};



//Add new policy_r__interface
policy_r__interfaceModel.insertPolicy_r__interface = function (policy_r__interfaceData, callback) {
    OrderList(policy_r__interfaceData.position_order, policy_r__interfaceData.rule, 999999);


    //Check if IPOBJ TYPE is ALLOWED in this Position
    checkInterfacePosition(policy_r__interfaceData.rule, policy_r__interfaceData.interface, policy_r__interfaceData.position, function (error, data) {
        if (error) {
            callback(error, {"error": "error"});
        } else {
            allowed = data;
            if (allowed) {
                db.get(function (error, connection) {
                    if (error)
                        return done('Database problem');
                    connection.query('INSERT INTO ' + tableModel + ' SET ?', policy_r__interfaceData, function (error, result) {
                        if (error) {
                            callback(error, null);
                        } else {
                            //devolvemos la última id insertada
                            callback(null, {"msg": "success"});
                        }
                    });
                });
            }
        }
    });
};

//Update policy_r__interface
policy_r__interfaceModel.updatePolicy_r__interface = function (old_order, policy_r__interfaceData, callback) {

    OrderList(policy_r__interfaceData.column_order, policy_r__interfaceData.rule, old_order);

    //Check if IPOBJ TYPE is ALLOWED in this Position
    checkInterfacePosition(policy_r__interfaceData.rule, policy_r__interfaceData.interface, policy_r__interfaceData.position, function (error, data) {
        if (error) {
            callback(error, {"error": "error"});
        } else {
            allowed = data;
            if (allowed) {
                db.get(function (error, connection) {
                    if (error)
                        return done('Database problem');
                    var sql = 'UPDATE ' + tableModel + ' SET interface_order = ' + connection.escape(policy_r__interfaceData.interface_order) + ',' +
                            'direction = ' + connection.escape(policy_r__interfaceData.direction) + ',' +
                            'negate = ' + connection.escape(policy_r__interfaceData.negate) +
                            ' WHERE rule = ' + policy_r__interfaceData.rule + ' AND  interface = ' + policy_r__interfaceData.interface;

                    connection.query(sql, function (error, result) {
                        if (error) {
                            callback(error, null);
                        } else {
                            callback(null, {"msg": "success"});
                        }
                    });
                });
            }
        }
    });
};

//Update NEGATE policy_r__interface for all interface in the rule
policy_r__interfaceModel.updatePolicy_r__interface_negate = function (rule, interface, negate, callback) {

    db.get(function (error, connection) {
        if (error)
            return done('Database problem');
        var sql = 'UPDATE ' + tableModel + ' SET ' +
                ' negate = ' + connection.escape(negate) + ' ' +
                ' WHERE rule = ' + rule;

        connection.query(sql, function (error, result) {
            if (error) {
                callback(error, null);
            } else {
                callback(null, {"msg": "success"});
            }
        });
    });
};

//Update ORDER policy_r__interface
policy_r__interfaceModel.updatePolicy_r__interface_order = function (rule, interface, old_order, new_order, callback) {

    OrderList(new_order, rule, old_order);
    db.get(function (error, connection) {
        if (error)
            return done('Database problem');
        var sql = 'UPDATE ' + tableModel + ' SET ' +
                ' interface_order = ' + connection.escape(new_order) + ' ' +
                ' WHERE rule = ' + rule + ' AND  interface = ' + interface;

        connection.query(sql, function (error, result) {
            if (error) {
                callback(error, null);
            } else {
                callback(null, {"msg": "success"});
            }
        });
    });
};

function OrderList(new_order, rule, old_order) {
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
                ' WHERE rule = ' + connection.escape(rule) +
                ' AND interface_order>=' + order1 + ' AND interface_order<=' + order2;
        logger.debug(sql);
        connection.query(sql);

    });

}
;

//Check if a object (type) can be inserted in a position type
function checkInterfacePosition(rule, id, position, callback) {

    var allowed = 0;
    db.get(function (error, connection) {
        if (error)
            callback(null, 0);
        var sql = 'select A.allowed from ipobj_type__policy_position A  ' +
                'inner join interface I on A.type=I.interface_type ' +
                ' WHERE I.id = ' + connection.escape(id) + ' AND A.position=' + connection.escape(position);
        connection.query(sql, function (error, rows) {
            if (error)
                callback(error, null);
            else {
                allowed = rows[0].allowed;
                if (allowed > 0)
                    callback(null, 1);
                else
                    callback(null, 0);
            }
        });
    });
}

function getNegateRulePosition(rule, position, callback) {

    var Nneg = 0;
    db.get(function (error, connection) {
        if (error)
            return done('Database problem');
        var sql = 'SELECT count(negate) as neg FROM ' + tableModel +
                ' WHERE rule = ' + connection.escape(rule) + ' AND position=' + connection.escape(position) +
                ' AND negate=1';
        logger.debug('SQL: ' + sql);
        connection.query(sql, function (error, rows) {
            if (error)
                callback(error, null);
            else {
                Nneg = rows[0].neg;
                logger.debug('Nneg 1: ' + Nneg);
                if (Nneg > 0)
                    callback(null, 1);
                else
                    callback(null, 0);
            }
        });
    });
}

//Remove policy_r__interface with id to remove
policy_r__interfaceModel.deletePolicy_r__interface = function (rule, interface, old_order, callback) {
    OrderList(999999, rule, old_order);

    db.get(function (error, connection) {
        if (error)
            return done('Database problem');
        var sqlExists = 'SELECT * FROM ' + tableModel + ' WHERE rule = ' + connection.escape(rule) + ' AND  interface = ' + connection.escape(interface);
        connection.query(sqlExists, function (error, row) {
            //If exists Id from policy_r__interface to remove
            if (row) {
                db.get(function (error, connection) {
                    var sql = 'DELETE FROM ' + tableModel + ' WHERE rule = ' + connection.escape(rule) + ' AND  interface = ' + connection.escape(interface);
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
module.exports = policy_r__interfaceModel;