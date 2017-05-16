var db = require('../db.js');


//creamos un objeto para ir almacenando todo lo que necesitemos
var routing_r__interfaceModel = {};
var tableModel="routing_r__interface";


//obtenemos todos los routing_r__interface por policy_r
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

//obtenemos todos los routing_r__interface por policy_r
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




//obtenemos un routing_r__interface por su rule y  interface
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



//añadir un nuevo routing_r__interface
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

//actualizar un routing_r__interface
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


//actualizar ORDER un routing_r__interface
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
        console.log(sql);
        connection.query(sql);        
        
    });
    
};

//eliminar un routing_r__interface pasando la id a eliminar
routing_r__interfaceModel.deleteRouting_r__interface = function (rule, interface,old_order, callback) {
    OrderList(999999, rule,old_order );
    
    db.get(function (error, connection) {
        if (error) return done('Database problem');
        var sqlExists = 'SELECT * FROM ' + tableModel + ' WHERE rule = ' + connection.escape(rule) + ' AND  interface = ' + connection.escape(interface);
        connection.query(sqlExists, function (error, row) {
            //si existe la id del routing_r__interface a eliminar
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

//exportamos el objeto para tenerlo disponible en la zona de rutas
module.exports = routing_r__interfaceModel;