var db = require('../db.js');


//creamos un objeto para ir almacenando todo lo que necesitemos
var interface__ipobjModel = {};
var tableModel = "interface__ipobj";


//obtenemos todos los interface__ipobj por intreface
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

//obtenemos todos los interface__ipobj por ipobj
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



//obtenemos un interface__ipobj por interface y ipobj
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


//añadir un nuevo interface__ipobj 
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

//actualizar un interface__ipobj 
interface__ipobjModel.updateInterface__ipobj = function (get_interface, get_ipobj,get_interface_order, interface__ipobjData, callback) {

    OrderList(interface__ipobjData.interface_order,get_interface,  get_interface_order);
    
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

//actualizar ORDER un interface__ipobj
interface__ipobjModel.updateInterface__ipobj_order = function (new_order,interface__ipobjData, callback) {

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


function OrderList(new_order, interface, old_order){
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
                ' WHERE interface = ' + connection.escape(interface) + 
                ' AND interface_order>=' + order1 + ' AND interface_order<=' + order2;
        connection.query(sql);        
        
    });
    
}


//eliminar un interface__ipobj pasando la id a eliminar
//FALTA BORRADO EN CASCADA 
interface__ipobjModel.deleteInterface__ipobj = function (interface, ipobj, callback) {
    db.get(function (error, connection) {
        if (error)
            return done('Database problem');
        var sqlExists = 'SELECT * FROM ' + tableModel + '  WHERE interface = ' + connection.escape(interface) + ' AND ipobj=' + connection.escape(ipobj);
        connection.query(sqlExists, function (error, row) {
            //si existe la id del interface__ipobj a eliminar
            if (row) {
                db.get(function (error, connection) {
                    var sql = 'DELETE FROM ' + tableModel + ' WHERE interface = ' + connection.escape(interface) + ' AND ipobj=' + connection.escape(ipobj);
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
module.exports = interface__ipobjModel;