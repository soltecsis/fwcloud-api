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
var logger = require('log4js').getLogger("app");

import { IPObjGroup } from '../../models/ipobj/IPObjGroup';
import { Interface } from '../../models/interface/Interface';
import { PrimaryColumn, Column, Entity, ManyToOne, JoinColumn, OneToMany } from "typeorm";
import { OpenVPNPrefix } from '../../models/vpn/openvpn/OpenVPNPrefix';

import { IPObj } from '../../models/ipobj/IPObj';
import { OpenVPN } from '../../models/vpn/openvpn/OpenVPN';
import modelEventService from "../ModelEventService";
import { PolicyType } from "./PolicyType";
import { IPObjType } from "../ipobj/IPObjType";
var data_policy_positions = require('../../models/data/data_policy_positions');
var data_policy_position_ipobjs = require('../../models/data/data_policy_position_ipobjs');

const tableName: string = 'policy_position';

@Entity(tableName)
export class PolicyPosition extends Model {

    @PrimaryColumn()
    id: number;

    @Column()
    name: string;

    @Column()
    policy_type: number;

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

    @OneToMany(type => IPObjType, ipObjType => ipObjType.policyPositions)
    ipObjTypes: Array<IPObjType>;

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


    //Get object information for the position. Grops, hosts, interfaces, etc. will be breakdown to leaf nodes information.
    public static getRulePositionDataDetailed(position) {
        return new Promise((resolve, reject) => {
            db.get((error, dbCon) => {
                if (error) return reject(error);
                
                //SELECT ALL IPOBJ UNDER a POSITION
                let sql=`SELECT ${position.fwcloud} as fwcloud, ${position.firewall} as firewall, 
                    P.rule, O.id as ipobj, P.ipobj_g, P.interface as interface, position, position_order, "O" as type
                    FROM policy_r__ipobj P
                    inner join ipobj O on O.id=P.ipobj
                    WHERE rule=${position.rule} AND position=${position.id} AND O.type<>8 ` +
                
                    //SELECT IPOBJ UNDER HOST/INTERFACE
                    `UNION SELECT ${position.fwcloud} as fwcloud, ${position.firewall} as firewall, 
                    rule, OF.id as ipobj, P.ipobj_g, P.interface as interface, position, position_order, "O" as type
                    FROM policy_r__ipobj P
                    inner join ipobj O on O.id=P.ipobj
                    inner join interface__ipobj II on II.ipobj=O.id
                    inner join interface I on I.id=II.interface
                    inner join ipobj OF on OF.interface=I.id
                    WHERE rule=${position.rule} AND position=${position.id} AND O.type=8 ` +
                    
                    //SELECT IPOBJ UNDER GROUP (NOT HOSTS)
                    `UNION SELECT ${position.fwcloud} as fwcloud, ${position.firewall} as firewall,
                    rule, O.id as ipobj, P.ipobj_g, P.interface as interface, position, position_order, "O" as type
                    FROM policy_r__ipobj P
                    inner join ipobj__ipobjg G on G.ipobj_g=P.ipobj_g
                    inner join ipobj O on O.id=G.ipobj
                    WHERE rule=${position.rule} AND position=${position.id} AND O.type<>8 ` +
                    
                    //SELECT IPOBJ UNDER HOST IN GROUP 
                    `UNION SELECT ${position.fwcloud} as fwcloud, ${position.firewall} as firewall,
                    rule, OF.id as ipobj, P.ipobj_g, P.interface as interface, position, position_order, "O" as type
                    FROM policy_r__ipobj P
                    inner join ipobj__ipobjg G on G.ipobj_g=P.ipobj_g
                    inner join ipobj O on O.id=G.ipobj
                    inner join interface__ipobj II on II.ipobj=O.id
                    inner join interface I on I.id=II.interface
                    inner join ipobj OF on OF.interface=I.id
                    WHERE rule=${position.rule} AND position=${position.id} AND O.type=8 ` +
                    
                    //SELECT INTERFACES in  POSITION I
                    `UNION SELECT ${position.fwcloud} as fwcloud, ${position.firewall} as firewall, 
                    rule, -1,-1,I.id as interface,position,position_order, "I" as type
                    FROM policy_r__interface P
                    inner join interface I on I.id=P.interface
                    WHERE rule=${position.rule} AND position=${position.id} ` +
                    
                    //SELECT IPOBJ UNDER INTERFACE POSITION O
                    `UNION SELECT ${position.fwcloud} as fwcloud, ${position.firewall} as firewall,
                    rule, O.id as ipobj,-1,-1 as interface,position,position_order, "O" as type
                    FROM policy_r__ipobj P
                    inner join interface I on I.id=P.interface
                    inner join ipobj O on O.interface=I.id
                    WHERE rule=${position.rule} AND position=${position.id} ` +
                    
                    //SELECT IPOBJ UNDER OPENVPN POSITION O
                    `UNION SELECT ${position.fwcloud} as fwcloud, ${position.firewall} as firewall,
                    rule, O.id as ipobj,-1,-1 as interface,position,position_order, "O" as type
                    FROM policy_r__openvpn P
                    inner join openvpn_opt OPT on OPT.openvpn=P.openvpn
                    inner join ipobj O on O.id=OPT.ipobj
                    WHERE rule=${position.rule} AND position=${position.id} AND OPT.name='ifconfig-push' ` +

                    //SELECT IPOBJ UNDER OPENVPN IN GROUP 
                    `UNION SELECT ${position.fwcloud} as fwcloud, ${position.firewall} as firewall,
                    rule, O.id as ipobj, P.ipobj_g, -1 as interface, position, position_order, "O" as type
                    FROM policy_r__ipobj P
                    inner join openvpn__ipobj_g G on G.ipobj_g=P.ipobj_g
                    inner join openvpn VPN on VPN.id=G.openvpn
                    inner join openvpn_opt OPT on OPT.openvpn=G.openvpn
                    inner join ipobj O on O.id=OPT.ipobj
                    WHERE rule=${position.rule} AND position=${position.id} AND OPT.name='ifconfig-push' ` +
                    
                    //SELECT IPOBJ UNDER OPENVPN PREFIX POSITION O
                    `UNION SELECT ${position.fwcloud} as fwcloud, ${position.firewall} as firewall,
                    rule, O.id as ipobj,-1,-1 as interface,position,position_order, "O" as type
                    FROM policy_r__openvpn_prefix P
                    inner join openvpn_prefix PRE on PRE.id=P.prefix
                    inner join openvpn VPN on VPN.openvpn=PRE.openvpn
                    inner join crt CRT on CRT.id=VPN.crt
                    inner join openvpn_opt OPT on OPT.openvpn=VPN.id
                    inner join ipobj O on O.id=OPT.ipobj
                    WHERE rule=${position.rule} AND position=${position.id} 
                    AND CRT.type=1 AND CRT.cn like CONCAT(PRE.name,'%') AND OPT.name='ifconfig-push' ` +

                    //SELECT IPOBJ UNDER OPENVPN PREFIX IN GROUP
                    `UNION SELECT ${position.fwcloud} as fwcloud, ${position.firewall} as firewall,
                    rule, O.id as ipobj,-1,-1 as interface,position,position_order, "O" as type
                    FROM policy_r__ipobj P
                    inner join openvpn_prefix__ipobj_g G on G.ipobj_g=P.ipobj_g
                    inner join openvpn_prefix PRE on PRE.id=G.prefix
                    inner join openvpn VPN on VPN.openvpn=PRE.openvpn
                    inner join crt CRT on CRT.id=VPN.crt
                    inner join openvpn_opt OPT on OPT.openvpn=VPN.id
                    inner join ipobj O on O.id=OPT.ipobj
                    WHERE rule=${position.rule} AND position=${position.id} 
                    AND CRT.type=1 AND CRT.cn like CONCAT(PRE.name,'%') AND OPT.name='ifconfig-push' ` +

                    `ORDER BY position_order`;

                dbCon.query(sql, async (error, rows) => {
                    if (error) return reject(error);

                    try {
                        position.ipobjs = await Promise.all(rows.map(data => IPObj.getFinalIpobjPro(data)));
                        resolve({"id": position.id, "name": position.name, "position_order": position.position_order, "position_objs": position.ipobjs});
                    }	catch(error) { reject(error) }
                });
            });
        });
    }


    public static getRulePositionData(position) {
        return new Promise((resolve, reject) => {
            db.get((error, dbCon) => {
                if (error) return reject(error);

                var position_node = new data_policy_positions(position);

                let sql = `SELECT rule, ipobj, ipobj_g, interface, position, position_order, "O" as type 
                    FROM policy_r__ipobj WHERE rule=${position.rule} AND position=${position.id}

                    UNION SELECT rule, interface, 0, 0, position, position_order, "I" as type 
                    FROM policy_r__interface WHERE rule=${position.rule} AND position=${position.id}

                    UNION SELECT rule, openvpn, 0, 0, position, position_order, "VPN" as type 
                    FROM policy_r__openvpn WHERE rule=${position.rule} AND position=${position.id}

                    UNION SELECT rule, prefix, 0, 0, position, position_order, "PRO" as type 
                    FROM policy_r__openvpn_prefix WHERE rule=${position.rule} AND position=${position.id}
                    ORDER BY position_order`;
                
                dbCon.query(sql, async (error, items) => {
                    if (error) return reject(error);

                    try {
                        //obtenemos IPOBJS o INTERFACES o GROUPS
                        //for (k = 0; k < data__rule_ipobjs.length; k++) {
                        //creamos array de ipobj
                        position_node.ipobjs = new Array();

                        for (let item of items) {
                            let data = {};
                            if (item.ipobj>0 && item.type==='O') // IPOBJ
                            data = await IPObj.getIpobj(dbCon, position.fwcloud, item.ipobj);
                            else if (item.ipobj_g>0 && item.type==='O') // IPOBJ GROUP
                                data = await IPObjGroup.getIpobj_g(dbCon, position.fwcloud, item.ipobj_g);
                            else if (item.interface>0 || item.type==='I') { // Network interface.
                                data = await Interface.getInterface(position.fwcloud, (item.type==='I')?item.ipobj:item.interface);
                                item.type='I'; // We need this when we create the data_policy_position_ipobjs object.
                            }
                            else if (item.ipobj>0 && item.type==='VPN') // OPENVPN
                                data = await OpenVPN.getOpenvpnInfo(dbCon, position.fwcloud, item.ipobj,1);
                            else if (item.ipobj>0 && item.type==='PRO') // OPENVPN PREFIXES
                                data = await OpenVPNPrefix.getPrefixOpenvpnInfo(dbCon, position.fwcloud, item.ipobj);
                            else data = null;

                            if (data) {
                                var ipobj_node = new data_policy_position_ipobjs(data[0], item.position_order, item.type);
                                // Add new object node to positions array.
                                position_node.ipobjs.push(ipobj_node);
                            }
                        }
            
                        resolve(position_node);
                    } catch(error) { reject(error) }
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
            logger.debug(sql);
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