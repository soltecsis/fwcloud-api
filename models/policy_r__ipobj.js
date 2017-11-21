var db = require('../db.js');
var async = require('async');

//create object
var policy_r__ipobjModel = {};
var tableModel = "policy_r__ipobj";

/**
 * Property Logger to manage App logs
 *
 * @property logger
 * @type log4js/app
 * 
 */
var logger = require('log4js').getLogger("app");


//Get All policy_r__ipobj by Policy_r (rule)
policy_r__ipobjModel.getPolicy_r__ipobjs = function (rule, callback) {

    db.get(function (error, connection) {
        if (error)
            return done('Database problem');

        var sql = 'SELECT * FROM ' + tableModel + ' WHERE rule=' + connection.escape(rule) + ' ORDER BY position_order';

        connection.query(sql, function (error, rows) {
            if (error)
                callback(error, null);
            else
                callback(null, rows);
        });
    });

};

//Get All policy_r__ipobj by Policy_r (rule) and position
policy_r__ipobjModel.getPolicy_r__ipobjs_position = function (rule, position, callback) {

    db.get(function (error, connection) {
        if (error)
            return done('Database problem');

        var sql = 'SELECT * FROM ' + tableModel + ' WHERE rule=' + connection.escape(rule) + ' AND position=' + connection.escape(position) + ' ORDER BY position_order';

        connection.query(sql, function (error, rows) {
            if (error)
                callback(error, null);
            else
                callback(null, rows);
        });
    });

};
//Get All policy_r__ipobj by Policy_r (rule) and position
policy_r__ipobjModel.getPolicy_r__ipobjs_interfaces_position = function (rule, position, callback) {

    db.get(function (error, connection) {
        if (error)
            return done('Database problem');


        var sql = 'SELECT rule,ipobj, ipobj_g, interface, position, position_order, negate, "O" as type FROM ' + tableModel + ' WHERE rule=' + connection.escape(rule) + ' AND position=' + connection.escape(position) +
                ' UNION SELECT rule,interface,0,0,position,position_order, negate, "I" as type  from policy_r__interface ' + ' WHERE rule=' + connection.escape(rule) + ' AND position=' + connection.escape(position) +
                ' ORDER BY position_order';

        connection.query(sql, function (error, rows) {
            if (error)
                callback(error, null);
            else
                callback(null, rows);
        });
    });

};

//Get All policy_r__ipobj by Policy_r (rule) and position
policy_r__ipobjModel.getPolicy_r__ipobjs_position_data = function (rule, position, callback) {

    db.get(function (error, connection) {
        if (error)
            return done('Database problem');

        var sql_obj = " INNER JOIN ipobj O on O.id=P.ipobj ";
        var sql = 'SELECT * FROM ' + tableModel + ' P ' + sql_obj + ' WHERE P.rule=' + connection.escape(rule) + ' AND P.position=' + connection.escape(position) + ' ORDER BY P.position_order';
        logger.debug(sql);
        connection.query(sql, function (error, rows) {
            if (error)
                callback(error, null);
            else
                callback(null, rows);
        });
    });

};

//Get  policy_r__ipobj by primarykey
policy_r__ipobjModel.getPolicy_r__ipobj = function (rule, ipobj, ipobj_g, interface, position, callback) {

    db.get(function (error, connection) {
        if (error)
            return done('Database problem');

        var sql = 'SELECT * FROM ' + tableModel +
                ' WHERE rule = ' + connection.escape(rule) + ' AND ipobj=' + connection.escape(ipobj) +
                ' AND ipobj_g=' + connection.escape(ipobj_g) + ' AND position=' + connection.escape(position) +
                ' ORDER BY position_order';

        connection.query(sql, function (error, rows) {
            if (error)
                callback(error, null);
            else
                callback(null, rows);
        });
    });
};


//Add new policy_r__ipobj 
policy_r__ipobjModel.insertPolicy_r__ipobj = function (policy_r__ipobjData, set_negate, callback) {


    //Check if IPOBJ TYPE is ALLOWED in this Position  ONLY 'O' POSITIONS
    checkIpobjPosition(policy_r__ipobjData.rule, policy_r__ipobjData.ipobj, policy_r__ipobjData.ipobj_g, policy_r__ipobjData.interface, policy_r__ipobjData.position, function (error, data) {
        if (error) {
            callback(error, {"error": error});
        } else {
            allowed = data;
            if (allowed) {
                //Check if the IPOBJ in this position are negated
                getNegateRulePosition(policy_r__ipobjData.rule, policy_r__ipobjData.position, function (error, data) {
                    if (error) {
                        callback(error, {"error": "error"});
                    } else {
                        negate = data;
                        if (set_negate)
                            negate = 1;

                        db.get(function (error, connection) {
                            if (error)
                                return done('Database problem');
                            
                            connection.query('INSERT INTO ' + tableModel + ' SET negate=' + negate + ', ?', policy_r__ipobjData, function (error, result) {
                                if (error) {
                                    logger.debug(error);
                                    callback(error, {"error": error});
                                } else {
                                    if (result.affectedRows > 0) {
                                        OrderList(policy_r__ipobjData.position_order, policy_r__ipobjData.rule, policy_r__ipobjData.position, 999999, policy_r__ipobjData.ipobj, policy_r__ipobjData.ipobj_g, policy_r__ipobjData.interface);
                                        callback(null, {"msg": "success"});
                                    } else {
                                        callback(null, {"msg": "nothing"});
                                    }
                                }
                            });
                        });
                    }
                });
            } else {
                callback({"allowed": 0, "error": "NOT ALLOWED"}, null);
            }
        }
    });

};

//Update policy_r__ipobj
policy_r__ipobjModel.updatePolicy_r__ipobj = function (rule, ipobj, ipobj_g, interface, position, position_order, policy_r__ipobjData, callback) {



    //Check if IPOBJ TYPE is ALLOWED in this Position
    //checkIpobjPosition(rule, ipobj, ipobj_g, interface, position, callback) {
    checkIpobjPosition(policy_r__ipobjData.rule, policy_r__ipobjData.ipobj, policy_r__ipobjData.interface, policy_r__ipobjData.position, function (error, data) {
        if (error) {
            callback(error, {"error": "error"});
        } else {
            allowed = data;
            if (allowed) {
                //Check if the IPOBJ in this position are negated
                getNegateRulePosition(policy_r__ipobjData.rule, policy_r__ipobjData.position, function (error, data) {
                    if (error) {
                        logger.debug("ERROR : ", error);
                    } else {
                        negate = data;
                        logger.debug("RULE: " + policy_r__ipobjData.rule, +"  Position: " + policy_r__ipobjData.position + "  NEGATE: " + negate);
                        db.get(function (error, connection) {
                            if (error)
                                return done('Database problem');
                            var sql = 'UPDATE ' + tableModel + ' SET ' +
                                    'rule = ' + connection.escape(policy_r__ipobjData.rule) + ',' +
                                    'ipobj = ' + connection.escape(policy_r__ipobjData.ipobj) + ',' +
                                    'ipobj_g = ' + connection.escape(policy_r__ipobjData.ipobj_g) + ',' +
                                    'interface = ' + connection.escape(policy_r__ipobjData.interface) + ',' +
                                    'position = ' + connection.escape(policy_r__ipobjData.position) + ',' +
                                    'position_order = ' + connection.escape(policy_r__ipobjData.position_order) + ', ' +
                                    'negate = ' + connection.escape(negate) + ' ' +
                                    ' WHERE rule = ' + connection.escape(rule) + ' AND ipobj=' + connection.escape(ipobj) +
                                    ' AND ipobj_g=' + connection.escape(ipobj_g) + ' AND position=' + connection.escape(position) +
                                    ' AND interface=' + connection.escape(interface);

                            connection.query(sql, function (error, result) {
                                if (error) {
                                    callback(error, null);
                                } else {
                                    if (result.affectedRows > 0) {
                                        if (position !== policy_r__ipobjData.position) {
                                            //ordenamos posicion antigua
                                            OrderList(999999, rule, position, position_order, ipobj, ipobj_g, interface);
                                            //ordenamos posicion nueva
                                            OrderList(policy_r__ipobjData.position_order, policy_r__ipobjData.rule, policy_r__ipobjData.position, 999999, ipobj, ipobj_g, interface);
                                        } else
                                            OrderList(policy_r__ipobjData.position_order, rule, position, position_order, ipobj, ipobj_g, interface);
                                        callback(null, {"msg": "success"});
                                    } else {
                                        callback(null, {"msg": "nothing"});
                                    }
                                }
                            });
                        });
                    }
                });
            } else {
                callback({"allowed": 0, "error": "NOT ALLOWED"}, null);
            }
        }
    });
};

//Update policy_r__ipobj Position ORDER
policy_r__ipobjModel.updatePolicy_r__ipobj_position_order = function (rule, ipobj, ipobj_g, interface, position, position_order, new_order, callback) {


    db.get(function (error, connection) {
        if (error)
            return done('Database problem');
        var sql = 'UPDATE ' + tableModel + ' SET ' +
                'position_order = ' + connection.escape(new_order) + ' ' +
                ' WHERE rule = ' + connection.escape(rule) + ' AND ipobj=' + connection.escape(ipobj) +
                ' AND ipobj_g=' + connection.escape(ipobj_g) + ' AND position=' + connection.escape(position) +
                ' AND interface=' + connection.escape(interface);

        connection.query(sql, function (error, result) {
            if (error) {
                callback(error, null);
            } else {
                if (result.affectedRows > 0) {
                    OrderList(new_order, rule, position, position_order, ipobj, ipobj_g, interface);
                    callback(null, {"msg": "success"});
                } else {
                    callback(null, {"msg": "nothing"});
                }
            }
        });
    });
};

//Update policy_r__ipobj POSITION
//When Update position we order New and Old POSITION
policy_r__ipobjModel.updatePolicy_r__ipobj_position = function (rule, ipobj, ipobj_g, interface, position, position_order, new_rule, new_position, new_order, callback) {

    //Check if IPOBJ TYPE is ALLOWED in this Position    
    checkIpobjPosition(new_rule, ipobj, ipobj_g, interface, new_position, function (error, data) {
        if (error) {
            callback(error, {"error": "error"});
        } else {
            allowed = data;
            if (allowed) {
                getNegateRulePosition(new_rule, new_position, function (error, data) {
                    if (error) {
                        logger.debug("ERROR : ", error);
                    } else {
                        negate = data;
                        db.get(function (error, connection) {
                            if (error)
                                return done('Database problem');


                            var sql = 'UPDATE ' + tableModel + ' SET ' +
                                    'rule = ' + connection.escape(new_rule) + ', ' +
                                    'position = ' + connection.escape(new_position) + ', ' +
                                    'position_order = ' + connection.escape(new_order) + ', ' +
                                    'negate = ' + connection.escape(negate) + ' ' +
                                    ' WHERE rule = ' + connection.escape(rule) + ' AND ipobj=' + connection.escape(ipobj) +
                                    ' AND ipobj_g=' + connection.escape(ipobj_g) + ' AND position=' + connection.escape(position) +
                                    ' AND interface=' + connection.escape(interface);
                            logger.debug(sql);
                            connection.query(sql, function (error, result) {
                                if (error) {
                                    callback(error, null);
                                } else {
                                    if (result.affectedRows > 0) {
                                        //Order New position
                                        OrderList(new_order, new_rule, new_position, 999999, ipobj, ipobj_g, interface);
                                        //Order Old position
                                        OrderList(999999, rule, position, position_order, ipobj, ipobj_g, interface);

                                        callback(null, {"msg": "success"});
                                    } else {
                                        callback(null, {"msg": "nothing"});
                                    }
                                }
                            });
                        });
                    }
                });

            } else {
                callback({"allowed": 0, "error": "NOT ALLOWED"}, null);
            }
        }
    });
};
//Update policy_r__ipobj NEGATE
//UPDATE ALL IPOBJ in this Position to new NEGATE status
policy_r__ipobjModel.updatePolicy_r__ipobj_negate = function (rule, position, negate, callback) {


    db.get(function (error, connection) {
        if (error)
            return done('Database problem');
        var sql = 'UPDATE ' + tableModel + ' SET ' +
                'negate = ' + connection.escape(negate) + ' ' +
                ' WHERE rule = ' + connection.escape(rule) + ' ' +
                ' AND position=' + connection.escape(position);
        connection.query(sql, function (error, result) {
            if (error) {
                callback(error, null);
            } else {
                callback(null, {"msg": "success"});
            }
        });
    });
};
function OrderList(new_order, rule, position, old_order, ipobj, ipobj_g, interface) {
    var increment = '+1';
    var order1 = new_order;
    var order2 = old_order;
    if (new_order > old_order) {
        increment = '-1';
        order1 = old_order;
        order2 = new_order;
    }
    logger.debug("---> ORDENANDO RULE : " + rule + " IPOBJ:" + ipobj + " Interface:" + interface + " IPOBJ_G:" + ipobj_g + "  POSITION: " + position + "  OLD_ORDER: " + old_order + "  NEW_ORDER: " + new_order);

    sql_obj = '';
    if (ipobj > 0)
        sql_obj = ' AND ipobj<>' + ipobj;
    else if (interface > 0)
        sql_obj = ' AND interface<>' + interface;
    else if (ipobj_g > 0)
        sql_obj = ' AND ipobj_g<>' + ipobj_g;

    db.get(function (error, connection) {
        if (error)
            return done('Database problem');
        var sql = 'UPDATE ' + tableModel + ' SET ' +
                'position_order = position_order' + increment +
                ' WHERE rule = ' + connection.escape(rule) + ' AND position=' + connection.escape(position) +
                ' AND position_order>=' + order1 + ' AND position_order<=' + order2 + sql_obj;
        logger.debug(sql);
        connection.query(sql);
    });
}


function checkIpobjPosition(rule, ipobj, ipobj_g, interface, position,  callback) {

    var allowed = 0;
    db.get(function (error, connection) {
        if (error)
            callback(null, 0);
        var sql = "";
        if (ipobj > 0) {
            sql = 'select A.allowed from ipobj O ' +
                    'inner join ipobj_type T on O.type=T.id ' +
                    'inner join ipobj_type__policy_position A on A.type=O.type ' +
                    'inner join policy_position P on P.id=A.position ' +
                    ' WHERE O.id = ' + connection.escape(ipobj) + ' AND A.position=' + connection.escape(position) + '  AND P.content="O"' ;
        } else if (ipobj_g > 0) {
            sql = 'select A.allowed from ipobj_g O ' +
                    'inner join ipobj_type T on O.type=T.id ' +
                    'inner join ipobj_type__policy_position A on A.type=O.type ' +
                    'inner join policy_position P on P.id=A.position ' +
                    ' WHERE O.id = ' + connection.escape(ipobj_g) + ' AND A.position=' + connection.escape(position) + '  AND P.content="O"' ;
        } else if (interface > 0) {
            sql = 'select A.allowed from interface O ' +
                    'inner join ipobj_type T on O.interface_type=T.id ' +
                    'inner join ipobj_type__policy_position A on A.type=O.interface_type ' +
                    'inner join policy_position P on P.id=A.position ' +
                    ' WHERE O.id = ' + connection.escape(interface) + ' AND A.position=' + connection.escape(position) + '  AND P.content="O"';
        }
        logger.debug(sql);
        connection.query(sql, function (error, rows) {
            if (error)
                callback(error, null);
            else {
                if (rows.length > 0) {
                    allowed = rows[0].allowed;
                    logger.debug("ALLOWED: " + allowed);
                    if (allowed > 0)
                        callback(null, 1);
                    else
                        callback(null, 0);
                }
                else
                    callback(null, 0);
            }
        });
    });
}

function getNegateRulePosition(rule, position, callback) {

    var Nneg = 0;
    db.get(function (error, connection) {
        if (error)
            return done('Database problem');
        var sql = 'SELECT count(negate) as neg FROM ' + tableModel +
                ' WHERE rule = ' + connection.escape(rule) + ' AND position=' + connection.escape(position) +
                ' AND negate=1';
        //logger.debug('SQL: ' + sql);
        connection.query(sql, function (error, rows) {
            if (error)
                callback(error, null);
            else {
                Nneg = rows[0].neg;
                //logger.debug('Nneg 1: ' + Nneg);
                if (Nneg > 0)
                    callback(null, 1);
                else
                    callback(null, 0);
            }
        });
    });
}
policy_r__ipobjModel.getTypePositions = function (position, new_position, callback) {

    db.get(function (error, connection) {
        if (error)
            return done('Database problem');
        var sql1 = 'SELECT id, content FROM policy_position  WHERE id = ' + connection.escape(position);
        var sql2 = 'SELECT id, content FROM policy_position  WHERE id = ' + connection.escape(new_position);
        //logger.debug('SQL: ' + sql1);
        connection.query(sql1, function (error, rows) {
            if (error)
                callback(error, null);
            else {
                var content1;
                if (rows.length > 0) {
                    content1 = rows[0].content;
                }

                connection.query(sql2, function (error, rows2) {
                    if (error)
                        callback(error, null);
                    else {
                        var content2;
                        if (rows2.length > 0) {
                            content2 = rows2[0].content;
                        }

                        logger.debug('Position: ' + position + '  Content: ' + content1 + '  New Position: ' + new_position + '  Content: ' + content2);
                        callback(null, {"content1": content1, "content2": content2});
                    }
                });
            }
        });
    });
};

//Remove policy_r__ipobj 
policy_r__ipobjModel.deletePolicy_r__ipobj = function (rule, ipobj, ipobj_g, interface, position, position_order, callback) {


    db.get(function (error, connection) {
        if (error)
            return done('Database problem');
        var sqlExists = 'SELECT * FROM ' + tableModel +
                ' WHERE rule = ' + connection.escape(rule) + ' AND ipobj=' + connection.escape(ipobj) +
                ' AND ipobj_g=' + connection.escape(ipobj_g) + ' AND position=' + connection.escape(position);
        connection.query(sqlExists, function (error, row) {
            //If exists Id from policy_r__ipobj to remove
            if (row) {
                db.get(function (error, connection) {
                    var sql = 'DELETE FROM ' + tableModel +
                            ' WHERE rule = ' + connection.escape(rule) + ' AND ipobj=' + connection.escape(ipobj) +
                            ' AND ipobj_g=' + connection.escape(ipobj_g) + ' AND position=' + connection.escape(position) +
                            ' AND interface=' + connection.escape(interface);
                    connection.query(sql, function (error, result) {
                        if (error) {
                            callback(error, null);
                        } else {
                            if (result.affectedRows > 0) {
                                OrderList(999999, rule, position, position_order, ipobj, ipobj_g, interface);
                                callback(null, {"msg": "deleted"});
                            } else {
                                callback(null, {"msg": "notExist"});
                            }
                        }
                    });
                });
            } else {
                callback(null, {"msg": "notExist"});
            }
        });
    });
};

//Remove policy_r__ipobj 
policy_r__ipobjModel.deletePolicy_r__All = function (rule, callback) {


    db.get(function (error, connection) {
        if (error)
            return done('Database problem');
        var sqlExists = 'SELECT * FROM ' + tableModel +
                ' WHERE rule = ' + connection.escape(rule);
        connection.query(sqlExists, function (error, row) {
            //If exists Id from policy_r__ipobj to remove
            if (row) {
                logger.debug("DELETING IPOBJ FROM RULE: " + rule);
                db.get(function (error, connection) {
                    var sql = 'DELETE FROM ' + tableModel +
                            ' WHERE rule = ' + connection.escape(rule);
                    connection.query(sql, function (error, result) {
                        if (error) {
                            logger.debug(error);
                            callback(error, null);
                        } else {
                            if (result.affectedRows > 0) {
                                callback(null, {"msg": "deleted"});
                            } else {
                                callback(null, {"msg": "notExist"});
                            }
                        }
                    });
                });
            } else {
                callback(null, {"msg": "notExist"});
            }
        });
    });
};

//Order policy_r__ipobj Position
policy_r__ipobjModel.orderPolicyPosition = function (rule, position, callback) {

    logger.debug("DENTRO ORDER   Rule: " + rule + '  Position: ' + position);

    db.get(function (error, connection) {
        if (error)
            return done('Database problem');
        var sqlPos = 'SELECT * FROM ' + tableModel + ' WHERE rule = ' + connection.escape(rule) + ' AND position= ' + connection.escape(position) + ' order by position_order';
        logger.debug(sqlPos);
        connection.query(sqlPos, function (error, rows) {
            if (rows.length > 0) {
                var order = 0;
                async.map(rows, function (row, callback1) {
                    order++;
                    db.get(function (error, connection) {
                        sql = 'UPDATE ' + tableModel + ' SET position_order=' + order +
                                ' WHERE rule = ' + connection.escape(row.rule) + ' AND ipobj=' + connection.escape(row.ipobj) +
                                ' AND ipobj_g=' + connection.escape(row.ipobj_g) + ' AND position=' + connection.escape(row.position) +
                                ' AND interface=' + connection.escape(row.interface);
                        //logger.debug(sql);
                        connection.query(sql, function (error, result) {
                            if (error) {
                                callback1();
                            } else {
                                callback1();
                            }
                        });
                    });
                }, //Fin de bucle
                        function (err) {
                            callback(null, {"msg": "success"});
                        }

                );

            } else {
                callback(null, {"msg": "notExist"});
            }
        });
    });
};

//Order policy_r__ipobj Position
policy_r__ipobjModel.orderPolicy = function (rule, callback) {


    db.get(function (error, connection) {
        if (error)
            return done('Database problem');
        var sqlRule = 'SELECT * FROM ' + tableModel + ' WHERE rule = ' + connection.escape(rule) + ' order by position, position_order';
        logger.debug(sqlRule);
        connection.query(sqlRule, function (error, rows) {
            if (rows.length > 0) {
                var order = 0;
                var prev_position = 0;
                async.map(rows, function (row, callback1) {
                    var position = row.position;
                    if (position !== prev_position) {
                        order = 1;
                        prev_position = position;
                    } else
                        order++;

                    db.get(function (error, connection) {
                        sql = 'UPDATE ' + tableModel + ' SET position_order=' + order +
                                ' WHERE rule = ' + connection.escape(row.rule) + ' AND ipobj=' + connection.escape(row.ipobj) +
                                ' AND ipobj_g=' + connection.escape(row.ipobj_g) + ' AND position=' + connection.escape(row.position) +
                                ' AND interface=' + connection.escape(row.interface);
                        //logger.debug(sql);
                        connection.query(sql, function (error, result) {
                            if (error) {
                                callback1();
                            } else {
                                callback1();
                            }
                        });
                    });
                }, //Fin de bucle
                        function (err) {
                            callback(null, {"msg": "success"});
                        }

                );

            } else {
                callback(null, {"msg": "notExist"});
            }
        });
    });
};

//Order policy_r__ipobj Position
policy_r__ipobjModel.orderAllPolicy = function (callback) {


    db.get(function (error, connection) {
        if (error)
            return done('Database problem');
        var sqlRule = 'SELECT * FROM ' + tableModel + ' ORDER by rule,position, position_order';
        logger.debug(sqlRule);
        connection.query(sqlRule, function (error, rows) {
            if (rows.length > 0) {
                var order = 0;
                var prev_rule = 0;
                var prev_position = 0;
                async.map(rows, function (row, callback1) {
                    var position = row.position;
                    var rule = row.rule;
                    if (position !== prev_position || rule !== prev_rule) {
                        order = 1;
                        prev_rule = rule;
                        prev_position = position;
                    } else
                        order++;

                    db.get(function (error, connection) {
                        sql = 'UPDATE ' + tableModel + ' SET position_order=' + order +
                                ' WHERE rule = ' + connection.escape(row.rule) + ' AND ipobj=' + connection.escape(row.ipobj) +
                                ' AND ipobj_g=' + connection.escape(row.ipobj_g) + ' AND position=' + connection.escape(row.position) +
                                ' AND interface=' + connection.escape(row.interface);
                        //logger.debug(sql);
                        connection.query(sql, function (error, result) {
                            if (error) {
                                callback1();
                            } else {
                                callback1();
                            }
                        });
                    });
                }, //Fin de bucle
                        function (err) {
                            logger.debug("FIN De BUCLE");
                            callback(null, {"msg": "success"});
                        }

                );

            } else {
                callback(null, {"msg": "notExist"});
            }
        });
    });
};


//FALTA CORREGIR PROBLEMA AL CONTABILIZAR REGISTROS EXISTENTES 

//check if IPOBJ Exists in any rule
policy_r__ipobjModel.checkIpobjInRule = function (ipobj, type, fwcloud, callback) {

    logger.debug("CHECK DELETING ipobj:" + ipobj + " Type:" + type + "  fwcloud:" + fwcloud);
    db.get(function (error, connection) {
        if (error)
            return done('Database problem');
        var sql = 'SELECT count(*) as n FROM ' + tableModel + ' O INNER JOIN policy_r R on R.id=O.rule ' + ' INNER JOIN firewall F on F.id=R.firewall ' +
                ' INNER JOIN  ipobj I on I.id=O.ipobj ' +
                ' WHERE O.ipobj=' + connection.escape(ipobj) + ' AND I.type=' + connection.escape(type) + ' AND F.fwcloud=' + connection.escape(fwcloud);
        logger.debug(sql);
        connection.query(sql, function (error, rows) {
            if (!error) {
                if (rows.length > 0) {
                    if (rows[0].n > 0) {
                        logger.debug("ALERT DELETING ipobj IN RULE:" + ipobj + " type: " + type + " fwcloud:" + fwcloud + " --> FOUND IN " + rows[0].n + " RULES");
                        callback(null, {"result": true});
                    } else {
                        callback(null, {"result": false});
                    }
                } else {
                    var sql = 'SELECT count(*) as n FROM ' + tableModel + ' O INNER JOIN policy_r R on R.id=O.rule ' + ' INNER JOIN firewall F on F.id=R.firewall ' +
                            ' INNER JOIN ipobj__ipobjg G on G.ipobj_g=O.ipobj_g INNER JOIN  ipobj I on I.id=G.ipobj ' +
                            ' WHERE I.ipobj=' + connection.escape(ipobj) + ' AND I.type=' + connection.escape(type) + ' AND F.fwcloud=' + connection.escape(fwcloud);
                    logger.debug(sql);
                    connection.query(sql, function (error, rows) {
                        if (!error) {
                            if (rows.length > 0) {
                                if (rows[0].n > 0) {
                                    logger.debug("ALERT DELETING ipobj IN GROUP:" + ipobj + " type: " + type + " fwcloud:" + fwcloud + " --> FOUND IN " + rows[0].n + " RULES");
                                    callback(null, {"result": true});
                                } else {
                                    callback(null, {"result": false});
                                }
                            } else
                                callback(null, {"result": false});
                        } else
                            callback(null, {"result": false});
                    });
                }
            } else
                callback(null, {"result": false});
        });
    });
};

//check if IPOBJ GROUP  Exists in any rule
policy_r__ipobjModel.checkGroupInRule = function (ipobj_g, fwcloud, callback) {

    logger.debug("CHECK DELETING  GROUP:" + ipobj_g + "  fwcloud:" + fwcloud);
    db.get(function (error, connection) {
        if (error)
            return done('Database problem');
        var sql = 'SELECT count(*) as n FROM ' + tableModel + ' O INNER JOIN policy_r R on R.id=O.rule ' + ' INNER JOIN firewall F on F.id=R.firewall ' +
                ' INNER JOIN  ipobj_g G on G.id=O.ipobj_g ' +
                ' WHERE O.ipobj_g=' + connection.escape(ipobj_g) + ' AND F.fwcloud=' + connection.escape(fwcloud);
        logger.debug(sql);
        connection.query(sql, function (error, rows) {
            if (!error) {
                if (rows.length > 0) {
                    if (rows[0].n > 0) {
                        logger.debug("ALERT DELETING ipobj FROM GROUP IN RULE:" + ipobj_g + " fwcloud:" + fwcloud + " --> FOUND IN " + rows[0].n + " RULES");
                        callback(null, {"result": true});
                    } else {
                        logger.debug("OK DELETING ipobj FROM GROUP IN RULE:" + ipobj_g + " fwcloud:" + fwcloud + " --> FOUND IN " + rows[0].n + " RULES");
                        callback(null, {"result": false});
                    }
                } else
                    callback(null, {"result": false});
            } else
                callback(null, {"result": false});
        });
    });
};

//check if INTERFACE Exists in any rule 'O' POSITIONS
policy_r__ipobjModel.checkInterfaceInRule = function (interface, type, fwcloud,  callback) {

    logger.debug("CHECK DELETING interface O POSITIONS:" + interface + " Type:" + type + "  fwcloud:" + fwcloud);
    db.get(function (error, connection) {
        if (error)
            return done('Database problem');
        var sql = 'SELECT count(*) as n FROM ' + tableModel + ' O INNER JOIN policy_r R on R.id=O.rule ' +
                ' INNER JOIN firewall F on F.id=R.firewall ' +
                ' INNER JOIN fwcloud C on C.id=F.fwcloud ' +
                ' inner join interface I on I.id=O.interface ' +
                ' WHERE I.id=' + connection.escape(interface) + ' AND I.interface_type=' + connection.escape(type) + 
                ' AND C.id=' + connection.escape(fwcloud) ;
        logger.debug(sql);
        connection.query(sql, function (error, rows) {
            if (!error) {
                if (rows.length > 0) {
                    if (rows[0].n > 0) {
                        logger.debug("ALERT <INTERFACE> DELETING interface IN RULE:" + interface + " type: " + type + " fwcloud:" + fwcloud + " --> FOUND IN " + rows[0].n + " RULES");
                        callback(null, {"result": true});
                    } else {
                        callback(null, {"result": false});
                    }
                } else {
                    callback(null, {"result": false});
                }
            } else
                callback(null, {"result": false});
        });
    });
};

//check if ALL INTERFACE UNDER HOST Exists in any rule
policy_r__ipobjModel.checkHostAllInterfacesInRule = function (ipobj_host, fwcloud, callback) {

    logger.debug("CHECK DELETING HOST ALL interfaces O POSITIONS:" + ipobj_host + "  fwcloud:" + fwcloud);
    db.get(function (error, connection) {
        if (error)
            return done('Database problem');
        var sql = 'SELECT count(*) as n FROM ' + tableModel + ' O ' +
                ' INNER JOIN interface__ipobj J on J.interface=O.interface ' +
                ' INNER JOIN policy_r R on R.id=O.rule ' +
                ' INNER JOIN firewall F on F.id=R.firewall ' +
                ' INNER JOIN fwcloud C on C.id=F.fwcloud ' +
                ' WHERE J.ipobj=' + connection.escape(ipobj_host) + ' AND C.id=' + connection.escape(fwcloud);
        logger.debug(sql);
        connection.query(sql, function (error, rows) {
            if (!error) {
                if (rows.length > 0) {
                    if (rows[0].n > 0) {
                        logger.debug("ALERT <HOST ALL INTERFACES> DELETING interface IN RULE:" + ipobj_host + " fwcloud:" + fwcloud + " --> FOUND IN " + rows[0].n + " RULES");
                        callback(null, {"result": true});
                    } else {
                        callback(null, {"result": false});
                    }
                } else {
                    callback(null, {"result": false});
                }
            } else
                callback(null, {"result": false});
        });
    });
};

//check if ALL IPOBJS UNDER ALL INTERFACE UNDER HOST Exists in any rule
policy_r__ipobjModel.checkHostAllInterfaceAllIpobjInRule = function (ipobj_host, fwcloud, callback) {

    logger.debug("CHECK DELETING HOST ALL IPOBJ UNDER ALL interfaces O POSITIONS:" + ipobj_host + "  fwcloud:" + fwcloud);
    db.get(function (error, connection) {
        if (error)
            return done('Database problem');
        var sql = 'SELECT count(*) as n FROM interface__ipobj J ' +
                ' inner join ipobj I on I.interface=J.interface ' +
                ' inner join policy_r__ipobj O on O.ipobj=I.id ' +
                ' INNER JOIN policy_r R on R.id=O.rule ' +
                ' INNER JOIN firewall F on F.id=R.firewall ' +
                ' INNER JOIN fwcloud C on C.id=F.fwcloud ' +
                ' WHERE J.ipobj=' + connection.escape(ipobj_host) + ' AND C.id=' + connection.escape(fwcloud);
        logger.debug(sql);
        connection.query(sql, function (error, rows) {
            if (!error) {
                if (rows.length > 0) {
                    if (rows[0].n > 0) {
                        logger.debug("ALERT <HOST ALL IPOBJ ALL INTERFACES> DELETING interface IN RULE:" + ipobj_host + " fwcloud:" + fwcloud + " --> FOUND IN " + rows[0].n + " RULES");
                        callback(null, {"result": true});
                    } else {
                        callback(null, {"result": false});
                    }
                } else {
                    callback(null, {"result": false});
                }
            } else
                callback(null, {"result": false});
        });
    });
};

//check if IPOBJ UNDER INTERFACE Exists in any rule
policy_r__ipobjModel.checkOBJInterfaceInRule = function (interface, type, fwcloud, firewall, callback) {

    logger.debug("CHECK DELETING IPOBJ UNDER interface :" + interface + " Type:" + type + "  fwcloud:" + fwcloud);
    db.get(function (error, connection) {
        if (error)
            return done('Database problem');
        var sql = 'SELECT count(*) as n FROM ' + tableModel + ' O INNER JOIN policy_r R on R.id=O.rule ' + ' INNER JOIN firewall F on F.id=R.firewall ' +
                ' INNER JOIN ipobj I on O.ipobj=I.id INNER JOIN interface Z on Z.id=I.interface' +
                ' WHERE I.interface=' + connection.escape(interface) + ' AND Z.interface_type=' + connection.escape(type) + ' AND F.fwcloud=' + connection.escape(fwcloud) + ' AND F.id=' + connection.escape(firewall);
        logger.debug(sql);
        connection.query(sql, function (error, rows) {
            if (!error) {
                if (rows.length > 0) {
                    if (rows[0].n > 0) {
                        logger.debug("ALERT <IPOBJ UNDER INTERFACE> DELETING interface IN RULE:" + interface + " type: " + type + " fwcloud:" + fwcloud + " --> FOUND IN " + rows[0].n + " RULES");
                        callback(null, {"result": true});
                    } else {
                        callback(null, {"result": false});
                    }
                } else {
                    callback(null, {"result": false});
                }
            } else
                callback(null, {"result": false});
        });
    });
};

//check if HOST INTERFACE Exists in any rule
policy_r__ipobjModel.checkHOSTInterfaceInRule = function (interface, type, fwcloud, firewall, callback) {

    logger.debug("CHECK DELETING HOST interface :" + interface + " Type:" + type + "  fwcloud:" + fwcloud);
    db.get(function (error, connection) {
        if (error)
            return done('Database problem');
        var sql = 'SELECT count(*) as n FROM ' + tableModel + ' O INNER JOIN policy_r R on R.id=O.rule ' + ' INNER JOIN firewall F on F.id=R.firewall ' +
                ' inner join interface__ipobj J on J.ipobj=O.ipobj  INNER JOIN interface Z on Z.id=J.interface' +
                ' WHERE J.interface=' + connection.escape(interface) + ' AND Z.interface_type=' + connection.escape(type) + ' AND F.fwcloud=' + connection.escape(fwcloud) + ' AND F.id=' + connection.escape(firewall);
        logger.debug(sql);
        connection.query(sql, function (error, rows) {
            if (!error) {
                if (rows.length > 0) {
                    if (rows[0].n > 0) {
                        logger.debug("ALERT <HOST INTERFACE> DELETING interface IN RULE:" + interface + " type: " + type + " fwcloud:" + fwcloud + " --> FOUND IN " + rows[0].n + " RULES");
                        callback(null, {"result": true});
                    } else {
                        callback(null, {"result": false});
                    }
                } else {
                    callback(null, {"result": false});
                }
            } else
                callback(null, {"result": false});
        });
    });
};


//------------------- SEARCH METHODS -----------------------------------------------
//FALTA BUSQUEDA de OBJETOS STANDAR SIN FWCLOUD
//check if IPOBJ Exists in any rule
policy_r__ipobjModel.searchIpobjInRule = function (ipobj, type, fwcloud, callback) {

    logger.debug("SEARCH IN RULES ipobj:" + ipobj + " Type:" + type + "  fwcloud:" + fwcloud);
    db.get(function (error, connection) {
        if (error)
            return done('Database problem');

        var sql = 'SELECT O.ipobj obj_id,I.name obj_name, I.type obj_type_id,T.type obj_type_name, ' +
                'C.id cloud_id, C.name cloud_name, R.firewall firewall_id, F.name firewall_name ,O.rule rule_id, R.rule_order,R.type rule_type,PT.name rule_type_name, ' +
                'O.position rule_position_id,  P.name rule_position_name,R.comment rule_comment ' +
                'FROM policy_r__ipobj O ' +
                'INNER JOIN policy_r R on R.id=O.rule  ' +
                'INNER JOIN firewall F on F.id=R.firewall  ' +
                'INNER JOIN  ipobj I on I.id=O.ipobj ' +
                'inner join ipobj_type T on T.id=I.type ' +
                'inner join policy_position P on P.id=O.position ' +
                'inner join policy_type PT on PT.id=R.type ' +
                'inner join fwcloud C on C.id=F.fwcloud ' +
                ' WHERE O.ipobj=' + connection.escape(ipobj) + ' AND I.type=' + connection.escape(type) + ' AND F.fwcloud=' + connection.escape(fwcloud);

        logger.debug(sql);
        connection.query(sql, function (error, rows) {
            if (!error) {
                if (rows.length > 0) {
                    logger.debug("FOUND ipobj IN RULES:" + ipobj + " type: " + type + " fwcloud:" + fwcloud + " --> FOUND IN " + rows.length + " RULES");
                    //logger.debug(rows);
                    callback(null, {"found": rows});

                } else
                    callback(null, {"found": ""});
            } else
                callback(error, null);
        });
    });
};

//check if INTERFACE Exists in any rule
policy_r__ipobjModel.searchInterfaceInRule = function (interface, type, fwcloud, firewall, callback) {

    logger.debug("SEARCH IN RULES interface:" + interface + " Type:" + type + "  fwcloud:" + fwcloud + "  firewall: " + firewall);
    db.get(function (error, connection) {
        if (error)
            return done('Database problem');

        var sql = 'SELECT O.interface obj_id,I.name obj_name, I.interface_type obj_type_id,T.type obj_type_name, ' +
                'C.id cloud_id, C.name cloud_name, R.firewall firewall_id, F.name firewall_name ,O.rule rule_id, R.rule_order,R.type rule_type,PT.name rule_type_name, ' +
                'O.position rule_position_id,  P.name rule_position_name,R.comment rule_comment ' +
                'FROM policy_r__ipobj O ' +
                'INNER JOIN policy_r R on R.id=O.rule  ' +
                'INNER JOIN firewall F on F.id=R.firewall  ' +
                'INNER JOIN  interface I on I.id=O.interface ' +
                'inner join ipobj_type T on T.id=I.interface_type ' +
                'inner join policy_position P on P.id=O.position ' +
                'inner join policy_type PT on PT.id=R.type ' +
                'inner join fwcloud C on C.id=F.fwcloud ' +
                ' WHERE O.interface=' + connection.escape(interface) + ' AND I.interface_type=' + connection.escape(type) + 
                ' AND C.id=' + connection.escape(fwcloud);
        if (firewall!==null){
            sql = sql + ' AND F.id=' + connection.escape(firewall);
        }

        logger.debug(sql);
        connection.query(sql, function (error, rows) {
            if (!error) {
                if (rows.length > 0) {
                    logger.debug("FOUND INTERFACE IN RULES:" + interface + " type: " + type + " fwcloud:" + fwcloud + " --> FOUND IN " + rows.length + " RULES");
                    //logger.debug(rows);
                    callback(null, {"found": rows});

                } else
                    callback(null, {"found": ""});
            } else
                callback(error, null);
        });
    });
};

//check if IPOBJ Exists in GROUP and GROUP in any rule
policy_r__ipobjModel.searchIpobjGroupInRule = function (ipobj, type, fwcloud, callback) {

    logger.debug("SEARCH GROUP IN RULES ipobj:" + ipobj + " Type:" + type + "  fwcloud:" + fwcloud);
    db.get(function (error, connection) {
        if (error)
            return done('Database problem');

        var sql = 'SELECT O.ipobj_g obj_id,GR.name obj_name, GR.type obj_type_id,T.type obj_type_name, ' +
                'C.id cloud_id, C.name cloud_name, R.firewall firewall_id, F.name firewall_name ,O.rule rule_id, R.rule_order,R.type rule_type,PT.name rule_type_name,   ' +
                'O.position rule_position_id,  P.name rule_position_name,R.comment rule_comment ' +
                'FROM policy_r__ipobj O ' +
                'INNER JOIN policy_r R on R.id=O.rule  ' +
                'INNER JOIN firewall F on F.id=R.firewall  ' +
                'INNER JOIN ipobj__ipobjg G ON G.ipobj_g=O.ipobj_g ' +
                'INNER JOIN ipobj_g GR ON GR.id=G.ipobj_g ' +
                'INNER JOIN  ipobj I on I.id=G.ipobj ' +
                'inner join ipobj_type T on T.id=GR.type ' +
                'inner join policy_position P on P.id=O.position ' +
                'inner join policy_type PT on PT.id=R.type ' +
                'inner join fwcloud C on C.id=F.fwcloud ' +
                ' WHERE I.id=' + connection.escape(ipobj) + ' AND I.type=' + connection.escape(type) + ' AND F.fwcloud=' + connection.escape(fwcloud);

        logger.debug(sql);
        connection.query(sql, function (error, rows) {
            if (!error) {
                if (rows.length > 0) {
                    logger.debug("FOUND ipobj GROUP IN RULES:" + ipobj + " type: " + type + " fwcloud:" + fwcloud + " --> FOUND IN " + rows.length + " RULES");
                    //logger.debug(rows);
                    callback(null, {"found": rows});

                } else
                    callback(null, {"found": ""});
            } else
                callback(error, null);
        });
    });
};

//check if IPOBJ's in GROUP Exists in any rule
policy_r__ipobjModel.searchIpobjInGroupInRule = function (idg,  fwcloud, callback) {

    logger.debug("SEARCH IPOBJ IN GROUP IN RULES :" + idg + "  fwcloud:" + fwcloud);
    db.get(function (error, connection) {
        if (error)
            return done('Database problem');

        var sql = 'SELECT O.ipobj obj_id,I.name obj_name, I.type obj_type_id,T.type obj_type_name, ' +
                'C.id cloud_id, C.name cloud_name, R.firewall firewall_id, F.name firewall_name ,O.rule rule_id, R.rule_order,R.type rule_type,PT.name rule_type_name,    ' +
                'O.position rule_position_id,  P.name rule_position_name,R.comment rule_comment  ' +
                'FROM policy_r__ipobj O  ' +
                'INNER JOIN policy_r R on R.id=O.rule   ' +
                'INNER JOIN firewall F on F.id=R.firewall   ' +
                'INNER JOIN  ipobj I on I.id=O.ipobj ' +
                'INNER JOIN ipobj__ipobjg G ON G.ipobj=I.id ' +
                'INNER JOIN ipobj_g GR ON GR.id= G.ipobj_g ' +
                'inner join ipobj_type T on T.id=I.type  ' +
                'inner join policy_position P on P.id=O.position  ' +
                'inner join policy_type PT on PT.id=R.type  ' +
                'inner join fwcloud C on C.id=F.fwcloud  ' +
                ' WHERE GR.id=' + connection.escape(idg) + ' AND F.fwcloud=' + connection.escape(fwcloud);

        logger.debug(sql);
        connection.query(sql, function (error, rows) {
            if (!error) {
                if (rows.length > 0) {
                    logger.debug("FOUND ipobjs IN GROUP IN RULES:" + idg +  " fwcloud:" + fwcloud + " --> FOUND IN " + rows.length + " RULES");
                    //logger.debug(rows);
                    callback(null, {"found": rows});

                } else
                    callback(null, {"found": ""});
            } else
                callback(error, null);
        });
    });
};

//check if GROUP Exists in any rule
policy_r__ipobjModel.searchGroupInRule = function (idg,  fwcloud, callback) {

    logger.debug("SEARCH GROUP IN RULES :" + idg +  "  fwcloud:" + fwcloud);
    db.get(function (error, connection) {
        if (error)
            return done('Database problem');

        var sql = 'SELECT O.ipobj_g obj_id,GR.name obj_name, GR.type obj_type_id,T.type obj_type_name, ' +
                'C.id cloud_id, C.name cloud_name, R.firewall firewall_id, F.name firewall_name ,O.rule rule_id, R.rule_order,R.type rule_type,PT.name rule_type_name,    ' +
                'O.position rule_position_id,  P.name rule_position_name,R.comment rule_comment  ' +
                'FROM policy_r__ipobj O  ' +
                'INNER JOIN policy_r R on R.id=O.rule   ' +
                'INNER JOIN firewall F on F.id=R.firewall   ' +
                'INNER JOIN ipobj_g GR ON GR.id=O.ipobj_g  ' +
                'inner join ipobj_type T on T.id=GR.type  ' +
                'inner join policy_position P on P.id=O.position  ' +
                'inner join policy_type PT on PT.id=R.type  ' +
                'inner join fwcloud C on C.id=F.fwcloud  ' +
                ' WHERE GR.id=' + connection.escape(idg) + ' AND F.fwcloud=' + connection.escape(fwcloud);

        logger.debug(sql);
        connection.query(sql, function (error, rows) {
            if (!error) {
                if (rows.length > 0) {
                    logger.debug("FOUND GROUP IN RULES:" + idg + " fwcloud:" + fwcloud + " --> FOUND IN " + rows.length + " RULES");                    
                    callback(null, {"found": rows});

                } else
                    callback(null, {"found": ""});
            } else
                callback(error, null);
        });
    });
};



//Search INTERFACES UNDER IPOBJ HOST that Exists in any rule
policy_r__ipobjModel.searchInterfacesIpobjHostInRule = function (ipobj, type, fwcloud,  callback) {

    logger.debug("SEARCH INTERFACES UNDER ipobj:" + ipobj + " Type:" + type + "  fwcloud:" + fwcloud);
    db.get(function (error, connection) {
        if (error)
            return done('Database problem');

        var sql = 'SELECT O.interface obj_id,K.name obj_name, K.interface_type obj_type_id,T.type obj_type_name, ' +
                'C.id cloud_id, C.name cloud_name, R.firewall firewall_id, F.name firewall_name ,O.rule rule_id, R.rule_order,R.type rule_type,PT.name rule_type_name,    ' +
                'O.position rule_position_id,  P.name rule_position_name,R.comment rule_comment ' +
                'FROM policy_r__ipobj O  ' +
                'INNER JOIN interface K ON K.id = O.interface ' +
                'INNER JOIN interface__ipobj J ON J.interface = K.id ' +
                'INNER JOIN ipobj I ON I.id = J.ipobj         ' +
                'INNER JOIN policy_r R ON R.id = O.rule ' +
                'INNER JOIN firewall F ON F.id = R.firewall			 ' +
                'INNER JOIN ipobj_type T ON T.id = K.interface_type ' +
                'INNER JOIN policy_position P ON P.id = O.position ' +
                'INNER JOIN policy_type PT ON PT.id = R.type ' +
                'INNER JOIN fwcloud C ON C.id = F.fwcloud ' +
                ' WHERE I.id=' + connection.escape(ipobj) + ' AND I.type=' + connection.escape(type) + ' AND F.fwcloud=' + connection.escape(fwcloud);

        logger.debug("SQL HOST: " + sql);
        connection.query(sql, function (error, rows) {
            if (!error) {
                if (rows.length > 0) {
                    logger.debug("FOUND INTERFACES UNDER ipobj HOST :" + ipobj + " type: " + type + " fwcloud:" + fwcloud + " --> FOUND IN " + rows.length + " RULES");
                    //logger.debug(rows);
                    callback(null, {"found": rows});

                } else
                    callback(null, {"found": ""});
            } else
                callback(error, null);
        });
    });
};

//Search INTERFACES ABOVE IPOBJ  that Exists in any rule
policy_r__ipobjModel.searchInterfacesAboveIpobjInRule = function (ipobj, type, fwcloud,  callback) {

    logger.debug("SEARCH INTERFACES ABOVE ipobj:" + ipobj + " Type:" + type + "  fwcloud:" + fwcloud);
    db.get(function (error, connection) {
        if (error)
            return done('Database problem');

        var sql = 'SELECT O.interface obj_id,K.name obj_name, K.interface_type obj_type_id,T.type obj_type_name, ' +
                'C.id cloud_id, C.name cloud_name, R.firewall firewall_id, F.name firewall_name ,O.rule rule_id, R.rule_order,R.type rule_type,PT.name rule_type_name,    ' +
                'O.position rule_position_id,  P.name rule_position_name,R.comment rule_comment ' +
                'FROM policy_r__ipobj O  ' +
                'INNER JOIN interface K ON K.id = O.interface ' +                
                'INNER JOIN ipobj I ON I.interface = K.id         ' +
                'INNER JOIN policy_r R ON R.id = O.rule ' +
                'INNER JOIN firewall F ON F.id = R.firewall			 ' +
                'INNER JOIN ipobj_type T ON T.id = K.interface_type ' +
                'INNER JOIN policy_position P ON P.id = O.position ' +
                'INNER JOIN policy_type PT ON PT.id = R.type ' +
                'INNER JOIN fwcloud C ON C.id = F.fwcloud ' +
                ' WHERE I.id=' + connection.escape(ipobj) + ' AND I.type=' + connection.escape(type) + ' AND F.fwcloud=' + connection.escape(fwcloud);

        logger.debug("SQL HOST: " + sql);
        connection.query(sql, function (error, rows) {
            if (!error) {
                if (rows.length > 0) {
                    logger.debug("FOUND INTERFACES ABOVE ipobj :" + ipobj + " type: " + type + " fwcloud:" + fwcloud + " --> FOUND IN " + rows.length + " RULES");
                    //logger.debug(rows);
                    callback(null, {"found": rows});

                } else
                    callback(null, {"found": ""});
            } else
                callback(error, null);
        });
    });
};

//SEARCH INTERFACES UNDER IPOBJ HOST WITH HOST IN RULES
policy_r__ipobjModel.searchHostInterfacesHostInRule = function (interface, type, fwcloud, firewall, callback) {

    logger.debug("SEARCH INTERFACES UNDER HOST ipobj:" + interface + " Type:" + type + "  fwcloud:" + fwcloud + "  Firewall: " + firewall);
    db.get(function (error, connection) {
        if (error)
            return done('Database problem');

        var sql = 'SELECT I.id obj_id,I.name obj_name, I.type obj_type_id,T.type obj_type_name, ' +
                'C.id cloud_id, C.name cloud_name, R.firewall firewall_id, F.name firewall_name ,O.rule rule_id, R.rule_order,R.type rule_type,PT.name rule_type_name,    ' +
                'O.position rule_position_id,  P.name rule_position_name,R.comment rule_comment ' +
                'FROM policy_r__ipobj O  ' +
                'INNER JOIN ipobj I ON I.id = O.ipobj ' +
                'INNER JOIN interface__ipobj J ON J.ipobj = I.id                 ' +
                'INNER JOIN interface K ON K.id = J.interface	 ' +
                'INNER JOIN ipobj_type T ON T.id = I.type         ' +
                'INNER JOIN policy_r R ON R.id = O.rule ' +
                'INNER JOIN firewall F ON F.id = R.firewall ' +
                'INNER JOIN policy_position P ON P.id = O.position ' +
                'INNER JOIN policy_type PT ON PT.id = R.type ' +
                'INNER JOIN fwcloud C ON C.id = F.fwcloud ' +
                ' WHERE K.id=' + connection.escape(interface) + ' AND K.interface_type=' + connection.escape(type) + ' AND F.fwcloud=' + connection.escape(fwcloud);
        if (firewall!==null)
            sql =sql + ' AND F.id=' + connection.escape(firewall);

        logger.debug("SQL HOST: " + sql);
        connection.query(sql, function (error, rows) {
            if (!error) {
                if (rows.length > 0) {
                    logger.debug("FOUND INTERFACES UNDER ipobj HOST :" + interface + " type: " + type + " fwcloud:" + fwcloud + " --> FOUND IN " + rows.length + " RULES");
                    //logger.debug(rows);
                    callback(null, {"found": rows});

                } else
                    callback(null, {"found": ""});
            } else
                callback(error, null);
        });
    });
};

//SEARCH IF IPOBJ UNDER INTERFACES UNDER IPOBJ HOST Has HOST IN RULES 'O' POSITIONS
policy_r__ipobjModel.searchIpobjInterfacesIpobjHostInRule = function (ipobj, type, fwcloud, callback) {

    logger.debug("SEARCH IF IPOBJ UNDER INTERFACES UNDER HOST has HOST in RULES:" + ipobj + " Type:" + type + "  fwcloud:" + fwcloud);
    db.get(function (error, connection) {
        if (error)
            return done('Database problem');

        var sql = 'SELECT O.ipobj obj_id,IR.name obj_name, IR.type obj_type_id,T.type obj_type_name, ' +
                'C.id cloud_id, C.name cloud_name, R.firewall firewall_id, F.name firewall_name ,O.rule rule_id, R.rule_order,R.type rule_type,PT.name rule_type_name,    ' +
                'O.position rule_position_id,  P.name rule_position_name,R.comment rule_comment ' +
                'FROM policy_r__ipobj O  ' +
                'INNER JOIN ipobj IR ON IR.id = O.ipobj ' +
                'INNER JOIN interface__ipobj J ON J.ipobj = IR.id ' +
                'INNER JOIN policy_r R ON R.id = O.rule ' +
                'INNER JOIN interface K ON K.id = J.interface ' +
                'INNER JOIN ipobj I ON I.interface = K.id ' +
                'INNER JOIN ipobj_type T ON T.id = IR.type ' +
                'INNER JOIN policy_position P ON P.id = O.position ' +
                'INNER JOIN policy_type PT ON PT.id = R.type ' +
                'INNER JOIN firewall F ON F.id = R.firewall ' +
                'INNER JOIN fwcloud C ON C.id = F.fwcloud ' +
                ' WHERE I.id=' + connection.escape(ipobj) + ' AND I.type=' + connection.escape(type) + ' AND F.fwcloud=' + connection.escape(fwcloud);

        logger.debug(sql);
        connection.query(sql, function (error, rows) {
            if (!error) {
                if (rows.length > 0) {
                    logger.debug("FOUND HOST IPOBJ UNDER INTERFACES UNDER ipobj HOST :" + ipobj + " type: " + type + " fwcloud:" + fwcloud + " --> FOUND IN " + rows.length + " RULES");
                    //logger.debug(rows);
                    callback(null, {"found": rows});

                } else{
                    logger.debug("NOT FOUND HOST IPOBJ UNDER INTERFACES UNDER ipobj HOST :" + ipobj + " type: " + type + " fwcloud:" + fwcloud );
                    callback(null, {"found": ""});
                }
            } else{
                logger.debug(error);
                callback(error, null);
            }
        });
    });
};

//SEARCH IF HOST Has IPOBJ UNDER INTERFACES  IN RULES 'O' POSITIONS
policy_r__ipobjModel.searchIpobjInterfacesIpobjInRule = function (host, type, fwcloud, callback) {

    logger.debug("XX SEARCH IF HOST Has IPOBJ UNDER INTERFACES  in RULES:" + host + " Type:" + type + "  fwcloud:" + fwcloud);
    db.get(function (error, connection) {
        if (error)
            return done('Database problem');

        var sql = 'SELECT O.ipobj obj_id,IR.name obj_name, IR.type obj_type_id,T.type obj_type_name, ' +
                'C.id cloud_id, C.name cloud_name, R.firewall firewall_id, F.name firewall_name ,O.rule rule_id, R.rule_order,R.type rule_type,PT.name rule_type_name,    ' +
                'O.position rule_position_id,  P.name rule_position_name,R.comment rule_comment ' +
                'FROM policy_r__ipobj O  ' +
                'INNER JOIN ipobj IR ON IR.id = O.ipobj ' +
                'INNER JOIN interface K ON K.id = IR.interface         ' +
                'INNER JOIN interface__ipobj J ON J.interface = K.id ' +
                'INNER JOIN ipobj I ON I.id = J.ipobj         ' +
                'INNER JOIN policy_r R ON R.id = O.rule         ' +
                'INNER JOIN ipobj_type T ON T.id = IR.type         ' +
                'INNER JOIN policy_position P ON P.id = O.position ' +
                'INNER JOIN policy_type PT ON PT.id = R.type ' +
                'INNER JOIN firewall F ON F.id = R.firewall ' +
                'INNER JOIN fwcloud C ON C.id = F.fwcloud ' +
                ' WHERE I.id=' + connection.escape(host) + ' AND I.type=' + connection.escape(type) + ' AND F.fwcloud=' + connection.escape(fwcloud);

        logger.debug(sql);
        connection.query(sql, function (error, rows) {
            if (!error) {
                if (rows.length > 0) {
                    logger.debug("FOUND IPOBJ UNDER INTERFACES UNDER ipobj HOST :" + host + " type: " + type + " fwcloud:" + fwcloud + " --> FOUND IN " + rows.length + " RULES");
                    //logger.debug(rows);
                    callback(null, {"found": rows});

                } else{
                    logger.debug("NOT FOUND  IPOBJ UNDER INTERFACES UNDER ipobj HOST :" + host + " type: " + type + " fwcloud:" + fwcloud );
                    callback(null, {"found": ""});
                }
            } else{
                logger.debug(error);
                callback(error, null);
            }
        });
    });
};
//check if Exist IPOBJS under INTERFACES  
policy_r__ipobjModel.searchIpobjInterfaces = function (ipobj, type, fwcloud, callback) {

    logger.debug("SEARCH IPOBJ UNDER INTERFACES :" + ipobj + " Type:" + type + "  fwcloud:" + fwcloud);
    db.get(function (error, connection) {
        if (error)
            return done('Database problem');

        var sql = 'SELECT I.id obj_id,I.name obj_name, I.type obj_type_id,T.type obj_type_name, ' +
                'C.id cloud_id, C.name cloud_name, K.id interface_id, K.name interface_name, K.interface_type interface_type_id, TK.type interface_type ' +
                'FROM ipobj I ' +
                'INNER JOIN interface K on K.id=I.interface ' +
                'inner join ipobj_type T on T.id=I.type ' +
                'inner join ipobj_type TK on TK.id=K.interface_type ' +
                'left join fwcloud C on C.id=I.fwcloud ' +
                ' WHERE I.id=' + connection.escape(ipobj) + ' AND I.type=' + connection.escape(type) + ' AND (I.fwcloud=' + connection.escape(fwcloud) + ' OR I.fwcloud IS NULL)';

        logger.debug(sql);
        connection.query(sql, function (error, rows) {
            if (!error) {
                if (rows.length > 0) {
                    logger.debug("FOUND IPOBJ UNDER INTERFACES  :" + ipobj + " type: " + type + " fwcloud:" + fwcloud + " --> FOUND IN " + rows.length + " INTERFACES");
                    //logger.debug(rows);
                    callback(null, {"found": rows});

                } else
                    callback(null, {"found": ""});
            } else
                callback(error, null);
        });
    });
};

//check if Exist IPOBJS under INTERFACES  IN RULES 
policy_r__ipobjModel.searchIpobjInterfacesInRules = function (interface, type, fwcloud, firewall, callback) {

    logger.debug("SEARCH IPOBJ UNDER INTERFACE in RULES:" + interface + " Type:" + type + "  fwcloud:" + fwcloud + "  Firewall: " + firewall);
    db.get(function (error, connection) {
        if (error)
            return done('Database problem');

        var sql = 'SELECT I.id obj_id,I.name obj_name, I.type obj_type_id,T.type obj_type_name, ' +
                'C.id cloud_id, C.name cloud_name, R.firewall firewall_id, F.name firewall_name , ' +
                'O.rule rule_id, R.rule_order,R.type rule_type,  PT.name rule_type_name,O.position rule_position_id,  P.name rule_position_name,R.comment rule_comment ' +
                'FROM policy_r__ipobj O ' +
                'INNER JOIN ipobj I ON I.id=O.ipobj ' +
                'INNER JOIN interface K on K.id=I.interface  ' +
                'inner join ipobj_type T on T.id=I.type  ' +
                'inner join ipobj_type TK on TK.id=K.interface_type  ' +
                'INNER JOIN policy_r R on R.id=O.rule    ' +
                'INNER JOIN firewall F on F.id=R.firewall    ' +
                'inner join fwcloud C on C.id=F.fwcloud  ' +
                'inner join policy_position P on P.id=O.position  ' +
                'inner join policy_type PT on PT.id=R.type ' +
                ' WHERE K.id=' + connection.escape(interface) + ' AND K.interface_type=' + connection.escape(type) + 
                ' AND F.fwcloud=' + connection.escape(fwcloud);
        if (firewall!==null)
            sql=sql + ' AND F.id=' + connection.escape(firewall);

        logger.debug(sql);
        connection.query(sql, function (error, rows) {
            if (!error) {
                if (rows.length > 0) {
                    logger.debug("FOUND IPOBJ UNDER INTERFACES  :" + interface + " type: " + type + " fwcloud:" + fwcloud + " --> FOUND IN " + rows.length + " INTERFACES");
                    //logger.debug(rows);
                    callback(null, {"found": rows});

                } else
                    callback(null, {"found": ""});
            } else
                callback(error, null);
        });
    });
};


//Export the object
module.exports = policy_r__ipobjModel;