var db = require('../db.js');


//creamos un objeto para ir almacenando todo lo que necesitemos
var routing_rModel = {};
var tableModel = "routing_r";




//obtenemos todos los routing_r por firewall y grupo
routing_rModel.getRouting_rs = function (idfirewall,idgroup, callback) {

    db.get(function (error, connection) {
        if (error)
            return done('Database problem');        
        var whereGroup='';
        if (idgroup!==''){
            whereGroup=' AND idgroup=' + connection.escape(idgroup);
        }
        var sql = 'SELECT * FROM ' + tableModel + ' WHERE firewall=' + connection.escape(idfirewall) + whereGroup + ' ORDER BY rule_order';
        console.log("sql : " + sql);
        connection.query(sql, function (error, rows) {
            if (error)
                callback(error, null);
            else
                callback(null, rows);
        });
    });
};





//obtenemos un routing_r por su id y grupo y firewall
routing_rModel.getRouting_r = function (idfirewall, id, callback) {
    db.get(function (error, connection) {
        if (error)
            return done('Database problem');

        var sql = 'SELECT * FROM ' + tableModel + ' WHERE id = ' + connection.escape(id) + ' AND firewall=' + connection.escape(idfirewall) ;
        connection.query(sql, function (error, row) {
            if (error)
                callback(error, null);
            else
                callback(null, row);
        });
    });
};

//obtenemos un routing por su nombre y firewall y grupo
routing_rModel.getRouting_rName = function (idfirewall,idgroup, name, callback) {
    db.get(function (error, connection) {
        if (error)
            return done('Database problem');
        var namesql = '%' + name + '%';
        var whereGroup='';
        if (idgroup!==''){
            whereGroup=' AND group=' + connection.escape(idgroup);
        }
        var sql = 'SELECT * FROM ' + tableModel + ' WHERE name like  ' + connection.escape(namesql) + ' AND firewall=' + connection.escape(idfirewall) + whereGroup;
        console.log(sql);
        connection.query(sql, function (error, row) {
            if (error)
                callback(error, null);
            else
                callback(null, row);
        });
    });
};



//añadir un nuevo routing_r de usuario
routing_rModel.insertRouting_r = function (routing_rData, callback) {
    db.get(function (error, connection) {
        if (error)
            return done('Database problem');
        connection.query('INSERT INTO ' + tableModel + ' SET ?', routing_rData, function (error, result) {
            if (error) {
                callback(error, null);
            } else {
                //devolvemos la última id insertada
                callback(null, {"insertId": result.insertId});
            }
        });
    });
};

//actualizar un routing_r de usuario
routing_rModel.updateRouting_r = function ( routing_rData, callback) {

    db.get(function (error, connection) {
        if (error)
            return done('Database problem');
        var sql = 'UPDATE ' + tableModel + ' SET ' +
                'idgroup = ' + connection.escape(routing_rData.idgroup) + ',' +
                'firewall = ' + connection.escape(routing_rData.firewall) + ',' +
                'rule_order = ' + connection.escape(routing_rData.rule_order) + ',' +                
                'metric = ' + connection.escape(routing_rData.metric) + ',' +
                'options = ' + connection.escape(routing_rData.options) + ',' +                
                'comment = ' + connection.escape(routing_rData.comment) + ' ' +
                ' WHERE id = ' + routing_rData.id;
        console.log(sql);
        connection.query(sql, function (error, result) {
            if (error) {
                callback(error, null);
            } else {
                callback(null, {"msg": "success"});
            }
        });
    });
};

//eliminar un routing_r pasando la id a eliminar
routing_rModel.deleteRouting_r = function (idfirewall, id, callback) {
    db.get(function (error, connection) {
        if (error)
            return done('Database problem');
        var sqlExists = 'SELECT * FROM ' + tableModel + '  WHERE id = ' + connection.escape(id) + ' AND firewall=' +  connection.escape(idfirewall);
        connection.query(sqlExists, function (error, row) {
            //si existe la id del routing_r a eliminar
            if (row) {
                db.get(function (error, connection) {
                    var sql = 'DELETE FROM ' + tableModel + ' WHERE id = ' + connection.escape(id);
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
module.exports = routing_rModel;