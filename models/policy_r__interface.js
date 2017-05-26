var db = require('../db.js');


//create object
var policy_r__interfaceModel = {};
var tableModel="policy_r__interface";


//Get All policy_r__interface by policy_r
policy_r__interfaceModel.getPolicy_r__interfaces_rule = function (interface,callback) {

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

//Get All policy_r__interface by policy_r
policy_r__interfaceModel.getPolicy_r__interfaces_interface = function (rule,callback) {

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




//Get policy_r__interface by  rule and  interface
policy_r__interfaceModel.getPolicy_r__interface = function (interface, rule, callback) {
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



//Add new policy_r__interface
policy_r__interfaceModel.insertPolicy_r__interface = function (policy_r__interfaceData, callback) {
    OrderList(policy_r__interfaceData.column_order, policy_r__interfaceData.rule, 999999);
    db.get(function (error, connection) {
        if (error) return done('Database problem');
        connection.query('INSERT INTO ' + tableModel + ' SET ?', policy_r__interfaceData, function (error, result) {
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

//Update policy_r__interface
policy_r__interfaceModel.updatePolicy_r__interface = function (old_order,policy_r__interfaceData, callback) {

    OrderList(policy_r__interfaceData.column_order, policy_r__interfaceData.rule, old_order);
    db.get(function (error, connection) {
        if (error) return done('Database problem');
        var sql = 'UPDATE ' + tableModel + ' SET interface_order = ' + connection.escape(policy_r__interfaceData.interface_order) + ',' +                            
            ' WHERE rule = ' + policy_r__interfaceData.rule  + ' AND  interface = ' + policy_r__interfaceData.interface;
            
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


//Update ORDER policy_r__interface
policy_r__interfaceModel.updatePolicy_r__interface_order = function (rule, interface, old_order, new_order, callback) {

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
        console.log(sql);
        connection.query(sql);        
        
    });
    
};

//Remove policy_r__interface with id to remove
policy_r__interfaceModel.deletePolicy_r__interface = function (rule, interface,old_order, callback) {
    OrderList(999999, rule,old_order );
    
    db.get(function (error, connection) {
        if (error) return done('Database problem');
        var sqlExists = 'SELECT * FROM ' + tableModel + ' WHERE rule = ' + connection.escape(rule) + ' AND  interface = ' + connection.escape(interface);
        connection.query(sqlExists, function (error, row) {
            //If exists Id from policy_r__interface to remove
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
module.exports = policy_r__interfaceModel;