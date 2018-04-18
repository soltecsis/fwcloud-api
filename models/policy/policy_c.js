var db = require('../../db.js');


//create object
var policy_cModel = {};
var tableModel = "policy_c";
var tableModelPolicy = "policy_r";


var logger = require('log4js').getLogger("app");

//Get All policy_c by firewall
policy_cModel.getPolicy_cs = function (idfirewall, callback) {

    db.get(function (error, connection) {
        if (error)
            callback(error, null);
        //var sql = 'SELECT * FROM ' + tableModel + ' WHERE firewall=' + connection.escape(idfirewall) + ' ORDER BY rule';
        var sql = 'SELECT R.id,R.rule_order,  ' + 
                ' ((R.updated_at>=C.updated_at) OR C.updated_at is null) as c_status_recompile, C.rule_compiled as c_compiled, ' +
                ' R.comment, R.fw_apply_to, IFNULL(FC.name , F.name) as firewall_name  ' +
                ' FROM ' + tableModelPolicy + ' R LEFT JOIN ' + tableModel + ' C ON R.id=C.rule ' + 
                ' INNER JOIN firewall F on F.id=R.firewall ' + 
                ' LEFT JOIN firewall FC on FC.id=R.fw_apply_to ' +
                ' WHERE R.firewall=' + connection.escape(idfirewall) +  ' AND R.active=1 ' +
                ' ORDER BY R.type, R.rule_order';
        connection.query(sql, function (error, rows) {
            if (error)
                callback(error, null);
            else
                callback(null, rows);
        });
    });
};

//Get All policy_c by policy type and firewall
policy_cModel.getPolicy_cs_type = function (fwcloud, idfirewall, type, callback) {

    db.get(function (error, connection) {
        if (error)
            callback(error, null);
        //return only: id, rule_order, c_status_recompile, c_compiled, comment
        var sql = 'SELECT R.id,R.rule_order,  ' + 
                ' ((R.updated_at>=C.updated_at) OR C.updated_at is null) as c_status_recompile, C.rule_compiled as c_compiled, ' +
                ' R.comment, R.fw_apply_to, IFNULL(FC.name , F.name) as firewall_name  ' +
                ' FROM ' + tableModelPolicy + ' R LEFT JOIN ' + tableModel + ' C ON R.id=C.rule ' + 
                ' INNER JOIN firewall F on F.id=R.firewall ' + 
                ' LEFT JOIN firewall FC on FC.id=R.fw_apply_to ' +
                ' WHERE R.firewall=' + connection.escape(idfirewall) + ' AND R.type=' + connection.escape(type) + 
                ' AND F.fwcloud=' +  connection.escape(fwcloud) + ' AND R.active=1 ' +
                ' ORDER BY R.rule_order';          
         
        connection.query(sql, function (error, rows) {
            if (error)
                callback(error, null);
            else
                callback(null, rows);
        });
    });
};




//Get policy_c by  id and firewall
policy_cModel.getPolicy_c = function (fwcloud, idfirewall, rule, callback) {
    db.get(function (error, connection) {
        if (error)
            callback(error, null);
        //var sql = 'SELECT * FROM ' + tableModel + ' WHERE rule = ' + connection.escape(rule) + ' AND firewall=' + connection.escape(idfirewall);
        var sql = 'SELECT R.id,R.rule_order,  ' + 
                ' ((R.updated_at>=C.updated_at) OR C.updated_at is null) as c_status_recompile, C.rule_compiled as c_compiled, ' +
                ' R.comment, R.fw_apply_to, IFNULL(FC.name , F.name) as firewall_name ' +
                ' FROM ' + tableModelPolicy + ' R LEFT JOIN ' + tableModel + ' C ON R.id=C.rule ' + 
                ' INNER JOIN firewall F on F.id=R.firewall ' + 
                ' LEFT JOIN firewall FC on FC.id=R.fw_apply_to ' +
                ' WHERE R.firewall=' + connection.escape(idfirewall) + ' AND R.id=' + connection.escape(rule) + 
                ' AND F.fwcloud=' +  connection.escape(fwcloud) ;
        
        connection.query(sql, function (error, row) {
            if (error)
                callback(error, null);
            else
                callback(null, row);
        });
    });
};


//Add new policy_c from user
policy_cModel.insertPolicy_c = function (policy_cData, callback) {
    db.get(function (error, connection) {
        if (error)
            callback(error, null);
        var sqlExists = 'SELECT * FROM ' + tableModel + '  WHERE rule = ' + connection.escape(policy_cData.rule) + ' AND firewall=' + connection.escape(policy_cData.firewall);
        connection.query(sqlExists, function (error, row) {
            if (row && row.length > 0) {
                policy_cModel.updatePolicy_c(policy_cData, function (error, data)
                {
                    if (error) {
                        callback(error, null);
                    }
                    else{
                        callback(null, {"insertId": policy_cData.id});
                    }
                });
                callback(null, {"insertId": policy_cData.id});
            } else {
                sqlInsert = 'INSERT INTO ' + tableModel + ' SET rule=' + policy_cData.rule + ', firewall=' + policy_cData.firewall + 
                        ", rule_compiled=" + connection.escape(policy_cData.rule_compiled) + ", status_compiled=" + connection.escape(policy_cData.status_compiled) +
                        ", updated_at=CURRENT_TIMESTAMP";
                
                connection.query(sqlInsert, function (error, result) {
                    if (error) {
                        callback(error, null);
                    } else {
                        //devolvemos la última id insertada
                        logger.debug("CREADA nueva RULE COMPILED: " + result.insertId);
                        callback(null, {"insertId": result.insertId});
                    }
                });
            }
        });
    });
};
//Update policy_c 
policy_cModel.updatePolicy_c = function (policy_cData, callback) {

    db.get(function (error, connection) {
        if (error)
            callback(error, null);
        var sql = 'UPDATE ' + tableModel + ' SET rule_compiled = ' + connection.escape(policy_cData.rule_compiled) + ',' +
                'firewall = ' + connection.escape(policy_cData.firewall) + ',' +
                'status_compiled = ' + connection.escape(policy_cData.status_compiled) + ', ' +
                'updated_at=CURRENT_TIMESTAMP ' + 
                ' WHERE rule = ' + policy_cData.rule;
        
        connection.query(sql, function (error, result) {
            if (error) {
                callback(error, null);
            } else {
                callback(null, {"result": true});
            }
        });
    });
};
//Remove policy_c with id to remove
policy_cModel.deletePolicy_c = function (idfirewall, rule, callback) {
    db.get(function (error, connection) {
        if (error)
            callback(error, null);
        var sqlExists = 'SELECT * FROM ' + tableModel + '  WHERE rule = ' + connection.escape(rule) + ' AND firewall=' + connection.escape(idfirewall);
        connection.query(sqlExists, function (error, row) {
            //If exists Id from policy_c to remove
            if (row) {
                db.get(function (error, connection) {
                    var sql = 'DELETE FROM ' + tableModel + ' WHERE rule = ' + connection.escape(rule);
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
module.exports = policy_cModel;