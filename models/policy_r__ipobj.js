var db = require('../db.js');


//create object
var policy_r__ipobjModel = {};
var tableModel = "policy_r__ipobj";




//Get All policy_r__ipobj by Policy_r (rule)
policy_r__ipobjModel.getPolicy_r__ipobjs = function (rule, callback) {
    
    db.get(function (error, connection) {
        if (error)
            return done('Database problem');      
                
        var sql = 'SELECT * FROM ' + tableModel + ' WHERE rule=' + connection.escape(rule) + ' ORDER BY position_order';
        
        connection.query(sql, function (error, rows) {
            if (error)
                callback(error, null);
            else
                callback(null, rows);
        });
    });
    
};

//Get All policy_r__ipobj by Policy_r (rule) and position
policy_r__ipobjModel.getPolicy_r__ipobjs_position = function (rule,position, callback) {
    
    db.get(function (error, connection) {
        if (error)
            return done('Database problem');      
                
        var sql = 'SELECT * FROM ' + tableModel + ' WHERE rule=' + connection.escape(rule) + ' AND position=' + connection.escape(position) + ' ORDER BY position_order';
        
        connection.query(sql, function (error, rows) {
            if (error)
                callback(error, null);
            else
                callback(null, rows);
        });
    });
    
};

//Get  policy_r__ipobj by primarykey
policy_r__ipobjModel.getPolicy_r__ipobj = function (rule,ipobj,ipobj_g, position, callback) {

    db.get(function (error, connection) {
        if (error)
            return done('Database problem');        

        var sql = 'SELECT * FROM ' + tableModel +
                ' WHERE rule = ' + connection.escape(rule) + ' AND ipobj=' + connection.escape(ipobj) + 
                ' AND ipobj_g=' + connection.escape(ipobj_g) + ' AND position=' + connection.escape(position) +
                ' ORDER BY position_order';
        
        connection.query(sql, function (error, rows) {
            if (error)
                callback(error, null);
            else
                callback(null, rows);
        });
    });
};







//Add new policy_r__ipobj 
policy_r__ipobjModel.insertPolicy_r__ipobj = function (policy_r__ipobjData, callback) {
    OrderList(policy_r__ipobjData.position_order, policy_r__ipobjData.rule, policy_r__ipobjData.position, 999999);
    db.get(function (error, connection) {
        if (error)
            return done('Database problem');
        connection.query('INSERT INTO ' + tableModel + ' SET ?', policy_r__ipobjData, function (error, result) {
            if (error) {
                callback(error, {"error": "error"});
            } else {
                //devolvemos la última id insertada
                callback(null, {"msg": "success"});
            }
        });
    });
    
};

//Update policy_r__ipobj
policy_r__ipobjModel.updatePolicy_r__ipobj = function (rule,ipobj,ipobj_g, position, position_order, policy_r__ipobjData, callback) {

    if (position!== policy_r__ipobjData.position){
         //ordenamos posicion antigua
        OrderList(999999, rule, position, position_order);
        //ordenamos posicion nueva
        OrderList(policy_r__ipobjData.position_order,policy_r__ipobjData.rule, policy_r__ipobjData.position,999999 );
    }
    else    
        OrderList(policy_r__ipobjData.position_order, rule, position, position_order);
    
    db.get(function (error, connection) {
        if (error)
            return done('Database problem');
        var sql = 'UPDATE ' + tableModel + ' SET ' +
                'rule = ' + connection.escape(policy_r__ipobjData.rule) + ',' +
                'ipobj = ' + connection.escape(policy_r__ipobjData.ipobj) + ',' +
                'ipobj_g = ' + connection.escape(policy_r__ipobjData.ipobj_g) + ',' +
                'position = ' + connection.escape(policy_r__ipobjData.position) + ',' +
                'position_order = ' + connection.escape(policy_r__ipobjData.position_order) + ' ' +
                ' WHERE rule = ' + connection.escape(rule) + ' AND ipobj=' + connection.escape(ipobj) + 
                ' AND ipobj_g=' + connection.escape(ipobj_g) + ' AND position=' + connection.escape(position);
        
        connection.query(sql, function (error, result) {
            if (error) {
                callback(error, null);
            } else {
                callback(null, {"msg": "success"});
            }
        });
    });
};

//Update policy_r__ipobj Position ORDER
policy_r__ipobjModel.updatePolicy_r__ipobj_position_order = function (rule,ipobj,ipobj_g, position, position_order,new_order, callback) {

    OrderList(new_order, rule, position, position_order);
    
    db.get(function (error, connection) {
        if (error)
            return done('Database problem');
        var sql = 'UPDATE ' + tableModel + ' SET ' +
                'position_order = ' + connection.escape(new_order) + ' ' +
                ' WHERE rule = ' + connection.escape(rule) + ' AND ipobj=' + connection.escape(ipobj) + 
                ' AND ipobj_g=' + connection.escape(ipobj_g) + ' AND position=' + connection.escape(position);

        connection.query(sql, function (error, result) {
            if (error) {
                callback(error, null);
            } else {
                callback(null, {"msg": "success"});
            }
        });
    });
};

//Update policy_r__ipobj position
//Al Update position ordenamos antigua and nueva POSITION
policy_r__ipobjModel.updatePolicy_r__ipobj_position = function (rule,ipobj,ipobj_g, position,position_order, new_position, new_order, callback) {

    //ordenamos posicion antigua
    OrderList(999999, rule, position, position_order);
    //ordenamos posicion nueva
    OrderList(new_order, rule, new_position,999999 );
    
    db.get(function (error, connection) {
        if (error)
            return done('Database problem');
        var sql = 'UPDATE ' + tableModel + ' SET ' +
                'position = ' + connection.escape(new_position) + ' ' +
                ' WHERE rule = ' + connection.escape(rule) + ' AND ipobj=' + connection.escape(ipobj) + 
                ' AND ipobj_g=' + connection.escape(ipobj_g) + ' AND position=' + connection.escape(position);

        connection.query(sql, function (error, result) {
            if (error) {
                callback(error, null);
            } else {
                callback(null, {"msg": "success"});
            }
        });
    });
};


function OrderList(new_order, rule, position, old_order){
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
                ' WHERE rule = ' + connection.escape(rule) + ' AND position=' + connection.escape(position) + 
                ' AND position_order>=' + order1 + ' AND position_order<=' + order2;
        console.log(sql);
        connection.query(sql);        
        
    });
    
};

//Remove policy_r__ipobj 
policy_r__ipobjModel.deletePolicy_r__ipobj = function (rule,ipobj,ipobj_g, position, position_order, callback) {
    
    OrderList(999999, rule, position, position_order);
    
    db.get(function (error, connection) {
        if (error)
            return done('Database problem');
        var sqlExists = 'SELECT * FROM ' + tableModel + 
                ' WHERE rule = ' + connection.escape(rule) + ' AND ipobj=' + connection.escape(ipobj) + 
                ' AND ipobj_g=' + connection.escape(ipobj_g) + ' AND position=' + connection.escape(position);
        
        connection.query(sqlExists, function (error, row) {
            //If exists Id from policy_r__ipobj to remove
            if (row) {
                db.get(function (error, connection) {
                    var sql = 'DELETE FROM ' + tableModel +
                    ' WHERE rule = ' + connection.escape(rule) + ' AND ipobj=' + connection.escape(ipobj) + 
                    ' AND ipobj_g=' + connection.escape(ipobj_g) + ' AND position=' + connection.escape(position);
                    
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
module.exports = policy_r__ipobjModel;