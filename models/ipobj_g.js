var db = require('../db.js');


//creamos un objeto para ir almacenando todo lo que necesitemos
var ipobj_gModel = {};
var tableModel="ipobj_g";


//obtenemos todos los ipobj_g
ipobj_gModel.getIpobj_gs = function (fwcloud,callback) {

    db.get(function (error, connection) {
        if (error) return done('Database problem');
        connection.query('SELECT * FROM ' + tableModel + ' WHERE fwcloud= ' + connection.escape(fwcloud) + ' ORDER BY id', function (error, rows) {
            if (error)
                callback(error, null);
            else
                callback(null, rows);
        });
    });
};





//obtenemos un ipobj_g por su id
ipobj_gModel.getIpobj_g = function (fwcloud,id, callback) {
    db.get(function (error, connection) {
        if (error) return done('Database problem');
        var sql = 'SELECT * FROM ' + tableModel + ' WHERE id = ' + connection.escape(id) + ' AND  fwcloud= ' + connection.escape(fwcloud) ;
        connection.query(sql, function (error, row) {
            if (error)
                callback(error, null);
            else
                callback(null, row);
        });
    });
};

//obtenemos un ipobj_g por su nombre
ipobj_gModel.getIpobj_gName = function (fwcloud,name, callback) {
    db.get(function (error, connection) {
        if (error) return done('Database problem');
        var namesql = '%' + name + '%';
        var sql = 'SELECT * FROM ' + tableModel + ' WHERE name like  ' + connection.escape(namesql) + ' AND  fwcloud= ' + connection.escape(fwcloud) ;
        connection.query(sql, function (error, row) {
            if (error)
                callback(error, null);
            else
                callback(null, row);
        });
    });
};

//obtenemos un ipobj_g por su tipo
ipobj_gModel.getIpobj_gType = function (fwcloud,type, callback) {
    db.get(function (error, connection) {
        if (error) return done('Database problem');
        var sql = 'SELECT * FROM ' + tableModel + ' WHERE type =  ' + connection.escape(type) + ' AND  fwcloud= ' + connection.escape(fwcloud) ;
        connection.query(sql, function (error, row) {
            if (error)
                callback(error, null);
            else
                callback(null, row);
        });
    });
};

//añadir un nuevo ipobj_g
ipobj_gModel.insertIpobj_g = function (ipobj_gData, callback) {
    db.get(function (error, connection) {
        if (error) return done('Database problem');
        connection.query('INSERT INTO ' + tableModel + ' SET ?', ipobj_gData, function (error, result) {
            if (error) {
                callback(error, null);
            }
            else {
                //devolvemos la última id insertada
                callback(null, { "insertId": result.insertId });
            }
        });
    });
};

//actualizar un ipobj_g
ipobj_gModel.updateIpobj_g = function (ipobj_gData, callback) {

    db.get(function (error, connection) {
        if (error) return done('Database problem');
        var sql = 'UPDATE ' + tableModel + ' SET name = ' + connection.escape(ipobj_gData.name) + ' ' +
            ' ,type = ' + connection.escape(ipobj_gData.type) + ',' +    
            ' ,fwcloud = ' + connection.escape(ipobj_gData.fwcloud) + ' ' +    
            ' WHERE id = ' + ipobj_gData.id;
            
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

//eliminar un ipobj_g pasando la id a eliminar
ipobj_gModel.deleteIpobj_g = function (id, callback) {
    db.get(function (error, connection) {
        if (error) return done('Database problem');
        var sqlExists = 'SELECT * FROM ' + tableModel + ' WHERE id = ' + connection.escape(id);
        connection.query(sqlExists, function (error, row) {
            //si existe la id del ipobj_g a eliminar
            if (row) {
                db.get(function (error, connection) {
                    var sql = 'DELETE FROM ' + tableModel + ' WHERE id = ' + connection.escape(id);
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
module.exports = ipobj_gModel;