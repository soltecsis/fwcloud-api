var db = require('../db.js');


//create object
var ipobj__ipobjgModel = {};
var tableModel="ipobj__ipobjg";


//Get All ipobj__ipobjg by group
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



//Get ipobj__ipobjg by  id
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



//Add new ipobj__ipobjg
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

//Add new ipobj__ipobjg by OBJREF_FWB
ipobj__ipobjgModel.insertIpobj__ipobjg_objref = function (idgroup, objref, callback) {
    db.get(function (error, connection) {
        if (error) return done('Database problem');
        var sql='INSERT INTO ' + tableModel + ' SET ipobj_g=' + connection.escape(idgroup) + ', ipobj=(select id from ipobj where id_fwb=' + connection.escape(objref) + ')';
        
        connection.query(sql ,  function (error, result) {
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

//Update ipobj__ipobjg
ipobj__ipobjgModel.updateIpobj__ipobjg = function (ipobj_g, ipobj,ipobj__ipobjgData, callback) {

    db.get(function (error, connection) {
        if (error) return done('Database problem');
        var sql = 'UPDATE ' + tableModel + ' SET ipobj_g = ' + connection.escape(ipobj__ipobjgData.ipobj_g) + ' ' +
            ' ,ipobj = ' + connection.escape(ipobj__ipobjgData.ipobj) + ' ' +    
            ' WHERE ipobj_g = ' + connection.escape(ipobj_g) + ' AND ipobj=' +  connection.escape(ipobj);
            
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

//Remove ipobj__ipobjg with id to remove
ipobj__ipobjgModel.deleteIpobj__ipobjg = function (ipobj_g, ipobj, callback) {
    db.get(function (error, connection) {
        if (error) return done('Database problem');
        var sqlExists = 'SELECT * FROM ' + tableModel + ' WHERE ipobj_g = ' + connection.escape(ipobj_g) + ' AND ipobj=' +  connection.escape(ipobj);
        connection.query(sqlExists, function (error, row) {
            //If exists Id from ipobj__ipobjg to remove
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

//Export the object
module.exports = ipobj__ipobjgModel;