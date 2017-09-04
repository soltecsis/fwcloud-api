var db = require('../db.js');


//create object
var routing_r__interfaceModel = {};
var tableModel="routing_r__interface";

/**
* Property Logger to manage App logs
*
* @property logger
* @type log4js/app
* 
*/
var logger = require('log4js').getLogger("app");

//Get All routing_r__interface by policy_r
routing_r__interfaceModel.getRouting_r__interfaces_rule = function (interface,callback) {

    db.get(function (error, connection) {
        if (error) return done('Database problem');
        var sql = 'SELECT * FROM ' + tableModel + ' WHERE interface = ' + connection.escape(interface) + ' ORDER by interface_order';
        connection.query(sql, function (error, rows) {
            if (error)
                callback(error, null);
            else
                callback(null, rows);
        });
    });
};

//Get All routing_r__interface by policy_r
routing_r__interfaceModel.getRouting_r__interfaces_interface = function (rule,callback) {

    db.get(function (error, connection) {
        if (error) return done('Database problem');
        var sql = 'SELECT * FROM ' + tableModel + ' WHERE rule = ' + connection.escape(rule) + ' ORDER by interface_order';
        connection.query(sql, function (error, rows) {
            if (error)
                callback(error, null);
            else
                callback(null, rows);
        });
    });
};




//Get routing_r__interface by  rule and  interface
routing_r__interfaceModel.getRouting_r__interface = function (interface, rule, callback) {
    db.get(function (error, connection) {
        if (error) return done('Database problem');
        var sql = 'SELECT * FROM ' + tableModel + ' WHERE rule = ' + connection.escape(rule) + ' AND interface = ' + connection.escape(interface) ;
        connection.query(sql, function (error, row) {
            if (error)
                callback(error, null);
            else
                callback(null, row);
        });
    });
};



//Add new routing_r__interface
routing_r__interfaceModel.insertRouting_r__interface = function (routing_r__interfaceData, callback) {
    OrderList(routing_r__interfaceData.column_order, routing_r__interfaceData.rule, 999999);
    db.get(function (error, connection) {
        if (error) return done('Database problem');
        connection.query('INSERT INTO ' + tableModel + ' SET ?', routing_r__interfaceData, function (error, result) {
            if (error) {
                callback(error, null);
            }
            else {
                //devolvemos la última id insertada
                callback(null, { "msg": "success" });
            }
        });
    });
};

//Update routing_r__interface
routing_r__interfaceModel.updateRouting_r__interface = function (old_order,routing_r__interfaceData, callback) {

    OrderList(routing_r__interfaceData.column_order, routing_r__interfaceData.rule, old_order);
    db.get(function (error, connection) {
        if (error) return done('Database problem');
        var sql = 'UPDATE ' + tableModel + ' SET interface_order = ' + connection.escape(routing_r__interfaceData.interface_order) + ',' +                            
            ' WHERE rule = ' + routing_r__interfaceData.rule  + ' AND  interface = ' + routing_r__interfaceData.interface;
            
        connection.query(sql, function (error, result) {
            if (error) {
                callback(error, null);
            }
            else {
                callback(null, { "msg": "success" });
            }
        });
    });
};


//Update ORDER routing_r__interface
routing_r__interfaceModel.updateRouting_r__interface_order = function (rule, interface, old_order, new_order, callback) {

    OrderList(new_order, rule, old_order);
    db.get(function (error, connection) {
        if (error) return done('Database problem');
        var sql = 'UPDATE ' + tableModel + ' SET ' +            
                ' interface_order = ' + connection.escape(new_order) + ' ' +            
            ' WHERE rule = ' + rule  + ' AND  interface = ' + interface;
            
        connection.query(sql, function (error, result) {
            if (error) {
                callback(error, null);
            }
            else {
                callback(null, { "msg": "success" });
            }
        });
    });
};

function OrderList(new_order, rule, old_order){
    var increment='+1';
    var order1=new_order;
    var order2= old_order;
    if (new_order>old_order){
        increment='-1';
        order1=old_order;
        order2= new_order;
    }
        
    db.get(function (error, connection) {
        if (error)
            return done('Database problem');
        var sql = 'UPDATE ' + tableModel + ' SET ' +
                'interface_order = interface_order' + increment + 
                ' WHERE rule = ' + connection.escape(rule)  + 
                ' AND interface_order>=' + order1 + ' AND interface_order<=' + order2;
        logger.debug(sql);
        connection.query(sql);        
        
    });
    
};

//Remove routing_r__interface with id to remove
routing_r__interfaceModel.deleteRouting_r__interface = function (rule, interface,old_order, callback) {
    OrderList(999999, rule,old_order );
    
    db.get(function (error, connection) {
        if (error) return done('Database problem');
        var sqlExists = 'SELECT * FROM ' + tableModel + ' WHERE rule = ' + connection.escape(rule) + ' AND  interface = ' + connection.escape(interface);
        connection.query(sqlExists, function (error, row) {
            //If exists Id from routing_r__interface to remove
            if (row) {
                db.get(function (error, connection) {
                    var sql = 'DELETE FROM ' + tableModel + ' WHERE rule = ' + connection.escape(rule) + ' AND  interface = ' + connection.escape(interface);
                    connection.query(sql, function (error, result) {
                        if (error) {
                            callback(error, null);
                        }
                        else {
                            callback(null, { "msg": "deleted" });
                        }
                    });
                });
            }
            else {
                callback(null, { "msg": "notExist" });
            }
        });
    });
};

//Export the object
module.exports = routing_r__interfaceModel;