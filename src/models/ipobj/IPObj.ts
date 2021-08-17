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
import { PolicyRuleToIPObj } from '../../models/policy/PolicyRuleToIPObj';
import { IPObjGroup } from './IPObjGroup';
import { InterfaceIPObj } from '../../models/interface/InterfaceIPObj';
import { IPObjToIPObjGroup } from '../../models/ipobj/IPObjToIPObjGroup';
import { Interface } from '../../models/interface/Interface';
import Model from '../Model';
import { PrimaryGeneratedColumn, Column, Entity, ManyToOne, JoinColumn, OneToMany, ManyToMany, getRepository, SelectQueryBuilder } from 'typeorm';
import { FwCloud } from '../fwcloud/FwCloud';
import { logger } from '../../fonaments/abstract-application';
import { IPObjType } from './IPObjType';
import { OpenVPNOption } from '../vpn/openvpn/openvpn-option.model';
import { Route } from '../routing/route/route.model';
import { RoutingRule } from '../routing/routing-rule/routing-rule.model';
import { IdManager } from '../../fwcloud-exporter/database-importer/terraformer/mapper/id-manager';
const ip = require('ip');
var asyncMod = require('async');
var host_Data = require('../../models/data/data_ipobj_host');
var interface_Data = require('../../models/data/data_interface');
var ipobj_Data = require('../../models/data/data_ipobj');
var data_policy_position_ipobjs = require('../../models/data/data_policy_position_ipobjs');
const fwcError = require('../../utils/error_table');

const tableName: string = "ipobj";

@Entity(tableName)
export class IPObj extends Model {

    @PrimaryGeneratedColumn()
    id: number;

    @Column()
    name: string;

    @Column()
    protocol: number;

    @Column()
    address: string;

    @Column()
    netmask: string;

    @Column()
    diff_serv: number;

    @Column()
    ip_version: number;

    @Column()
    icmp_type: number;

    @Column()
    icmp_code: number;

    @Column()
    tcp_flags_mask: number;

    @Column()
    tcp_flags_settings: number;

    @Column()
    range_start: string;

    @Column()
    range_end: string;

    @Column()
    source_port_start: number;

    @Column()
    source_port_end: number;

    @Column()
    destination_port_start: number;

    @Column()
    destination_port_end: number;

    @Column()
    options: string;

    @Column()
    comment: string;

    @Column()
    created_at: Date;

    @Column()
    updated_at: Date;

    @Column()
    created_by: number;

    @Column()
    updated_by: number;

    @Column({name: 'fwcloud'})
    fwCloudId: number;

    @ManyToOne(type => FwCloud, fwcloud => fwcloud.ipObjs)
    @JoinColumn({
        name: 'fwcloud'
    })
    fwCloud: FwCloud;

    @Column({name: 'type'})
    ipObjTypeId: number;

    @ManyToOne(type => IPObjType, ipObjType => ipObjType.ipObjs)
    @JoinColumn({
        name: 'type'
    })
    ipObjType: IPObjType;

    @Column({name: 'interface'})
    interfaceId: number;
    
    @ManyToOne(type => Interface, _interface => _interface.ipObjs)
    @JoinColumn({
        name: 'interface'
    })
    interface: Interface

    @OneToMany(type => OpenVPNOption, options => options.ipObj)
    optionsList: Array<OpenVPNOption>;

    @OneToMany(type => IPObjToIPObjGroup, ipObjToIPObjGroup => ipObjToIPObjGroup.ipObj)
    ipObjToIPObjGroups!: Array<IPObjToIPObjGroup>;

    @OneToMany(type => InterfaceIPObj, interfaceIPObj => interfaceIPObj.hostIPObj)
    hosts!: Array<InterfaceIPObj>;

    /**
    * Pending foreign keys.
    @OneToMany(type => PolicyRuleToIPObj, policyRuleToIPObj => policyRuleToIPObj.ipObj)
    policyRuleToIPObjs: Array<PolicyRuleToIPObj>;
    */

    @OneToMany(type => Route, model => model.gateway)
	routeGateways: Route[];

    @ManyToMany(type => RoutingRule, routingRule => routingRule.ipObjs)
    routingRules: RoutingRule[]

    @ManyToMany(type => Route, route => route.ipObjs)
    routes: Route[]

    public getTableName(): string {
        return tableName;
    }

    public isStandard(): boolean {
        return this.id < 100000;
    }

    /**
     * Get ipobj by Ipobj id
     * 
     * @method getIpobj
     * 
     * @param {Integer} req.body.fwcloud FwCloud identifier
     * @param {Integer} req.body.id Ipobj identifier
     * 
     * @return {ROW} Returns ROW Data from Ipobj and FWC_TREE
     * */
    public static getIpobj(dbCon, fwcloud, id) {
        return new Promise((resolve, reject) => {
            var sql = `SELECT I.* FROM ${tableName} I
			WHERE I.id=${id} AND (I.fwcloud=${fwcloud} OR I.fwcloud IS NULL)`;

            dbCon.query(sql, async (error, rows) => {
                if (error) return reject(error);

                if (rows.length > 0) {
                    if (rows[0].type === 8) { //CHECK IF IPOBJ IS a HOST
                        this.getIpobj_Host_Full(fwcloud, id, (errorhost, datahost) => {
                            if (errorhost) return reject(errorhost);
                            resolve(datahost);
                        });
                    } else if (rows[0].type === 5 && rows[0].interface != null) { // Address that is part of an interface.
                        try {
                            await this.addressParentsData(dbCon, rows[0]);
                            resolve(rows);
                        } catch (error) { return reject(error) }
                    } else
                        resolve(rows);
                } else
                    resolve(rows);
            });
        });
    };

    public static addressParentsData(connection, addr) {
        return new Promise((resolve, reject) => {
            let sql = 'select I.name' +
                ' ,case when I.firewall is not null then F.id end as firewall_id' +
                ' ,case when I.firewall is not null then F.name end as firewall_name' +
                ' ,case when C.id is not null then C.id end as cluster_id' +
                ' ,case when C.name is not null then C.name end as cluster_name' +
                ' ,case when OBJ.id is not null then OBJ.id end as host_id' +
                ' ,case when OBJ.name is not null then OBJ.name end as host_name' +
                ' from interface I' +
                ' left join firewall F on F.id=I.firewall' +
                ' left join cluster C on C.id=F.cluster' +
                ' left join interface__ipobj II on II.interface=I.id' +
                ' left join ipobj OBJ on OBJ.id=II.ipobj' +
                ' where I.id=' + connection.escape(addr.interface);
            connection.query(sql, (error, rows) => {
                if (error) return reject(error);
                if (rows.length != 1) return reject(fwcError.NOT_FOUND);

                if (rows[0].cluster_id) {
                    addr.cluster_id = rows[0].cluster_id;
                    addr.cluster_name = rows[0].cluster_name;
                }
                if (rows[0].firewall_id) {
                    addr.firewall_id = rows[0].firewall_id;
                    addr.firewall_name = rows[0].firewall_name;
                }
                if (rows[0].host_id) {
                    addr.host_id = rows[0].host_id;
                    addr.host_name = rows[0].host_name;
                }
                addr.if_id = addr.interface;
                addr.if_name = rows[0].name;

                resolve(addr);
            });
        });
    }


    /**
     * Get ipobj by Ipobj id
     * 
     * @method getIpobjPro
     * 
     * @param {Integer} fwcloud FwCloud identifier
     * @param {Integer} id Ipobj identifier
     * 
     * @return {ROW} Returns ROW Data from Ipobj and FWC_TREE
     * */
    public static getIpobjPro(position_ipobj) {
        return new Promise((resolve, reject) => {
            db.get((error, connection) => {
                if (error) return reject(error);

                //SELECT IPOBJ DATA UNDER POSITION
                var sql = 'SELECT I.*, T.id id_node, T.id_parent id_parent_node ' +
                    ' FROM ' + tableName + ' I ' +
                    ' inner join fwc_tree T on T.id_obj=I.id and T.obj_type=I.type AND (T.fwcloud=' + connection.escape(position_ipobj.fwcloud) + ' OR T.fwcloud IS NULL)' +
                    ' inner join fwc_tree P on P.id=T.id_parent ' + //  and P.obj_type<>20 and P.obj_type<>21' +
                    ' WHERE I.id = ' + connection.escape(position_ipobj.ipobj) + ' AND (I.fwcloud=' + connection.escape(position_ipobj.fwcloud) + ' OR I.fwcloud IS NULL)';

                logger().debug("getIpobjPro -> ", sql);
                connection.query(sql, (error, row) => {
                    if (error) {
                        reject(error);
                    } else {
                        if (row.length > 0) {
                            //CHECK IF IPOBJ IS a HOST
                            if (row[0].type === 8) {
                                logger().debug("======== > ENCONTRADO HOST: " + position_ipobj.ipobj);
                                //GET ALL HOST INTERFACES
                                Interface.getInterfacesHost_Full_Pro(position_ipobj.ipobj, position_ipobj.fwcloud)
                                    .then(interfacesHost => {

                                        //RETURN IPOBJ HOST DATA                                                                            
                                        var hostdata = new data_policy_position_ipobjs(row[0], position_ipobj.position_order, 'O');
                                        hostdata.interfaces = interfacesHost;

                                        resolve(hostdata);
                                    })
                                    .catch(e => {
                                        resolve();
                                    });
                            } else {
                                //RETURN IPOBJ DATA
                                var ipobj = new data_policy_position_ipobjs(row[0], position_ipobj.position_order, 'O');
                                //logger().debug("------------------- > ENCONTRADO IPOBJ: " + position_ipobj.ipobj + "  EN POSITION: " + position_ipobj.position);
                                resolve(ipobj);
                            }
                        } else if (position_ipobj.type === 'I') {
                            //SEARCH INTERFACE DATA
                            Interface.getInterfaceFullPro(position_ipobj.firewall, position_ipobj.fwcloud, position_ipobj.ipobj)
                                .then(dataInt => {
                                    logger().debug("------- > ENCONTRADA INTERFACE: " + position_ipobj.ipobj + "  EN POSITION: " + position_ipobj.position);
                                    //var ipobj = new data_policy_position_ipobjs(dataInt[0], position_ipobj.position_order, 'I');
                                    //RETURN INTERFACE DATA
                                    resolve(dataInt);
                                })
                                .catch(() =>
                                    resolve({})
                                );
                        } else if (position_ipobj.type === 'O' && position_ipobj.ipobj_g > 0) {
                            logger().debug("======== > ENCONTRADO GROUP: " + position_ipobj.ipobj_g);
                            //GET ALL GROUP's IPOBJS
                            IPObjGroup.getIpobj_g_Full_Pro(position_ipobj.fwcloud, position_ipobj.ipobj_g)
                                .then(ipobjsGroup => {
                                    logger().debug("-------------------------> FINAL de GROUP : " + position_ipobj.ipobj_g + " ----");
                                    //RETURN IPOBJ GROUP DATA                                                                            
                                    var groupdata = new data_policy_position_ipobjs(position_ipobj, position_ipobj.position_order, 'G');
                                    groupdata.ipobjs = ipobjsGroup;
                                    resolve(groupdata);
                                })
                                .catch(e => {
                                    resolve({});
                                });

                        } else {
                            resolve({});
                        }


                    }
                });
            });
        });
    };


    //Get ipobj HOST by  id and ALL IPOBjs
    /**
     * Get ipobj HOST DATA and Interfaces and Ipobj bellow Interfaces
     * 
     * @method getIpobj_Host_Full
     * 
     * @param {Integer} fwcloud FwCloud identifier
     * @param {Integer} id Ipobj identifier
     * 
     * @return {ROW} Returns ROW Data from Ipobj_Host/Interfaces/Ipobjs
     * */
    public static getIpobj_Host_Full(fwcloud, id, AllDone) {

        var hosts = [];
        var host_cont = 0;
        var ipobjs_cont = 0;
        var interfaces_cont = 0;

        db.get((error, connection) => {
            if (error)
                AllDone(error, null);

            var sqlId = '';
            if (id !== '')
                sqlId = ' AND G.id = ' + connection.escape(id);
            var sql = 'SELECT G.*,  T.id id_node, T.id_parent id_parent_node FROM ' + tableName + ' G ' +
                'inner join fwc_tree T on T.id_obj=G.id and T.obj_type=G.type AND (T.fwcloud=' + connection.escape(fwcloud) + ' OR T.fwcloud IS NULL) ' +
                ' WHERE  (G.fwcloud= ' + connection.escape(fwcloud) + ' OR G.fwcloud is null) ' + sqlId;
            logger().debug(sql);
            connection.query(sql, (error, rows) => {
                if (error)
                    AllDone(error, null);
                else if (rows.length > 0) {
                    host_cont = rows.length;
                    var row = rows[0];
                    asyncMod.map(rows, (row, callback1) => {

                        var host_node = new host_Data(row);

                        logger().debug(" ---> DENTRO de HOST: " + row.id + " NAME: " + row.name);
                        var idhost = row.id;
                        host_node.interfaces = new Array();

                        //GET ALL HOST INTERFACES
                        Interface.getInterfacesHost(idhost, fwcloud, (error, data_interfaces) => {
                            if (data_interfaces.length > 0) {
                                interfaces_cont = data_interfaces.length;

                                asyncMod.map(data_interfaces, (data_interface, callback2) => {
                                    //GET INTERFACES
                                    logger().debug("--> DENTRO de INTERFACE id:" + data_interface.id + "  Name:" + data_interface.name + "  Type:" + data_interface.interface_type)

                                    var interface_node = new interface_Data(data_interface);
                                    var idinterface = data_interface.id;

                                    interface_node.ipobjs = new Array();

                                    //GET ALL INTERFACE OBJECTs
                                    this.getAllIpobjsInterface(fwcloud, idinterface, (error, data_ipobjs) => {
                                        if (data_ipobjs.length > 0) {
                                            ipobjs_cont = data_ipobjs.length;

                                            asyncMod.map(data_ipobjs, (data_ipobj, callback2) => {
                                                //GET OBJECTS
                                                logger().debug("--> DENTRO de OBJECT id:" + data_ipobj.id + "  Name:" + data_ipobj.name + "  Type:" + data_ipobj.type);

                                                var ipobj_node = new ipobj_Data(data_ipobj);
                                                //Añadimos ipobj a array Interfaces
                                                interface_node.ipobjs.push(ipobj_node);
                                                callback2();
                                            }, //Fin de bucle de IPOBJS
                                                function (err) {

                                                    if (interface_node.ipobjs.length >= ipobjs_cont) {
                                                        host_node.interfaces.push(interface_node);
                                                        if (host_node.interfaces.length >= interfaces_cont) {
                                                            hosts.push(host_node);
                                                            if (hosts.length >= host_cont) {
                                                                AllDone(null, hosts);
                                                            }
                                                        }
                                                    }
                                                }
                                            );
                                        } else {
                                            host_node.interfaces.push(interface_node);
                                            if (host_node.interfaces.length >= interfaces_cont) {
                                                hosts.push(host_node);
                                                if (hosts.length >= host_cont) {
                                                    AllDone(null, hosts);
                                                }
                                            }
                                        }
                                    }
                                    );

                                    callback2();
                                }, //Fin de bucle de INTERFACES
                                    function (err) {

                                        //                                        if (host_node.interfaces.length >= interfaces_cont) {
                                        //                                            hosts.push(host_node);
                                        //                                            if (hosts.length >= host_cont) {
                                        //                                                AllDone(null, hosts);
                                        //                                            }
                                        //                                        }
                                    }
                                );
                            } else {
                                hosts.push(host_node);
                                if (hosts.length >= host_cont) {
                                    AllDone(null, hosts);
                                }
                            }
                        }
                        );
                        callback1();
                    }, //Fin de bucle de GROUPS
                        function (err) {
                            if (hosts.length >= host_cont) {

                                AllDone(null, hosts);
                            }
                        }
                    );
                } else {
                    AllDone("", null);
                }
            });
        });
    };

    /**
     * Get All ipobj by Group
     * 
     * @method getAllIpobjsGroup
     * 
     * @param {Integer} fwcloud FwCloud identifier
     * @param {Integer} idgroup Group identifier
     * 
     * @return {ROWS} Returns ROWS Data from Ipobj and FWC_TREE
     * */
    public static getAllIpobjsGroup(fwcloud, idgroup, callback) {

        db.get((error, connection) => {
            if (error)
                callback(error, null);

            var sql = 'SELECT * FROM ' + tableName + ' I ' +
                ' INNER JOIN ipobj__ipobjg G on G.ipobj=I.id ' +
                ' WHERE  G.ipobj_g=' + idgroup +
                ' AND (I.fwcloud=' + fwcloud + ' OR I.fwcloud IS NULL) ORDER BY G.id_gi';
            //var sql = 'SELECT I.*, T.id id_node, T.id_parent id_parent_node  FROM ' + tableModel + ' I ' +
            //	' INNER JOIN ipobj__ipobjg G on G.ipobj=I.id ' +
            //	' inner join fwc_tree T on T.id_obj=I.id and T.obj_type=I.type AND (T.fwcloud=' + fwcloud + ' OR T.fwcloud IS NULL)' +
            //	' inner join fwc_tree P on P.id=T.id_parent  and P.obj_type<>20 and P.obj_type<>21' +
            //	' WHERE G.ipobj_g=' + idgroup + ' AND (I.fwcloud=' + fwcloud + ' OR I.fwcloud IS NULL)' +
            //	' ORDER BY G.id_gi';

            connection.query(sql, (error, rows) => {
                if (error)
                    callback(error, null);
                else
                    callback(null, rows);
            });
        });
    };

    /**
     * Get All ipobj by Interface
     * 
     * @method getAllIpobjsInterface
     * 
     * @param {Integer} fwcloud FwCloud identifier
     * @param {Integer} idinterface Interface identifier
     * 
     * @return {ROWS} Returns ROWS Data from Ipobj and FWC_TREE
     * */
    public static getAllIpobjsInterface(fwcloud, idinterface, callback) {

        db.get((error, connection) => {
            if (error)
                callback(error, null);



            var sql = 'SELECT I.*, T.id id_node, T.id_parent id_parent_node  FROM ' + tableName + ' I ' +
                ' inner join fwc_tree T on T.id_obj=I.id and T.obj_type=I.type AND (T.fwcloud=' + connection.escape(fwcloud) + ')' +
                ' inner join fwc_tree P on P.id=T.id_parent  and P.obj_type<>20 and P.obj_type<>21' +
                ' WHERE I.interface=' + connection.escape(idinterface) + ' AND (I.fwcloud=' + connection.escape(fwcloud) + ' OR I.fwcloud IS NULL)' +
                ' ORDER BY I.id';
            logger().debug(sql);

            connection.query(sql, (error, rows) => {
                if (error)
                    callback(error, null);
                else
                    callback(null, rows);
            });
        });
    };

    /**
     * Get All ipobj by Interface PROMISE
     * 
     * @method getAllIpobjsInterface
     * 
     * @param {Integer} fwcloud FwCloud identifier
     * @param {Integer} idinterface Interface identifier
     * 
     * @return {ROWS} Returns ROWS Data from Ipobj and FWC_TREE
     * */
    public static getAllIpobjsInterfacePro(data) {
        var fwcloud = data.fwcloud;

        return new Promise((resolve, reject) => {
            db.get((error, connection) => {
                if (error) return reject(error);

                var sql = 'SELECT I.id as ipobj, I.*, T.id id_node, T.id_parent id_parent_node  FROM ' + tableName + ' I ' +
                    ' inner join fwc_tree T on T.id_obj=I.id and T.obj_type=I.type AND (T.fwcloud=' + connection.escape(fwcloud) + ' )' +
                    ' inner join fwc_tree P on P.id=T.id_parent  and P.obj_type<>20 and P.obj_type<>21' +
                    ' WHERE I.interface=' + connection.escape(data.id) + ' AND (I.fwcloud=' + connection.escape(fwcloud) + ' OR I.fwcloud IS NULL)' +
                    ' ORDER BY I.id';
                //logger().debug("getAllIpobjsInterfacePro -> ", sql);
                var _interface = new interface_Data(data);
                connection.query(sql, (error, rows) => {
                    if (error) return reject(error);
                    Promise.all(rows.map(data => this.getIpobjData(data)))
                        .then(ipobjs => {
                            _interface.ipobjs = ipobjs;
                            resolve(_interface);
                        })
                        .catch(e => resolve(null));
                });
            });
        });
    };

    private static getIpobjData(row) {
        return new Promise((resolve, reject) => {
            var ipobj = new ipobj_Data(row);
            resolve(ipobj);
        });
    }



    public static getIpobjInfo(dbCon, fwcloud, ipobj) {
        return new Promise((resolve, reject) => {
            const sql = 'SELECT * FROM ipobj WHERE fwcloud=' + fwcloud + ' AND id=' + ipobj;
            dbCon.query(sql, (error, result) => {
                if (error) return reject(error);
                if (result.length < 1) return reject(fwcError.NOT_FOUND);

                resolve(result[0]);
            });
        });
    };


    /**
     * Add ipobj
     * 
     * @method insertIpobj
     * 
     * @param {Object} ipobjData Ipobj Data
     * 
     * @return {JSON} Returns JSON result
     * @example 
     * #### JSON RESPONSE OK:
     *      {result: true, "insertId": result.insertId}
     * 
     * #### JSON RESPONSE ERROR:
     *      {result: false, "insertId": ''}
     * */
    public static insertIpobj(dbCon, ipobjData) {
        return new Promise((resolve, reject) => {
            // The IDs for the user defined IP Objects begin from the value 100000. 
            // IDs values from 0 to 99999 are reserved for standard IP Objects.
            dbCon.query(`SELECT ID FROM ${tableName} ORDER BY ID DESC LIMIT 1`, (error, result) => {
                if (error) return reject(error);

                ipobjData.id = ((result[0].ID >= 100000) ? (result[0].ID + 1) : 100000);
                dbCon.query(`INSERT INTO ${tableName} SET ?`, ipobjData, (error, result) => {
                    if (error) return reject(error);
                    resolve(result.insertId);
                });
            });
        });
    };

    public static cloneIpobj(ipobjDataclone) {
        return new Promise((resolve, reject) => {
            db.get((error, connection) => {
                if (error) return reject(error);

                var ipobjData = {
                    id: null,
                    fwcloud: ipobjDataclone.fwcloud,
                    interface: ipobjDataclone.newinterface,
                    name: ipobjDataclone.name,
                    type: ipobjDataclone.type,
                    protocol: ipobjDataclone.protocol,
                    address: ipobjDataclone.address,
                    netmask: ipobjDataclone.netmask,
                    diff_serv: ipobjDataclone.diff_serv,
                    ip_version: ipobjDataclone.ip_version,
                    icmp_code: ipobjDataclone.icmp_code,
                    icmp_type: ipobjDataclone.icmp_type,
                    tcp_flags_mask: ipobjDataclone.tcp_flags_mask,
                    tcp_flags_settings: ipobjDataclone.tcp_flags_settings,
                    range_start: ipobjDataclone.range_start,
                    range_end: ipobjDataclone.range_end,
                    source_port_start: ipobjDataclone.source_port_start,
                    source_port_end: ipobjDataclone.source_port_end,
                    destination_port_start: ipobjDataclone.destination_port_start,
                    destination_port_end: ipobjDataclone.destination_port_end,
                    options: ipobjDataclone.options,
                    comment: ipobjDataclone.comment
                };
                connection.query('INSERT INTO ' + tableName + ' SET ?', ipobjData, (error, result) => {
                    if (error) return reject(error);
                    resolve({ "id_org": ipobjDataclone.id, "id_clon": result.insertId });
                });
            });
        });
    };

    /**
     * Update ipobj
     * 
     * @method updateIpobj
     * 
     * @param {Object} ipobjData Ipobj Data
     * 
     * @return {JSON} Returns JSON result
     * @example 
     * #### JSON RESPONSE OK:
     *      {result: true}
     * 
     * #### JSON RESPONSE ERROR:
     *      {result: false}
     * */
    public static updateIpobj(req, ipobjData) {
        return new Promise((resolve, reject) => {
            var sql = 'UPDATE ' + tableName + ' SET ' +
                'fwcloud = ' + ipobjData.fwcloud + ',' +
                'interface = ' + req.dbCon.escape(ipobjData.interface) + ',' +
                'name = ' + req.dbCon.escape(ipobjData.name) + ',' +
                'type = ' + req.dbCon.escape(ipobjData.type) + ',' +
                'protocol = ' + req.dbCon.escape(ipobjData.protocol) + ',' +
                'address = ' + req.dbCon.escape(ipobjData.address) + ',' +
                'netmask = ' + req.dbCon.escape(ipobjData.netmask) + ',' +
                'diff_serv = ' + req.dbCon.escape(ipobjData.diff_serv) + ',' +
                'ip_version = ' + req.dbCon.escape(ipobjData.ip_version) + ',' +
                'icmp_code = ' + req.dbCon.escape(ipobjData.icmp_code) + ',' +
                'icmp_type = ' + req.dbCon.escape(ipobjData.icmp_type) + ',' +
                'tcp_flags_mask = ' + req.dbCon.escape(ipobjData.tcp_flags_mask) + ',' +
                'tcp_flags_settings = ' + req.dbCon.escape(ipobjData.tcp_flags_settings) + ',' +
                'range_start = ' + req.dbCon.escape(ipobjData.range_start) + ',' +
                'range_end = ' + req.dbCon.escape(ipobjData.range_end) + ',' +
                'source_port_start = ' + req.dbCon.escape(ipobjData.source_port_start) + ',' +
                'source_port_end = ' + req.dbCon.escape(ipobjData.source_port_end) + ',' +
                'destination_port_start = ' + req.dbCon.escape(ipobjData.destination_port_start) + ',' +
                'destination_port_end = ' + req.dbCon.escape(ipobjData.destination_port_end) + ',' +
                'options = ' + req.dbCon.escape(ipobjData.options) + ',' +
                'comment = ' + req.dbCon.escape(ipobjData.comment) + ' ' +
                ' WHERE id = ' + ipobjData.id + ' AND fwcloud=' + ipobjData.fwcloud;
            req.dbCon.query(sql, async (error, result) => {
                if (error) return reject(error);
                resolve();
            });
        });
    };

    /**
     * ### Delete ipobj
     * 
     * @method deleteIpobj
     * 
     * @param {Integer} id id ipobj identifier
     * @param {Integer} type ipobj type
     * @param {Integer} fwcloud FwCloud identifier
     * 
     * @return {JSON} Returns JSON result
     * @example 
     * #### JSON RESPONSE OK:
     * 
     *      {"result": true, "msg": "deleted"}
     * 
     * #### JSON RESPONSE ERROR NOT EXIST:
     * 
     *      {"result": false, "msg": "notExist"}
     *      
     * #### JSON RESPONSE RESTRICTED:
     * 
     *      {"result": false, "msg": "Restricted", "restrictions": data.search}
     * */
    public static deleteIpobj(dbCon, fwcloud, id) {
        return new Promise((resolve, reject) => {
            dbCon.query(`DELETE FROM ${tableName}  WHERE id=${id} AND fwcloud=${fwcloud}`, (error, result) => {
                if (error) return reject(error);

                if (result.affectedRows > 0)
                    resolve({ "result": true, "msg": "deleted" });
                else
                    resolve({ "result": false, "msg": "notExist" });
            });
        });
    };

    public static deleteHost(dbCon, fwcloud, host) {
        return new Promise((resolve, reject) => {
            let sql = `select II.interface as id from interface__ipobj II
			inner join ipobj I on I.id=II.ipobj
			where II.ipobj=${host} and I.fwcloud=${fwcloud}`;
            dbCon.query(sql, async (error, interfaces) => {
                if (error) return reject(error);

                try {
                    // Delete all objects under this host.
                    for (let _interface of interfaces) {
                        await InterfaceIPObj.deleteHostInterface(dbCon, host, _interface.id);
                        await this.deleteIpobjInterface(dbCon, _interface.id);
                        await Interface.deleteInterfaceHOST(dbCon, _interface.id);
                    }

                    // Delete host ipobj.
                    await this.deleteIpobj(dbCon, fwcloud, host);
                } catch (error) { return reject(error) }

                resolve();
            });
        });
    };

    //DELETE ALL IPOBJ UNDER INTERFACE
    public static deleteIpobjInterface(dbCon, _interface) {
        return new Promise((resolve, reject) => {
            dbCon.query(`DELETE FROM ${tableName} WHERE interface=${_interface}`, (error, result) => {
                if (error) return reject(error);

                if (result.affectedRows > 0)
                    resolve({ "result": true, "msg": "deleted" });
                else
                    resolve({ "result": false, "msg": "notExist" });
            });
        });
    };

    //UPDATE HOST IF IPOBJ IS UNDER 
    public static UpdateHOST(id) {
        return new Promise((resolve, reject) => {
            db.get((error, connection) => {
                if (error)
                    reject(error);
                var sql = 'UPDATE ipobj H  ' +
                    'inner join interface__ipobj II on II.ipobj=H.id ' +
                    'inner join interface I on I.id=II.interface ' +
                    'inner join ipobj O on O.interface= I.id ' +
                    'set H.updated_at= CURRENT_TIMESTAMP ' +
                    ' WHERE O.id = ' + connection.escape(id);
                logger().debug(sql);
                connection.query(sql, async (error, result) => {
                    if (error) {
                        logger().debug(error);
                        reject(error);
                    } else {
                        if (result.affectedRows > 0) {
                            resolve({ "result": true });
                        } else {
                            resolve({ "result": false });
                        }
                    }
                });
            });
        });
    };

    //UPDATE INTEFACE IF IPOBJ IS UNDER 
    public static UpdateINTERFACE(id) {
        return new Promise((resolve, reject) => {
            db.get((error, connection) => {
                if (error)
                    reject(error);
                var sql = 'UPDATE interface I  ' +
                    'inner join ipobj O on O.interface= I.id ' +
                    'set I.updated_at= CURRENT_TIMESTAMP ' +
                    ' WHERE O.id = ' + connection.escape(id);
                logger().debug(sql);
                connection.query(sql, async (error, result) => {
                    if (error) {
                        logger().debug(error);
                        reject(error);
                    } else {
                        if (result.affectedRows > 0) {
                            resolve({ "result": true });
                        } else {
                            resolve({ "result": false });
                        }
                    }
                });
            });
        });
    };




    /**
     * ### check if IPOBJ Exists in any Group
     * 
     * @method checkIpobjInGroup
     * 
     * @param {Integer} ipobj id ipobj identifier
     * @param {Integer} type ipobj type
     * @param {Integer} fwcloud FwCloud identifier
     * 
     * @return {JSON} Returns JSON result
     * @example 
     * #### JSON RESPONSE OK:
     * 
     *      {"result": true};
     * 
     * #### JSON RESPONSE ERROR NOT EXIST:
     * 
     *      {"result": false};
     *      
     * */
    public static checkIpobjInGroup(ipobj, type, fwcloud, callback) {

        logger().debug("CHECK DELETING FROM GROUP ipobj:" + ipobj + " Type:" + type + "  fwcloud:" + fwcloud);
        db.get((error, connection) => {

            var sql = 'SELECT count(*) as n FROM ' + tableName + ' I ' +
                ' INNER JOIN ipobj__ipobjg G on G.ipobj=I.id ' +
                ' WHERE I.id=' + connection.escape(ipobj) + ' AND I.type=' + connection.escape(type) + ' AND I.fwcloud=' + connection.escape(fwcloud);
            logger().debug(sql);
            connection.query(sql, (error, rows) => {
                if (!error) {
                    if (rows.length > 0) {
                        if (rows[0].n > 0) {
                            logger().debug("ALERT DELETING ipobj IN GROUP:" + ipobj + " type: " + type + " fwcloud:" + fwcloud + " --> FOUND IN " + rows[0].n + " GROUPS");
                            callback(null, { "result": true });
                        } else {
                            callback(null, { "result": false });
                        }
                    } else
                        callback(null, { "result": false });
                } else {
                    logger().error(error);
                    callback(null, { "result": false });
                }
            });
        });

    };

    /**
     * ### searchIpobjUsage
     * Search where is used IPOBJ in RULES, OpenVPN configs, etc.
     * 
     * @method searchIpobjInRules
     * 
     * @param {Integer} id id ipobj identifier
     * @param {Integer} type ipobj type
     * @param {Integer} fwcloud FwCloud identifier
     * 
     * @return {JSON} Returns JSON result
     * @example #### JSON RESPONSE OK
     * 
     *          {"result": true, "msg": "IPOBJ FOUND", 
     *              "search":
     *                  {   "IpobjInRules": data_ipobj, 
     *                      "GroupInRules": data_grouprule, 
     *                      "IpobjInGroup": data_group,
     *                      "InterfacesIpobjInRules": data_interfaces, 
     *                      "InterfacesFIpobjInRules": data_interfaces_f,
     *                      "InterfacesAboveIpobjInRules": data_interfaces_above,
     *                      "HostIpobjInterfacesIpobjInRules": data_ipobj_host, 
     *                      "IpobjInterfacesIpobjInRules": data_ipobj_ipobj
     *                  }
     *          }
     * 
     * #### JSON RESPONSE ERROR NOT EXIST:
     * 
     *      {"result": false, "msg": "IPOBJ NOT FOUND", 
     *          "search": {
     "IpobjInRules": "", 
     "GroupInRules": "",
     "IpobjInGroup": "", 
     "InterfacesIpobjInRules": "", 
     "InterfacesFIpobjInRules": "",
     "InterfacesAboveIpobjInRules": "",
     "HostIpobjInterfacesIpobjInRules": "", 
     "IpobjInterfacesIpobjInRules": ""
     }
     }
     *      
     * */
    public static searchIpobjUsage(dbCon: any, fwcloud: number, id: number, type: number) {
        return new Promise(async (resolve, reject) => {
            try {
                let search: any = {};
                search.result = false;
                search.restrictions = {};
                search.restrictions.IpobjInRule = await PolicyRuleToIPObj.searchIpobjInRule(id, type, fwcloud); //SEARCH IPOBJ IN RULES
                search.restrictions.IpobjInGroup = await IPObjToIPObjGroup.searchIpobjInGroup(id, type, fwcloud); //SEARCH IPOBJ IN GROUPS
                search.restrictions.IpobjInGroupInRule = await PolicyRuleToIPObj.searchIpobjInGroupInRule(id, type, fwcloud); //SEARCH IPOBJ GROUP IN RULES
                search.restrictions.IpobjInOpenVPN = await this.searchIpobjInOpenvpn(id, type, fwcloud); //SEARCH IPOBJ IN OpenVPN CONFIG

                search.restrictions.IpobjInRoute = await getRepository(Route).createQueryBuilder('route')
                .where((qb) => {
                    const query: string = qb.subQuery()
                        .from(Route, 'route')
                        .select('route.id')
                        .innerJoin('route.ipObjs', 'ipObj')
                        .innerJoin('route.routingTable', 'table')
                        .innerJoin('table.firewall', 'firewall')
                        .where('ipObj.id = :ipobj', {ipobj: id})
                        .where(`firewall.fwCloudId = :fwcloud`, {fwcloud: fwcloud}).getQuery();

                        return `route.id IN ${query}`;
                })
                .orWhere((qb) => {
                    const query: string = qb.subQuery()
                        .from(Route, 'route')
                        .select('route.id')
                        .innerJoin('route.gateway', 'gateway')
                        .innerJoin('route.routingTable', 'table')
                        .innerJoin('table.firewall', 'firewall')
                        .where('gateway.id = :gateway', {gateway: id})
                        .where(`firewall.fwCloudId = :fwcloud`, {fwcloud: fwcloud}).getQuery();

                        return `route.id IN ${query}`;
                }).getMany();
                search.restrictions.IpobjInRoute = search.restrictions.IpobjInRoute.map(item => ({ ...item, route_id: item.id }));

                search.restrictions.IpobjInRoutingRule = await getRepository(RoutingRule).createQueryBuilder('rule')
                    .innerJoinAndSelect('rule.ipObjs', 'ipObj', 'ipObj.id = :ipobj', {ipobj: id})
                    .innerJoin('rule.routingTable', 'table')
                    .innerJoin('table.firewall', 'firewall')
                    .where(`firewall.fwCloudId = :fwcloud`, {fwcloud: fwcloud})
                    .getMany();
                search.restrictions.IpobjInRoutingRule = search.restrictions.IpobjInRoutingRule.map(item => ({ ...item, routing_rule_id: item.id }));


                if (type === 8) { // HOST
                    search.restrictions.InterfaceHostInRule = await PolicyRuleToIPObj.searchInterfaceHostInRule(dbCon, fwcloud, id);
                    search.restrictions.AddrHostInRule = await PolicyRuleToIPObj.searchAddrHostInRule(dbCon, fwcloud, id);
                    search.restrictions.AddrHostInGroup = await IPObjToIPObjGroup.searchAddrHostInGroup(dbCon, fwcloud, id);
                    search.restrictions.AddrHostInOpenvpn = await this.searchAddrHostInOpenvpn(dbCon, fwcloud, id);
                }

                // Avoid leaving an interface used in a rule without address.
                if (type === 5) { // ADDRESS
                    search.restrictions.LastAddrInInterfaceInRule = await PolicyRuleToIPObj.searchLastAddrInInterfaceInRule(dbCon, id, type, fwcloud);
                    search.restrictions.LastAddrInHostInRule = await PolicyRuleToIPObj.searchLastAddrInHostInRule(dbCon, id, type, fwcloud);
                    search.restrictions.LastAddrInHostInRoute = await Route.getRouteWhichLastAddressInHost(id, type, fwcloud);
                    search.restrictions.LastAddrInHostInRoutingRule = await RoutingRule.getRoutingRuleWhichLastAddressInHost(id, type, fwcloud);
                    search.restrictions.LastAddrInGroupHostInRoute = await Route.getRouteWhichLastAddressInHostInGroup(id, type, fwcloud);
                    search.restrictions.LastAddrInGroupHostInRoutingRule = await RoutingRule.getRoutingRuleWhichLastAddressInHostInGroup(id, type, fwcloud);
                }

                for (let key in search.restrictions) {
                    if (search.restrictions[key].length > 0) {
                        search.result = true;
                        break;
                    }
                }
                resolve(search);
            } catch (error) { reject(error) }
        });
    };


    //check if IPOBJ exists in and OpenVPN configuration 
    public static searchIpobjInOpenvpn(ipobj, type, fwcloud) {
        return new Promise((resolve, reject) => {
            db.get((error, connection) => {
                if (error) return reject(error);

                let sql = `SELECT VPN.*, CRT.cn,
				C.id cloud_id, C.name cloud_name, VPN.firewall firewall_id, F.name firewall_name,
				F.cluster as cluster_id, IF(F.cluster is null,null,(select name from cluster where id=F.cluster)) as cluster_name
				FROM openvpn AS VPN
				inner join crt CRT on CRT.id=VPN.crt
				INNER JOIN openvpn_opt OPT on OPT.openvpn=VPN.id
				INNER JOIN ipobj OBJ on OBJ.id=OPT.ipobj
				INNER JOIN firewall F on F.id=VPN.firewall
				inner join fwcloud C on C.id=F.fwcloud
			 	WHERE OBJ.id=${ipobj} AND OBJ.type=${type} AND (OBJ.fwcloud=${fwcloud} OR OBJ.fwcloud IS NULL)`;
                connection.query(sql, (error, rows) => {
                    if (error) return reject(error);
                    resolve(rows);
                });
            });
        });
    };

    //check if IPOBJ exists in and OpenVPN configuration 
    public static addrInIfconfigPushOpenVPN(ipobj, fwcloud) {
        return new Promise((resolve, reject) => {
            db.get((error, connection) => {
                if (error) return reject(error);

                let sql = `SELECT VPN.id
                    FROM openvpn AS VPN
                    INNER JOIN openvpn_opt OPT on OPT.openvpn=VPN.id
                    INNER JOIN firewall F on F.id=VPN.firewall
                    inner JOIN fwcloud C on C.id=F.fwcloud
                    WHERE OPT.ipobj=${ipobj} AND OPT.name='ifconfig-push' AND C.id=${fwcloud}`;
                connection.query(sql, (error, rows) => {
                    if (error) return reject(error);
                    resolve(rows);
                });
            });
        });
    };

    //check if interface ipobj exists in and OpenVPN configuration 
    public static searchIpobjInterfaceInOpenvpn(_interface, fwcloud, diff_firewall) {
        return new Promise((resolve, reject) => {
            db.get((error, connection) => {
                if (error) return reject(error);

                let sql = `SELECT VPN.*, CRT.cn,
				C.id cloud_id, C.name cloud_name, VPN.firewall firewall_id, F.name firewall_name,
				F.cluster as cluster_id, IF(F.cluster is null,null,(select name from cluster where id=F.cluster)) as cluster_name
				FROM openvpn AS VPN
				inner join crt CRT on CRT.id=VPN.crt
				INNER JOIN openvpn_opt OPT on OPT.openvpn=VPN.id
				INNER JOIN ipobj OBJ on OBJ.id=OPT.ipobj
				INNER JOIN firewall F on F.id=VPN.firewall
				inner join fwcloud C on C.id=F.fwcloud
				WHERE OBJ.interface=${_interface} AND (OBJ.fwcloud=${fwcloud} OR OBJ.fwcloud IS NULL)
				${diff_firewall ? `AND F.id<>${diff_firewall}` : ''}`;

                connection.query(sql, (error, rows) => {
                    if (error) return reject(error);
                    resolve(rows);
                });
            });
        });
    };

    //check if interface ipobj exists in and OpenVPN configuration 
    public static searchAddrHostInOpenvpn(dbCon, fwcloud, host) {
        return new Promise((resolve, reject) => {
            let sql = `SELECT VPN.*, CRT.cn,
			C.id cloud_id, C.name cloud_name, VPN.firewall firewall_id, F.name firewall_name,
			F.cluster as cluster_id, IF(F.cluster is null,null,(select name from cluster where id=F.cluster)) as cluster_name
			FROM openvpn AS VPN
			inner join crt CRT on CRT.id=VPN.crt
			INNER JOIN openvpn_opt OPT on OPT.openvpn=VPN.id
			INNER JOIN ipobj OBJ on OBJ.id=OPT.ipobj
			inner join interface__ipobj II on II.interface=OBJ.interface
			INNER JOIN firewall F on F.id=VPN.firewall
			inner join fwcloud C on C.id=F.fwcloud
			WHERE II.ipobj=${host} AND F.fwcloud=${fwcloud}`;
            dbCon.query(sql, (error, rows) => {
                if (error) return reject(error);
                resolve(rows);
            });
        });
    };


    public static searchLastInterfaceWithAddrInHostInRule(_interface, fwcloud) {
        return new Promise((resolve, reject) => {
            db.get((error, dbCon) => {
                if (error) return reject(error);

                // If this is a host interface, get data for the rules in with the host is beig used.
                let sql = `SELECT I.id obj_id, I.name obj_name, I.type obj_type_id, T.type obj_type_name,
				C.id cloud_id, C.name cloud_name, R.firewall firewall_id, F.name firewall_name,
				O.rule rule_id, R.rule_order,R.type rule_type,  PT.name rule_type_name,O.position rule_position_id, P.name rule_position_name,R.comment rule_comment,
				F.cluster as cluster_id, IF(F.cluster is null,null,(select name from cluster where id=F.cluster)) as cluster_name
				FROM policy_r__ipobj O
				INNER JOIN ipobj I ON I.id=O.ipobj
				inner join interface__ipobj II on II.ipobj=I.id
				inner join ipobj_type T on T.id=I.type
				INNER JOIN policy_r R on R.id=O.rule
				INNER JOIN firewall F on F.id=R.firewall
				inner join fwcloud C on C.id=F.fwcloud
				inner join policy_position P on P.id=O.position
				inner join policy_type PT on PT.id=R.type				
				where II.interface=${_interface} AND I.type=8 AND F.fwcloud=${fwcloud}`;

                dbCon.query(sql, async (error, rows) => {
                    if (error) return reject(error);
                    if (rows.length === 0) return resolve(rows);

                    try {
                        let host = rows[0].obj_id;
                        // Get all host addresses.
                        let all_host_addr: any = await Interface.getHostAddr(dbCon, host);
                        for (let addr of all_host_addr) {
                            // If one of the host addresses hast a different interface, then we are not removing 
                            // the last host interface with IP addresses.
                            if (addr.interface != _interface) return resolve([]);
                        }
                    } catch (error) { return reject(error) }

                    resolve(rows);
                });
            });
        });
    };

    // Search if IP without mask exists.
    public static searchAddr(dbCon, fwcloud, addr): Promise<number> {        
        return new Promise((resolve, reject) => {
            let sql = `select id from ipobj 
            where (fwcloud IS NULL OR fwcloud=${fwcloud}) AND address=${dbCon.escape(addr)} 
            AND type=5 order by id asc`; // 5: ADDRESS

            dbCon.query(sql, (error, rows) => {
                if (error) return reject(error);
                
                resolve(rows.length === 0 ? 0 : rows[0].id);
            });
        });
    };

    // Search if IP with mask exists. (IP is given in CIDR notation) 
    public static searchAddrWithMask(dbCon, fwcloud, addr, mask): Promise<number> {        
        return new Promise((resolve, reject) => {
            let sql = `select id,address,netmask from ipobj 
            where (fwcloud IS NULL OR fwcloud=${fwcloud}) AND address=${dbCon.escape(addr)} 
            AND (type=5 OR type=7) order by id asc`; // 5: ADDRESS, 7: NETWORK

            dbCon.query(sql, (error, rows) => {
                if (error) return reject(error);

                // We have two formats for the netmask (for example, 255.255.255.0 or /24).
                // We have to check if the object already exist independently of the netmask format.
                const net1 = ip.cidrSubnet(`${addr}/${mask}`);
                let net2: any = {};
                for (let row of rows) {
                    net2 = (row.netmask[0] === '/') ? ip.cidrSubnet(`${row.address}${row.netmask}`) : ip.subnet(row.address, row.netmask);
                    if (net1.subnetMaskLength===net2.subnetMaskLength)
                        resolve(row.id);
                }

                resolve(0);
            });
        });
    };

    // Search if IP with mask exists. (IP is given in CIDR notation) 
    public static searchIPRange(dbCon, fwcloud, start, end) {        
        return new Promise((resolve, reject) => {
            let sql = `select id from ipobj where (fwcloud IS NULL OR fwcloud=${fwcloud}) 
            AND range_start=${dbCon.escape(start)} AND range_end=${dbCon.escape(end)} AND type=6`; // 6: ADDRESS RANGE

            dbCon.query(sql, (error, rows) => {
                if (error) return reject(error);

                resolve(rows.length === 0 ? 0 : rows[0].id);
            });
        });
    };

    // Search if IP protocol number exists. 
    public static searchIPProtocolByNumber(dbCon, fwcloud, protocolNumber): Promise<string> {        
        return new Promise((resolve, reject) => {
            let sql = `select id from ipobj 
            where (fwcloud IS NULL OR fwcloud=${fwcloud}) AND protocol=${protocolNumber} and type=1`; // 1: IP

            dbCon.query(sql, (error, rows) => {
                if (error) return reject(error);

                resolve(rows.length === 0 ? '' : rows[0].id);
            });
        });
    };

    // Search if IP protocol name exists.
    public static searchIPProtocolByName(dbCon, fwcloud, protocolName): Promise<string> {        
        return new Promise((resolve, reject) => {
            let sql = `select id from ipobj 
            where (fwcloud IS NULL OR fwcloud=${fwcloud}) AND name=${dbCon.escape(protocolName)} and type=1`; // 1: IP

            dbCon.query(sql, (error, rows) => {
                if (error) return reject(error);

                resolve(rows.length === 0 ? '' : rows[0].id);
            });
        });
    };
    
    // Search for service port.
    public static searchPort(dbCon, fwcloud, protocol, scrPorts, dstPorts, tcpFlags, tcpFlagsSet) {        
        return new Promise((resolve, reject) => {
            let sql = `select id from ipobj 
            where (fwcloud IS NULL OR fwcloud=${fwcloud}) AND protocol=${protocol==='tcp' ? 6 : 17}
            AND source_port_start=${scrPorts[0]} AND source_port_end=${scrPorts[1]}
            AND destination_port_start=${dstPorts[0]} AND destination_port_end=${dstPorts[1]}`;

            if (tcpFlags)
                sql = `${sql} AND tcp_flags_mask=${tcpFlags} AND tcp_flags_settings=${tcpFlagsSet}`

            dbCon.query(sql, (error, rows) => {
                if (error) return reject(error);

                resolve(rows.length === 0 ? 0 : rows[0].id)
            });
        });
    };
    
    // Search for icmp service.
    public static searchICMP(dbCon, fwcloud, type, code) {        
        return new Promise((resolve, reject) => {
            let sql = `select id from ipobj 
            where (fwcloud IS NULL OR fwcloud=${fwcloud}) AND protocol=1 AND type=3
            AND icmp_type=${type} AND icmp_code=${code}`;

            dbCon.query(sql, (error, rows) => {
                if (error) return reject(error);

                resolve(rows.length === 0 ? 0 : rows[0].id)
            });
        });
    };
}