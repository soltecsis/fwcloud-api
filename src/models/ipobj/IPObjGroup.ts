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
import { IPObj } from './IPObj';
import { OpenVPN } from '../../models/vpn/openvpn/OpenVPN';
import { OpenVPNPrefix } from '../../models/vpn/openvpn/OpenVPNPrefix';
import { IPObjToIPObjGroup } from '../../models/ipobj/IPObjToIPObjGroup';
import { PolicyRuleToIPObj } from '../../models/policy/PolicyRuleToIPObj';
import { Entity, Column, getRepository, PrimaryGeneratedColumn, OneToMany, ManyToMany, ManyToOne, JoinColumn } from "typeorm";
import { logger } from "../../fonaments/abstract-application";
import { RoutingRule } from "../routing/routing-rule/routing-rule.model";
import { Route } from "../routing/route/route.model";
import { FwCloud } from "../fwcloud/FwCloud";
var asyncMod = require('async');
var ipobj_g_Data = require('../data/data_ipobj_g');
var ipobj_Data = require('../data/data_ipobj');

const fwcError = require('../../utils/error_table');

const tableName: string = 'ipobj_g';

@Entity(tableName)
export class IPObjGroup extends Model {

    @PrimaryGeneratedColumn()
    id: number;

    @Column()
    name: string;

    @Column()
    comment: string;

    @Column({name: 'type'})
    type: number;

    @Column()
    created_at: Date;

    @Column()
    updated_at: Date;


    @Column({name: 'fwcloud'})
    fwCloudId: number;

	@ManyToOne(type => FwCloud, fwcloud => fwcloud.ipObjGroups)
	@JoinColumn({
		name: 'fwcloud'
	})
	fwCloud: FwCloud;

    @OneToMany(type => IPObjToIPObjGroup, ipObjToIPObjGroup => ipObjToIPObjGroup.ipObjGroup)
    ipObjToIPObjGroups!: Array<IPObjToIPObjGroup>;

    @ManyToMany(type => OpenVPN, openVPN => openVPN.ipObjGroups)
    openVPNs: Array<OpenVPN>;

    @ManyToMany(type => OpenVPNPrefix, openVPNPrefix => openVPNPrefix.ipObjGroups)
    openVPNPrefixes: Array<OpenVPNPrefix>;

    @ManyToMany(type => RoutingRule, routingRule => routingRule.ipObjGroups)
    routingRules: RoutingRule[];

    @ManyToMany(type => Route, route => route.ipObjGroups)
    routes: Route[]


    /**
    * Pending foreign keys.
    @OneToMany(type => PolicyRuleToIPObj, model => model.ipObjGroup)
    policyRuleToIPObjs: Array<PolicyRuleToIPObj>;
    */

    public getTableName(): string {
        return tableName;
    }

    public isStandard(): boolean {
        return this.id < 100000;
    }
    
    //Get All ipobj_g
    public static getIpobjGroups(dbCon, fwcloud) {
        return new Promise((resolve, reject) => {
            dbCon.query(`SELECT * FROM ${tableName} WHERE (fwcloud=${dbCon.escape(fwcloud)} OR fwcloud is null) ORDER BY id`, (error, rows) => {
                if (error) return reject(error);
                resolve(rows);
            });
        });    
    }

    //Get ipobj_g by  id
    public static getIpobj_g(dbCon, fwcloud, id) {
        return new Promise((resolve, reject) => {
            dbCon.query(`SELECT * FROM ${tableName} WHERE id=${id} AND (fwcloud=${fwcloud} OR fwcloud is null)`, (error, rows) => {
                if (error) return reject(error);
                resolve(rows);
            });
        });
    }

    //Count group items.
    public static countGroupItems(dbCon, group) {
        return new Promise((resolve, reject) => {
            let sql = `select ipobj as id from ipobj__ipobjg where ipobj_g=${group}
            union select openvpn as id from openvpn__ipobj_g where ipobj_g=${group}
            union select prefix as id from openvpn_prefix__ipobj_g where ipobj_g=${group}`;
            dbCon.query(sql, (error, result) => {
                if (error) return reject(error);

                resolve(result.length);
            });
        });
    }


    //IP version of the group items.
    public static groupIPVersion(dbCon, group) {
        return new Promise((resolve, reject) => {
            dbCon.query(`select type from ${tableName} where id=${group}`, (error, result) => {
                if (error) return reject(error);
                if (result.length !== 1) return reject(fwcError.NOT_FOUND);
                // If this is not an IP objects group then finish without IP version.
                if (result[0].type !== 20) return resolve(0);

                let sql = `select O.type,O.ip_version from ipobj__ipobjg G
                inner join ipobj O on O.id=G.ipobj
                where G.ipobj_g=${group}`
                dbCon.query(sql, (error, result) => {
                    if (error) return reject(error);
                    if (result.length > 0) return resolve(parseInt(result[0].ip_version));

                    dbCon.query(`select count(*) as n from openvpn__ipobj_g where ipobj_g=${group}`, (error, result) => {
                        if (error) return reject(error);
                        // If there is an OpenVPN configuration in the group, then this is an IPv4 group.
                        if (result[0].n > 0) return resolve(4);

                        dbCon.query(`select count(*) as n from openvpn_prefix__ipobj_g where ipobj_g=${group}`, (error, result) => {
                            if (error) return reject(error);
                            // If there is an OpenVPN prefix in the group, then this is an IPv4 group.
                            if (result[0].n > 0) return resolve(4);

                            // If we arrive here, then the group is empty.
                            resolve(0);
                        });
                    });
                });
            });
        });
    }


    //Get ipobj_g by  id AND ALL IPOBjs
    public static getIpobj_g_Full(dbCon, fwcloud, gid) {
        return new Promise((resolve, reject) => {
            let sql = `SELECT G.*, T.id id_node, T.id_parent id_parent_node FROM ${tableName} G
            inner join fwc_tree T on T.id_obj=G.id and T.obj_type=G.type AND (T.fwcloud=${fwcloud} OR T.fwcloud IS NULL)
            WHERE (G.fwcloud=${fwcloud} OR G.fwcloud is null) AND G.id=${gid}`;
            dbCon.query(sql, (error, rows) => {
                if (error) return reject(error);
                if (rows.length === 0) return reject(fwcError.NOT_FOUND);

                let groups = [];
                let group_data = new ipobj_g_Data(rows[0]);
                group_data.ipobjs = new Array();

                sql = `select id, name, 'O' as type from ipobj O
                inner join ipobj__ipobjg R on R.ipobj=O.id
                where R.ipobj_g=${gid}
                
                UNION select O.id, C.cn as name, 'VPN' as type from openvpn O
                inner join openvpn__ipobj_g R on R.openvpn=O.id
                inner join crt C on C.id=O.crt
                where R.ipobj_g=${gid}

                UNION select id, name, 'PRO' as type from openvpn_prefix O
                inner join openvpn_prefix__ipobj_g R on R.prefix=O.id
                where R.ipobj_g=${gid}
                order by name`;
                dbCon.query(sql, async (error, rows) => {
                    if (error) return reject(error);

                    let ipobj_node;
                    for (let obj of rows) {
                        try {
                            if (obj.type === 'O')
                                ipobj_node = new ipobj_Data((await IPObj.getIpobj(dbCon, fwcloud, obj.id))[0]);
                            else if (obj.type === 'VPN')
                                ipobj_node = new ipobj_Data((await OpenVPN.getOpenvpnInfo(dbCon, fwcloud, obj.id, 1))[0]);
                            else if (obj.type === 'PRO')
                                ipobj_node = new ipobj_Data((await OpenVPNPrefix.getPrefixOpenvpnInfo(dbCon, fwcloud, obj.id))[0]);
                            group_data.ipobjs.push(ipobj_node);
                        } catch (error) { return reject(error) }
                    }

                    groups.push(group_data);
                    resolve(groups);
                });
            });
        });
    }

    //Get ipobj_g by  id AND ALL IPOBjs
    public static getIpobj_g_Full_Pro(fwcloud, id) {
        return new Promise((resolve, reject) => {
            var groups = [];
            var group_cont = 0;
            var ipobjs_cont = 0;

            db.get((error, connection) => {
                if (error)
                    reject(error);

                var sqlId = '';
                if (id !== '')
                    sqlId = ' AND G.id = ' + connection.escape(id);
                var sql = 'SELECT G.*,  T.id id_node, T.id_parent id_parent_node FROM ' + tableName + ' G ' +
                    'inner join fwc_tree T on T.id_obj=G.id and T.obj_type=G.type AND (T.fwcloud=' + connection.escape(fwcloud) + ') ' +
                    ' WHERE  (G.fwcloud= ' + connection.escape(fwcloud) + ' OR G.fwcloud is null) ' + sqlId;
                //logger().debug(sql);
                connection.query(sql, (error, rows) => {
                    if (error)
                        reject(error);
                    else if (rows.length > 0) {
                        group_cont = rows.length;
                        var row = rows[0];
                        asyncMod.map(rows, (row, callback1) => {

                            var group_node = new ipobj_g_Data(row);

                            logger().debug(" ---> DENTRO de GRUPO: " + row.id + " NAME: " + row.name);
                            var idgroup = row.id;
                            group_node.ipobjs = new Array();
                            //GET ALL GROUP OBJECTs
                            IPObj.getAllIpobjsGroup(fwcloud, idgroup, (error, data_ipobjs) => {
                                if (data_ipobjs.length > 0) {
                                    ipobjs_cont = data_ipobjs.length;

                                    asyncMod.map(data_ipobjs, (data_ipobj, callback2) => {
                                        //GET OBJECTS
                                        logger().debug("--> DENTRO de OBJECT id:" + data_ipobj.id + "  Name:" + data_ipobj.name + "  Type:" + data_ipobj.type);

                                        var ipobj_node = new ipobj_Data(data_ipobj);
                                        //Añadimos ipobj a array Grupo
                                        group_node.ipobjs.push(ipobj_node);
                                        callback2();
                                    }, //Fin de bucle de IPOBJS
                                        function (err) {

                                            if (group_node.ipobjs.length >= ipobjs_cont) {
                                                groups.push(group_node);
                                                if (groups.length >= group_cont) {
                                                    //AllDone(null, groups);
                                                    resolve(groups);
                                                }


                                            }
                                        }
                                    );
                                } else {
                                    groups.push(group_node);
                                    if (groups.length >= group_cont) {
                                        resolve(groups);
                                    }
                                }
                            }
                            );
                            callback1();
                        }, //Fin de bucle de GROUPS
                            function (err) {
                                if (groups.length >= group_cont) {

                                    resolve(groups);
                                }
                            }
                        );
                    } else {
                        reject("");
                    }
                });
            });
        });
    }

    public static searchGroupUsage(id, fwcloud) {
        return new Promise(async (resolve, reject) => {
            try {
                let search: any = {};
                search.result = false;
                search.restrictions = {};
                //search.restrictions.IpobjInGroupInRule = await PolicyRuleToIPObj.searchGroupIPObjectsInRule(id, fwcloud); //SEARCH IPOBJ GROUP IN RULES
                search.restrictions.GroupInRule = await PolicyRuleToIPObj.searchGroupInRule(id, fwcloud); //SEARCH IPOBJ GROUP IN RULES
                search.restrictions.GroupInRoute = await getRepository(Route).createQueryBuilder('route')
                    .innerJoin('route.routingTable', 'table')
                    .innerJoinAndSelect('route.ipObjGroups', 'group', 'group.id = :id', {id: id})
                    .innerJoin('table.firewall', 'firewall')
                    .where(`firewall.fwCloudId = :fwcloud`, {fwcloud: fwcloud})
                    .getMany();
                search.restrictions.GroupInRoutingRule = await getRepository(RoutingRule).createQueryBuilder('route')
                    .innerJoin('route.routingTable', 'table')
                    .innerJoinAndSelect('route.ipObjGroups', 'group', 'group.id = :id', {id: id})
                    .innerJoin('table.firewall', 'firewall')
                    .where(`firewall.fwCloudId = :fwcloud`, {fwcloud: fwcloud})
                    .getMany();

                for (let key in search.restrictions) {
                    if (search.restrictions[key].length > 0) {
                        search.result = true;
                        break;
                    }
                }
                resolve(search);
            } catch (error) { reject(error) }
        });
    }

    //Add new ipobj_g
    public static insertIpobj_g(ipobj_gData, callback) {
        db.get((error, connection) => {
            if (error) return callback(error, null);
            // The IDs for the user defined IP Objects groups begin from the value 100000. 
            // IDs values from 0 to 99999 are reserved for standard IP Objects.
            connection.query('SELECT ID FROM ' + tableName + ' ORDER BY ID DESC LIMIT 1', (error, result) => {
                if (error) return callback(error, null);
                ipobj_gData.id = ((result[0].ID >= 100000) ? (result[0].ID + 1) : 100000);
                connection.query('INSERT INTO ' + tableName + ' SET ?', ipobj_gData, (error, result) => {
                    if (error) return callback(error, null);
                    if (result.affectedRows > 0) {
                        //devolvemos la última id insertada
                        callback(null, { "insertId": result.insertId });
                    } else
                        callback(error, null);
                });
            });
        });
    }

    //Update ipobj_g
    public static updateIpobj_g(req, ipobj_gData) {
        return new Promise((resolve, reject) => {
            let sql = `UPDATE ${tableName} SET name=${req.dbCon.escape(ipobj_gData.name)}
            ,type=${ipobj_gData.type}
            ,comment=${req.dbCon.escape(ipobj_gData.comment)}
            WHERE id=${ipobj_gData.id} AND fwcloud=${req.body.fwcloud}`;
            req.dbCon.query(sql, async (error, result) => {
                if (error) return reject(error);
                resolve();
            });
        });
    }

    //Remove ipobj_g with id to remove
    public static deleteIpobj_g(dbCon, fwcloud, id, type) {
        return new Promise(async (resolve, reject) => {
            // FIRST DELETE CHILDREN
            try {
                await IPObjToIPObjGroup.deleteIpobj__ipobjgAll(dbCon, id);
            } catch (error) { return reject(error) }

            dbCon.query(`DELETE FROM ${tableName} WHERE id=${id} AND fwcloud=${fwcloud} AND type=${type}`, (error, result) => {
                if (error) return reject(error);
                resolve();
            });
        });
    }
}