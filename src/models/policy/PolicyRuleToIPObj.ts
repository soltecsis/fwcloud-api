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
import { Interface } from '../../models/interface/Interface';
import { IPObjGroup } from '../../models/ipobj/IPObjGroup';
import { PolicyRule } from '../../models/policy/PolicyRule';
import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, JoinColumn, getRepository } from 'typeorm';
import { logger } from '../../fonaments/abstract-application';
import { PolicyPosition } from './PolicyPosition';
import { RulePositionsMap } from '../../models/policy/PolicyPosition';
import { IPObj } from '../ipobj/IPObj';
var asyncMod = require('async');
const fwcError = require('../../utils/error_table');

const tableModel: string = "policy_r__ipobj";

@Entity(tableModel)
export class PolicyRuleToIPObj extends Model {

    @PrimaryGeneratedColumn({name: 'id_pi'})
    id: number;

    @Column({name: 'rule'})
    policyRuleId: number;

    @Column({name: 'ipobj'})
    ipObjId: number;

    @Column({name: 'ipobj_g'})
    ipObjGroupId: number;

    @Column({name: 'interface'})
    interfaceId: number;

    @Column({name: 'position'})
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
    
    @ManyToOne(type => PolicyRule, policyRule => policyRule.policyRuleToIPObjs)
    @JoinColumn({
        name: 'rule'
    })
    policyRule: PolicyRule;

    @ManyToOne(type => IPObj, ipObj => ipObj.policyRuleToIPObjs)
    @JoinColumn({
        name: 'ipobj'
    })
    ipObj: IPObj;

    @ManyToOne(type => Interface, model => model.policyRuleToIPObjs)
    @JoinColumn({
        name: 'interface'
    })
    interface: Interface;
    
    @ManyToOne(type => IPObjGroup, model => model.policyRuleToIPObjs)
    @JoinColumn({
        name: 'ipobj_g'
    })
    ipObjGroup: IPObjGroup;
    

    @ManyToOne(type => PolicyPosition, policyPosition => policyPosition.policyRuleToIPObjs)
    @JoinColumn({
        name: 'position'
    })
    policyPosition: PolicyPosition;

    public getTableName(): string {
        return tableModel;
    }

    //Get All policy_r__ipobj by Policy_r (rule)
    public static getPolicy_r__ipobjs(rule, callback) {

        db.get((error, connection) => {
            if (error)
                callback(error, null);

            var sql = 'SELECT * FROM ' + tableModel + ' WHERE rule=' + connection.escape(rule) + ' ORDER BY position_order';

            connection.query(sql, (error, rows) => {
                if (error)
                    callback(error, null);
                else
                    callback(null, rows);
            });
        });

    };

    //Get All policy_r__ipobj by Policy_r (rule) and position
    public static getRuleIPObjsByPosition(rule, position) {
        return new Promise((resolve, reject) => {
            db.get((error, connection) => {
                if (error) return reject(error);

                let sql = `SELECT * FROM ${tableModel} 
                    WHERE rule=${connection.escape(rule)} AND position=${connection.escape(position)}
                    ORDER BY position_order`;

                connection.query(sql, (error, rows) => {
                    if (error) return reject(error);
                    resolve(rows);
                });
            });
        });
    };

    //Get All policy_r__ipobj by Policy_r (rule) and position
    public static getPolicy_r__ipobjs_position_data(rule, position, callback) {

        db.get((error, connection) => {
            if (error)
                callback(error, null);

            var sql_obj = " INNER JOIN ipobj O on O.id=P.ipobj ";
            var sql = 'SELECT * FROM ' + tableModel + ' P ' + sql_obj + ' WHERE P.rule=' + connection.escape(rule) + ' AND P.position=' + connection.escape(position) + ' ORDER BY P.position_order';
            logger().debug(sql);
            connection.query(sql, (error, rows) => {
                if (error)
                    callback(error, null);
                else
                    callback(null, rows);
            });
        });

    };

    //Get  policy_r__ipobj by primarykey
    public static getPolicy_r__ipobj(rule, ipobj, ipobj_g, _interface, position, callback) {

        db.get((error, connection) => {
            if (error)
                callback(error, null);

            var sql = 'SELECT * FROM ' + tableModel +
                ' WHERE rule = ' + connection.escape(rule) + ' AND ipobj=' + connection.escape(ipobj) +
                ' AND ipobj_g=' + connection.escape(ipobj_g) + ' AND position=' + connection.escape(position) +
                ' ORDER BY position_order';

            connection.query(sql, (error, rows) => {
                if (error)
                    callback(error, null);
                else
                    callback(null, rows);
            });
        });
    };

    //Verify that the object is not already present in the destination position. 
    public static checkExistsInPosition = (policy_r__ipobjData) => {
        return new Promise((resolve, reject) => {
            db.get((error, connection) => {
                if (error) return reject(error);
                // First verify that the object is not already in the position.
                var sql = 'SELECT id_pi FROM ' + tableModel +
                    ' WHERE rule=' + connection.escape(policy_r__ipobjData.rule) + ' AND ipobj=' + connection.escape(policy_r__ipobjData.ipobj) +
                    ' AND ipobj_g=' + connection.escape(policy_r__ipobjData.ipobj_g) + ' AND interface=' + connection.escape(policy_r__ipobjData.interface) +
                    ' AND position=' + connection.escape(policy_r__ipobjData.position);
                connection.query(sql, (error, rows) => {
                    if (error) return reject(error);
                    if (rows.length > 0) return resolve(true);

                    // If the new object is a group, then return.
                    if (policy_r__ipobjData.ipobj_g != -1) return resolve(false);

                    // It the new object is an interface verify that its host is not in the same rule position.
                    if (policy_r__ipobjData.interface != -1) {
                        // Search if the new interface is contained in a host.
                        sql = 'SELECT PR.id_pi FROM ' + tableModel + ' PR' +
                            ' INNER JOIN ipobj IPO ON IPO.id=PR.ipobj' +
                            ' INNER JOIN interface__ipobj II ON II.ipobj=IPO.id' +
                            ' WHERE IPO.type=8 AND PR.rule=' + connection.escape(policy_r__ipobjData.rule) + ' AND PR.position=' + connection.escape(policy_r__ipobjData.position) +
                            ' AND II.interface=' + connection.escape(policy_r__ipobjData.interface);
                        connection.query(sql, (error, rows) => {
                            if (error) return reject(error);
                            if (rows.length > 0) return resolve(true);

                            // Search if the new interface is contained in a host that is part of a group that exist in the rule position.
                            sql = 'SELECT PR.id_pi FROM ' + tableModel + ' PR' +
                                ' INNER JOIN ipobj__ipobjg IG ON IG.ipobj_g=PR.ipobj_g' +
                                ' INNER JOIN ipobj IPO ON IPO.id=IG.ipobj' +
                                ' INNER JOIN interface__ipobj II ON II.ipobj=IPO.id' +
                                ' WHERE IPO.type=8 AND PR.rule=' + connection.escape(policy_r__ipobjData.rule) + ' AND PR.position=' + connection.escape(policy_r__ipobjData.position) +
                                ' AND II.interface=' + connection.escape(policy_r__ipobjData.interface);
                            connection.query(sql, (error, rows) => {
                                if (error) return reject(error);
                                if (rows.length > 0) return resolve(true);

                                /* Falta el código para detectar si en la posición de la regla existe algún grupo
                                que contenga a la interfaz que estamos arrastrando. */

                                resolve(false);
                            });
                        });
                    } else {
                        // Search if the new object is contained in a group.
                        sql = 'SELECT PR.id_pi FROM ' + tableModel + ' PR' +
                            ' INNER JOIN ipobj__ipobjg IG ON IG.ipobj_g=PR.ipobj_g' +
                            ' WHERE PR.rule=' + connection.escape(policy_r__ipobjData.rule) + ' AND PR.position=' + connection.escape(policy_r__ipobjData.position) +
                            ' AND IG.ipobj=' + connection.escape(policy_r__ipobjData.ipobj);
                        connection.query(sql, (error, rows) => {
                            if (error) return reject(error);
                            if (rows.length > 0) return resolve(true);

                            // Search if the new object is an address that is contained in an interface.
                            sql = 'SELECT PR.id_pi FROM ' + tableModel + ' PR' +
                                ' INNER JOIN ipobj IPO ON IPO.interface=PR.interface' +
                                ' WHERE IPO.type=5 AND PR.rule=' + connection.escape(policy_r__ipobjData.rule) + ' AND PR.position=' + connection.escape(policy_r__ipobjData.position) +
                                ' AND IPO.id=' + connection.escape(policy_r__ipobjData.ipobj);
                            connection.query(sql, (error, rows) => {
                                if (error) return reject(error);
                                if (rows.length > 0) return resolve(true);

                                // Search if the new object is and address that is contained in an interface that is part of a host.
                                sql = 'SELECT PR.id_pi FROM ' + tableModel + ' PR' +
                                    ' INNER JOIN ipobj IPO ON IPO.id=PR.ipobj' +
                                    ' INNER JOIN interface__ipobj II ON II.ipobj=IPO.id' +
                                    ' INNER JOIN ipobj IPO2 ON IPO2.interface=II.interface' +
                                    ' WHERE IPO.type=8 AND IPO2.type=5 AND PR.rule=' + connection.escape(policy_r__ipobjData.rule) + ' AND PR.position=' + connection.escape(policy_r__ipobjData.position) +
                                    ' AND IPO2.id=' + connection.escape(policy_r__ipobjData.ipobj);
                                connection.query(sql, (error, rows) => {
                                    if (error) return reject(error);
                                    if (rows.length > 0) return resolve(true);

                                    // Search if the new object is and address that is contained in an interface that is part of a host that is 
                                    // contained in a group.
                                    sql = 'SELECT PR.id_pi FROM ' + tableModel + ' PR' +
                                        ' INNER JOIN ipobj__ipobjg IG ON IG.ipobj_g=PR.ipobj_g' +
                                        ' INNER JOIN ipobj IPO ON IPO.id=IG.ipobj' +
                                        ' INNER JOIN interface__ipobj II ON II.ipobj=IPO.id' +
                                        ' INNER JOIN ipobj IPO2 ON IPO2.interface=II.interface' +
                                        ' WHERE IPO.type=8 AND IPO2.type=5 AND PR.rule=' + connection.escape(policy_r__ipobjData.rule) + ' AND PR.position=' + connection.escape(policy_r__ipobjData.position) +
                                        ' AND IPO2.id=' + connection.escape(policy_r__ipobjData.ipobj);
                                    connection.query(sql, (error, rows) => {
                                        if (error) return reject(error);
                                        if (rows.length > 0) return resolve(true);
                                        resolve(false);
                                    });
                                });
                            });
                        });
                    }
                });
            });
        });
    }

    //Check if group is empty.
    public static isGroupEmpty = (dbCon, group) => {
        return new Promise((resolve, reject) => {
            let sql = `select ipobj as id from ipobj__ipobjg where ipobj_g=${group}
			union select openvpn as id from openvpn__ipobj_g where ipobj_g=${group}
			union select prefix as id from openvpn_prefix__ipobj_g where ipobj_g=${group}`;
            dbCon.query(sql, (error, result) => {
                if (error) return reject(error);

                if (result.length === 0) return resolve(true);
                resolve(false);
            });
        });
    };


    // Verify that the object we are moving to the rule is not an empty object container.
    public static emptyIpobjContainerToObjectPosition(req) {
        return new Promise((resolve, reject) => {
            // First we need the object type and the content type of the rule position.
            let sql = `select content,
			${(req.body.ipobj > 0) ? `(select type from ipobj where id=${req.body.ipobj}) as type` : ``}
			${(req.body.interface > 0) ? `(select type from interface where id=${req.body.interface}) as type` : ``}
			${(req.body.ipobj_g > 0) ? `(select type from ipobj_g where id=${req.body.ipobj_g}) as type` : ``}
			from policy_position where id=${req.body.position}`;
            req.dbCon.query(sql, async (error, rows) => {
                if (error) return reject(error);

                // We are not moving to a object (O) content position.
                // We can move empty interfaces (without addresses) to a interface (I) content position.
                if (rows[0].content !== 'O') return resolve(false);

                try {
                    const rule_ip_version = await PolicyRule.getPolicyRuleIPversion(req.dbCon, req.body.fwcloud, req.body.firewall, req.body.rule);

                    let type = parseInt(rows[0].type);
                    if (type === 10 || type === 11) { // 10 = INTERFACE FIREWALL, 11 = INTERFACE HOST
                        let addrs: any = await Interface.getInterfaceAddr(req.dbCon, req.body.interface);
                        let n = 0;
                        for (let addr of addrs) { // Count the amount of interface address with the same IP version of the rule.
                            if (parseInt(addr.ip_version) === rule_ip_version) n++;
                        }
                        if (n === 0) return resolve(true);
                    }
                    else if (type === 8) { // 8 = HOST
                        let addrs: any = await Interface.getHostAddr(req.dbCon, req.body.ipobj);
                        let n = 0;
                        for (let addr of addrs) { // Count the amount of interface address with the same IP version of the rule.
                            if (parseInt(addr.ip_version) === rule_ip_version) n++;
                        }
                        if (n === 0) return resolve(true);
                    }
                    else if ((type === 20 || type === 21) && (await this.isGroupEmpty(req.dbCon, req.body.ipobj_g))) // 20 = GROUP OBJECTS, 21 = GROUP SERVICES
                        return resolve(true);
                } catch (error) { return reject(error) }

                resolve(false);
            });
        });
    }


    //Add new policy_r__ipobj 
    public static insertPolicy_r__ipobj(policy_r__ipobjData) {
        return new Promise((resolve, reject) => {
            //Check if IPOBJ TYPE is ALLOWED in this Position  ONLY 'O' POSITIONS
            this.checkIpobjPosition(policy_r__ipobjData.ipobj, policy_r__ipobjData.ipobj_g, policy_r__ipobjData.interface, policy_r__ipobjData.position, (error, allowed) => {
                if (error) return reject(error);
                if (!allowed) return reject(fwcError.NOT_ALLOWED);
                db.get((error, connection) => {
                    if (error) return reject(error);

                    connection.query(`INSERT INTO ${tableModel} SET ?`, policy_r__ipobjData, async (error, result) => {
                        if (error) return reject(error);
                        if (result.affectedRows > 0) {
                            this.OrderList(policy_r__ipobjData.position_order, policy_r__ipobjData.rule, policy_r__ipobjData.position, 999999, policy_r__ipobjData.ipobj, policy_r__ipobjData.ipobj_g, policy_r__ipobjData.interface);
                            resolve();
                        } else reject(fwcError.NOT_ALLOWED);
                    });
                });
            });
        });
    };

    //Clone policy_r__ipobj 
    public static clonePolicy_r__ipobj(policy_r__ipobjData) {
        return new Promise((resolve, reject) => {
            logger().debug("policy_r__ipobjData: ", policy_r__ipobjData);
            var newfirewall = policy_r__ipobjData.newfirewall;
            var p_ipobjData = {
                rule: policy_r__ipobjData.newrule,
                ipobj: policy_r__ipobjData.ipobj,
                ipobj_g: policy_r__ipobjData.ipobj_g,
                interface: policy_r__ipobjData.interface,
                position: policy_r__ipobjData.position,
                position_order: policy_r__ipobjData.position_order
            };
            db.get((error, connection) => {
                if (error)
                    reject(error);
                if (p_ipobjData.interface !== -1) {
                    var sqlI = 'select id from interface where id=' + policy_r__ipobjData.interface + ' AND firewall= ' + newfirewall;
                    logger().debug("--------- >>>> SQL INTERFACE OTHER: ", sqlI);
                    connection.query(sqlI, (error, result) => {
                        if (result && result.length > 0) {
                            p_ipobjData.interface = result[0].id;
                            this.cloneInsertPolicy_r__ipobj(p_ipobjData)
                                .then((resp: any) => {
                                    resolve({ "result": resp.result });
                                });

                        }
                        else {
                            this.cloneInsertPolicy_r__ipobj(p_ipobjData)
                                .then((resp:any) => {
                                    resolve({ "result": resp.result });
                                });
                        }
                    });
                }
                else if (p_ipobjData.ipobj !== -1) {
                    var sqlI = 'select O.id from ipobj O inner join interface I on I.id=O.interface ' +
                        ' where O.id=' + policy_r__ipobjData.ipobj + ' AND I.firewall= ' + newfirewall;
                    logger().debug("--------- >>>> SQL IPOBJ OTHER: ", sqlI);
                    connection.query(sqlI, (error, result) => {
                        if (result && result.length > 0) {
                            p_ipobjData.ipobj = result[0].id;
                            this.cloneInsertPolicy_r__ipobj(p_ipobjData)
                                .then((resp: any) => {
                                    resolve({ "result": resp.result });
                                });

                        }
                        else {
                            this.cloneInsertPolicy_r__ipobj(p_ipobjData)
                                .then((resp:any) => {
                                    resolve({ "result": resp.result });
                                });
                        }
                    });
                }
                else {
                    this.cloneInsertPolicy_r__ipobj(p_ipobjData)
                        .then((resp:any) => {
                            resolve({ "result": resp.result });
                        });
                }

            });
        });
    };

    public static cloneInsertPolicy_r__ipobj(p_ipobjData) {
        return new Promise((resolve, reject) => {
            db.get((error, connection) => {
                if (error)
                    reject(error);
                connection.query('INSERT INTO ' + tableModel + ' SET ?', p_ipobjData, async (error, result) => {
                    if (error) {
                        logger().debug(error);
                        resolve({ "result": false, "allowed": 1 });
                    } else {
                        if (result.affectedRows > 0) {
                            this.OrderList(p_ipobjData.position_order, p_ipobjData.rule, p_ipobjData.position, 999999, p_ipobjData.ipobj, p_ipobjData.ipobj_g, p_ipobjData.interface);
                            resolve({ "result": true });
                        } else {
                            resolve({ "result": false });
                        }
                    }
                });
            });
        });
    };
    //Duplicate policy_r__ipobj RULES
    public static duplicatePolicy_r__ipobj = (dbCon, rule, new_rule) => {
        return new Promise((resolve, reject) => {
            let sql = `INSERT INTO ${tableModel} (rule, ipobj, ipobj_g, interface, position, position_order)
			(SELECT ${new_rule}, ipobj, ipobj_g, interface, position, position_order
			from ${tableModel} where rule=${rule} order by  position, position_order)`;
            dbCon.query(sql, async (error, result) => {
                if (error) return reject(error);
                resolve();
            });
        });
    };

    //Update policy_r__ipobj
    public static updatePolicy_r__ipobj(rule, ipobj, ipobj_g, _interface, position, position_order, policy_r__ipobjData, callback) {
        //Check if IPOBJ TYPE is ALLOWED in this Position
        //checkIpobjPosition(rule, ipobj, ipobj_g, interface, position, callback) {
        this.checkIpobjPosition(policy_r__ipobjData.ipobj, null, policy_r__ipobjData.interface, policy_r__ipobjData.position, (error, data) => {
            if (error) {
                callback(error, null);
            } else {
                const allowed = data;
                if (allowed) {
                    db.get((error, connection) => {
                        if (error)
                            callback(error, null);
                        var sql = 'UPDATE ' + tableModel + ' SET ' +
                            'rule = ' + connection.escape(policy_r__ipobjData.rule) + ',' +
                            'ipobj = ' + connection.escape(policy_r__ipobjData.ipobj) + ',' +
                            'ipobj_g = ' + connection.escape(policy_r__ipobjData.ipobj_g) + ',' +
                            'interface = ' + connection.escape(policy_r__ipobjData.interface) + ',' +
                            'position = ' + connection.escape(policy_r__ipobjData.position) + ',' +
                            'position_order = ' + connection.escape(policy_r__ipobjData.position_order) + ', ' +
                            ' WHERE rule = ' + connection.escape(rule) + ' AND ipobj=' + connection.escape(ipobj) +
                            ' AND ipobj_g=' + connection.escape(ipobj_g) + ' AND position=' + connection.escape(position) +
                            ' AND interface=' + connection.escape(_interface);
                        connection.query(sql, async (error, result) => {
                            if (error) {
                                callback(error, null);
                            } else {
                                if (result.affectedRows > 0) {
                                    if (position !== policy_r__ipobjData.position) {
                                        //ordenamos posicion antigua
                                        this.OrderList(999999, rule, position, position_order, ipobj, ipobj_g, _interface);
                                        //ordenamos posicion nueva
                                        this.OrderList(policy_r__ipobjData.position_order, policy_r__ipobjData.rule, policy_r__ipobjData.position, 999999, ipobj, ipobj_g, _interface);
                                    } else
                                        this.OrderList(policy_r__ipobjData.position_order, rule, position, position_order, ipobj, ipobj_g, _interface);
                                    callback(null, { "result": true, "allowed": 1 });
                                } else {
                                    callback(null, { "result": false, "allowed": 1 });
                                }
                            }
                        });
                    });
                } else {
                    callback(null, { "result": false, "allowed": 0 });
                }
            }
        });
    };
    //Update policy_r__ipobj Position ORDER
    public static updatePolicy_r__ipobj_position_order(rule, ipobj, ipobj_g, _interface, position, position_order, new_order, callback) {


        db.get((error, connection) => {
            if (error)
                callback(error, null);
            var sql = 'UPDATE ' + tableModel + ' SET ' +
                'position_order = ' + connection.escape(new_order) + ' ' +
                ' WHERE rule = ' + connection.escape(rule) + ' AND ipobj=' + connection.escape(ipobj) +
                ' AND ipobj_g=' + connection.escape(ipobj_g) + ' AND position=' + connection.escape(position) +
                ' AND interface=' + connection.escape(_interface);
            connection.query(sql, async (error, result) => {
                if (error) {
                    callback(error, null);
                } else {
                    if (result.affectedRows > 0) {
                        this.OrderList(new_order, rule, position, position_order, ipobj, ipobj_g, _interface);
                        callback(null, { "result": true });
                    } else {
                        callback(null, { "result": false });
                    }
                }
            });
        });
    };
    //Update policy_r__ipobj POSITION
    //When Update position we order New and Old POSITION
    public static updatePolicy_r__ipobj_position(dbCon, rule, ipobj, ipobj_g, _interface, position, position_order, new_rule, new_position, new_order) {
        return new Promise((resolve, reject) => {
            //Check if IPOBJ TYPE is ALLOWED in this Position    
            this.checkIpobjPosition(ipobj, ipobj_g, _interface, new_position, (error, data) => {
                if (error) return reject(error);
                if (!data) return reject(fwcError.NOT_ALLOWED);

                var sql = `UPDATE ${tableModel} SET
                    rule=${dbCon.escape(new_rule)}, position=${dbCon.escape(new_position)}, 
                    position_order=${dbCon.escape(new_order)}
                    WHERE rule=${dbCon.escape(rule)} AND ipobj=${dbCon.escape(ipobj)}
                    AND ipobj_g=${dbCon.escape(ipobj_g)} AND position=${dbCon.escape(position)}
                    AND interface=${dbCon.escape(_interface)}`;
                dbCon.query(sql, async (error, result) => {
                    if (error) return reject(error);

                    if (result.affectedRows > 0) {
                        //Order New position
                        this.OrderList(new_order, new_rule, new_position, 999999, ipobj, ipobj_g, _interface);
                        //Order Old position
                        this.OrderList(999999, rule, position, position_order, ipobj, ipobj_g, _interface);
                        resolve();
                    } else reject(fwcError.NOT_FOUND);
                });
            });
        });
    };

    private static async OrderList(new_order, rule, position, old_order, ipobj, ipobj_g, _interface) {

        return new Promise<any>((resolve, reject) => {
            var increment = '+1';
            var order1 = new_order;
            var order2 = old_order;
            if (new_order > old_order) {
                increment = '-1';
                order1 = old_order;
                order2 = new_order;
            }
            logger().debug("---> ORDENANDO RULE : " + rule + " IPOBJ:" + ipobj + " Interface:" + _interface + " IPOBJ_G:" + ipobj_g + "  POSITION: " + position + "  OLD_ORDER: " + old_order + "  NEW_ORDER: " + new_order);
            let sql_obj = '';
            if (ipobj > 0)
                sql_obj = ' AND ipobj<>' + ipobj;
            else if (_interface > 0)
                sql_obj = ' AND interface<>' + _interface;
            else if (ipobj_g > 0)
                sql_obj = ' AND ipobj_g<>' + ipobj_g;
            db.get((error, connection) => {
                if (error)
                    reject(error);
                var sql = 'UPDATE ' + tableModel + ' SET ' +
                    'position_order = position_order' + increment +
                    ' WHERE rule = ' + connection.escape(rule) + ' AND position=' + connection.escape(position) +
                    ' AND position_order>=' + order1 + ' AND position_order<=' + order2 + sql_obj;
                logger().debug(sql);
                connection.query(sql, async (error, result) => {
                    if (error) {
                        reject(error);
                    }
                    resolve(result);
                });
            });
        });
    }


    private static checkIpobjPosition(ipobj, ipobj_g, _interface, position, callback) {
        db.get((error, connection) => {
            if (error) return callback(error, 0);

            let sql = "";
            if (ipobj > 0) {
                sql = 'select A.type from ipobj O ' +
                    'inner join ipobj_type T on O.type=T.id ' +
                    'inner join ipobj_type__policy_position A on A.type=O.type ' +
                    'inner join policy_position P on P.id=A.position ' +
                    'WHERE O.id = ' + connection.escape(ipobj) + ' AND A.position=' + connection.escape(position) + '  AND P.content="O"';
            } else if (ipobj_g > 0) {
                sql = 'select A.type from ipobj_g O ' +
                    'inner join ipobj_type T on O.type=T.id ' +
                    'inner join ipobj_type__policy_position A on A.type=O.type ' +
                    'inner join policy_position P on P.id=A.position ' +
                    'WHERE O.id = ' + connection.escape(ipobj_g) + ' AND A.position=' + connection.escape(position) + '  AND P.content="O"';
            } else if (_interface > 0) {
                sql = 'select A.type from interface O ' +
                    'inner join ipobj_type T on O.interface_type=T.id ' +
                    'inner join ipobj_type__policy_position A on A.type=O.interface_type ' +
                    'inner join policy_position P on P.id=A.position ' +
                    'WHERE O.id = ' + connection.escape(_interface) + ' AND A.position=' + connection.escape(position) + '  AND P.content="O"';
            }

            connection.query(sql, (error, rows) => {
                if (error) return callback(error, null);
                callback(null, (rows.length > 0) ? 1 : 0);
            });
        });
    }

    public static getPositionsContent = (dbCon, position, new_position) => {
        return new Promise(async (resolve, reject) => {
            dbCon.query(`SELECT id, content FROM policy_position WHERE id=${position}`, (error, result) => {
                if (error) return reject(error);
                if (result.length !== 1) reject(fwcError.NOT_FOUND);
                let content1 = result[0].content;

                dbCon.query(`SELECT id, content FROM policy_position WHERE id=${new_position}`, (error, result) => {
                    if (error) return reject(error);
                    if (result.length !== 1) reject(fwcError.NOT_FOUND);
                    let content2 = result[0].content;

                    resolve({ "content1": content1, "content2": content2 });
                });
            });
        });
    };

    //Remove policy_r__ipobj 
    public static deletePolicy_r__ipobj(dbCon, rule, ipobj, ipobj_g, _interface, position, position_order) {
        return new Promise(async (resolve, reject) => {
            var sqlExists = `SELECT * FROM ${tableModel}
                WHERE rule=${dbCon.escape(rule)} AND ipobj=${dbCon.escape(ipobj)}
                AND ipobj_g=${dbCon.escape(ipobj_g)} AND position=${dbCon.escape(position)}`;
            dbCon.query(sqlExists, async (error, row) => {
                if (error) return reject(error);

                //If exists Id from policy_r__ipobj to remove
                if (row) {
                    const sql = `DELETE FROM ${tableModel}
                        WHERE rule=${dbCon.escape(rule)} AND ipobj=${dbCon.escape(ipobj)}
                        AND ipobj_g=${dbCon.escape(ipobj_g)} AND position=${dbCon.escape(position)}
                        AND interface=${dbCon.escape(_interface)}`;
                    dbCon.query(sql, (error, result) => {
                        if (error) return reject(error);
                        if (result.affectedRows > 0) {
                            this.OrderList(999999, rule, position, position_order, ipobj, ipobj_g, _interface);
                            resolve();
                        } else reject(fwcError.NOT_FOUND);   
                    });
                } else reject(fwcError.NOT_FOUND);
            });
        });
    };
    //Remove policy_r__ipobj 
    public static deletePolicy_r__All(rule, callback) {


        db.get((error, connection) => {
            if (error)
                callback(error, null);
            var sqlExists = 'SELECT * FROM ' + tableModel +
                ' WHERE rule = ' + connection.escape(rule);
            connection.query(sqlExists, (error, row) => {
                //If exists Id from policy_r__ipobj to remove
                if (row) {
                    logger().debug("DELETING IPOBJ FROM RULE: " + rule);
                    db.get(async (error, connection) => {
                        var sql = 'DELETE FROM ' + tableModel +
                            ' WHERE rule = ' + connection.escape(rule);
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
    //Order policy_r__ipobj Position
    public static orderPolicyPosition(rule, position, callback) {

        logger().debug("DENTRO ORDER   Rule: " + rule + '  Position: ' + position);
        db.get((error, connection) => {
            if (error)
                callback(error, null);
            var sqlPos = 'SELECT * FROM ' + tableModel + ' WHERE rule = ' + connection.escape(rule) + ' AND position= ' + connection.escape(position) + ' order by position_order';
            logger().debug(sqlPos);
            connection.query(sqlPos, (error, rows) => {
                if (rows.length > 0) {
                    var order = 0;
                    asyncMod.map(rows, (row, callback1) => {
                        order++;
                        db.get((error, connection) => {
                            const sql = 'UPDATE ' + tableModel + ' SET position_order=' + order +
                                ' WHERE rule = ' + connection.escape(row.rule) + ' AND ipobj=' + connection.escape(row.ipobj) +
                                ' AND ipobj_g=' + connection.escape(row.ipobj_g) + ' AND position=' + connection.escape(row.position) +
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
    //Order policy_r__ipobj Position
    public static orderPolicy(rule, callback) {


        db.get((error, connection) => {
            if (error)
                callback(error, null);
            var sqlRule = 'SELECT * FROM ' + tableModel + ' WHERE rule = ' + connection.escape(rule) + ' order by position, position_order';
            logger().debug(sqlRule);
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
                            const sql = 'UPDATE ' + tableModel + ' SET position_order=' + order +
                                ' WHERE rule = ' + connection.escape(row.rule) + ' AND ipobj=' + connection.escape(row.ipobj) +
                                ' AND ipobj_g=' + connection.escape(row.ipobj_g) + ' AND position=' + connection.escape(row.position) +
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
    //Order policy_r__ipobj Position
    public static orderAllPolicy(callback) {


        db.get((error, connection) => {
            if (error)
                callback(error, null);
            var sqlRule = 'SELECT * FROM ' + tableModel + ' ORDER by rule,position, position_order';
            logger().debug(sqlRule);
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
                            const sql = 'UPDATE ' + tableModel + ' SET position_order=' + order +
                                ' WHERE rule = ' + connection.escape(row.rule) + ' AND ipobj=' + connection.escape(row.ipobj) +
                                ' AND ipobj_g=' + connection.escape(row.ipobj_g) + ' AND position=' + connection.escape(row.position) +
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
    //FALTA CORREGIR PROBLEMA AL CONTABILIZAR REGISTROS EXISTENTES 

    //check if IPOBJ Exists in any rule
    public static checkIpobjInRule(ipobj, type, fwcloud, callback) {

        logger().debug("CHECK DELETING ipobj:" + ipobj + " Type:" + type + "  fwcloud:" + fwcloud);
        db.get((error, connection) => {
            if (error)
                callback(error, null);
            var sql = 'SELECT count(*) as n FROM ' + tableModel + ' O INNER JOIN policy_r R on R.id=O.rule ' + ' INNER JOIN firewall F on F.id=R.firewall ' +
                ' INNER JOIN  ipobj I on I.id=O.ipobj ' +
                ' WHERE O.ipobj=' + connection.escape(ipobj) + ' AND I.type=' + connection.escape(type) + ' AND F.fwcloud=' + connection.escape(fwcloud);
            logger().debug(sql);
            connection.query(sql, (error, rows) => {
                if (!error) {
                    if (rows.length > 0) {
                        if (rows[0].n > 0) {
                            logger().debug("ALERT DELETING ipobj IN RULE:" + ipobj + " type: " + type + " fwcloud:" + fwcloud + " --> FOUND IN " + rows[0].n + " RULES");
                            callback(null, { "result": true });
                        } else {
                            callback(null, { "result": false });
                        }
                    } else {
                        var sql = 'SELECT count(*) as n FROM ' + tableModel + ' O INNER JOIN policy_r R on R.id=O.rule ' + ' INNER JOIN firewall F on F.id=R.firewall ' +
                            ' INNER JOIN ipobj__ipobjg G on G.ipobj_g=O.ipobj_g INNER JOIN  ipobj I on I.id=G.ipobj ' +
                            ' WHERE I.ipobj=' + connection.escape(ipobj) + ' AND I.type=' + connection.escape(type) + ' AND F.fwcloud=' + connection.escape(fwcloud);
                        logger().debug(sql);
                        connection.query(sql, (error, rows) => {
                            if (!error) {
                                if (rows.length > 0) {
                                    if (rows[0].n > 0) {
                                        logger().debug("ALERT DELETING ipobj IN GROUP:" + ipobj + " type: " + type + " fwcloud:" + fwcloud + " --> FOUND IN " + rows[0].n + " RULES");
                                        callback(null, { "result": true });
                                    } else {
                                        callback(null, { "result": false });
                                    }
                                } else
                                    callback(null, { "result": false });
                            } else
                                callback(null, { "result": false });
                        });
                    }
                } else
                    callback(null, { "result": false });
            });
        });
    };


    //check if INTERFACE Exists in any rule 'O' POSITIONS
    public static checkInterfaceInRule(_interface, type, fwcloud, callback) {

        logger().debug("CHECK DELETING interface O POSITIONS:" + _interface + " Type:" + type + "  fwcloud:" + fwcloud);
        db.get((error, connection) => {
            if (error)
                callback(error, null);
            const sql = 'SELECT count(*) as n FROM ' + tableModel + ' O INNER JOIN policy_r R on R.id=O.rule ' +
                ' INNER JOIN firewall F on F.id=R.firewall ' +
                ' INNER JOIN fwcloud C on C.id=F.fwcloud ' +
                ' inner join interface I on I.id=O.interface ' +
                ' WHERE I.id=' + connection.escape(_interface) + ' AND I.interface_type=' + connection.escape(type) +
                ' AND C.id=' + connection.escape(fwcloud);
            logger().debug(sql);
            connection.query(sql, (error, rows) => {
                if (!error) {
                    if (rows.length > 0) {
                        if (rows[0].n > 0) {
                            logger().debug("ALERT <INTERFACE> DELETING interface IN RULE:" + _interface + " type: " + type + " fwcloud:" + fwcloud + " --> FOUND IN " + rows[0].n + " RULES");
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
    //check if ALL INTERFACE UNDER HOST Exists in any rule
    public static checkHostAllInterfacesInRule(ipobj_host, fwcloud, callback) {

        logger().debug("CHECK DELETING HOST ALL interfaces O POSITIONS:" + ipobj_host + "  fwcloud:" + fwcloud);
        db.get((error, connection) => {
            if (error)
                callback(error, null);
            var sql = 'SELECT count(*) as n FROM ' + tableModel + ' O ' +
                ' INNER JOIN interface__ipobj J on J.interface=O.interface ' +
                ' INNER JOIN policy_r R on R.id=O.rule ' +
                ' INNER JOIN firewall F on F.id=R.firewall ' +
                ' INNER JOIN fwcloud C on C.id=F.fwcloud ' +
                ' WHERE J.ipobj=' + connection.escape(ipobj_host) + ' AND C.id=' + connection.escape(fwcloud);
            logger().debug(sql);
            connection.query(sql, (error, rows) => {
                if (!error) {
                    if (rows.length > 0) {
                        if (rows[0].n > 0) {
                            logger().debug("ALERT <HOST ALL INTERFACES> DELETING interface IN RULE:" + ipobj_host + " fwcloud:" + fwcloud + " --> FOUND IN " + rows[0].n + " RULES");
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
    //check if ALL IPOBJS UNDER ALL INTERFACE UNDER HOST Exists in any rule
    public static checkHostAllInterfaceAllIpobjInRule(ipobj_host, fwcloud, callback) {

        logger().debug("CHECK DELETING HOST ALL IPOBJ UNDER ALL interfaces O POSITIONS:" + ipobj_host + "  fwcloud:" + fwcloud);
        db.get((error, connection) => {
            if (error)
                callback(error, null);
            var sql = 'SELECT count(*) as n FROM interface__ipobj J ' +
                ' inner join ipobj I on I.interface=J.interface ' +
                ' inner join policy_r__ipobj O on O.ipobj=I.id ' +
                ' INNER JOIN policy_r R on R.id=O.rule ' +
                ' INNER JOIN firewall F on F.id=R.firewall ' +
                ' INNER JOIN fwcloud C on C.id=F.fwcloud ' +
                ' WHERE J.ipobj=' + connection.escape(ipobj_host) + ' AND C.id=' + connection.escape(fwcloud);
            logger().debug(sql);
            connection.query(sql, (error, rows) => {
                if (!error) {
                    if (rows.length > 0) {
                        if (rows[0].n > 0) {
                            logger().debug("ALERT <HOST ALL IPOBJ ALL INTERFACES> DELETING interface IN RULE:" + ipobj_host + " fwcloud:" + fwcloud + " --> FOUND IN " + rows[0].n + " RULES");
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
    //check if IPOBJ UNDER INTERFACE Exists in any rule
    public static checkOBJInterfaceInRule(_interface, type, fwcloud, firewall, callback) {

        logger().debug("CHECK DELETING IPOBJ UNDER interface :" + _interface + " Type:" + type + "  fwcloud:" + fwcloud);
        db.get((error, connection) => {
            if (error)
                callback(error, null);
            var sql = 'SELECT count(*) as n FROM ' + tableModel + ' O INNER JOIN policy_r R on R.id=O.rule ' + ' INNER JOIN firewall F on F.id=R.firewall ' +
                ' INNER JOIN ipobj I on O.ipobj=I.id INNER JOIN interface Z on Z.id=I.interface' +
                ' WHERE I.interface=' + connection.escape(_interface) + ' AND Z.interface_type=' + connection.escape(type) + ' AND F.fwcloud=' + connection.escape(fwcloud) + ' AND F.id=' + connection.escape(firewall);
            logger().debug(sql);
            connection.query(sql, (error, rows) => {
                if (!error) {
                    if (rows.length > 0) {
                        if (rows[0].n > 0) {
                            logger().debug("ALERT <IPOBJ UNDER INTERFACE> DELETING interface IN RULE:" + _interface + " type: " + type + " fwcloud:" + fwcloud + " --> FOUND IN " + rows[0].n + " RULES");
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
    //check if HOST INTERFACE Exists in any rule
    public static checkHOSTInterfaceInRule(_interface, type, fwcloud, firewall, callback) {

        logger().debug("CHECK DELETING HOST interface :" + _interface + " Type:" + type + "  fwcloud:" + fwcloud);
        db.get((error, connection) => {
            if (error)
                callback(error, null);
            var sql = 'SELECT count(*) as n FROM ' + tableModel + ' O INNER JOIN policy_r R on R.id=O.rule ' + ' INNER JOIN firewall F on F.id=R.firewall ' +
                ' inner join interface__ipobj J on J.ipobj=O.ipobj  INNER JOIN interface Z on Z.id=J.interface' +
                ' WHERE J.interface=' + connection.escape(_interface) + ' AND Z.interface_type=' + connection.escape(type) + ' AND F.fwcloud=' + connection.escape(fwcloud) + ' AND F.id=' + connection.escape(firewall);
            logger().debug(sql);
            connection.query(sql, (error, rows) => {
                if (!error) {
                    if (rows.length > 0) {
                        if (rows[0].n > 0) {
                            logger().debug("ALERT <HOST INTERFACE> DELETING interface IN RULE:" + _interface + " type: " + type + " fwcloud:" + fwcloud + " --> FOUND IN " + rows[0].n + " RULES");
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


    //------------------- SEARCH METHODS -----------------------------------------------
    //FALTA BUSQUEDA de OBJETOS STANDAR SIN FWCLOUD
    //check if IPOBJ Exists in any rule
    public static searchIpobjInRule = (ipobj, type, fwcloud) => {
        return new Promise((resolve, reject) => {
            db.get((error, connection) => {
                if (error) return reject(error);
                var sql = `SELECT O.ipobj obj_id,I.name obj_name, I.type obj_type_id,T.type obj_type_name,
				C.id cloud_id, C.name cloud_name, R.firewall firewall_id, F.name firewall_name ,O.rule rule_id, R.rule_order,R.type rule_type,PT.name rule_type_name,
				O.position rule_position_id, P.name rule_position_name, R.comment rule_comment,
				F.cluster as cluster_id, IF(F.cluster is null,null,(select name from cluster where id=F.cluster)) as cluster_name
				FROM policy_r__ipobj O
				INNER JOIN policy_r R on R.id=O.rule
				INNER JOIN firewall F on F.id=R.firewall
				INNER JOIN ipobj I on I.id=O.ipobj
				inner join ipobj_type T on T.id=I.type
				inner join policy_position P on P.id=O.position
				inner join policy_type PT on PT.id=R.type
				inner join fwcloud C on C.id=F.fwcloud
				WHERE O.ipobj=${ipobj} AND I.type=${type} AND F.fwcloud=${fwcloud}`;
                connection.query(sql, (error, rows) => {
                    if (error) return reject(error);
                    resolve(rows);
                });
            });
        });
    };

    //check if INTERFACE Exists in any rule
    public static searchInterfaceInRule = (_interface, type, fwcloud, firewall, diff_firewall) => {
        return new Promise((resolve, reject) => {
            db.get((error, connection) => {
                if (error) return reject(error);
                var sql = `SELECT O.interface obj_id,I.name obj_name, I.interface_type obj_type_id,T.type obj_type_name,
				C.id cloud_id, C.name cloud_name, R.firewall firewall_id, F.name firewall_name ,O.rule rule_id, R.rule_order,R.type rule_type,PT.name rule_type_name,
				O.position rule_position_id,  P.name rule_position_name,R.comment rule_comment,
				F.cluster as cluster_id, IF(F.cluster is null,null,(select name from cluster where id=F.cluster)) as cluster_name
				FROM policy_r__ipobj O
				INNER JOIN policy_r R on R.id=O.rule
				INNER JOIN firewall F on F.id=R.firewall
				INNER JOIN  interface I on I.id=O.interface
				inner join ipobj_type T on T.id=I.interface_type
				inner join policy_position P on P.id=O.position
				inner join policy_type PT on PT.id=R.type
				inner join fwcloud C on C.id=F.fwcloud
				WHERE O.interface=${_interface} AND I.interface_type=${type} AND C.id=${fwcloud}`;
                if (diff_firewall)
                    sql += ` AND F.id<>${diff_firewall}`;
                else if (firewall !== null) {
                    sql += ` AND F.id=${firewall}`;
                }
                connection.query(sql, (error, rows) => {
                    if (error) return reject(error);
                    resolve(rows);
                });
            });
        });
    };

    //check if IPOBJ Exists in GROUP and GROUP in any rule
    public static searchIpobjInGroupInRule = (ipobj, type, fwcloud) => {
        return new Promise((resolve, reject) => {
            db.get((error, connection) => {
                if (error) return reject(error);
                var sql = `SELECT O.ipobj_g obj_id,GR.name obj_name, GR.type obj_type_id,T.type obj_type_name,
				C.id cloud_id, C.name cloud_name, R.firewall firewall_id, F.name firewall_name ,O.rule rule_id, R.rule_order, R.type rule_type, PT.name rule_type_name,
				O.position rule_position_id,  P.name rule_position_name,R.comment rule_comment,
				F.cluster as cluster_id, IF(F.cluster is null,null,(select name from cluster where id=F.cluster)) as cluster_name
				FROM policy_r__ipobj O
				INNER JOIN policy_r R on R.id=O.rule
				INNER JOIN firewall F on F.id=R.firewall
				INNER JOIN ipobj__ipobjg G ON G.ipobj_g=O.ipobj_g
				INNER JOIN ipobj_g GR ON GR.id=G.ipobj_g
				INNER JOIN  ipobj I on I.id=G.ipobj
				inner join ipobj_type T on T.id=GR.type
				inner join policy_position P on P.id=O.position
				inner join policy_type PT on PT.id=R.type
				inner join fwcloud C on C.id=F.fwcloud
				WHERE I.id=${ipobj} AND I.type=${type} AND F.fwcloud=${fwcloud}`;
                connection.query(sql, (error, rows) => {
                    if (error) return reject(error);
                    resolve(rows);
                });
            });
        });
    };

    //check if IPOBJ's in GROUP Exists in any rule
    public static searchGroupIPObjectsInRule = (idg, fwcloud) => {
        return new Promise((resolve, reject) => {
            db.get((error, connection) => {
                if (error) return reject(error);
                var sql = `SELECT O.ipobj obj_id,I.name obj_name, I.type obj_type_id,T.type obj_type_name,
				C.id cloud_id, C.name cloud_name, R.firewall firewall_id, F.name firewall_name ,O.rule rule_id, R.rule_order,R.type rule_type,PT.name rule_type_name,
				O.position rule_position_id,  P.name rule_position_name,R.comment rule_comment,
				F.cluster as cluster_id, IF(F.cluster is null,null,(select name from cluster where id=F.cluster)) as cluster_name
				FROM policy_r__ipobj O
				INNER JOIN policy_r R on R.id=O.rule
				INNER JOIN firewall F on F.id=R.firewall
				INNER JOIN  ipobj I on I.id=O.ipobj
				INNER JOIN ipobj__ipobjg G ON G.ipobj=I.id
				INNER JOIN ipobj_g GR ON GR.id= G.ipobj_g
				inner join ipobj_type T on T.id=I.type
				inner join policy_position P on P.id=O.position
				inner join policy_type PT on PT.id=R.type
				inner join fwcloud C on C.id=F.fwcloud
				WHERE GR.id=${idg} AND F.fwcloud=${fwcloud}`;
                connection.query(sql, (error, rows) => {
                    if (error) return reject(error);
                    resolve(rows);
                });
            });
        });
    };

    //check if GROUP Exists in any rule
    public static searchGroupInRule = (idg, fwcloud) => {
        return new Promise((resolve, reject) => {
            db.get((error, connection) => {
                if (error) return reject(error);
                var sql = `SELECT O.ipobj_g obj_id,GR.name obj_name, GR.type obj_type_id,T.type obj_type_name,
				C.id cloud_id, C.name cloud_name, R.firewall firewall_id, F.name firewall_name, O.rule rule_id, R.rule_order,R.type rule_type,PT.name rule_type_name,
				O.position rule_position_id, P.name rule_position_name, R.comment rule_comment,
				F.cluster as cluster_id, IF(F.cluster is null,null,(select name from cluster where id=F.cluster)) as cluster_name
				FROM policy_r__ipobj O
				INNER JOIN policy_r R on R.id=O.rule
				INNER JOIN firewall F on F.id=R.firewall
				INNER JOIN ipobj_g GR ON GR.id=O.ipobj_g
				inner join ipobj_type T on T.id=GR.type
				inner join policy_position P on P.id=O.position
				inner join policy_type PT on PT.id=R.type
				inner join fwcloud C on C.id=F.fwcloud
				WHERE GR.id=${idg} AND F.fwcloud=${fwcloud}`;
                connection.query(sql, (error, rows) => {
                    if (error) return reject(error);
                    resolve(rows);
                });
            });
        });
    };

    //Search INTERFACES UNDER IPOBJ HOST that Exists in any rule
    public static searchInterfaceHostInRule = (dbCon, fwcloud, ipobj) => {
        return new Promise((resolve, reject) => {
            var sql = `SELECT O.interface obj_id,K.name obj_name, K.interface_type obj_type_id,T.type obj_type_name,
			C.id cloud_id, C.name cloud_name, R.firewall firewall_id, F.name firewall_name ,O.rule rule_id, R.rule_order,R.type rule_type,PT.name rule_type_name,
			O.position rule_position_id,  P.name rule_position_name,R.comment rule_comment,
			F.cluster as cluster_id, IF(F.cluster is null,null,(select name from cluster where id=F.cluster)) as cluster_name
			FROM policy_r__ipobj O
			INNER JOIN interface K ON K.id=O.interface
			INNER JOIN interface__ipobj J ON J.interface=K.id
			INNER JOIN ipobj I ON I.id=J.ipobj
			INNER JOIN policy_r R ON R.id=O.rule
			INNER JOIN firewall F ON F.id=R.firewall
			INNER JOIN ipobj_type T ON T.id=K.interface_type
			INNER JOIN policy_position P ON P.id=O.position
			INNER JOIN policy_type PT ON PT.id=R.type
			INNER JOIN fwcloud C ON C.id=F.fwcloud
			WHERE I.id=${ipobj} AND I.type=8 AND F.fwcloud=${fwcloud}`;
            dbCon.query(sql, (error, rows) => {
                if (error) return reject(error);
                resolve(rows);
            });
        });
    };

    //Search ADDR UNDER IPOBJ HOST that Exists in any rule
    public static searchAddrHostInRule = (dbCon, fwcloud, ipobj) => {
        return new Promise((resolve, reject) => {
            var sql = `SELECT O.ipobj obj_id, I.name obj_name, I.type obj_type_id, T.type obj_type_name,
			C.id cloud_id, C.name cloud_name, R.firewall firewall_id, F.name firewall_name ,O.rule rule_id, R.rule_order,R.type rule_type,PT.name rule_type_name,
			O.position rule_position_id,  P.name rule_position_name,R.comment rule_comment,
			F.cluster as cluster_id, IF(F.cluster is null,null,(select name from cluster where id=F.cluster)) as cluster_name
			FROM policy_r__ipobj O
			INNER JOIN ipobj I ON I.id=O.ipobj
			INNER JOIN interface K ON K.id=I.interface
			INNER JOIN interface__ipobj J ON J.interface=K.id
			inner join ipobj_type T on T.id=I.type
			INNER JOIN policy_r R ON R.id=O.rule
			INNER JOIN firewall F ON F.id=R.firewall
			INNER JOIN policy_position P ON P.id=O.position
			INNER JOIN policy_type PT ON PT.id=R.type
			INNER JOIN fwcloud C ON C.id=F.fwcloud
			WHERE J.ipobj=${ipobj} AND I.type=5 AND F.fwcloud=${fwcloud}`;
            dbCon.query(sql, (error, rows) => {
                if (error) return reject(error);
                resolve(rows);
            });
        });
    };

    public static searchLastAddrInInterfaceInRule = (dbCon, ipobj, type, fwcloud) => {
        return new Promise((resolve, reject) => {
            // Fisrt get all the interfaces in rules to which the address belongs.
            var sql = `SELECT O.interface obj_id,K.name obj_name, K.interface_type obj_type_id,T.type obj_type_name,
			C.id cloud_id, C.name cloud_name, R.firewall firewall_id, F.name firewall_name ,O.rule rule_id, R.rule_order,R.type rule_type,PT.name rule_type_name,
			O.position rule_position_id,  P.name rule_position_name,R.comment rule_comment,
			F.cluster as cluster_id, IF(F.cluster is null,null,(select name from cluster where id=F.cluster)) as cluster_name
			FROM policy_r__ipobj O
			INNER JOIN interface K ON K.id=O.interface
			INNER JOIN ipobj I ON I.interface=K.id
			INNER JOIN policy_r R ON R.id=O.rule
			INNER JOIN firewall F ON F.id=R.firewall
			INNER JOIN ipobj_type T ON T.id=K.interface_type
			INNER JOIN policy_position P ON P.id=O.position
			INNER JOIN policy_type PT ON PT.id=R.type
			INNER JOIN fwcloud C ON C.id=F.fwcloud 
			WHERE I.id=${ipobj} AND I.type=${type} AND F.fwcloud=${fwcloud}`;
            dbCon.query(sql, async (error, rows) => {
                if (error) return reject(error);

                let result = [];
                try {
                    for (let row of rows) {
                        const rule_ip_version = await PolicyRule.getPolicyRuleIPversion(dbCon, fwcloud, row.firewall_id, row.rule_id);
                        let addrs: any = await Interface.getInterfaceAddr(dbCon, row.obj_id);

                        // Count the amount of interface address with the same IP version of the rule.
                        let n = 0;
                        let id = 0;
                        for (let addr of addrs) {
                            if (parseInt(addr.ip_version) === rule_ip_version) {
                                n++;
                                if (n === 1) id = addr.id;
                            }
                        }

                        // We are the last IP address in the interface used in a firewall rule.
                        if (n === 1 && ipobj === id)
                            result.push(row);
                    }
                } catch (error) { return reject(error) }

                resolve(result);
            });
        });
    };

    public static searchLastAddrInHostInRule = (dbCon, ipobj, type, fwcloud) => {
        return new Promise((resolve, reject) => {
            // Fisrt get all the host in rules to which the address belongs.
            var sql = `SELECT O.ipobj obj_id,IR.name obj_name, IR.type obj_type_id,T.type obj_type_name,
			C.id cloud_id, C.name cloud_name, R.firewall firewall_id, F.name firewall_name ,O.rule rule_id, R.rule_order,R.type rule_type,PT.name rule_type_name,
			O.position rule_position_id, P.name rule_position_name, R.comment rule_comment,
			F.cluster as cluster_id, IF(F.cluster is null,null,(select name from cluster where id=F.cluster)) as cluster_name
			FROM policy_r__ipobj O
			INNER JOIN ipobj IR ON IR.id=O.ipobj
			INNER JOIN interface__ipobj J ON J.ipobj=IR.id
			INNER JOIN policy_r R ON R.id=O.rule
			INNER JOIN interface K ON K.id=J.interface
			INNER JOIN ipobj I ON I.interface=K.id
			INNER JOIN ipobj_type T ON T.id=IR.type
			INNER JOIN policy_position P ON P.id=O.position
			INNER JOIN policy_type PT ON PT.id=R.type
			INNER JOIN firewall F ON F.id=R.firewall
			INNER JOIN fwcloud C ON C.id=F.fwcloud
			WHERE I.id=${ipobj} AND I.type=${type} AND F.fwcloud=${fwcloud}`;
            dbCon.query(sql, async (error, rows) => {
                if (error) return reject(error);

                let result = [];
                try {
                    for (let row of rows) {
                        const rule_ip_version = await PolicyRule.getPolicyRuleIPversion(dbCon, fwcloud, row.firewall_id, row.rule_id);
                        let addrs: any = await Interface.getHostAddr(dbCon, row.obj_id);

                        // Count the amount of interface address with the same IP version of the rule.
                        let n = 0;
                        let id = 0;
                        for (let addr of addrs) {
                            if (parseInt(addr.ip_version) === rule_ip_version) {
                                n++;
                                if (n === 1) id = addr.id;
                            }
                        }

                        // We are the last IP address in the host used in a firewall rule.
                        if (n === 1 && ipobj === id)
                            result.push(row);
                    }
                } catch (error) { return reject(error) }

                resolve(result);
            });
        });
    };

    public static async searchLastAddrInHostInGroup(ipObjId: number, type: number, fwcloudId: number): Promise<PolicyRule[]> {
        const policyRuleToIPObjGroups: PolicyRuleToIPObj[] = await getRepository(PolicyRuleToIPObj).createQueryBuilder('policyRuleToIPObj')
            .innerJoinAndSelect('policyRuleToIPObj.ipObjGroup', 'ipObjGroup')
            .innerJoinAndSelect('ipObjGroup.ipObjToIPObjGroups', 'ipObjToIPObjGroups')
            .innerJoin('ipObjToIPObjGroups.ipObj', 'ipobj')
            .innerJoin('ipobj.hosts', 'interfaceIPObj')
            .innerJoin('policyRuleToIPObj.policyRule', 'rule')
            .innerJoin('interfaceIPObj.hostInterface', 'interface')
            .innerJoin('interface.ipObjs', 'intIPObj')
            .innerJoin('rule.firewall', 'firewall')
            .where('intIPObj.id = :ipObjId', {ipObjId})
            .andWhere('firewall.fwCloudId = :fwcloudId', {fwcloudId})  
            .getMany();

        let result: PolicyRuleToIPObj[] = [];
        
        for (let policyRuleToIPObjGroup of policyRuleToIPObjGroups) {
            for(let ipObjToIPObjGroup of policyRuleToIPObjGroup.ipObjGroup.ipObjToIPObjGroups) {
                let addrs: any = await Interface.getHostAddr(db.getQuery(), ipObjToIPObjGroup.ipObjId);

                // Count the amount of interface address with the same IP version of the rule.
                let n = 0;
                let id = 0;
                for (let addr of addrs) {
                    n++;
                    if (n === 1) id = addr.id;
                }

                // We are the last IP address in the host used in a firewall rule.
                if (n === 1 && ipObjId === id)
                    result.push(policyRuleToIPObjGroup);
            }
        }

        if (result.length === 0) {
            return [];
        }

        return await getRepository(PolicyRule).createQueryBuilder('rule')
            .distinct()
            .addSelect('firewall.id', 'firewall_id')
            .addSelect('firewall.name', 'firewall_name')
            .addSelect('cluster.id', 'cluster_id')
            .addSelect('cluster.name', 'cluster_name')
            .addSelect('type.name', 'rule_type_name')
            .innerJoin('rule.policyType', 'type')
            .innerJoin('rule.firewall', 'firewall')
            .leftJoin('firewall.cluster', 'cluster')
            .whereInIds(result.map(item => item.policyRuleId))
        .getRawMany();
    }

    //check if Exist IPOBJS under INTERFACES  IN RULES 
    public static searchIpobjInterfaceInRule = (_interface, type, fwcloud, firewall, diff_firewall) => {
        return new Promise((resolve, reject) => {
            db.get((error, connection) => {
                if (error) return reject(error);
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
                    ' WHERE K.id=' + _interface + ' AND K.interface_type=' + type + ' AND F.fwcloud=' + fwcloud;
                if (diff_firewall !== '')
                    sql = sql + ' AND F.id<>' + connection.escape(diff_firewall);
                else if (firewall !== null)
                    sql = sql + ' AND F.id=' + connection.escape(firewall);
                connection.query(sql, (error, rows) => {
                    if (error) return reject(error);
                    resolve(rows);
                });
            });
        });
    };

    //check if Exist IPOBJS under INTERFACES IN GROUPS
    public static searchIpobjInterfaceInGroup = (_interface, type) => {
        return new Promise((resolve, reject) => {
            db.get((error, connection) => {
                if (error) return reject(error);
                var sql = `SELECT I.id obj_id, I.name obj_name, I.type obj_type_id, T.type obj_type_name,
				G.id group_id, G.name group_name, G.type group_type
				FROM ipobj__ipobjg O
				INNER JOIN ipobj_g G ON G.id=O.ipobj_g
				INNER JOIN ipobj I ON I.id=O.ipobj
				INNER JOIN interface K on K.id=I.interface
				inner join ipobj_type T on T.id=I.type
				WHERE K.id=${_interface} AND K.interface_type=${type}`;
                connection.query(sql, (error, rows) => {
                    if (error) return reject(error);
                    resolve(rows);
                });
            });
        });
    };


    public static checkIpVersion(req) {
        return new Promise(async (resolve, reject) => {
            let rule_ip_version;
            try {
                rule_ip_version = await PolicyRule.getPolicyRuleIPversion(req.dbCon, req.body.fwcloud, req.body.firewall, req.body.rule);
            } catch (error) { return reject(error) }

            if (req.body.ipobj > 0) { // Verify the IP version of the IP object that we are moving.
                req.dbCon.query(`select ip_version,type from ipobj where id=${req.body.ipobj}`, (error, result) => {
                    if (error) return reject(error);
                    if (result.length !== 1) return reject(fwcError.NOT_FOUND);

                    let type = parseInt(result[0].type);
                    if (type !== 5 && type !== 6 && type !== 7) //5=ADRRES, 6=ADDRESS RANGE, 7=NETWORK
                        return resolve(true);

                    if (parseInt(result[0].ip_version) === rule_ip_version)
                        return resolve(true);
                    return resolve(false);
                });
            }
            else if (req.body.ipobj_g > 0) { // Verify the IP version of the group that we are inserting in the rule.
                try {
                    const groupData = await IPObjGroup.getIpobj_g(req.dbCon, req.body.fwcloud, req.body.ipobj_g);

                    // If this is a services group, then we don't need to check the IP version.
                    if (groupData[0].type === 21) return resolve(true);

                    const groupIPv: {ipv4: boolean, ipv6: boolean} = await IPObjGroup.groupIPVersion(req.dbCon, req.body.ipobj_g);

                    if (rule_ip_version === 4 && groupIPv.ipv4) {
                        return resolve(true);
                    }

                    if (rule_ip_version === 6 && groupIPv.ipv6) {
                        return resolve(true);
                    }

                    resolve(false);
                } catch (error) { return reject(error) }
            } else resolve(true);
        });
    };
}