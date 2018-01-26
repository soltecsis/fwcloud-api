var db = require('../../db.js');


//create object
var routing_rModel = {};
var tableModel = "routing_r";



var logger = require('log4js').getLogger("app");

//Get All routing_r by firewall and group
routing_rModel.getRouting_rs = function (idfirewall,idgroup, callback) {

    db.get(function (error, connection) {
        if (error)
            callback(error, null);        
        var whereGroup='';
        if (idgroup!==''){
            whereGroup=' AND idgroup=' + connection.escape(idgroup);
        }
        var sql = 'SELECT * FROM ' + tableModel + ' WHERE firewall=' + connection.escape(idfirewall) + whereGroup + ' ORDER BY rule_order';
        logger.debug("sql : " + sql);
        connection.query(sql, function (error, rows) {
            if (error)
                callback(error, null);
            else
                callback(null, rows);
        });
    });
};





//Get routing_r by  id and group and firewall
routing_rModel.getRouting_r = function (idfirewall, id, callback) {
    db.get(function (error, connection) {
        if (error)
            callback(error, null);

        var sql = 'SELECT * FROM ' + tableModel + ' WHERE id = ' + connection.escape(id) + ' AND firewall=' + connection.escape(idfirewall) ;
        connection.query(sql, function (error, row) {
            if (error)
                callback(error, null);
            else
                callback(null, row);
        });
    });
};

//Get routing by name and firewall and group
routing_rModel.getRouting_rName = function (idfirewall,idgroup, name, callback) {
    db.get(function (error, connection) {
        if (error)
            callback(error, null);
        var namesql = '%' + name + '%';
        var whereGroup='';
        if (idgroup!==''){
            whereGroup=' AND group=' + connection.escape(idgroup);
        }
        var sql = 'SELECT * FROM ' + tableModel + ' WHERE name like  ' + connection.escape(namesql) + ' AND firewall=' + connection.escape(idfirewall) + whereGroup;
        logger.debug(sql);
        connection.query(sql, function (error, row) {
            if (error)
                callback(error, null);
            else
                callback(null, row);
        });
    });
};



//Add new routing_r from user
routing_rModel.insertRouting_r = function (routing_rData, callback) {
    db.get(function (error, connection) {
        if (error)
            callback(error, null);
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

//Update routing_r from user
routing_rModel.updateRouting_r = function ( routing_rData, callback) {

    db.get(function (error, connection) {
        if (error)
            callback(error, null);
        var sql = 'UPDATE ' + tableModel + ' SET ' +
                'idgroup = ' + connection.escape(routing_rData.idgroup) + ',' +
                'firewall = ' + connection.escape(routing_rData.firewall) + ',' +
                'rule_order = ' + connection.escape(routing_rData.rule_order) + ',' +                
                'metric = ' + connection.escape(routing_rData.metric) + ',' +
                'options = ' + connection.escape(routing_rData.options) + ',' +                
                'comment = ' + connection.escape(routing_rData.comment) + ' ' +
                ' WHERE id = ' + routing_rData.id;
        logger.debug(sql);
        connection.query(sql, function (error, result) {
            if (error) {
                callback(error, null);
            } else {
                callback(null, {"result": true});
            }
        });
    });
};

//Remove routing_r with id to remove
routing_rModel.deleteRouting_r = function (idfirewall, id, callback) {
    db.get(function (error, connection) {
        if (error)
            callback(error, null);
        var sqlExists = 'SELECT * FROM ' + tableModel + '  WHERE id = ' + connection.escape(id) + ' AND firewall=' +  connection.escape(idfirewall);
        connection.query(sqlExists, function (error, row) {
            //If exists Id from routing_r to remove
            if (row) {
                db.get(function (error, connection) {
                    var sql = 'DELETE FROM ' + tableModel + ' WHERE id = ' + connection.escape(id);
                    connection.query(sql, function (error, result) {
                        if (error) {
                            callback(error, null);
                        } else {
                            callback(null, {"result": true, "msg": "deleted"});
                        }
                    });
                });
            } else {
                callback(null, {"result": false});
            }
        });
    });
};

//Export the object
module.exports = routing_rModel;