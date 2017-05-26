var db = require('../db.js');


//create object
var ipobjModel = {};
var tableModel = "ipobj";



//Get ipobj by  id 
ipobjModel.getIpobj = function ( id, callback) {
    db.get(function (error, connection) {
        if (error)
            return done('Database problem');

        var sql = 'SELECT * FROM ' + tableModel +  ' WHERE id = ' + connection.escape(id) ;
        connection.query(sql, function (error, row) {
            if (error)
                callback(error, null);
            else
                callback(null, row);
        });
    });
};

//Get All ipobj by group
ipobjModel.getIpobjsGroup = function (idgroup, callback) {

    db.get(function (error, connection) {
        if (error)
            return done('Database problem');        

        var innergroup=' T INNER JOIN ipobj__ipobjg G on G.ipobj=T.id ';
        var sql = 'SELECT * FROM ' + tableModel + innergroup +  ' WHERE  G.ipobj_g=' + connection.escape(idgroup) + ' ORDER BY id';
        console.log(sql);
        connection.query(sql, function (error, rows) {
            if (error)
                callback(error, null);
            else
                callback(null, rows);
        });
    });
};

//Get ipobj by  id and group 
ipobjModel.getIpobjGroup = function ( idgroup, id, callback) {
    db.get(function (error, connection) {
        if (error)
            return done('Database problem');

        var innergroup=' T INNER JOIN ipobj__ipobjg G on G.ipobj=T.id ';
        var sql = 'SELECT * FROM ' + tableModel + innergroup +  ' WHERE id = ' + connection.escape(id) + ' AND G.ipobj_g=' + connection.escape(idgroup);        
        connection.query(sql, function (error, row) {
            if (error)
                callback(error, null);
            else
                callback(null, row);
        });
    });
};

//Get ipobj by name 
ipobjModel.getIpobjName = function (name, callback) {
    db.get(function (error, connection) {
        if (error)
            return done('Database problem');
        var namesql = '%' + name + '%';

        var sql = 'SELECT * FROM ' + tableModel + ' WHERE name like  ' + connection.escape(namesql) ;
        
        connection.query(sql, function (error, row) {
            if (error)
                callback(error, null);
            else
                callback(null, row);
        });
    });
};



//Add new ipobj from user
ipobjModel.insertIpobj = function (ipobjData, callback) {
    db.get(function (error, connection) {
        if (error)
            return done('Database problem');
        connection.query('INSERT INTO ' + tableModel + ' SET ?', ipobjData, function (error, result) {
            if (error) {
                callback(error, null);
            } else {
                //devolvemos la última id insertada
                callback(null, {"insertId": result.insertId});
            }
        });
    });
};

//Update ipobj from user
ipobjModel.updateIpobj = function ( ipobjData, callback) {

    db.get(function (error, connection) {
        if (error)
            return done('Database problem');
        var sql = 'UPDATE ' + tableModel + ' SET ' +
                'fwcloud = ' + connection.escape(ipobjData.fwcloud) + ',' +
                'interface = ' + connection.escape(ipobjData.interface) + ',' +
                'name = ' + connection.escape(ipobjData.name) + ',' +
                'type = ' + connection.escape(ipobjData.type) + ',' +
                'protocol = ' + connection.escape(ipobjData.protocol) + ',' +
                'address = ' + connection.escape(ipobjData.address) + ',' +                
                'netmask = ' + connection.escape(ipobjData.netmask) + ',' +
                'diff_serv = ' + connection.escape(ipobjData.diff_serv) + ',' +
                'ip_version = ' + connection.escape(ipobjData.ip_version) + ',' +
                'code = ' + connection.escape(ipobjData.code) + ',' +
                'tcp_flags_mask = ' + connection.escape(ipobjData.tcp_flags_mask) + ',' +                
                'tcp_flags_settings = ' + connection.escape(ipobjData.tcp_flags_settings) + ',' +                
                'range_start = ' + connection.escape(ipobjData.range_start) + ',' +
                'range_end = ' + connection.escape(ipobjData.range_end) + ',' +
                'source_port_start = ' + connection.escape(ipobjData.source_port_start) + ',' +
                'source_port_end = ' + connection.escape(ipobjData.source_port_end) + ',' +
                'destination_port_start = ' + connection.escape(ipobjData.destination_port_start) + ',' +
                'destination_port_end = ' + connection.escape(ipobjData.destination_port_end) + ',' +
                'options = ' + connection.escape(ipobjData.options) + ',' +
                'comment = ' + connection.escape(ipobjData.comment) + ' ' +                
                ' WHERE id = ' + ipobjData.id;
        
        connection.query(sql, function (error, result) {
            if (error) {
                callback(error, null);
            } else {
                callback(null, {"msg": "success"});
            }
        });
    });
};

//Remove ipobj with id to remove
ipobjModel.deleteIpobj = function ( id, callback) {
    db.get(function (error, connection) {
        if (error)
            return done('Database problem');
        var sqlExists = 'SELECT * FROM ' + tableModel + '  WHERE id = ' + connection.escape(id) ;
        connection.query(sqlExists, function (error, row) {
            //If exists Id from ipobj to remove
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

//Export the object
module.exports = ipobjModel;