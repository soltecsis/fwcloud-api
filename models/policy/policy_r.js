//create object
var policy_rModel = {};

//Export the object
module.exports = policy_rModel;

var db = require('../../db.js');
var asyncMod = require('async');

var Policy_r__interfaceModel = require('../../models/policy/policy_r__interface');
var Policy_typeModel = require('../../models/policy/policy_type');




var tableModel = "policy_r";
var Policy_positionModel = require('../../models/policy/policy_position');
var Policy_r__ipobjModel = require('../../models/policy/policy_r__ipobj');

var IpobjModel = require('../../models/ipobj/ipobj');
var Ipobj_gModel = require('../../models/ipobj/ipobj_g');
var InterfaceModel = require('../../models/interface/interface');
var data_policy_r = require('../../models/data/data_policy_r');
var data_policy_positions = require('../../models/data/data_policy_positions');
var data_policy_position_ipobjs = require('../../models/data/data_policy_position_ipobjs');
var RuleCompileModel = require('../../models/policy/rule_compile');
var Policy_cModel = require('../../models/policy/policy_c');

var utilsModel = require('../../utils/utils');
var logger = require('log4js').getLogger("app");


//Get All policy_r by firewall and group
policy_rModel.getPolicy_rs = function (idfirewall, idgroup, callback) {

    db.get(function (error, connection) {
        if (error)
            callback(error, null);
        var whereGroup = '';
        if (idgroup !== '') {
            whereGroup = ' AND idgroup=' + connection.escape(idgroup);
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

//Get All policy_r by firewall and type
policy_rModel.getPolicy_rs_type = function (fwcloud, idfirewall, type, rule, AllDone) {


    var policy = [];
    var policy_cont = 0;
    var position_cont = 0;
    var ipobj_cont = 0;
    var i, j, k;
    var sqlRule = "";



    db.get(function (error, connection) {
        if (error)
            callback(error, null);

        if (rule !== "") {
            sqlRule = " AND P.id=" + connection.escape(rule);
        }
        Policy_typeModel.getPolicy_type(type, function (error, data_types) {
            if (error)
                AllDone(error, null);
            else {
                if (data_types.length > 0)
                    type = data_types[0].id;
                else
                    type = 1;

                var sql = 'SELECT P.*, G.name as group_name, G.groupstyle as group_style, ' +
                        ' C.updated_at as c_updated_at, ' +
                        ' IF((P.updated_at > C.updated_at) OR C.updated_at IS NULL, 0, IFNULL(C.status_compiled,0) ) as rule_compiled ' +
                        ' FROM ' + tableModel + ' P ' +
                        ' LEFT JOIN policy_g G ON G.id=P.idgroup ' +
                        ' LEFT JOIN policy_c C ON C.rule=P.id ' +
                        ' WHERE P.firewall=' + connection.escape(idfirewall) + ' AND  P.type= ' + connection.escape(type) +
                        sqlRule + ' ORDER BY P.rule_order';
                logger.debug(sql);
                connection.query(sql, function (error, rows) {
                    if (error)
                        AllDone(error, null);
                    else {
                        if (rows.length > 0) {
                            i = 0;
                            policy_cont = rows.length;
                            //for (i = 0; i < rows.length; i++) {
                            //--------------------------------------------------------------------------------------------------
                            asyncMod.map(rows, function (row_rule, callback1) {
                                i++;
                                var policy_node = new data_policy_r(row_rule);


                                var rule_id = row_rule.id;
                                logger.debug(i + " ---> DENTRO de REGLA: " + rule_id + " ORDER: " + row_rule.rule_order);

                                //Buscamos POSITIONS de REGLA
                                Policy_positionModel.getPolicy_positionsType(type, function (error, data_positions)
                                {
                                    //If exists policy_position get data
                                    if (typeof data_positions !== 'undefined')
                                    {
                                        //logger.debug("REGLA: " + rule_id + "  POSITIONS: " + data_positions.length);
                                        j = 0;
                                        //for (j = 0; j < data_positions.length; j++) {

                                        position_cont = data_positions.length;
                                        policy_node.positions = new Array();

                                        //--------------------------------------------------------------------------------------------------
                                        asyncMod.map(data_positions, function (row_position, callback2) {
                                            j++;
                                            //logger.debug(j + " - DENTRO de POSITION: " + row_position.id + " - " + row_position.name + "     ORDER:" + row_position.position_order);
                                            var position_node = new data_policy_positions(row_position);

                                            //Buscamos IPOBJS por POSITION
                                            Policy_r__ipobjModel.getPolicy_r__ipobjs_interfaces_position(rule_id, row_position.id, function (error, data__rule_ipobjs)
                                            {
                                                //logger.debug(" IPOBJS PARA POSITION:" + row_position.id + " --> " + data__rule_ipobjs.length);
                                                //If exists policy_r__ipobj get data
                                                //if (typeof data__rule_ipobjs !== 'undefined' && data__rule_ipobjs.length > 0)
                                                if (typeof data__rule_ipobjs !== 'undefined')
                                                {

                                                    //obtenemos IPOBJS o INTERFACES o GROUPS
                                                    k = 0;
                                                    //for (k = 0; k < data__rule_ipobjs.length; k++) {
                                                    ipobj_cont = data__rule_ipobjs.length;
                                                    //creamos array de ipobj
                                                    position_node.ipobjs = new Array();
                                                    //--------------------------------------------------------------------------------------------------
                                                    asyncMod.map(data__rule_ipobjs, function (row_ipobj, callback3) {
                                                        k++;
                                                        logger.debug("BUCLE REGLA:" + rule_id + "  POSITION:" + row_position.id + "  IPOBJ ID: " + row_ipobj.ipobj + "  IPOBJ_GROUP: " + row_ipobj.ipobj_g + "  TYPE: " + row_ipobj.type + "  INTERFACE:" + row_ipobj.interface + "   ORDER:" + row_ipobj.position_order + "  NEGATE:" + row_ipobj.negate);
                                                        // GET IPOBJs  Position O
                                                        if (row_ipobj.ipobj > 0 && row_ipobj.type === 'O') {
                                                            IpobjModel.getIpobj(fwcloud, row_ipobj.ipobj, function (error, data_ipobjs)
                                                            {
                                                                //If exists ipobj get data
                                                                if (data_ipobjs.length > 0)
                                                                {
                                                                    var ipobj = data_ipobjs[0];
                                                                    var ipobj_node = new data_policy_position_ipobjs(ipobj, row_ipobj.position_order, row_ipobj.negate, 'O');
                                                                    //Añadimos ipobj a array de position
                                                                    position_node.ipobjs.push(ipobj_node);

                                                                    callback3();
                                                                }
                                                                //Get Error
                                                                else
                                                                {
                                                                    logger.debug("ERROR getIpobj: " + error);
                                                                    callback3();
                                                                }
                                                            });
                                                        }
                                                        //GET GROUPS  Position O
                                                        else if (row_ipobj.ipobj_g > 0 && row_ipobj.type === 'O') {
                                                            Ipobj_gModel.getIpobj_g(fwcloud, row_ipobj.ipobj_g, function (error, data_ipobjs)
                                                            {
                                                                //If exists ipobj_g get data
                                                                if (data_ipobjs.length > 0)
                                                                {
                                                                    var ipobj = data_ipobjs[0];
                                                                    var ipobj_node = new data_policy_position_ipobjs(ipobj, row_ipobj.position_order, row_ipobj.negate, 'G');
                                                                    //Añadimos ipobj a array de position
                                                                    position_node.ipobjs.push(ipobj_node);

                                                                    callback3();
                                                                }
                                                                //Get Error
                                                                else
                                                                {
                                                                    logger.debug("ERROR GROUP getIpobj: " + error);
                                                                    callback3();
                                                                }
                                                            });
                                                        }
                                                        //GET INTERFACES Position I and O
                                                        else if (row_ipobj.interface > 0 || row_ipobj.type === 'I') {
                                                            var idInterface = row_ipobj.interface;
                                                            if (row_ipobj.type === 'I')
                                                                idInterface = row_ipobj.ipobj;

                                                            InterfaceModel.getInterface(idfirewall, fwcloud, idInterface, function (error, data_interface)
                                                            {
                                                                if (data_interface.length > 0)
                                                                {
                                                                    var interface = data_interface[0];
                                                                    var ipobj_node = new data_policy_position_ipobjs(interface, row_ipobj.position_order, row_ipobj.negate, 'I');
                                                                    //Añadimos ipobj a array de position
                                                                    position_node.ipobjs.push(ipobj_node);

                                                                    callback3();
                                                                }
                                                                //Get Error
                                                                else
                                                                {
                                                                    logger.debug("ERROR getInterface: " + error);
                                                                    callback3();
                                                                }
                                                            });
                                                        } else {
                                                            callback3();
                                                        }
                                                    }, //Fin de bucle de IPOBJS
                                                            function (err) {
                                                                //logger.debug("añadiendo IPOBJS: " + ipobj_cont + "   IPOBJS_COUNT:" + position_node.ipobjs.length);
                                                                //logger.debug("-------------------------Añadiendo IPOBJS  en Regla:" + rule_id + "  Position:" + row_position.id);
                                                                //logger.debug(position_node);

                                                                position_node.ipobjs.sort(function (a, b) {
                                                                    return a.position_order - b.position_order;
                                                                });

                                                                policy_node.positions.push(position_node);

                                                                if (policy_node.positions.length >= position_cont) {

                                                                    policy_node.positions.sort(function (a, b) {
                                                                        return a.position_order - b.position_order;
                                                                    });
                                                                    policy.push(policy_node);
                                                                    //logger.debug("------------------Añadiendo POLICY_NODE  en Regla:" + rule_id + "  Position:" + row_position.id);
                                                                    if (policy.length >= policy_cont) {
                                                                        //logger.debug("-------------------- HEMOS LLLEGADO aL FINAL BUCLE 3----------------");
                                                                        policy.sort(function (a, b) {
                                                                            return a.rule_order - b.rule_order;
                                                                        });
                                                                        AllDone(null, policy);
                                                                    }
                                                                }

                                                            });
                                                }

                                            });

                                            callback2();

                                        }, //Fin de bucle Positions                                
                                                function (err) {
                                                    //logger.debug("J=" + j + " ---------- FINAL BUCLE 2 --------");
                                                    //logger.debug('iterating2 done   CONT=' + policy_cont);
//                                            if (err)
//                                                callback2(err, null);
//                                            else
//                                                callback2(null, policy);

                                                    //logger.debug("añadiendo POLICY NODE");
                                                    //policy.push(policy_node);
                                                    //logger.debug("LENGHT E2: " + policy.length);
                                                    if (policy.length >= policy_cont) {
                                                        //logger.debug("-------------------- HEMOS LLLEGADO aL FINAL BUCLE 2   con I=" + i + " - J=" + j + " - K=" + k);
                                                    }
                                                });


                                        //logger.debug(policy);


                                    }
                                    //Get Error
                                    else
                                    {
                                        logger.debug("ERROR getPolicy_positionsType: " + error);
                                    }
                                });

                                callback1();


                            }, //Fin de bucle Reglas                    
                                    function (err) {
                                        //logger.debug("---------- FINAL BUCLE 1 --------");
                                    });
                        } else {
                            //NO existe regla
                            logger.debug("NO HAY REGLAS");
                            AllDone("", null);
                        }

                    }
                });
            }
        });
    });
};

//Get All policy_r by firewall and type
policy_rModel.getPolicy_rs_type_full = function (fwcloud, idfirewall, type, rule, AllDone) {
    return new Promise((resolve, reject) => {

        var policy = [];
        var policy_cont = 0;
        var position_cont = 0;
        var ipobj_cont = 0;
        var i, j, k;
        var sqlRule = "";


        db.get(function (error, connection) {
            if (error)
                reject(error);

            if (rule !== "") {
                sqlRule = " AND P.id=" + connection.escape(rule);
                //TEST
                //sqlRule = " AND (P.id=760 OR P.id=761) ";
                //sqlRule = " AND (P.id=760) ";
            }
            Policy_typeModel.getPolicy_type(type, function (error, data_types) {
                if (error)
                    reject(error);
                else {
                    if (data_types.length > 0)
                        type = data_types[0].id;
                    else
                        type = 1;

                    var sql = 'SELECT ' + fwcloud + ' as fwcloud, P.*, G.name as group_name, G.groupstyle as group_style, ' +
                            ' F.name as firewall_name, ' +
                            ' C.updated_at as c_updated_at, ' +
                            ' IF((P.updated_at > C.updated_at) OR C.updated_at IS NULL, 0, IFNULL(C.status_compiled,0) ) as rule_compiled ' +
                            ' FROM ' + tableModel + ' P ' +
                            ' LEFT JOIN policy_g G ON G.id=P.idgroup ' +
                            ' LEFT JOIN policy_c C ON C.rule=P.id ' +
                            ' LEFT JOIN firewall F ON F.id=P.fw_apply_to ' +
                            ' WHERE P.firewall=' + connection.escape(idfirewall) + ' AND  P.type= ' + connection.escape(type) +
                            sqlRule + ' ORDER BY P.rule_order';
                    //logger.debug(sql);
                    connection.query(sql, function (error, rows) {
                        if (error)
                            reject(error);
                        else {
                            if (rows.length > 0) {
                                //Bucle por REGLAS                            
                                //logger.debug("DENTRO de BUCLE de REGLAS: " + rows.length + " Reglas");
                                Promise.all(rows.map(Policy_positionModel.getPolicy_positionsTypePro))
                                        .then(data => {
                                            logger.debug("---------------------------------------------------> FINAL de REGLAS <----");
                                            resolve(data);
                                        })
                                        .catch(e => {
                                            reject(e);
                                        });


                            } else {
                                //NO existe regla
                                logger.debug("NO HAY REGLAS");
                                reject("");
                            }

                        }
                    });
                }
            });
        });
    });
};


//Get policy_r by  id  and firewall
policy_rModel.getPolicy_r = function (idfirewall, id, callback) {
    db.get(function (error, connection) {
        if (error)
            callback(error, null);

        var sql = 'SELECT P.*, F.fwcloud, (select MAX(rule_order) from ' + tableModel + ' where firewall=P.firewall and type=P.type) as max_order, ' +
                ' (select MIN(rule_order) from ' + tableModel + ' where firewall=P.firewall and type=P.type) as min_order ' +
                ' FROM ' + tableModel + ' P  INNER JOIN firewall F on F.id=P.firewall WHERE P.id = ' + connection.escape(id) + ' AND P.firewall=' + connection.escape(idfirewall);

        connection.query(sql, function (error, row) {
            if (error) {
                logger.debug(error);
                callback(error, null);
            } else
                callback(null, row);
        });
    });
};
//Get policy_r by  id  
policy_rModel.getPolicy_r_id = function (id, callback) {
    db.get(function (error, connection) {
        if (error)
            callback(error, null);

        var sql = 'SELECT P.*, F.fwcloud ' +
                ' FROM ' + tableModel + ' P INNER JOIN firewall F on F.id=P.firewall  WHERE P.id = ' + connection.escape(id);

        connection.query(sql, function (error, row) {
            if (error) {
                logger.debug(error);
                callback(error, null);
            } else
                callback(null, row);
        });
    });
};

//Get policy_r  GROUP by  NEXT or Previous RULE
policy_rModel.getPolicy_r_DestGroup = function (idfirewall, offset, order, type, callback) {
    db.get(function (error, connection) {
        if (error)
            callback(error, null);

        if (offset > 0)
            order++;
        else
            order--;

        var sql = 'SELECT idgroup ' +
                ' FROM ' + tableModel + '  WHERE rule_order = ' + connection.escape(order) + ' AND type= ' + connection.escape(type) + ' AND firewall=' + connection.escape(idfirewall);

        connection.query(sql, function (error, row) {
            if (error) {
                logger.debug(error);
                callback(error, null);
            } else
                callback(null, row);
        });
    });
};

//Get routing by name and firewall and group
policy_rModel.getPolicy_rName = function (idfirewall, idgroup, name, callback) {
    db.get(function (error, connection) {
        if (error)
            callback(error, null);
        var namesql = '%' + name + '%';
        var whereGroup = '';
        if (idgroup !== '') {
            whereGroup = ' AND group=' + connection.escape(idgroup);
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

policy_rModel.insertPolicy_r_CatchingAllRules = function (iduser, fwcloud, idfirewall) {
    return new Promise((resolve, reject) => {

        var policy_rData = {
            id: null,
            idgroup: null,
            firewall: idfirewall,
            rule_order: 1,
            action: 2,
            time_start: null,
            time_end: null,
            active: 1,
            options: '',
            comment: 'Catching All Rule.',
            type: 0,
            style: null
        };

        //CREATE INPUT RULE
        //Get Policy Type I
        Policy_typeModel.getPolicy_typeL('I', function (error, dataPol) {
            if (dataPol && dataPol.length > 0) {
                policy_rData.type = dataPol[0].id;
                //Insert Empty Rule
                policy_rModel.insertPolicy_r(policy_rData, function (error, dataRule) {
                    if (dataRule && dataRule.result) {
                        logger.debug("FIREWALL: " + idfirewall + " with CATCHING ALL INPUT RULE CREATED:  " + dataRule.insertId);
                    }
                });
            }
        });

        //Create Forward rule 
        Policy_typeModel.getPolicy_typeL('F', function (error, dataPol) {
            if (dataPol && dataPol.length > 0) {
                policy_rData.type = dataPol[0].id;
                //Insert Empty Rule
                policy_rModel.insertPolicy_r(policy_rData, function (error, dataRule) {
                    if (dataRule && dataRule.result) {
                        logger.debug("FIREWALL: " + idfirewall + " with CATCHING ALL FORWARD RULE CREATED:  " + dataRule.insertId);
                    }
                });
            }
        });

        //Create Output rule 
        Policy_typeModel.getPolicy_typeL('O', function (error, dataPol) {
            if (dataPol && dataPol.length > 0) {
                policy_rData.type = dataPol[0].id;
                //Insert Empty Rule
                policy_rData.action = 1; // For the OUTPUT chain by default allow all traffic.
                policy_rModel.insertPolicy_r(policy_rData, function (error, dataRule) {
                    if (dataRule && dataRule.result) {
                        logger.debug("FIREWALL: " + idfirewall + " with CATCHING ALL OUTPUT RULE CREATED:  " + dataRule.insertId);
                    }
                });
            }
        });

        resolve();

    });

};


//Add new policy_r from user
policy_rModel.insertPolicy_r = function (policy_rData, callback) {

    db.get(function (error, connection) {
        if (error)
            callback(error, null);

        connection.query('INSERT INTO ' + tableModel + ' SET ?', policy_rData, function (error, result) {
            if (error) {
                logger.debug(error);
                callback(error, null);
            } else {
                if (result.affectedRows > 0) {
                    OrderList(policy_rData.rule_order, policy_rData.firewall, 999999, result.insertId);
                    //devolvemos la última id insertada
                    callback(null, {"result": true, "insertId": result.insertId});
                } else
                    callback(null, {"result": false});
            }
        });
    });
};

//Clone policy and IPOBJ
policy_rModel.cloneFirewallPolicy = function (iduser, fwcloud, idfirewall, idNewfirewall) {
    return new Promise((resolve, reject) => {
        db.get(function (error, connection) {
            if (error)
                reject(error);
            sql = ' select ' + connection.escape(idNewfirewall) + ' as newfirewall, P.* ' +
                    ' from policy_r P ' +
                    ' where P.firewall=' + connection.escape(idfirewall);
            logger.debug(sql);
            connection.query(sql, function (error, rows) {
                if (error) {
                    logger.debug(error);
                    reject(error);
                } else {
                    //Bucle por Policy
                    Promise.all(rows.map(policy_rModel.clonePolicy))
                            .then(data => {
                                logger.debug("-->>>>>>>> FINAL de POLICY para nuevo Firewall : " + idNewfirewall);
                                resolve(data);
                            })
                            .catch(e => {
                                reject(e);
                            });

                }
            });
        });
    });
};

policy_rModel.clonePolicy = function (rowData) {
    return new Promise((resolve, reject) => {
        db.get(function (error, connection) {
            if (error)
                reject(error);

            //CREATE NEW POLICY

            var policy_rData = {
                id: null,
                idgroup: rowData.idgroup,
                firewall: rowData.newfirewall,
                rule_order: rowData.rule_order,
                action: rowData.action,
                time_start: rowData.time_start,
                time_end: rowData.time_end,
                active: rowData.active,
                options: rowData.options,
                comment: rowData.comment,
                type: rowData.type,
                style: rowData.style,
                fw_apply_to: rowData.fw_apply_to,
                fw_ref: rowData.firewall
            };

            policy_rModel.insertPolicy_r(policy_rData, function (error, data)
            {
                if (error)
                    resolve(false);

                var newRule = data.insertId;
                //SELECT ALL IPOBJ UNDER POSITIONS
                sql = ' select ' + connection.escape(rowData.newfirewall) + ' as newfirewall, ' + connection.escape(newRule) + ' as newrule, O.* ' +
                        ' from policy_r__ipobj O ' +
                        ' where O.rule=' + connection.escape(rowData.id) +
                        ' ORDER BY position_order';
                logger.debug(sql);
                connection.query(sql, function (error, rows) {
                    if (error) {
                        logger.debug(error);
                        reject(error);
                    } else {
                        //Bucle por IPOBJS
                        Promise.all(rows.map(Policy_r__ipobjModel.clonePolicy_r__ipobj))
                                .then(data => {
                                    logger.debug("-->>>>>>>> FINAL de IPOBJS PARA nueva POLICY: " + newRule);                                    
                                })
                                .then(() => {
                                    //SELECT ALL INTERFACES UNDER POSITIONS
                                    sql = ' select ' + connection.escape(newRule) + ' as newrule, I.id as newInterface, O.* ' +
                                            ' from policy_r__interface O ' +
                                            ' inner join interface I on I.id_fwb=O.interface ' +
                                            ' where O.rule=' + connection.escape(rowData.id) +
                                            ' AND I.firewall= ' + connection.escape(rowData.newfirewall) +
                                            ' ORDER BY position_order';
                                    logger.debug("-------> SQL ALL INTERFACES: ", sql);
                                    connection.query(sql, function (error, rowsI) {
                                        if (error) {
                                            logger.debug(error);
                                            reject(error);
                                        } else {
                                            //Bucle por IPOBJS
                                            Promise.all(rowsI.map(Policy_r__interfaceModel.clonePolicy_r__interface))
                                                    .then(data => {
                                                        logger.debug("-->>>>>>>> FINAL de INTERFACES PARA nueva POLICY: " + newRule);
                                                        resolve(data);
                                                    })
                                                    .catch(e => {
                                                        reject(e);
                                                    });

                                        }
                                    });
                                })
                                .catch(e => {
                                    reject(e);
                                });

                    }
                });


            });
        });
    });
};

//Update policy_r from user
policy_rModel.updatePolicy_r = function (old_order, policy_rData, callback) {
    Policy_typeModel.getPolicy_type(policy_rData.type, function (error, data_types) {
        if (error)
            callback(error, null);
        else {
            if (data_types.length > 0)
                type = data_types[0].id;
            else
                type = 1;
            db.get(function (error, connection) {
                if (error)
                    callback(error, null);
                logger.debug("UPDATE RULE:");
                logger.debug(policy_rData);

                var sql = 'UPDATE ' + tableModel + ' SET ' +
                        'idgroup = ' + connection.escape(policy_rData.idgroup) + ',' +
                        'firewall = ' + connection.escape(policy_rData.firewall) + ',' +
                        'rule_order = ' + connection.escape(policy_rData.rule_order) + ',' +
                        'action = ' + connection.escape(policy_rData.action) + ',' +
                        'time_start = ' + connection.escape(policy_rData.time_start) + ',' +
                        'time_end = ' + connection.escape(policy_rData.time_end) + ',' +
                        'options = ' + connection.escape(policy_rData.options) + ',' +
                        'active = ' + connection.escape(policy_rData.active) + ',' +
                        'comment = ' + connection.escape(policy_rData.comment) + ', ' +
                        'type = ' + connection.escape(type) + ', ' +
                        'style = ' + connection.escape(policy_rData.style) + ', ' +
                        'fw_apply_to = ' + connection.escape(policy_rData.fw_apply_to) + ' ' +
                        ' WHERE id = ' + policy_rData.id;

                connection.query(sql, function (error, result) {
                    if (error) {
                        logger.error(error);
                        callback(error, null);
                    } else {
                        if (result.affectedRows > 0) {
                            OrderList(policy_rData.rule_order, policy_rData.firewall, old_order, policy_rData.id);
                            callback(null, {"result": true});
                        } else
                            callback(null, {"result": false});
                    }
                });
            });
        }
    });
};

//Update ORDER de policy_r 
policy_rModel.updatePolicy_r_order = function (idfirewall, type, id, new_order, old_order, idgroup, callback) {
    Policy_typeModel.getPolicy_type(type, function (error, data_types) {
        if (error)
            callback(error, null);
        else {
            if (data_types.length > 0)
                type = data_types[0].id;
            else
                type = 1;
            db.get(function (error, connection) {
                if (error)
                    callback(error, null);
                var sql = 'UPDATE ' + tableModel + ' SET ' +
                        'rule_order = ' + connection.escape(new_order) + ', ' +
                        'idgroup = ' + connection.escape(idgroup) + ' ' +
                        ' WHERE id = ' + connection.escape(id) + ' AND firewall=' + connection.escape(idfirewall) + ' AND type=' + connection.escape(type);
                //' AND rule_order=' + connection.escape(old_order);

                connection.query(sql, function (error, result) {
                    if (error) {
                        callback(error, null);
                    } else {
                        if (result.affectedRows > 0) {
                            OrderList(new_order, idfirewall, old_order, id);
                            logger.debug("---> ORDENADA POLICY " + id + "  OLD ORDER: " + old_order + "  NEW ORDER: " + new_order);
                            callback(null, {"result": true});
                        } else
                            callback(null, {"result": false});
                    }
                });
            });
        }
    });
};

//var FirewallsClusterModel = require('../firewall/firewalls_cluster');
var FirewallModel = require('../../models/firewall/firewall');

//Update APPLYTO de policy_r 
policy_rModel.updatePolicy_r_applyto = function (iduser, fwcloud, idfirewall, type, id, idcluster, fwapplyto, callback) {
    Policy_typeModel.getPolicy_type(type, function (error, data_types) {
        if (error)
            callback(error, null);
        else {
            if (data_types.length > 0)
                type = data_types[0].id;
            else
                type = 1;

            FirewallModel.getFirewall(iduser, fwcloud, fwapplyto, function (error, data_fc) {
                if (error)
                    callback(error, null);
                else {
                    if (data_fc.length > 0) {
                        db.get(function (error, connection) {
                            if (error)
                                callback(error, null);
                            if (fwapplyto === undefined || fwapplyto === '' || isNaN(fwapplyto)) {
                                fwapplyto = null;
                            }
                            var sql = 'UPDATE ' + tableModel + ' SET ' +
                                    'fw_apply_to = ' + connection.escape(fwapplyto) + ' ' +
                                    ' WHERE id = ' + connection.escape(id) + ' AND firewall=' + connection.escape(idfirewall) + ' AND type=' + connection.escape(type);
                            connection.query(sql, function (error, result) {
                                if (error) {
                                    callback(error, null);
                                } else {
                                    if (result.affectedRows > 0) {
                                        callback(null, {"result": true});
                                    } else
                                        callback(null, {"result": false});
                                }
                            });
                        });
                    } else {
                        callback(null, {"result": false});
                    }
                }
            });


        }
    });
};


//Update policy_r from user
policy_rModel.updatePolicy_r_Group = function (firewall, oldgroup, newgroup, id, callback) {

    db.get(function (error, connection) {
        if (error)
            callback(error, null);

        var sql = 'UPDATE ' + tableModel + ' SET ' +
                'idgroup = ' + connection.escape(newgroup) + ' ' +
                ' WHERE id = ' + id + " and firewall=" + firewall;
        if (oldgroup !== null)
            sql += "  AND idgroup=" + oldgroup;
        logger.debug(sql);
        connection.query(sql, function (error, result) {
            if (error) {
                logger.error(error);
                callback(error, null);
            } else {
                if (result.affectedRows > 0) {
                    callback(null, {"result": true});
                } else
                    callback(null, {"result": false});
            }
        });
    });
};
//Update policy_r Style
policy_rModel.updatePolicy_r_Style = function (firewall, id, type, style, callback) {

    db.get(function (error, connection) {
        if (error)
            callback(error, null);

        var sql = 'UPDATE ' + tableModel + ' SET ' +
                'style = ' + connection.escape(style) + ' ' +
                ' WHERE id = ' + connection.escape(id) + " and firewall=" + connection.escape(firewall) + " AND type=" + connection.escape(type);
        connection.query(sql, function (error, result) {
            if (error) {
                logger.error(error);
                callback(error, null);
            } else {
                if (result.affectedRows > 0) {
                    callback(null, {"result": true});
                } else
                    callback(null, {"result": false});
            }
        });
    });
};

//Update policy_r Active
policy_rModel.updatePolicy_r_Active = function (firewall, id, type, active, callback) {

    db.get(function (error, connection) {
        if (error)
            callback(error, null);

        var sql = 'UPDATE ' + tableModel + ' SET ' +
                'active = ' + connection.escape(active) + ' ' +
                ' WHERE id = ' + connection.escape(id) + " and firewall=" + connection.escape(firewall) + " AND type=" + connection.escape(type);

        connection.query(sql, function (error, result) {
            if (error) {
                logger.error(error);
                callback(error, null);
            } else {
                if (result.affectedRows > 0) {
                    callback(null, {"result": true});
                } else
                    callback(null, {"result": false});
            }
        });

    });
};

//Update policy_r from user
policy_rModel.updatePolicy_r_GroupAll = function (firewall, idgroup, callback) {

    db.get(function (error, connection) {
        if (error)
            callback(error, null);

        var sql = 'UPDATE ' + tableModel + ' SET ' +
                'idgroup = NULL' + ' ' +
                ' WHERE idgroup = ' + idgroup + " and firewall=" + firewall;

        connection.query(sql, function (error, result) {
            if (error) {
                logger.error(error);
                callback(error, null);
            } else {
                if (result.affectedRows > 0) {
                    callback(null, {"result": true});
                } else
                    callback(null, {"result": false});
            }
        });
    });
};


function OrderList(new_order, idfirewall, old_order, id) {
    var increment = '+1';
    var order1 = new_order;
    var order2 = old_order;
    if (new_order > old_order) {
        increment = '-1';
        order1 = old_order;
        order2 = new_order;
    }

    db.get(function (error, connection) {
        if (error)
            callback(error, null);
        var sql = 'UPDATE ' + tableModel + ' SET ' +
                'rule_order = rule_order' + increment +
                ' WHERE firewall = ' + connection.escape(idfirewall) +
                ' AND rule_order>=' + order1 + ' AND rule_order<=' + order2 +
                ' AND id<>' + connection.escape(id);
        connection.query(sql);

    });

}
;


//Remove All policy_r from firewall
policy_rModel.deletePolicy_r_Firewall = function (idfirewall) {
    return new Promise((resolve, reject) => {
        db.get(function (error, connection) {
            if (error)
                reject(error);
            var sql = 'SELECT  I.*   FROM ' + tableModel + ' I ' +
                    ' WHERE (I.firewall=' + connection.escape(idfirewall) + ') ';

            connection.query(sql, function (error, rows) {
                if (error)
                    reject(error);
                else {
                    logger.debug("-----> DELETING RULES FROM FIREWALL: " + idfirewall);
                    //Bucle por reglas
                    Promise.all(rows.map(policy_rModel.deletePolicy_rPro))
                            .then(data => {
                                resolve(data);
                            })
                            .catch(e => {
                                reject(e);
                            });
                }
            });
        });

    });
};


policy_rModel.deletePolicy_rPro = function (data) {
    return new Promise((resolve, reject) => {
        policy_rModel.deletePolicy_r(data.firewall, data.id)
                .then(resp => {
                    resolve(resp);
                })
                .catch(e => {
                    reject(e);
                });
    });
};


//Remove policy_r with id to remove
policy_rModel.deletePolicy_r = function (idfirewall, id) {
    return new Promise((resolve, reject) => {
        db.get(function (error, connection) {
            if (error)
                reject(error);
            var sqlExists = 'SELECT * FROM ' + tableModel + '  WHERE id = ' + connection.escape(id) + ' AND firewall=' + connection.escape(idfirewall);
            //logger.debug(sqlExists);

            connection.query(sqlExists, function (error, row) {
                //If exists Id from policy_r to remove
                if (row && row.length > 0) {
                    var rule_order = row[0].rule_order;
                    logger.debug("DELETING RULE: " + id + "  Firewall: " + idfirewall + "  ORDER: " + rule_order);
                    //DELETE FROM policy_r__ipobj
                    Policy_r__ipobjModel.deletePolicy_r__All(id, function (error, data)
                    {
                        if (error)
                            reject(error);
                        else {
                            //DELETE FROM policy_r__interface
                            Policy_r__interfaceModel.deletePolicy_r__All(id, function (error, data)
                            {
                                if (error)
                                    reject(error);
                                else {
                                    //DELETE POLICY_C compilation
                                    Policy_cModel.deletePolicy_c(idfirewall, id, function (error, data)
                                    {
                                        if (error)
                                            reject(error);
                                        else {
                                            db.get(function (error, connection) {
                                                var sql = 'DELETE FROM ' + tableModel + ' WHERE id = ' + connection.escape(id) + ' AND firewall=' + connection.escape(idfirewall);
                                                connection.query(sql, function (error, result) {
                                                    if (error) {
                                                        logger.debug(error);
                                                        reject(error);
                                                    } else {
                                                        if (result.affectedRows > 0) {
                                                            OrderList(999999, idfirewall, rule_order, id);
                                                            resolve({"result": true, "msg": "deleted"});
                                                        } else {
                                                            resolve({"result": false, "msg": "notExist"});
                                                        }
                                                    }
                                                });
                                            });
                                        }
                                    });
                                }
                            });
                        }

                    });
                } else {
                    resolve({"result": false, "msg": "notExist"});
                }
            });
        });
    });
};

var streamModel = require('../stream/stream');

//Compile rule and save it
policy_rModel.compilePolicy_r = function (accessData, callback) {

    var rule = accessData.rule;

    policy_rModel.getPolicy_r_id(rule, function (error, data) {
        if (error)
            callback(error, null);
        if (data && data.length > 0) {
            var strRule = " Rule: " + rule + " FWCloud: " + data[0].fwcloud + "  Firewall: " + data[0].firewall + "  Type: " + data[0].type + "\n";
            logger.debug("---------- COMPILING RULE " + strRule + " -------");
            streamModel.pushMessageCompile(accessData, "COMPILING RULE " + rule + " COMPILATION PROCESS\n");

            //RuleCompileModel.rule_compile(data[0].fwcloud, data[0].firewall, data[0].type, rule, (cs) => {
            RuleCompileModel.get(data[0].fwcloud, data[0].firewall, data[0].type, rule)
                    .then(data => {
                        if (data && data.length > 0) {
                            logger.debug("---- RULE COMPILED --->  ");
                            logger.debug(data);
                            logger.debug("-----------------------");
                            streamModel.pushMessageCompile(accessData, "RULE " + rule + "  COMPILED\n");
                            streamModel.pushMessageCompile(accessData, "\n" + data + " \n");
                            streamModel.pushMessageCompile(accessData, "\nCOMPILATION COMPLETED\n\n");
                            callback(null, {"result": true, "msg": "Rule compiled"});
                        } else {
                            logger.debug("---- ERROR RULE NOT COMPILED --->  ");
                            streamModel.pushMessageCompile(accessData, "ERROR COMPILING RULE " + rule + "\n\n");
                            callback(null, {"result": false, "msg": "CS Empty, rule NOT compiled"});
                        }
                    })
                    .catch(error => {
                        streamModel.pushMessageCompile(accessData, "ERROR COMPILING RULE " + rule + "\n\n");
                        callback(null, {"result": false, "msg": "ERROR rule NOT compiled"});
                    });

        } else
            callback(null, {"result": false, "msg": "rule Not found, NOT compiled"});
    });

};
