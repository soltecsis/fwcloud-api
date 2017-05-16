var db = require('../db.js');


//creamos un objeto para ir almacenando todo lo que necesitemos
var ipobj__ipobjgModel = {};
var tableModel="ipobj__ipobjg";


//obtenemos todos los ipobj__ipobjg por grupo
ipobj__ipobjgModel.getIpobj__ipobjgs = function (ipobjg, callback) {

    db.get(function (error, connection) {
        if (error) return done('Database problem');
        connection.query('SELECT * FROM ' + tableModel + ' WHERE ipobj_g=' + connection.escape(ipobjg) + ' ORDER BY ipobj', function (error, rows) {
            if (error)
                callback(error, null);
            else
                callback(null, rows);
        });
    });
};



//obtenemos un ipobj__ipobjg por su id
ipobj__ipobjgModel.getIpobj__ipobjg = function (ipobjg,ipobj, callback) {
    db.get(function (error, connection) {
        if (error) return done('Database problem');
        var sql = 'SELECT * FROM ' + tableModel + ' WHERE ipobj_g = ' + connection.escape(ipobjg) + ' AND ipobj = ' + connection.escape(ipobj);
        connection.query(sql, function (error, row) {
            if (error)
                callback(error, null);
            else
                callback(null, row);
        });
    });
};



//añadir un nuevo ipobj__ipobjg
ipobj__ipobjgModel.insertIpobj__ipobjg = function (ipobj__ipobjgData, callback) {
    db.get(function (error, connection) {
        if (error) return done('Database problem');
        connection.query('INSERT INTO ' + tableModel + ' SET ?', ipobj__ipobjgData, function (error, result) {
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

//actualizar un ipobj__ipobjg
ipobj__ipobjgModel.updateIpobj__ipobjg = function (ipobj_g, ipobj,ipobj__ipobjgData, callback) {

    db.get(function (error, connection) {
        if (error) return done('Database problem');
        var sql = 'UPDATE ' + tableModel + ' SET ipobj_g = ' + connection.escape(ipobj__ipobjgData.ipobj_g) + ' ' +
            ' ,ipobj = ' + connection.escape(ipobj__ipobjgData.ipobj) + ' ' +    
            ' WHERE ipobj_g = ' + connection.escape(ipobj_g) + ' AND ipobj=' +  connection.escape(ipobj);
            console.log(sql);
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

//eliminar un ipobj__ipobjg pasando la id a eliminar
ipobj__ipobjgModel.deleteIpobj__ipobjg = function (ipobj_g, ipobj, callback) {
    db.get(function (error, connection) {
        if (error) return done('Database problem');
        var sqlExists = 'SELECT * FROM ' + tableModel + ' WHERE ipobj_g = ' + connection.escape(ipobj_g) + ' AND ipobj=' +  connection.escape(ipobj);
        connection.query(sqlExists, function (error, row) {
            //si existe la id del ipobj__ipobjg a eliminar
            if (row) {
                db.get(function (error, connection) {
                    var sql = 'DELETE FROM ' + tableModel + ' WHERE ipobj_g = ' + connection.escape(ipobj_g) + ' AND ipobj=' +  connection.escape(ipobj);
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
module.exports = ipobj__ipobjgModel;