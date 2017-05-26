var db = require('../db.js');


//create object
var policy_r__positionModel = {};
var tableModel="policy_r__position";


//Get All policy_r__position by policy_r
policy_r__positionModel.getPolicy_r__positions = function (rule,callback) {

    db.get(function (error, connection) {
        if (error) return done('Database problem');
        var sql = 'SELECT * FROM ' + tableModel + ' WHERE rule = ' + connection.escape(rule) + ' ORDER by column_order';
        connection.query(sql, function (error, rows) {
            if (error)
                callback(error, null);
            else
                callback(null, rows);
        });
    });
};





//Get policy_r__position by  rule and  position
policy_r__positionModel.getPolicy_r__position = function (rule,position, callback) {
    db.get(function (error, connection) {
        if (error) return done('Database problem');
        var sql = 'SELECT * FROM ' + tableModel + ' WHERE rule = ' + connection.escape(rule) + ' AND position = ' + connection.escape(position) ;
        connection.query(sql, function (error, row) {
            if (error)
                callback(error, null);
            else
                callback(null, row);
        });
    });
};



//Add new policy_r__position
policy_r__positionModel.insertPolicy_r__position = function (policy_r__positionData, callback) {
    OrderList(policy_r__positionData.column_order, policy_r__positionData.rule, 999999);
    db.get(function (error, connection) {
        if (error) return done('Database problem');
        connection.query('INSERT INTO ' + tableModel + ' SET ?', policy_r__positionData, function (error, result) {
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

//Update policy_r__position
policy_r__positionModel.updatePolicy_r__position = function (old_order,policy_r__positionData, callback) {

    OrderList(policy_r__positionData.column_order, policy_r__positionData.rule, old_order);
    db.get(function (error, connection) {
        if (error) return done('Database problem');
        var sql = 'UPDATE ' + tableModel + ' SET column_order = ' + connection.escape(policy_r__positionData.column_order) + ',' +            
                ' negate = ' + connection.escape(policy_r__positionData.negate) + ' ' +            
            ' WHERE rule = ' + policy_r__positionData.rule  + ' AND  position = ' + policy_r__positionData.position;
            
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

//Update NEGATE policy_r__position
policy_r__positionModel.updatePolicy_r__position_negate = function (rule, position, negate, callback) {

    db.get(function (error, connection) {
        if (error) return done('Database problem');
        var sql = 'UPDATE ' + tableModel + ' SET ' +            
                ' negate = ' + connection.escape(negate) + ' ' +            
            ' WHERE rule = ' + rule  + ' AND  position = ' + position;
            
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

//Update ORDER policy_r__position
policy_r__positionModel.updatePolicy_r__position_order = function (rule, position, old_order, new_order, callback) {

    OrderList(new_order, rule, old_order);
    db.get(function (error, connection) {
        if (error) return done('Database problem');
        var sql = 'UPDATE ' + tableModel + ' SET ' +            
                ' column_order = ' + connection.escape(order) + ' ' +            
            ' WHERE rule = ' + rule  + ' AND  position = ' + position;
            
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
                'position_order = position_order' + increment + 
                ' WHERE rule = ' + connection.escape(rule)  + 
                ' AND position_order>=' + order1 + ' AND position_order<=' + order2;
        console.log(sql);
        connection.query(sql);        
        
    });
    
};

//Remove policy_r__position with id to remove
policy_r__positionModel.deletePolicy_r__position = function (rule, position,old_order, callback) {
    OrderList(999999, rule,old_order );
    
    db.get(function (error, connection) {
        if (error) return done('Database problem');
        var sqlExists = 'SELECT * FROM ' + tableModel + ' WHERE rule = ' + connection.escape(rule) + ' AND  position = ' + connection.escape(position);
        connection.query(sqlExists, function (error, row) {
            //If exists Id from policy_r__position to remove
            if (row) {
                db.get(function (error, connection) {
                    var sql = 'DELETE FROM ' + tableModel + ' WHERE rule = ' + connection.escape(rule) + ' AND  position = ' + connection.escape(position);
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
module.exports = policy_r__positionModel;