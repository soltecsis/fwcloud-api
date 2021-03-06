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

import Model from "../Model";
import db from '../../database/database-manager';
import { PrimaryColumn, Column, Entity, ManyToOne, JoinColumn, OneToMany, ManyToMany } from "typeorm";
import { PolicyType } from "./PolicyType";
import { IPObjType } from "../ipobj/IPObjType";
import { PolicyRuleToInterface } from "./PolicyRuleToInterface";
import { PolicyRuleToOpenVPNPrefix } from "./PolicyRuleToOpenVPNPrefix";
import { PolicyRuleToIPObj } from "./PolicyRuleToIPObj";
import { PolicyRuleToOpenVPN } from "./PolicyRuleToOpenVPN";
import { IPObjTypeToPolicyPosition } from "../ipobj/IPObjTypeToPolicyPosition";
import { logger } from "../../fonaments/abstract-application";

const tableName: string = 'policy_position';

@Entity(tableName)
export class PolicyPosition extends Model {

    @PrimaryColumn()
    id: number;

    @Column()
    name: string;

    @Column({name: 'policy_type'})
    policyTypeId: number;

    @Column()
    position_order: number;

    @Column()
    content: string;

    @Column()
    single_object: number;
    
    @ManyToOne(type => PolicyType, type => type.policyPositions)
    @JoinColumn({
        name: 'policy_type'
    })
    policyType: PolicyType

    @ManyToMany(type => IPObjType, ipObjType => ipObjType.policyPositions)
    ipObjTypes: Array<IPObjType>;

    @OneToMany(type => PolicyRuleToInterface, policyRuleToInterface => policyRuleToInterface.policyPosition)
    policyRuleToInterfaces: Array<PolicyRuleToInterface>;

    @OneToMany(type => PolicyRuleToIPObj, policyRuleToIPObj => policyRuleToIPObj.policyPosition)
    policyRuleToIPObjs: Array<PolicyRuleToIPObj>;

    @OneToMany(type => PolicyRuleToOpenVPN, policyRuleToOpenVPN => policyRuleToOpenVPN.policyPosition)
    policyRuleToOpenVPNs: Array<PolicyRuleToOpenVPN>;

    @OneToMany(type => PolicyRuleToOpenVPNPrefix, policyRuleToOpenVPNPrefix => policyRuleToOpenVPNPrefix.policyPosition)
    policyRuleToOpenVPNPrefixes: Array<PolicyRuleToOpenVPNPrefix>;

    @OneToMany(type => IPObjTypeToPolicyPosition, model => model.policyPosition)
    ipObjTypeToPolicyPositions!: Array<IPObjTypeToPolicyPosition>;


    public getTableName(): string {
        return tableName;
    }

    //Get All policy_position
    public static getPolicy_positions(callback) {
        db.get((error, connection) => {
            if (error)
                callback(error, null);
            connection.query('SELECT * FROM ' + tableName + ' ORDER BY position_order', (error, rows) => {
                if (error)
                    callback(error, null);
                else
                    callback(null, rows);
            });
        });
    }



    //Get policy_position by type
    public static getPolicyPositionsByType(dbCon,type) {
        return new Promise((resolve, reject) => {
            dbCon.query(`SELECT * FROM ${tableName} WHERE policy_type=${type} ORDER BY position_order`, (error, result) => {
                if (error) return reject(error);
                resolve(result);
            });
        });
    }


    //Get policy_position by  type
    public static checkPolicyRulePosition(dbCon,rule,position) {
        return new Promise((resolve, reject) => {
            let sql = `select PP.id from ${tableName} PP
                inner join policy_r R on R.type=PP.policy_type
                where R.id=${rule} and PP.id=${position}`;

            dbCon.query(sql, (error, result) => {
                if (error) return reject(error);
                resolve(result.length===1 ? true : false);
            });
        });
    }


    public static getRulePositionData(dbCon, position) {
        return new Promise((resolve, reject) => {
            const sql = `SELECT OBJ.id, OBJ.name, OBJ.type, R.position_order, '' as labelName 
                FROM policy_r__ipobj R INNER JOIN ipobj OBJ ON OBJ.id=R.ipobj 
                WHERE R.rule=${position.rule} AND R.position=${position.id}

                UNION SELECT G.id, G.name, G.type, R.position_order, '' as labelName
                FROM policy_r__ipobj R INNER JOIN ipobj_g G ON G.id=R.ipobj_g 
                WHERE R.rule=${position.rule} AND R.position=${position.id}

                UNION SELECT I.id, I.name, I.type, R.position_order, I.labelName 
                FROM policy_r__ipobj R INNER JOIN interface I ON I.id=R.interface 
                WHERE R.rule=${position.rule} AND R.position=${position.id}

                UNION SELECT I.id, I.name, I.type, R.position_order, I.labelName 
                FROM policy_r__interface R INNER JOIN interface I ON I.id=R.interface
                WHERE R.rule=${position.rule} AND R.position=${position.id}

                UNION SELECT VPN.id, CRT.cn, "311" as type, R.position_order, '' as labelName
                FROM policy_r__openvpn R INNER JOIN openvpn VPN ON VPN.id=R.openvpn
                INNER JOIN crt CRT ON CRT.id=VPN.crt
                WHERE R.rule=${position.rule} AND R.position=${position.id}

                UNION SELECT PRE.id, PRE.name, "401" as type, R.position_order, '' as labelName
                FROM policy_r__openvpn_prefix R INNER JOIN openvpn_prefix PRE ON PRE.id=R.prefix
                WHERE R.rule=${position.rule} AND R.position=${position.id}
                
                ORDER BY position_order`;
            
            dbCon.query(sql, async (error, items) => {
                if (error) return reject(error);

                for (let i=0; i<items.length; i++) {
                    if (items[i].type === '10') // INTERFACE FIREWALL
                        items[i].firewall_id = parseInt(position.firewall);
                }

                resolve({
                    content: position.content,
                    id: position.id,
                    name: position.name,
                    policy_type: position.policy_type,
                    position_order: position.position_order,
                    single_object: position.single_object,
                    ipobjs: items,
                });
            });
        });
    }

    //Get policy_position by type
    public static getRulePositions(rule) {
        return new Promise((resolve, reject) => {
            db.get((error, connection) => {
                if (error) return reject(error);
                
                let sql = `SELECT ${rule.fwcloud} as fwcloud,${rule.firewall} as firewall,${rule.id} as rule, P.* 
                    FROM ${tableName} P WHERE P.policy_type=${rule.type} ORDER BY P.position_order`;
                connection.query(sql, async (error, positions) => {
                    if (error) return reject(error);
                    resolve(positions);
                });
            });
        });
    }

    public static getPolicyTypePositions(dbCon, type: number) {
        return new Promise((resolve, reject) => {
            dbCon.query(`SELECT id,name,position_order FROM ${tableName} WHERE policy_type=${type} ORDER BY position_order`, (error, positions) => {
                if (error) return reject(error);
                resolve(positions);
            });
        });
    }



    //Get policy_position by  id
    public static getPolicy_position(id, callback) {
        db.get((error, connection) => {
            if (error)
                callback(error, null);
            var sql = 'SELECT * FROM ' + tableName + ' WHERE id = ' + connection.escape(id);
            connection.query(sql, (error, row) => {
                if (error)
                    callback(error, null);
                else
                    callback(null, row);
            });
        });
    }


    //Add new policy_position
    public static insertPolicy_position(policy_positionData, callback) {
        db.get((error, connection) => {
            if (error)
                callback(error, null);
            connection.query('INSERT INTO ' + tableName + ' SET ?', policy_positionData, (error, result) => {
                if (error) {
                    callback(error, null);
                } else {
                    //devolvemos la última id insertada
                    callback(null, {"insertId": result.insertId});
                }
            });
        });
    }

    //Update policy_position
    public static updatePolicy_position(policy_positionData, callback) {

        db.get((error, connection) => {
            if (error)
                callback(error, null);
            var sql = 'UPDATE ' + tableName + ' SET name = ' + connection.escape(policy_positionData.name) + ', ' +
                    'policy_type = ' + connection.escape(policy_positionData.poicy_type) + ', ' +
                    'position_order = ' + connection.escape(policy_positionData.position_order) + ', ' +
                    'content = ' + connection.escape(policy_positionData.content) + ' ' +
                    ' WHERE id = ' + policy_positionData.id;
            logger().debug(sql);
            connection.query(sql, (error, result) => {
                if (error) {
                    callback(error, null);
                } else {
                    callback(null, {"result": true});
                }
            });
        });
    }

    //Remove policy_position with id to remove
    public static deletePolicy_position(id, callback) {
        db.get((error, connection) => {
            if (error)
                callback(error, null);
            var sqlExists = 'SELECT * FROM ' + tableName + ' WHERE id = ' + connection.escape(id);
            connection.query(sqlExists, (error, row) => {
                //If exists Id from policy_position to remove
                if (row) {
                    db.get((error, connection) => {
                        var sql = 'DELETE FROM ' + tableName + ' WHERE id = ' + connection.escape(id);
                        connection.query(sql, (error, result) => {
                            if (error) {
                                callback(error, null);
                            } else {
                                callback(null, {"result": true});
                            }
                        });
                    });
                } else {
                    callback(null, {"result": false});
                }
            });
        });
    }
}