//create object
var policy_rModel = {};

//Export the object
module.exports = policy_rModel;

var db = require('../../db.js');
var asyncMod = require('async');

var Policy_r__interfaceModel = require('../../models/policy/policy_r__interface');
var Policy_typeModel = require('../../models/policy/policy_type');




var tableModel = "policy_r";
var Policy_positionModel = require('./position');
var Policy_r__ipobjModel = require('../../models/policy/policy_r__ipobj');

var IpobjModel = require('../../models/ipobj/ipobj');
var Ipobj_gModel = require('../ipobj/group');
var InterfaceModel = require('../../models/interface/interface');
var data_policy_r = require('../../models/data/data_policy_r');
var data_policy_positions = require('../../models/data/data_policy_positions');
var data_policy_position_ipobjs = require('../../models/data/data_policy_position_ipobjs');
var RuleCompileModel = require('../../models/policy/rule_compile');
var Policy_cModel = require('../../models/policy/policy_c');
var Policy_gModel = require('../../models/policy/policy_g');

var logger = require('log4js').getLogger("app");


//Get All policy_r by firewall and group
policy_rModel.getPolicy_rs = function(idfirewall, idgroup, callback) {

    db.get(function(error, connection) {
        if (error)
            callback(error, null);
        var whereGroup = '';
        if (idgroup !== '') {
            whereGroup = ' AND idgroup=' + connection.escape(idgroup);
        }
        var sql = 'SELECT * FROM ' + tableModel + ' WHERE firewall=' + connection.escape(idfirewall) + whereGroup + ' ORDER BY rule_order';
        connection.query(sql, function(error, rows) {
            if (error)
                callback(error, null);
            else
                callback(null, rows);
        });
    });
};

//Get All policy_r by firewall and type
policy_rModel.getPolicy_rs_type = (fwcloud, idfirewall, type, rule, AllDone) => {
    var policy = [];
    var policy_cont = 0;
    var position_cont = 0;
    var ipobj_cont = 0;
    var i, j, k;
    var sqlRule = "";

    db.get(function(error, connection) {
        if (error)
            callback(error, null);

        if (rule !== "") {
            sqlRule = " AND P.id=" + connection.escape(rule);
        }
        Policy_typeModel.getPolicy_type(type, function(error, data_types) {
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
                connection.query(sql, function(error, rows) {
                    if (error)
                        AllDone(error, null);
                    else {
                        if (rows.length > 0) {
                            i = 0;
                            policy_cont = rows.length;
                            //for (i = 0; i < rows.length; i++) {
                            //--------------------------------------------------------------------------------------------------
                            asyncMod.map(rows, function(row_rule, callback1) {
                                    i++;
                                    var policy_node = new data_policy_r(row_rule);


                                    var rule_id = row_rule.id;
                                    logger.debug(i + " ---> DENTRO de REGLA: " + rule_id + " ORDER: " + row_rule.rule_order);

                                    //Buscamos POSITIONS de REGLA
                                    Policy_positionModel.getPolicy_positionsType(type, function(error, data_positions) {
                                        //If exists policy_position get data
                                        if (typeof data_positions !== 'undefined') {
                                            //logger.debug("REGLA: " + rule_id + "  POSITIONS: " + data_positions.length);
                                            j = 0;
                                            //for (j = 0; j < data_positions.length; j++) {

                                            position_cont = data_positions.length;
                                            policy_node.positions = new Array();

                                            //--------------------------------------------------------------------------------------------------
                                            asyncMod.map(data_positions, function(row_position, callback2) {
                                                    j++;
                                                    //logger.debug(j + " - DENTRO de POSITION: " + row_position.id + " - " + row_position.name + "     ORDER:" + row_position.position_order);
                                                    var position_node = new data_policy_positions(row_position);

                                                    //Buscamos IPOBJS por POSITION
                                                    Policy_r__ipobjModel.getPolicy_r__ipobjs_interfaces_position(rule_id, row_position.id, function(error, data__rule_ipobjs) {
                                                        //logger.debug(" IPOBJS PARA POSITION:" + row_position.id + " --> " + data__rule_ipobjs.length);
                                                        //If exists policy_r__ipobj get data
                                                        //if (typeof data__rule_ipobjs !== 'undefined' && data__rule_ipobjs.length > 0)
                                                        if (typeof data__rule_ipobjs !== 'undefined') {

                                                            //obtenemos IPOBJS o INTERFACES o GROUPS
                                                            k = 0;
                                                            //for (k = 0; k < data__rule_ipobjs.length; k++) {
                                                            ipobj_cont = data__rule_ipobjs.length;
                                                            //creamos array de ipobj
                                                            position_node.ipobjs = new Array();
                                                            //--------------------------------------------------------------------------------------------------
                                                            asyncMod.map(data__rule_ipobjs, function(row_ipobj, callback3) {
                                                                    k++;
                                                                    logger.debug("BUCLE REGLA:" + rule_id + "  POSITION:" + row_position.id + "  IPOBJ ID: " + row_ipobj.ipobj + "  IPOBJ_GROUP: " + row_ipobj.ipobj_g + "  TYPE: " + row_ipobj.type + "  INTERFACE:" + row_ipobj.interface + "   ORDER:" + row_ipobj.position_order + "  NEGATE:" + row_ipobj.negate);
                                                                    // GET IPOBJs  Position O
                                                                    if (row_ipobj.ipobj > 0 && row_ipobj.type === 'O') {
                                                                        IpobjModel.getIpobj(fwcloud, row_ipobj.ipobj, function(error, data_ipobjs) {
                                                                            //If exists ipobj get data
                                                                            if (data_ipobjs.length > 0) {
                                                                                var ipobj = data_ipobjs[0];
                                                                                var ipobj_node = new data_policy_position_ipobjs(ipobj, row_ipobj.position_order, row_ipobj.negate, 'O');
                                                                                //Añadimos ipobj a array de position
                                                                                position_node.ipobjs.push(ipobj_node);

                                                                                callback3();
                                                                            }
                                                                            //Get Error
                                                                            else {
                                                                                logger.debug("ERROR getIpobj: " + error);
                                                                                callback3();
                                                                            }
                                                                        });
                                                                    }
                                                                    //GET GROUPS  Position O
                                                                    else if (row_ipobj.ipobj_g > 0 && row_ipobj.type === 'O') {
                                                                        Ipobj_gModel.getIpobj_g(fwcloud, row_ipobj.ipobj_g, function(error, data_ipobjs) {
                                                                            //If exists ipobj_g get data
                                                                            if (data_ipobjs.length > 0) {
                                                                                var ipobj = data_ipobjs[0];
                                                                                var ipobj_node = new data_policy_position_ipobjs(ipobj, row_ipobj.position_order, row_ipobj.negate, 'G');
                                                                                //Añadimos ipobj a array de position
                                                                                position_node.ipobjs.push(ipobj_node);

                                                                                callback3();
                                                                            }
                                                                            //Get Error
                                                                            else {
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

                                                                        InterfaceModel.getInterface(idfirewall, fwcloud, idInterface, function(error, data_interface) {
                                                                            if (data_interface.length > 0) {
                                                                                var interface = data_interface[0];
                                                                                var ipobj_node = new data_policy_position_ipobjs(interface, row_ipobj.position_order, row_ipobj.negate, 'I');
                                                                                //Añadimos ipobj a array de position
                                                                                position_node.ipobjs.push(ipobj_node);

                                                                                callback3();
                                                                            }
                                                                            //Get Error
                                                                            else {
                                                                                logger.debug("ERROR getInterface: " + error);
                                                                                callback3();
                                                                            }
                                                                        });
                                                                    } else {
                                                                        callback3();
                                                                    }
                                                                }, //Fin de bucle de IPOBJS
                                                                function(err) {
                                                                    //logger.debug("añadiendo IPOBJS: " + ipobj_cont + "   IPOBJS_COUNT:" + position_node.ipobjs.length);
                                                                    //logger.debug("-------------------------Añadiendo IPOBJS  en Regla:" + rule_id + "  Position:" + row_position.id);
                                                                    //logger.debug(position_node);

                                                                    position_node.ipobjs.sort(function(a, b) {
                                                                        return a.position_order - b.position_order;
                                                                    });

                                                                    policy_node.positions.push(position_node);

                                                                    if (policy_node.positions.length >= position_cont) {

                                                                        policy_node.positions.sort(function(a, b) {
                                                                            return a.position_order - b.position_order;
                                                                        });
                                                                        policy.push(policy_node);
                                                                        //logger.debug("------------------Añadiendo POLICY_NODE  en Regla:" + rule_id + "  Position:" + row_position.id);
                                                                        if (policy.length >= policy_cont) {
                                                                            //logger.debug("-------------------- HEMOS LLLEGADO aL FINAL BUCLE 3----------------");
                                                                            policy.sort(function(a, b) {
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
                                                function(err) {
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
                                        else {
                                            logger.debug("ERROR getPolicy_positionsType: " + error);
                                        }
                                    });

                                    callback1();


                                }, //Fin de bucle Reglas                    
                                function(err) {
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
policy_rModel.getPolicy_rs_type_full = function(fwcloud, idfirewall, type, rule, AllDone) {
    return new Promise((resolve, reject) => {
        var sqlRule = "";

        db.get((error, connection) => {
            if (error) return reject(error);

            if (rule !== "") {
                sqlRule = " AND P.id=" + connection.escape(rule);
                //TEST
                //sqlRule = " AND (P.id=760 OR P.id=761) ";
                //sqlRule = " AND (P.id=760) ";
            }
            Policy_typeModel.getPolicy_type(type, (error, data_types) => {
                if (error) return reject(error);

                if (data_types.length > 0)
                    type = data_types[0].id;
                else
                    type = 1;

                var sql = 'SELECT ' + fwcloud + ' as fwcloud, P.*, G.name as group_name, G.groupstyle as group_style,' +
                    ' F.name as firewall_name,' +
                    ' F.options as firewall_options,' +
                    ' C.updated_at as c_updated_at,' +
                    ' IF((P.updated_at > C.updated_at) OR C.updated_at IS NULL, 0, IFNULL(C.status_compiled,0) ) as rule_compiled' +
                    ' FROM ' + tableModel + ' P ' +
                    ' LEFT JOIN policy_g G ON G.id=P.idgroup ' +
                    ' LEFT JOIN policy_c C ON C.rule=P.id ' +
                    ' LEFT JOIN firewall F ON F.id=(IF((P.fw_apply_to is NULL),' + connection.escape(idfirewall) + ',P.fw_apply_to)) ' +
                    ' WHERE P.firewall=' + connection.escape(idfirewall) + ' AND  P.type= ' + connection.escape(type) +
                    sqlRule + ' ORDER BY P.rule_order';
                connection.query(sql, (error, rows) => {
                    if (error) return reject(error);
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
                });
            });
        });
    });
};


//Get policy_r by  id  and firewall
policy_rModel.getPolicy_r = function(idfirewall, id, callback) {
    db.get(function(error, connection) {
        if (error)
            callback(error, null);

        var sql = 'SELECT P.*, F.fwcloud, (select MAX(rule_order) from ' + tableModel + ' where firewall=P.firewall and type=P.type) as max_order, ' +
            ' (select MIN(rule_order) from ' + tableModel + ' where firewall=P.firewall and type=P.type) as min_order ' +
            ' FROM ' + tableModel + ' P  INNER JOIN firewall F on F.id=P.firewall WHERE P.id = ' + connection.escape(id) + ' AND P.firewall=' + connection.escape(idfirewall);

        connection.query(sql, function(error, row) {
            if (error) {
                logger.debug(error);
                callback(error, null);
            } else
                callback(null, row);
        });
    });
};
//Get policy_r by  id  
policy_rModel.getPolicy_r_id = function(id, callback) {
    db.get(function(error, connection) {
        if (error)
            callback(error, null);

        var sql = 'SELECT P.*, F.fwcloud ' +
            ' FROM ' + tableModel + ' P INNER JOIN firewall F on F.id=P.firewall  WHERE P.id = ' + connection.escape(id);

        connection.query(sql, function(error, row) {
            if (error) {
                logger.debug(error);
                callback(error, null);
            } else
                callback(null, row);
        });
    });
};

//Get policy_r  GROUP by  NEXT or Previous RULE
policy_rModel.getPolicy_r_DestGroup = function(idfirewall, offset, order, type, callback) {
    db.get(function(error, connection) {
        var nextRuleStr;

        if (error)
            callback(error, null);

        if (offset > 0)
        //order++;
            nextRuleStr = " > ";
        else
        //order--;
            nextRuleStr = " < ";

        //var sql = 'SELECT idgroup ' +
        //		' FROM ' + tableModel + '  WHERE rule_order = ' + connection.escape(order) + ' AND type= ' + connection.escape(type) + ' AND firewall=' + connection.escape(idfirewall);

        var sql = 'SELECT id, idgroup, rule_order ' +
            ' FROM ' + tableModel + '  WHERE rule_order ' + nextRuleStr + connection.escape(order) + ' AND type= ' + connection.escape(type) + ' AND firewall=' + connection.escape(idfirewall) + ' LIMIT 1';


        connection.query(sql, function(error, row) {
            if (error) {
                logger.debug(error);
                callback(error, null);
            } else
                callback(null, row);
        });
    });
};

//Get routing by name and firewall and group
policy_rModel.getPolicy_rName = function(idfirewall, idgroup, name, callback) {
    db.get(function(error, connection) {
        if (error)
            callback(error, null);
        var namesql = '%' + name + '%';
        var whereGroup = '';
        if (idgroup !== '') {
            whereGroup = ' AND group=' + connection.escape(idgroup);
        }
        var sql = 'SELECT * FROM ' + tableModel + ' WHERE name like  ' + connection.escape(namesql) + ' AND firewall=' + connection.escape(idfirewall) + whereGroup;
        logger.debug(sql);
        connection.query(sql, function(error, row) {
            if (error)
                callback(error, null);
            else
                callback(null, row);
        });
    });
};

policy_rModel.insertDefaultPolicy = (fwId, loInterfaceId) => {
    return new Promise((resolve, reject) => {
        var policy_rData = {
            id: null,
            idgroup: null,
            firewall: fwId,
            rule_order: 1,
            action: 2,
            time_start: null,
            time_end: null,
            active: 1,
            options: 0,
            comment: '',
            type: 0,
            style: null
        };

        var policy_r__interfaceData = {
            rule: null,
            interface: loInterfaceId,
            negate: 0,
            position: 20,
            position_order: 1
        };

        var policy_r__ipobjData = {
            rule: null,
            ipobj: -1,
            ipobj_g: 5,
            interface: -1,
            position: 3,
            position_order: 1
        };

        // Generate the default INPUT policy.
        policy_rData.type = 1;
        policy_rData.comment = 'Allow all incoming traffic from self host.';
        policy_rData.action = 1;
        policy_rModel.insertPolicy_r(policy_rData, (error, dataRule) => { // Insert empty rule.
            if (error) return reject(error);
            policy_r__interfaceData.rule = dataRule.insertId;
            Policy_r__interfaceModel.insertPolicy_r__interface(fwId, policy_r__interfaceData, (error, data) => {
                if (error) return reject(error);

                // Allow useful ICMP traffic.
                policy_rData.comment = 'Allow useful ICMP.';
                policy_rData.rule_order = 2;
                policy_rModel.insertPolicy_r(policy_rData, (error, dataRule) => {
                    if (error) return reject(error);

                    policy_r__ipobjData.rule = dataRule.insertId;
                    Policy_r__ipobjModel.insertPolicy_r__ipobj(policy_r__ipobjData, 0, (error, data) => {
                        if (error) return reject(error);

                        // Now create the catch all rule.
                        policy_rData.comment = 'Catch-all rule.';
                        policy_rData.action = 2;
                        policy_rData.rule_order = 3;
                        policy_rModel.insertPolicy_r(policy_rData, (error, dataRule) => {
                            if (error) return reject(error);

                            // Generate the default FORWARD policy. 
                            policy_rData.type = 3;
                            policy_rData.comment = 'Catch-all rule.';
                            policy_rModel.insertPolicy_r(policy_rData, (error, dataRule) => {
                                if (error) return reject(error);

                                // Generate the default OUTPUT policy. 
                                policy_rData.type = 2;
                                policy_rData.comment = 'Allow all outgoing traffic.';
                                policy_rData.action = 1; // For the OUTPUT chain by default allow all traffic.
                                policy_rModel.insertPolicy_r(policy_rData, (error, dataRule) => {
                                    if (error) return reject(error);
                                    resolve();
                                });
                            });
                        });
                    });
                });
            });
        });
    });
};


//Add new policy_r from user
policy_rModel.insertPolicy_r = function(policy_rData, callback) {

    db.get(function(error, connection) {
        if (error)
            callback(error, null);

        connection.query('INSERT INTO ' + tableModel + ' SET ?', policy_rData, function(error, result) {
            if (error) {
                logger.debug(error);
                callback(error, null);
            } else {
                if (result.affectedRows > 0) {
                    OrderList(policy_rData.rule_order, policy_rData.firewall, 999999, result.insertId);
                    //devolvemos la última id insertada
                    callback(null, { "result": true, "insertId": result.insertId });
                } else
                    callback(null, { "result": false });
            }
        });
    });
};

var clon_data;

//Clone policy and IPOBJ
policy_rModel.cloneFirewallPolicy = function(iduser, fwcloud, idfirewall, idNewFirewall, dataI) {
    return new Promise((resolve, reject) => {
        clon_data = dataI;
        db.get((error, connection) => {
            if (error) return reject(error);

            sql = ' select ' + connection.escape(idNewFirewall) + ' as newfirewall, P.* ' +
                ' from policy_r P ' +
                ' where P.firewall=' + connection.escape(idfirewall);
            connection.query(sql, function(error, rows) {
                if (error) return reject(error);

                //Bucle por Policy
                Promise.all(rows.map(policy_rModel.clonePolicy))
                    .then(() => Policy_gModel.clonePolicyGroups(idfirewall, idNewFirewall))
                    .then(() => resolve())
                    .catch(error => reject(error));
            });
        });
    });
};

policy_rModel.clonePolicy = function(rowData) {
    return new Promise((resolve, reject) => {
        db.get(function(error, connection) {
            if (error) return reject(error);

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

            policy_rModel.insertPolicy_r(policy_rData, (error, data) => {
                if (error) return resolve(false);

                var newRule = data.insertId;
                //SELECT ALL IPOBJ UNDER POSITIONS
                sql = ' select ' + connection.escape(rowData.newfirewall) + ' as newfirewall, ' + connection.escape(newRule) + ' as newrule, O.* ' +
                    ' from policy_r__ipobj O ' +
                    ' where O.rule=' + connection.escape(rowData.id) +
                    ' ORDER BY position_order';
                connection.query(sql, (error, rows) => {
                    if (error) return reject(error);
                    if (clon_data) {
                        for (var i = 0; i < rows.length; i++) {
                            for (var item of clon_data) {
                                if (rows[i].ipobj === -1 && rows[i].interface !== -1) {
                                    // Replace interfaces IDs with interfaces IDs of the cloned firewall.
                                    if (rows[i].interface === item.id_org) {
                                        rows[i].interface = item.id_clon;
                                        break;
                                    }
                                } else {
                                    // Replace ipobj IDs with ipobj IDs of the cloned firewall.
                                    var found = 0;
                                    for (var addr of item.addr) {
                                        if (rows[i].ipobj === addr.id_org) {
                                            rows[i].ipobj = addr.id_clon;
                                            found = 1;
                                            break;
                                        }
                                    }
                                    if (found) break;
                                }
                            }
                        }
                    }

                    //Bucle por IPOBJS
                    Promise.all(rows.map(Policy_r__ipobjModel.clonePolicy_r__ipobj))
                        .then(() => {
                            //SELECT ALL INTERFACES UNDER POSITIONS
                            sql = ' select ' + connection.escape(newRule) + ' as newrule, I.id as newInterface, O.* ' +
                                ' from policy_r__interface O ' +
                                ' inner join interface I on I.id=O.interface ' +
                                ' where O.rule=' + connection.escape(rowData.id) +
                                ' AND I.firewall=' + connection.escape(rowData.firewall) +
                                ' ORDER BY position_order';
                            connection.query(sql, (error, rowsI) => {
                                if (error) return reject(error);
                                // Replace the interfaces IDs with interfaces IDs of the cloned firewall.
                                if (clon_data) {
                                    for (var i = 0; i < rowsI.length; i++) {
                                        for (var item of clon_data) {
                                            if (rowsI[i].newInterface === item.id_org) {
                                                rowsI[i].newInterface = item.id_clon;
                                                break;
                                            }
                                        }
                                    }
                                }
                                //Bucle for INTERFACES
                                Promise.all(rowsI.map(Policy_r__interfaceModel.clonePolicy_r__interface))
                                    .then(data => resolve(data))
                                    .catch(e => reject(e));
                            });
                        })
                        .catch(e => reject(e));
                });
            });
        });
    });
};


//Update policy_r from user
policy_rModel.updatePolicy_r = function(old_order, policy_rData, callback) {
    Policy_typeModel.getPolicy_type(policy_rData.type, function(error, data_types) {
        if (error)
            callback(error, null);
        else {
            if (data_types.length > 0)
                type = data_types[0].id;
            else
                type = 1;
            db.get(function(error, connection) {
                if (error)
                    callback(error, null);
                logger.debug("UPDATE RULE:");
                logger.debug(policy_rData);

                let sql = 'UPDATE ' + tableModel + ' SET ';
                if (policy_rData.idgroup) sql += 'idgroup=' + policy_rData.idgroup + ',';
                if (policy_rData.rule_order) sql += 'rule_order=' + policy_rData.rule_order + ',';
                if (policy_rData.action) sql += 'action=' + policy_rData.action + ',';
                if (policy_rData.time_start) sql += 'time_start=' + policy_rData.time_start + ',';
                if (policy_rData.time_end) sql += 'time_end=' + policy_rData.time_end + ',';
                if (policy_rData.options) sql += 'options=' + policy_rData.options + ',';
                if (policy_rData.active) sql += 'active=' + policy_rData.active + ',';
                if (policy_rData.comment) sql += 'comment=' + connection.escape(policy_rData.comment) + ',';
                if (policy_rData.style) sql += 'style=' + policy_rData.style + ',';
                if (policy_rData.fw_apply_to) sql += 'fw_apply_to=' + policy_rData.fw_apply_to + ',';
                sql = sql.slice(0, -1) + ' WHERE id=' + policy_rData.id;

                connection.query(sql, function(error, result) {
                    if (error) {
                        logger.error(error);
                        callback(error, null);
                    } else {
                        if (result.affectedRows > 0) {
                            OrderList(policy_rData.rule_order, policy_rData.firewall, old_order, policy_rData.id);
                            callback(null, { "result": true });
                        } else
                            callback(null, { "result": false });
                    }
                });
            });
        }
    });
};

//Update ORDER de policy_r 
policy_rModel.updatePolicy_r_order = function(idfirewall, type, id, new_order, old_order, idgroup, callback) {
    Policy_typeModel.getPolicy_type(type, function(error, data_types) {
        if (error)
            callback(error, null);
        else {
            if (data_types.length > 0)
                type = data_types[0].id;
            else
                type = 1;
            db.get(function(error, connection) {
                if (error)
                    callback(error, null);
                var sql = 'UPDATE ' + tableModel + ' SET ' +
                    'rule_order = ' + connection.escape(new_order) + ', ' +
                    'idgroup = ' + connection.escape(idgroup) + ' ' +
                    ' WHERE id = ' + connection.escape(id) + ' AND firewall=' + connection.escape(idfirewall) + ' AND type=' + connection.escape(type);
                //' AND rule_order=' + connection.escape(old_order);

                connection.query(sql, function(error, result) {
                    if (error) {
                        callback(error, null);
                    } else {
                        if (result.affectedRows > 0) {
                            OrderList(new_order, idfirewall, old_order, id);
                            logger.debug("---> ORDENADA POLICY " + id + "  OLD ORDER: " + old_order + "  NEW ORDER: " + new_order);
                            callback(null, { "result": true });
                        } else
                            callback(null, { "result": false });
                    }
                });
            });
        }
    });
};

//Update policy_r from user
policy_rModel.updatePolicy_r_Group = function(firewall, oldgroup, newgroup, id, callback) {

    db.get(function(error, connection) {
        if (error)
            callback(error, null);

        var sql = 'UPDATE ' + tableModel + ' SET ' +
            'idgroup = ' + connection.escape(newgroup) + ' ' +
            ' WHERE id = ' + id + " and firewall=" + firewall;
        if (oldgroup !== null)
            sql += "  AND idgroup=" + oldgroup;
        logger.debug(sql);
        connection.query(sql, function(error, result) {
            if (error) {
                logger.error(error);
                callback(error, null);
            } else {
                if (result.affectedRows > 0) {
                    callback(null, { "result": true });
                } else
                    callback(null, { "result": false });
            }
        });
    });
};
//Update policy_r Style
policy_rModel.updatePolicy_r_Style = function(firewall, id, type, style, callback) {

    db.get(function(error, connection) {
        if (error)
            callback(error, null);

        var sql = 'UPDATE ' + tableModel + ' SET ' +
            'style = ' + connection.escape(style) + ' ' +
            ' WHERE id = ' + connection.escape(id) + " and firewall=" + connection.escape(firewall) + " AND type=" + connection.escape(type);
        connection.query(sql, function(error, result) {
            if (error) {
                logger.error(error);
                callback(error, null);
            } else {
                if (result.affectedRows > 0) {
                    callback(null, { "result": true });
                } else
                    callback(null, { "result": false });
            }
        });
    });
};

//Update policy_r Active
policy_rModel.updatePolicy_r_Active = function(firewall, id, type, active, callback) {

    db.get(function(error, connection) {
        if (error)
            callback(error, null);

        var sql = 'UPDATE ' + tableModel + ' SET ' +
            'active = ' + connection.escape(active) + ' ' +
            ' WHERE id = ' + connection.escape(id) + " and firewall=" + connection.escape(firewall) + " AND type=" + connection.escape(type);

        connection.query(sql, function(error, result) {
            if (error) {
                logger.error(error);
                callback(error, null);
            } else {
                if (result.affectedRows > 0) {
                    callback(null, { "result": true });
                } else
                    callback(null, { "result": false });
            }
        });

    });
};

//Update policy_r from user
policy_rModel.updatePolicy_r_GroupAll = function(firewall, idgroup, callback) {

    db.get(function(error, connection) {
        if (error)
            callback(error, null);

        var sql = 'UPDATE ' + tableModel + ' SET ' +
            'idgroup = NULL' + ' ' +
            ' WHERE idgroup = ' + idgroup + " and firewall=" + firewall;

        connection.query(sql, function(error, result) {
            if (error) {
                logger.error(error);
                callback(error, null);
            } else {
                if (result.affectedRows > 0) {
                    callback(null, { "result": true });
                } else
                    callback(null, { "result": false });
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

    db.get(function(error, connection) {
        if (error)
            callback(error, null);
        var sql = 'UPDATE ' + tableModel + ' SET ' +
            'rule_order = rule_order' + increment +
            ' WHERE firewall = ' + connection.escape(idfirewall) +
            ' AND rule_order>=' + order1 + ' AND rule_order<=' + order2 +
            ' AND id<>' + connection.escape(id);
        connection.query(sql);

    });

};


//Remove All policy_r from firewall
policy_rModel.deletePolicy_r_Firewall = function(idfirewall) {
    return new Promise((resolve, reject) => {
        db.get((error, connection) => {
            if (error) return reject(error);

            var sql = 'SELECT  I.*   FROM ' + tableModel + ' I ' +
                ' WHERE (I.firewall=' + connection.escape(idfirewall) + ') ';
            connection.query(sql, (error, rows) => {
                if (error) return reject(error);
                //Bucle por reglas
                Promise.all(rows.map(policy_rModel.deletePolicy_rPro))
                    .then(data => Policy_gModel.deleteFirewallGroups(idfirewall))
                    .then(() => resolve())
                    .catch(error => reject(error));
            });
        });

    });
};

policy_rModel.deletePolicy_rPro = function(data) {
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
policy_rModel.deletePolicy_r = function(idfirewall, id) {
    return new Promise((resolve, reject) => {
        db.get(function(error, connection) {
            if (error)
                reject(error);
            var sqlExists = 'SELECT * FROM ' + tableModel + '  WHERE id = ' + connection.escape(id) + ' AND firewall=' + connection.escape(idfirewall);
            //logger.debug(sqlExists);

            connection.query(sqlExists, function(error, row) {
                //If exists Id from policy_r to remove
                if (row && row.length > 0) {
                    var rule_order = row[0].rule_order;
                    logger.debug("DELETING RULE: " + id + "  Firewall: " + idfirewall + "  ORDER: " + rule_order);
                    //DELETE FROM policy_r__ipobj
                    Policy_r__ipobjModel.deletePolicy_r__All(id, function(error, data) {
                        if (error)
                            reject(error);
                        else {
                            //DELETE FROM policy_r__interface
                            Policy_r__interfaceModel.deletePolicy_r__All(id, function(error, data) {
                                if (error)
                                    reject(error);
                                else {
                                    //DELETE POLICY_C compilation
                                    Policy_cModel.deletePolicy_c(idfirewall, id)
                                        .then(() => {
                                            var sql = 'DELETE FROM ' + tableModel + ' WHERE id = ' + connection.escape(id) + ' AND firewall=' + connection.escape(idfirewall);
                                            connection.query(sql, function(error, result) {
                                                if (error) return reject(error);
                                                if (result.affectedRows > 0) {
                                                    OrderList(999999, idfirewall, rule_order, id);
                                                    resolve({ "result": true, "msg": "deleted" });
                                                } else
                                                    resolve({ "result": false, "msg": "notExist" });
                                            });
                                        })
                                        .catch(error => reject(error));
                                }
                            });
                        }
                    });
                } else {
                    resolve({ "result": false, "msg": "notExist" });
                }
            });
        });
    });
};

var streamModel = require('../stream/stream');

//Compile rule and save it
policy_rModel.compilePolicy_r = function(accessData, callback) {

    var rule = accessData.rule;

    policy_rModel.getPolicy_r_id(rule, (error, data) => {
        if (error) return callback(error, null);
        if (data && data.length > 0) {
            //streamModel.pushMessageCompile(accessData, "COMPILING RULE " + rule + " COMPILATION PROCESS\n");

            RuleCompileModel.get(data[0].fwcloud, data[0].firewall, data[0].type, rule)
                .then(data => {
                    if (data && data.length > 0) {
                        //streamModel.pushMessageCompile(accessData, "RULE " + rule + "  COMPILED\n");
                        //streamModel.pushMessageCompile(accessData, "\n" + data + " \n");
                        //streamModel.pushMessageCompile(accessData, "\nCOMPILATION COMPLETED\n\n");
                        callback(null, { "result": true, "msg": "Rule compiled" });
                    } else {
                        //streamModel.pushMessageCompile(accessData, "ERROR COMPILING RULE " + rule + "\n\n");
                        callback(null, { "result": false, "msg": "CS Empty, rule NOT compiled" });
                    }
                })
                .catch(error => {
                    //streamModel.pushMessageCompile(accessData, "ERROR COMPILING RULE " + rule + "\n\n");
                    callback(null, { "result": false, "msg": "ERROR rule NOT compiled" });
                });
        } else
            callback(null, { "result": false, "msg": "rule Not found, NOT compiled" });
    });
};


policy_rModel.cleanApplyTo = function(idfirewall, callback) {
    db.get(function(error, connection) {
        if (error) callback(error);

        var sql = 'UPDATE ' + tableModel + ' SET fw_apply_to=null WHERE firewall=' + connection.escape(idfirewall);
        connection.query(sql, (error, result) => {
            if (error)
                callback(error, null);
            else
                callback(null, { "result": true });
        });
    });
};

//Update apply_to fields of a cloned cluster to point to the new cluster nodes.
policy_rModel.updateApplyToRules = function(clusterNew, fwNewMaster) {
    return new Promise((resolve, reject) => {
        db.get((error, connection) => {
            if (error) return reject(error);
            let sql = 'select P.id,P.fw_apply_to,(select name from firewall where id=P.fw_apply_to) as name,' + clusterNew + ' as clusterNew FROM ' + tableModel + ' P' +
                ' INNER JOIN firewall F on F.id=P.firewall' +
                ' WHERE P.fw_apply_to is not NULL AND P.firewall=' + connection.escape(fwNewMaster) + ' AND F.cluster=' + connection.escape(clusterNew);
            connection.query(sql, (error, rows) => {
                if (error) return reject(error);
                //Bucle for rules with fw_apply_to defined.
                Promise.all(rows.map(policy_rModel.repointApplyTo))
                    .then(data => resolve(data))
                    .catch(e => reject(e));
            });
        });
    });
};

policy_rModel.repointApplyTo = function(rowData) {
    return new Promise((resolve, reject) => {
        db.get((error, connection) => {
            if (error) return reject(error);

            let sql = 'select id FROM firewall' +
                ' WHERE cluster=' + connection.escape(rowData.clusterNew) + ' AND name=' + connection.escape(rowData.name);
            connection.query(sql, (error, rows) => {
                if (error) return reject(error);

                if (rows.length === 1)
                    sql = 'UPDATE ' + tableModel + ' set fw_apply_to=' + connection.escape(rows[0].id) + ' WHERE id=' + connection.escape(rowData.id);
                else // We have not found the node in the new cluster.
                    sql = 'UPDATE ' + tableModel + ' set fw_apply_to=NULL WHERE id=' + connection.escape(rowData.id);

                connection.query(sql, (error, rows1) => {
                    if (error) return reject(error);
                    resolve(rows1);
                });
            });
        });
    });
};