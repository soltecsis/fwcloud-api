/*
    Copyright 2019 SOLTECSIS SOLUCIONES TECNOLOGICAS, SLU
    https://soltecsis.com
    info@soltecsis.com


    This file is part of FWCloud (https://fwcloud.net).

    FWCloud is free software: you can redistribute it and/or modify
    it under the terms of the GNU Affero General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    FWCloud is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU General Public License for more details.

    You should have received a copy of the GNU General Public License
    along with FWCloud.  If not, see <https://www.gnu.org/licenses/>.
*/


import db from '../../database/database-manager';
import Model from '../Model';
import { Column, PrimaryColumn, Entity, JoinColumn, ManyToOne } from 'typeorm';
import { logger } from '../../fonaments/abstract-application';
import { PolicyRule } from './PolicyRule';
import { Interface } from '../interface/Interface';
import { PolicyPosition } from './PolicyPosition';
const fwcError = require('../../utils/error_table');

var asyncMod = require('async');

const tableName: string = "policy_r__interface";

@Entity(tableName)
export class PolicyRuleToInterface extends Model {

    @PrimaryColumn({name: 'rule'})
    policyRuleId: number;

    @PrimaryColumn({name: 'interface'})
    interfaceId: number;

    @PrimaryColumn({name: 'position'})
    policyPositionId: number;

    @Column()
    position_order: number;

    @Column()
    created_at: Date;

    @Column()
    updated_at: Date;

    @Column()
    created_by: number;

    @Column()
    updated_by: number;

    @ManyToOne(type => Interface, _interface => _interface.policyRuleToInterfaces)
    @JoinColumn({
        name: 'interface'
    })
    policyRuleInterface: Interface;

    @ManyToOne(type => PolicyRule, policyRule => policyRule.policyRuleToInterfaces)
    @JoinColumn({
        name: 'rule'
    })
    policyRule: PolicyRule;

    @ManyToOne(type => PolicyPosition, policyPosition => policyPosition.policyRuleToInterfaces)
    @JoinColumn({
        name: 'position'
    })
    policyPosition: PolicyPosition;

    public getTableName(): string {
        return tableName;
    }

    //Get All policy_r__interface by policy_r
    public static getPolicy_r__interfaces_rule(_interface, callback) {

        db.get((error, connection) => {
            if (error)
                callback(error, null);
            var sql = 'SELECT * FROM ' + tableName + ' WHERE interface = ' + connection.escape(_interface) + ' ORDER by interface_order';
            connection.query(sql, (error, rows) => {
                if (error)
                    callback(error, null);
                else
                    callback(null, rows);
            });
        });
    };

    //Get All policy_r__interface by policy_r
    public static getPolicy_r__interfaces_interface(rule, callback) {

        db.get((error, connection) => {
            if (error)
                callback(error, null);
            var sql = 'SELECT * FROM ' + tableName + ' WHERE rule = ' + connection.escape(rule) + ' ORDER by interface_order';
            connection.query(sql, (error, rows) => {
                if (error)
                    callback(error, null);
                else
                    callback(null, rows);
            });
        });
    };




    //Get policy_r__interface by  rule and  interface
    public static getPolicy_r__interface(_interface, rule, callback) {
        db.get((error, connection) => {
            if (error)
                callback(error, null);
            var sql = 'SELECT * FROM ' + tableName + ' WHERE rule = ' + connection.escape(rule) + ' AND interface = ' + connection.escape(_interface);
            connection.query(sql, (error, row) => {
                if (error)
                    callback(error, null);
                else
                    callback(null, row);
            });
        });
    };



    //Add new policy_r__interface
    public static insertPolicy_r__interface(idfirewall, policy_r__interfaceData): Promise<void> {
        return new Promise((resolve, reject) => {
            //Check if IPOBJ TYPE is ALLOWED in this Position
            this.checkInterfacePosition(idfirewall, policy_r__interfaceData.rule, policy_r__interfaceData.interface, policy_r__interfaceData.position, (error, allowed) => {
                if (error) return reject(error);
                if (!allowed) return reject(fwcError.NOT_ALLOWED);
                db.get((error, connection) => {
                    if (error) return reject(error);
                    connection.query('INSERT INTO ' + tableName + ' SET ?', policy_r__interfaceData, async (error, result) => {
                        if (error) return reject(error);
                        if (result.affectedRows > 0) {
                            try {
                                await this.OrderList(policy_r__interfaceData.position_order, policy_r__interfaceData.rule, policy_r__interfaceData.position, 999999, policy_r__interfaceData.interface);
                            } catch(err) { return reject(err) }
                            
                            resolve();
                        } else reject(fwcError.NOT_FOUND);
                    });
                });
            });
        });
    };

    //Clone policy_r__interface
    public static clonePolicy_r__interface(policy_r__interfaceData) {
        return new Promise((resolve, reject) => {
            var p_interfaceData = {
                rule: policy_r__interfaceData.newrule,
                interface: policy_r__interfaceData.newInterface,
                position: policy_r__interfaceData.position,
                position_order: policy_r__interfaceData.position_order
            };

            db.get((error, connection) => {
                if (error)
                    reject(error);
                connection.query('INSERT INTO ' + tableName + ' SET ?', p_interfaceData, async (error, result) => {
                    if (error) {
                        reject(error);
                    } else {
                        if (result.affectedRows > 0) {
                            this.OrderList(p_interfaceData.position_order, p_interfaceData.rule, p_interfaceData.position, 999999, p_interfaceData.interface);

                            resolve({ "result": true, "allowed": "1" });
                        } else {
                            resolve({ "result": false, "allowed": "1" });
                        }
                    }
                });
            });
        });
    };

    //Duplicate policy_r__interface RULES
    public static duplicatePolicy_r__interface = (dbCon, rule, new_rule): Promise<void> => {
        return new Promise((resolve, reject) => {
            let sql = `INSERT INTO ${tableName} (rule, interface, position,position_order)
			(SELECT ${new_rule}, interface, position, position_order
			from ${tableName} where rule=${rule} order by  position, position_order)`;
            dbCon.query(sql, async (error, result) => {
                if (error) return reject(error);
                resolve();
            });
        });
    };


    //Update policy_r__interface
    public static updatePolicy_r__interface(idfirewall, rule, _interface, old_position, old_position_order, policy_r__interfaceData, callback) {

        //Check if IPOBJ TYPE is ALLOWED in this Position
        this.checkInterfacePosition(idfirewall, policy_r__interfaceData.rule, policy_r__interfaceData.interface, policy_r__interfaceData.position, (error, data) => {
            if (error) {
                callback(error, null);
            } else {
                const allowed = data;
                if (allowed) {

                    db.get((error, connection) => {
                        if (error)
                            callback(error, null);
                        var sql = 'UPDATE ' + tableName + ' SET position = ' + connection.escape(policy_r__interfaceData.position) + ',' +
                            ' WHERE rule = ' + policy_r__interfaceData.rule + ' AND  interface = ' + policy_r__interfaceData.interface;

                        connection.query(sql, async (error, result) => {
                            if (error) {
                                callback(error, null);
                            } else {
                                if (result.affectedRows > 0) {
                                    this.OrderList(policy_r__interfaceData.position_order, rule, null, old_position_order, _interface);
                                    callback(null, { "result": true });
                                } else {
                                    callback(null, { "result": false });
                                }
                            }
                        });
                    });
                }
            }
        });
    };

    //Update policy_r__interface POSITION AND RULE
    public static updatePolicy_r__interface_position(dbCon, idfirewall, rule, _interface, old_position, old_position_order, new_rule, new_position, new_order): Promise<void> {
        return new Promise((resolve, reject) => {
            //Check if IPOBJ TYPE is ALLOWED in this Position
            this.checkInterfacePosition(idfirewall, new_rule, _interface, new_position, (error, allowed) => {
                if (error) return reject(error);
                if (!allowed) return reject(fwcError.NOT_FOUND);

                var sql = `UPDATE ${tableName} SET position=${dbCon.escape(new_position)},
                    rule=${dbCon.escape(new_rule)}, position_order=${dbCon.escape(new_order)}
                    WHERE rule=${rule} AND interface=${_interface} AND position=${dbCon.escape(old_position)}`;
                dbCon.query(sql, async (error, result) => {
                    if (error) return reject(error);
                    if (result.affectedRows > 0) {
                        //Order New position
                        this.OrderList(new_order, new_rule, new_position, 999999, _interface);
                        //Order OLD position
                        this.OrderList(999999, rule, old_position, old_position_order, _interface);

                        resolve();
                    } else reject(fwcError.NOT_FOUND);
                });
            });
        });
    };

    //Update ORDER policy_r__interface
    public static updatePolicy_r__interface_order(rule, _interface, position, old_order, new_order, callback) {

        this.OrderList(new_order, rule, position, old_order, _interface);
        db.get((error, connection) => {
            if (error)
                callback(error, null);
            var sql = 'UPDATE ' + tableName + ' SET ' +
                ' position_order = ' + connection.escape(new_order) + ' ' +
                ' WHERE rule = ' + rule + ' AND  interface = ' + _interface;

            connection.query(sql, async (error, result) => {
                if (error) {
                    callback(error, null);
                } else {
                    callback(null, { "result": true });
                }
            });
        });
    };

    private static OrderList(new_order, rule, position, old_order, _interface) {
        return new Promise((resolve, reject) => {
            var increment = '+1';
            var order1 = new_order;
            var order2 = old_order;
            if (new_order > old_order) {
                increment = '-1';
                order1 = old_order;
                order2 = new_order;
            }

            logger().debug("---> ORDENANDO RULE INTERFACE: " + rule + " POSITION: " + position + "  OLD_ORDER: " + old_order + "  NEW_ORDER: " + new_order);

            db.get((error, connection) => {
                if (error) {
                    reject(error);
                }

                var sql = 'UPDATE ' + tableName + ' SET ' +
                    'position_order = position_order' + increment +
                    ' WHERE rule = ' + connection.escape(rule) + ' AND position=' + connection.escape(position) +
                    ' AND position_order>=' + order1 + ' AND position_order<=' + order2 +
                    ' AND interface<>' + _interface;
                logger().debug(sql);
                connection.query(sql, async (error, result) => {
                    if (error) {
                        reject(error);
                    } else {
                        resolve(result);
                    }
                });

            });
        });
    };

    //Check if a object (type) can be inserted in a position type
    private static checkInterfacePosition(idfirewall, rule, id, position, callback) {
        db.get((error, connection) => {
            if (error) return callback(null, 0);

            let sql = `select A.type from ipobj_type__policy_position A
			inner join interface I on A.type=I.interface_type
			inner join policy_position P on P.id=A.position
			WHERE I.id=${id} AND A.position=${position} AND I.firewall=${idfirewall}`;
            connection.query(sql, (error, rows) => {
                if (error) return callback(error, null);
                callback(null, (rows.length > 0) ? 1 : 0);
            });
        });
    }

    //Remove policy_r__interface with id to remove
    public static deletePolicy_r__interface(dbCon, rule, _interface, position, old_order, callback): Promise<void> {
        return new Promise((resolve, reject) => {
            var sqlExists = `SELECT * FROM ${tableName} 
                WHERE rule=${dbCon.escape(rule)} AND  interface=${dbCon.escape(_interface)}
                AND position=${dbCon.escape(position)}`;
            dbCon.query(sqlExists, (error, row) => {
                //If exists Id from policy_r__interface to remove
                if (row) {
                    db.get(async (error, connection) => {
                        var sql = `DELETE FROM ${tableName}
                            WHERE rule=${connection.escape(rule)} 
                            AND interface=${connection.escape(_interface)} 
                            AND position=${connection.escape(position)}`;
                        connection.query(sql, async (error, result) => {
                            if (error) return reject(error);
                            if (result.affectedRows > 0) {
                                this.OrderList(999999, rule, position, old_order, _interface);
                                resolve();
                            } else reject(fwcError.NOT_FOUND);
                        });
                    });
                } else reject(fwcError.NOT_FOUND);
            });
        });
    };

    //Remove policy_r__interface with id to remove
    public static deletePolicy_r__All(rule, callback) {

        db.get((error, connection) => {
            if (error)
                callback(error, null);
            var sqlExists = 'SELECT * FROM ' + tableName + ' WHERE rule = ' + connection.escape(rule);
            connection.query(sqlExists, (error, row) => {
                //If exists Id from policy_r__interface to remove
                if (row) {
                    logger().debug("DELETING INTERFACES FROM RULE: " + rule);
                    db.get(async (error, connection) => {
                        var sql = 'DELETE FROM ' + tableName + ' WHERE rule = ' + connection.escape(rule);
                        connection.query(sql, async (error, result) => {
                            if (error) {
                                logger().debug(error);
                                callback(error, null);
                            } else {
                                if (result.affectedRows > 0) {
                                    callback(null, { "result": true, "msg": "deleted" });
                                } else {
                                    callback(null, { "result": false });
                                }
                            }
                        });
                    });
                } else {
                    callback(null, { "result": false });
                }
            });
        });
    };

    //Order policy_r__interfaces Position
    public static orderPolicyPosition(rule, position, callback) {

        logger().debug("DENTRO ORDER   Rule: " + rule + '  Position: ' + position);

        db.get((error, connection) => {
            if (error)
                callback(error, null);
            var sqlPos = 'SELECT * FROM ' + tableName + ' WHERE rule = ' + connection.escape(rule) + ' AND position= ' + connection.escape(position) + ' order by position_order';
            //logger().debug(sqlPos);
            connection.query(sqlPos, (error, rows) => {
                if (rows.length > 0) {
                    var order = 0;
                    asyncMod.map(rows, (row, callback1) => {
                        order++;
                        db.get((error, connection) => {
                            const sql = 'UPDATE ' + tableName + ' SET position_order=' + order +
                                ' WHERE rule = ' + connection.escape(row.rule) +
                                ' AND position=' + connection.escape(row.position) +
                                ' AND interface=' + connection.escape(row.interface);
                            //logger().debug(sql);
                            connection.query(sql, async (error, result) => {
                                if (error) {
                                    callback1();
                                } else {
                                    callback1();
                                }
                            });
                        });
                    }, //Fin de bucle
                        function (err) {
                            callback(null, { "result": true });
                        }

                    );

                } else {
                    callback(null, { "result": false });
                }
            });
        });
    };

    //Order policy_r__interfaces Position
    public static orderPolicy(rule, callback) {


        db.get((error, connection) => {
            if (error)
                callback(error, null);
            var sqlRule = 'SELECT * FROM ' + tableName + ' WHERE rule = ' + connection.escape(rule) + ' order by position, position_order';
            //logger().debug(sqlRule);
            connection.query(sqlRule, (error, rows) => {
                if (rows.length > 0) {
                    var order = 0;
                    var prev_position = 0;
                    asyncMod.map(rows, (row, callback1) => {
                        var position = row.position;
                        if (position !== prev_position) {
                            order = 1;
                            prev_position = position;
                        } else
                            order++;

                        db.get((error, connection) => {
                            const sql = 'UPDATE ' + tableName + ' SET position_order=' + order +
                                ' WHERE rule = ' + connection.escape(row.rule) +
                                ' AND position=' + connection.escape(row.position) +
                                ' AND interface=' + connection.escape(row.interface);
                            //logger().debug(sql);
                            connection.query(sql, async (error, result) => {
                                if (error) {
                                    callback1();
                                } else {
                                    callback1();
                                }
                            });
                        });
                    }, //Fin de bucle
                        function (err) {
                            callback(null, { "result": true });
                        }

                    );

                } else {
                    callback(null, { "result": false });
                }
            });
        });
    };

    //Order policy_r__interfaces Position
    public static orderAllPolicy(callback) {


        db.get((error, connection) => {
            if (error)
                callback(error, null);
            var sqlRule = 'SELECT * FROM ' + tableName + ' ORDER by rule,position, position_order';
            //logger().debug(sqlRule);
            connection.query(sqlRule, (error, rows) => {
                if (rows.length > 0) {
                    var order = 0;
                    var prev_rule = 0;
                    var prev_position = 0;
                    asyncMod.map(rows, (row, callback1) => {
                        var position = row.position;
                        var rule = row.rule;
                        if (position !== prev_position || rule !== prev_rule) {
                            order = 1;
                            prev_rule = rule;
                            prev_position = position;
                        } else
                            order++;

                        db.get((error, connection) => {
                            const sql = 'UPDATE ' + tableName + ' SET position_order=' + order +
                                ' WHERE rule = ' + connection.escape(row.rule) +
                                ' AND position=' + connection.escape(row.position) +
                                ' AND interface=' + connection.escape(row.interface);
                            //logger().debug(sql);
                            connection.query(sql, async (error, result) => {
                                if (error) {
                                    callback1();
                                } else {
                                    callback1();
                                }
                            });
                        });
                    }, //Fin de bucle
                        function (err) {
                            logger().debug("FIN De BUCLE");
                            callback(null, { "result": true });
                        }

                    );

                } else {
                    callback(null, { "result": false });
                }
            });
        });
    };


    //check if INTERFACE Exists in any rule
    public static checkInterfaceInRule(_interface, type, fwcloud, callback) {

        logger().debug("CHECK DELETING interface I POSITIONS:" + _interface + " Type:" + type + "  fwcloud:" + fwcloud);
        db.get((error, connection) => {
            if (error)
                callback(error, null);
            var sql = 'SELECT count(*) as n FROM ' + tableName + ' O INNER JOIN policy_r R on R.id=O.rule ' +
                ' INNER JOIN firewall F on F.id=R.firewall ' +
                ' INNER JOIN fwcloud C on C.id=F.fwcloud ' +
                ' inner join interface I on I.id=O.interface ' +
                ' WHERE I.id=' + connection.escape(_interface) + ' AND I.interface_type=' + connection.escape(type) +
                ' AND C.id=' + connection.escape(fwcloud);
            //logger().debug(sql);
            connection.query(sql, (error, rows) => {
                if (!error) {
                    if (rows.length > 0) {
                        if (rows[0].n > 0) {
                            logger().debug("ALERT DELETING interface IN RULE:" + _interface + " type: " + type + " fwcloud:" + fwcloud + " --> FOUND IN " + rows[0].n + " RULES");
                            callback(null, { "result": true });
                        } else {
                            callback(null, { "result": false });
                        }
                    } else {
                        callback(null, { "result": false });
                    }
                } else
                    callback(null, { "result": false });
            });
        });
    };

    //check if HOST ALL INTERFACEs Exists in any rule
    public static checkHostAllInterfacesInRule(ipobj_host, fwcloud, callback) {

        logger().debug("CHECK DELETING HOST ALL interfaces I POSITIONS:" + ipobj_host + "  fwcloud:" + fwcloud);
        db.get((error, connection) => {
            if (error)
                callback(error, null);
            var sql = 'SELECT count(*) as n FROM ' + tableName + ' O ' +
                ' inner join interface__ipobj J on J.interface=O.interface  ' +
                ' INNER JOIN policy_r R on R.id=O.rule ' +
                ' INNER JOIN firewall F on F.id=R.firewall ' +
                ' inner join fwcloud C on C.id=F.fwcloud ' +
                ' WHERE J.ipobj=' + connection.escape(ipobj_host) + ' AND C.id=' + connection.escape(fwcloud);
            //logger().debug(sql);
            connection.query(sql, (error, rows) => {
                if (!error) {
                    if (rows.length > 0) {
                        if (rows[0].n > 0) {
                            logger().debug("ALERT DELETING HOST ALL interfaces IN RULE:" + ipobj_host + " fwcloud:" + fwcloud + " --> FOUND IN " + rows[0].n + " RULES");
                            callback(null, { "result": true });
                        } else {
                            callback(null, { "result": false });
                        }
                    } else {
                        callback(null, { "result": false });
                    }
                } else
                    callback(null, { "result": false });
            });
        });
    };


    //search if INTERFACE Exists in any rule I POSITIONS
    public static SearchInterfaceInRules = (_interface, type, fwcloud, firewall, diff_firewall) => {
        return new Promise((resolve, reject) => {
            db.get((error, connection) => {
                if (error) return reject(error);
                let sql = "";
                if (firewall === null) {
                    //Search interfaces in all Firewalls from Cloud
                    sql = `SELECT O.interface obj_id,I.name obj_name, I.interface_type obj_type_id,T.type obj_type_name,
					C.id cloud_id, C.name cloud_name, R.firewall firewall_id, F.name firewall_name ,O.rule rule_id, R.rule_order,R.type rule_type,
					PT.name rule_type_name,O.position rule_position_id,  P.name rule_position_name,R.comment rule_comment,
					F.cluster as cluster_id, IF(F.cluster is null,null,(select name from cluster where id=F.cluster)) as cluster_name
					FROM policy_r__interface O
					INNER JOIN policy_r R on R.id=O.rule
					INNER JOIN firewall F on F.id=R.firewall
					INNEr JOIN interface I on I.id=O.interface
					inner join ipobj_type T on T.id=I.interface_type
					inner join policy_position P on P.id=O.position
					inner join policy_type PT on PT.id=R.type
					inner join fwcloud C on C.id=F.fwcloud
					WHERE I.id=${_interface} AND I.interface_type=${type} AND C.id=${fwcloud}`;
                    if (diff_firewall)
                        sql += ` AND F.id<>${diff_firewall}`;
                } else {
                    //Search interfaces only in Firewall interface
                    sql = `SELECT O.interface obj_id,I.name obj_name, I.interface_type obj_type_id,T.type obj_type_name,
					C.id cloud_id, C.name cloud_name, R.firewall firewall_id, F.name firewall_name ,O.rule rule_id, R.rule_order,R.type rule_type,
					PT.name rule_type_name,O.position rule_position_id,  P.name rule_position_name,R.comment rule_comment,
					F.cluster as cluster_id, IF(F.cluster is null,null,(select name from cluster where id=F.cluster)) as cluster_name
					FROM policy_r__interface O
					INNER JOIN policy_r R on R.id=O.rule
					INNER JOIN firewall F on F.id=R.firewall
					INNEr JOIN interface I on I.id=O.interface
					inner join ipobj_type T on T.id=I.interface_type
					inner join policy_position P on P.id=O.position
					inner join policy_type PT on PT.id=R.type
					inner join fwcloud C on C.id=F.fwcloud
					WHERE I.id=${_interface} AND I.interface_type=${type} AND C.id=${fwcloud}`;
                    if (diff_firewall)
                        sql += ` AND F.id<>${diff_firewall}`;
                    else
                        sql += ` AND F.id=${firewall}`;
                }
                connection.query(sql, (error, rows) => {
                    if (error) return reject(error);
                    resolve(rows);
                });
            });
        });
    };


    public static interfaceAlreadyInRulePosition = (dbCon, fwcloud, firewall, rule, position, _interface) => {
        return new Promise((resolve, reject) => {
            let sql = `SELECT O.rule FROM ${tableName} O 
                INNER JOIN policy_r R on R.id=O.rule
                INNER JOIN firewall F on F.id=R.firewall
                INNER JOIN fwcloud C on C.id=F.fwcloud
                WHERE O.rule=${dbCon.escape(rule)} AND O.position=${dbCon.escape(position)} AND O.interface=${dbCon.escape(_interface)} 
                AND F.id=${dbCon.escape(firewall)} AND C.id=${dbCon.escape(fwcloud)}`;

            dbCon.query(sql, (error, rows) => {
                if (error) return reject(error);
                resolve(rows.length === 0 ? false : true);
            });

        });
    };

}


