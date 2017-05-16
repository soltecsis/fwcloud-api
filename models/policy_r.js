var db = require('../db.js');


//creamos un objeto para ir almacenando todo lo que necesitemos
var policy_rModel = {};
var tableModel = "policy_r";




//obtenemos todos los policy_r por firewall y grupo
policy_rModel.getPolicy_rs = function (idfirewall,idgroup, callback) {

    db.get(function (error, connection) {
        if (error)
            return done('Database problem');        
        var whereGroup='';
        if (idgroup!==''){
            whereGroup=' AND idgroup=' + connection.escape(idgroup);
        }
        var sql = 'SELECT * FROM ' + tableModel + ' WHERE firewall=' + connection.escape(idfirewall) + whereGroup + ' ORDER BY rule_order';
        connection.query(sql, function (error, rows) {
            if (error)
                callback(error, null);
            else
                callback(null, rows);
        });
    });
};


//obtenemos un policy_r por su id  y firewall
policy_rModel.getPolicy_r = function (idfirewall,  id, callback) {
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
policy_rModel.getPolicy_rName = function (idfirewall,idgroup, name, callback) {
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



//añadir un nuevo policy_r de usuario
policy_rModel.insertPolicy_r = function (policy_rData, callback) {
    OrderList(policy_rData.rule_order, policy_rData.firewall,  999999);
    db.get(function (error, connection) {
        if (error)
            return done('Database problem');
        connection.query('INSERT INTO ' + tableModel + ' SET ?', policy_rData, function (error, result) {
            if (error) {
                callback(error, null);
            } else {
                //devolvemos la última id insertada
                callback(null, {"insertId": result.insertId});
            }
        });
    });
};

//actualizar un policy_r de usuario
policy_rModel.updatePolicy_r = function (old_order, policy_rData, callback) {

    OrderList(policy_rData.rule_order, policy_rData.firewall,  old_order);
    
    db.get(function (error, connection) {
        if (error)
            return done('Database problem');
        var sql = 'UPDATE ' + tableModel + ' SET ' +
                'idgroup = ' + connection.escape(policy_rData.idgroup) + ',' +
                'firewall = ' + connection.escape(policy_rData.firewall) + ',' +                
                'rule_order = ' + connection.escape(policy_rData.rule_order) + ',' +                
                'direction = ' + connection.escape(policy_rData.direction) + ',' +
                'action = ' + connection.escape(policy_rData.action) + ',' +
                'time_start = ' + connection.escape(policy_rData.time_start) + ',' +
                'time_end = ' + connection.escape(policy_rData.time_end) + ',' +
                'options = ' + connection.escape(policy_rData.options) + ',' +                
                'active = ' + connection.escape(policy_rData.active) + ',' +                
                'comment = ' + connection.escape(policy_rData.comment) + ' ' +
                'type = ' + connection.escape(policy_rData.type) + ' ' +
                'interface_negate = ' + connection.escape(policy_rData.interface_negate) + ' ' +
                ' WHERE id = ' + policy_rData.id;
        connection.query(sql, function (error, result) {
            if (error) {
                callback(error, null);
            } else {
                callback(null, {"msg": "success"});
            }
        });
    });
};

//actualizar ORDER de un policy_r 
policy_rModel.updatePolicy_r_order = function (idfirewall,id, rule_order, old_order, callback) {

    OrderList(rule_order, idfirewall,  old_order);
    
    db.get(function (error, connection) {
        if (error)
            return done('Database problem');
        var sql = 'UPDATE ' + tableModel + ' SET ' +
                'rule_order = ' + connection.escape(rule_order) + ' ' +                                
                ' WHERE id = ' + id;
        
        connection.query(sql, function (error, result) {
            if (error) {
                callback(error, null);
            } else {
                callback(null, {"msg": "success"});
            }
        });
    });
};

function OrderList(new_order, idfirewall,  old_order){
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
                'rule_order = rule_order' + increment + 
                ' WHERE firewall = ' + connection.escape(idfirewall)  + 
                ' AND rule_order>=' + order1 + ' AND rule_order<=' + order2;
        connection.query(sql);        
        
    });
    
};

//eliminar un policy_r pasando la id a eliminar
policy_rModel.deletePolicy_r = function (idfirewall, id,rule_order, callback) {
    OrderList(999999, idfirewall,  rule_order);
    db.get(function (error, connection) {
        if (error)
            return done('Database problem');
        var sqlExists = 'SELECT * FROM ' + tableModel + '  WHERE id = ' + connection.escape(id) + ' AND firewall=' +  connection.escape(idfirewall);
        connection.query(sqlExists, function (error, row) {
            //si existe la id del policy_r a eliminar
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
module.exports = policy_rModel;