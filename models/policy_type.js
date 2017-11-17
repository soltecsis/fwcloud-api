var db = require('../db.js');


//create object
var policy_typeModel = {};
var tableModel="policy_type";

/**
* Property Logger to manage App logs
*
* @property logger
* @type log4js/app
* 
*/
var logger = require('log4js').getLogger("app");

//Get All policy_type
policy_typeModel.getPolicy_types = function (callback) {

    db.get(function (error, connection) {
        if (error) return done('Database problem');
        connection.query('SELECT * FROM ' + tableModel + ' ORDER BY type_order', function (error, rows) {
            if (error)
                callback(error, null);
            else
                callback(null, rows);
        });
    });
};





//Get policy_type by  type
policy_typeModel.getPolicy_type = function (type, callback) {
    db.get(function (error, connection) {
        if (error) return done('Database problem');
        var sql = 'SELECT * FROM ' + tableModel + ' WHERE type = ' + connection.escape(type);
        connection.query(sql, function (error, row) {
            if (error)
                callback(error, null);
            else{                
                callback(null, row);
            }
        });
    });
};

//Get policy_type by name
policy_typeModel.getPolicy_typeName = function (name, callback) {
    db.get(function (error, connection) {
        if (error) return done('Database problem');
        var namesql = '%' + name + '%';
        var sql = 'SELECT * FROM ' + tableModel + ' WHERE name like  ' + connection.escape(namesql) + ' ORDER BY type_order' ;
        connection.query(sql, function (error, row) {
            if (error)
                callback(error, null);
            else
                callback(null, row);
        });
    });
};



//Add new policy_type
policy_typeModel.insertPolicy_type = function (policy_typeData, callback) {
    db.get(function (error, connection) {
        if (error) return done('Database problem');
        connection.query('INSERT INTO ' + tableModel + ' SET ?', policy_typeData, function (error, result) {
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

//Update policy_type
policy_typeModel.updatePolicy_type = function (policy_typeData, callback) {

    db.get(function (error, connection) {
        if (error) return done('Database problem');
        var sql = 'UPDATE ' + tableModel + ' SET name = ' + connection.escape(policy_typeData.name) + ', ' +            
                ' SET type = ' + connection.escape(policy_typeData.type) + ', ' +            
                ' SET id = ' + connection.escape(policy_typeData.id) + ' ' +            
            ' WHERE type = ' + policy_typeData.type;
            logger.debug(sql);
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

//Remove policy_type with type to remove
policy_typeModel.deletePolicy_type = function (type, callback) {
    db.get(function (error, connection) {
        if (error) return done('Database problem');
        var sqlExists = 'SELECT * FROM ' + tableModel + ' WHERE type = ' + connection.escape(type);
        connection.query(sqlExists, function (error, row) {
            //If exists Id from policy_type to remove
            if (row) {
                db.get(function (error, connection) {
                    var sql = 'DELETE FROM ' + tableModel + ' WHERE type = ' + connection.escape(type);
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
module.exports = policy_typeModel;