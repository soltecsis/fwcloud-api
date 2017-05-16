var db = require('../db.js');


//creamos un objeto para ir almacenando todo lo que necesitemos
var policy_r__ipobjModel = {};
var tableModel = "policy_r__ipobj";




//obtenemos todos los policy_r__ipobj por Policy_r (rule)
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

//obtenemos todos los policy_r__ipobj por Policy_r (rule) y position
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

//obtenemos  policy_r__ipobj por primarykey
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







//añadir un nuevo policy_r__ipobj 
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

//actualizar un policy_r__ipobj
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

//actualizar un policy_r__ipobj Position ORDER
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

//actualizar un policy_r__ipobj position
//Al actualizar position ordenamos antigua y nueva POSITION
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

//eliminar un policy_r__ipobj 
policy_r__ipobjModel.deletePolicy_r__ipobj = function (rule,ipobj,ipobj_g, position, position_order, callback) {
    
    OrderList(999999, rule, position, position_order);
    
    db.get(function (error, connection) {
        if (error)
            return done('Database problem');
        var sqlExists = 'SELECT * FROM ' + tableModel + 
                ' WHERE rule = ' + connection.escape(rule) + ' AND ipobj=' + connection.escape(ipobj) + 
                ' AND ipobj_g=' + connection.escape(ipobj_g) + ' AND position=' + connection.escape(position);
        
        connection.query(sqlExists, function (error, row) {
            //si existe la id del policy_r__ipobj a eliminar
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

//exportamos el objeto para tenerlo disponible en la zona de rutas
module.exports = policy_r__ipobjModel;