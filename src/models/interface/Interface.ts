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

import { PolicyRuleToIPObj } from '../../models/policy/PolicyRuleToIPObj';
import { PolicyRuleToInterface } from '../../models/policy/PolicyRuleToInterface';
import { InterfaceIPObj } from '../../models/interface/InterfaceIPObj';
import { IPObj } from '../../models/ipobj/IPObj';
import modelEventService from "../ModelEventService";
import { getRepository, Column, PrimaryGeneratedColumn, Entity, Repository, ManyToOne, JoinColumn, OneToMany, JoinTable } from "typeorm";
import { Firewall } from "../firewall/Firewall";
import { app } from "../../fonaments/abstract-application";
import { RepositoryService } from "../../database/repository.service";
import { PolicyRule } from "../policy/PolicyRule";
import { RoutingRuleToInterface } from "../routing/routing-rule-to-interface.model";
var data_policy_position_ipobjs = require('../../models/data/data_policy_position_ipobjs');

const tableName: string = 'interface';

@Entity(tableName)
export class Interface extends Model {

    @PrimaryGeneratedColumn()
    id: number;

    @Column()
    name: string;

    @Column()
    labelName: string;

    @Column()
    comment: string;

    @Column()
    mac: string;

    @Column()
    type: string;

    @Column()
    interface_type: string;

    @Column()
    created_at: Date;

    @Column()
    updated_at: Date;

    @Column()
    created_by: number;

    @Column()
    updated_by: number;

    @ManyToOne(type => Firewall, firewall => firewall.interfaces)
    @JoinColumn({
        name: 'firewall'
    })
    firewall: Firewall;

    @OneToMany(type => IPObj, ipObj => ipObj.interface)
    ipObjs: Array<IPObj>;

    @OneToMany(type => InterfaceIPObj, interfaceIPObj => interfaceIPObj.hostInterface)
    hosts!: Array<InterfaceIPObj>;

    @OneToMany(type => PolicyRuleToInterface, policyRuleToInterface => policyRuleToInterface.policyRuleInterface)
    policyRuleToInterfaces: Array<PolicyRuleToInterface>;

    @OneToMany(type => RoutingRuleToInterface, routingRuleToInterface => routingRuleToInterface.routingRuleInterface)
    routingRuleToInterfaces: Array<PolicyRuleToInterface>;

    public getTableName(): string {
        return tableName;
    }

    public async onUpdate() {
        const policyRuleToInterfaceRepository: Repository<PolicyRuleToInterface> = (await app().getService<RepositoryService>(RepositoryService.name))
            .for(PolicyRuleToInterface);

        const policyRuleToInterfaces: PolicyRuleToInterface[] = await policyRuleToInterfaceRepository.find({interface: this.id});
        for(let i = 0; i < policyRuleToInterfaces.length; i++) {
            await modelEventService.emit('update', PolicyRuleToInterface, policyRuleToInterfaces[i])
        }

        const policyRuleToIPObjRepository: Repository<PolicyRuleToIPObj> = (await app().getService<RepositoryService>(RepositoryService.name))
            .for(PolicyRuleToIPObj);
        const policyRuleToIPObjs: PolicyRuleToIPObj[] = await policyRuleToIPObjRepository.find({interface: this.id});
        for(let i = 0; i < policyRuleToIPObjs.length; i++) {
            await modelEventService.emit('update', PolicyRuleToIPObj, policyRuleToIPObjs[i])
        }
	}

    //Get All interface by firewall
    public static getInterfaces(dbCon, fwcloud, firewall): Promise<Array<any>> {
        return new Promise((resolve, reject) => {
            let sql = `select I.* from ${tableName} I
                inner join firewall F on F.id=I.firewall
                where I.firewall=${firewall} and F.fwcloud=${fwcloud}`;
            dbCon.query(sql, (error, rows) => {
                if (error) return reject(error);
                resolve(rows);
            });
        });
    };

    //Get All interface by firewall and IPOBJ UNDER Interfaces
    public static getInterfacesFull(idfirewall, fwcloud, callback) {
        db.get((error, connection) => {
            if (error) return callback(error, null);

            var sql = 'SELECT ' + fwcloud + ' as fwcloud, I.*, T.id id_node, T.id_parent id_parent_node FROM ' + tableName + ' I' +
                ' inner join fwc_tree T on T.id_obj=I.id and T.obj_type=I.interface_type AND T.node_type="IFF" AND T.fwcloud=' + fwcloud +
                ' WHERE I.firewall=' + idfirewall + ' ORDER BY I.id';

            connection.query(sql, (error, rows) => {
                if (error)
                    callback(error, null);
                else {
                    //logger.debug("-----> BUSCANDO INTERFACES FIREWALL: ", idfirewall, " CLOUD: ", fwcloud);
                    //Bucle por interfaces
                    Promise.all(rows.map(data => IPObj.getAllIpobjsInterfacePro(data)))
                        .then(data => callback(null, data))
                        .catch(e => callback(e, null));
                }
            });
        });
    };

    //Get All interface by HOST
    public static getInterfacesHost(idhost, fwcloud, callback) {

        db.get((error, connection) => {
            if (error)
                callback(error, null);
            //var sql = 'SELECT * FROM ' + tableName + ' WHERE (firewall=' + connection.escape(idfirewall) + ' OR firewall is NULL) ' + ' ORDER BY id';
            var sql = 'SELECT I.*,  T.id id_node, T.id_parent id_parent_node, J.fwcloud  FROM ' + tableName + ' I ' +
                ' inner join fwc_tree T on T.id_obj=I.id and T.obj_type=I.interface_type AND (T.fwcloud=' + connection.escape(fwcloud) + ' OR T.fwcloud IS NULL) ' +
                ' inner join interface__ipobj O on O.interface=I.id left join ipobj J ON J.id=O.ipobj' +
                ' WHERE (O.ipobj=' + connection.escape(idhost) + ')';


            connection.query(sql, (error, rows) => {
                if (error)
                    callback(error, null);
                else
                    callback(null, rows);
            });
        });
    };

    //Get All interface by HOST and IPOBJECTS UNDER INTERFACES
    public static getInterfacesHost_Full_Pro(idhost, fwcloud) {
        return new Promise((resolve, reject) => {
            db.get((error, connection) => {
                if (error)
                    reject(error);
                //SELECT INTERFACES UNDER HOST
                var sql = 'SELECT I.*,  T.id id_node, T.id_parent id_parent_node, J.fwcloud  FROM ' + tableName + ' I ' +
                    ' inner join fwc_tree T on T.id_obj=I.id and T.obj_type=I.interface_type AND (T.fwcloud=' + connection.escape(fwcloud) + ' OR T.fwcloud IS NULL) ' +
                    ' inner join interface__ipobj O on O.interface=I.id left join ipobj J ON J.id=O.ipobj' +
                    ' WHERE (O.ipobj=' + connection.escape(idhost) + ')';

                connection.query(sql, (error, rows) => {
                    if (error)
                        reject(error);
                    else {
                        //BUCLE DE INTERFACES del HOST -> Obtenemos IPOBJS por cada Interface
                        Promise.all(rows.map(data => this.getInterfaceFullProData(data)))
                            .then(dataI => {
                                //dataI es una Inteface y sus ipobjs
                                //logger.debug("-------------------------> FINAL INTERFACES UNDER HOST : ");
                                resolve(dataI);
                            })
                            .catch(e => {
                                reject(e);
                            });
                    }
                });
            });
        });
    };

    //Get interface by  id and interface
    public static getInterfaceHost(idhost, fwcloud, id, callback) {
        db.get((error, connection) => {
            if (error)
                callback(error, null);
            var sql = 'SELECT I.*,  T.id id_node, T.id_parent id_parent_node, ' +
                ' IF(I.interface_type=10,  F.fwcloud , J.fwcloud) as fwcloud, ' +
                ' F.id as firewall_id, F.name as firewall_name, F.cluster as cluster_id, C.name as cluster_name, ' +
                ' J.id as host_id, J.name as host_name ' +
                ' FROM ' + tableName + ' I ' +
                ' inner join fwc_tree T on T.id_obj=I.id and T.obj_type=I.interface_type ' +
                ' AND (T.fwcloud=' + connection.escape(fwcloud) + ' OR T.fwcloud IS NULL) ' +
                ' left join interface__ipobj O on O.interface=I.id ' +
                ' left join ipobj J ON J.id=O.ipobj ' +
                ' left join firewall F on F.id=I.firewall ' +
                ' left join cluster C on C.id=F.cluster ' +
                ' WHERE I.id = ' + connection.escape(id);

            //logger.debug("INTERFACE SQL: " + sql);
            connection.query(sql, (error, row) => {
                if (error) {
                    logger.debug("ERROR getinterface: ", error, "\n", sql);
                    callback(error, null);
                } else
                    callback(null, row);
            });
        });
    };

    //Get interface by  id and interface
    public static getInterface(fwcloud, id) {
        return new Promise((resolve, reject) => {
            db.get((error, dbCon) => {
                if (error) return reject(error);
                var sql = `SELECT I.*,
                    IF(I.interface_type=10, F.fwcloud , J.fwcloud) as fwcloud,
                    F.id as firewall_id, F.name as firewall_name, F.cluster as cluster_id, C.name as cluster_name,
                    J.id as host_id, J.name as host_name
                    FROM ${tableName} I
                    left join interface__ipobj O on O.interface=I.id
                    left join ipobj J ON J.id=O.ipobj
                    left join firewall F on F.id=I.firewall
                    left join cluster C on C.id=F.cluster
                    WHERE I.id=${id}`;
                dbCon.query(sql, (error, row) => {
                    if (error) return reject(error);
                    resolve(row);
                });
            });
        });
    };

    public static getInterfaceFullProData(data) {
        return new Promise((resolve, reject) => {
            this.getInterfaceFullPro(data.idfirewall, data.fwcloud, data.id)
                .then(dataI => {
                    resolve(dataI);
                })
                .catch(e => {
                    reject(e);
                });
        });
    };

    //Get interface by  id and interface
    public static getInterfaceFullPro(idfirewall, fwcloud, id) {
        return new Promise((resolve, reject) => {
            db.get((error, connection) => {
                if (error)
                    reject(error);
                //SELECT INTERFACE
                var sql = 'SELECT I.*,  T.id id_node, T.id_parent id_parent_node, ' +
                    ' IF(I.interface_type=10,  F.fwcloud , J.fwcloud) as fwcloud ' +
                    ' FROM ' + tableName + ' I ' +
                    ' inner join fwc_tree T on T.id_obj=I.id and T.obj_type=I.interface_type ' +
                    ' AND (T.fwcloud=' + connection.escape(fwcloud) + ' OR T.fwcloud IS NULL) ' +
                    ' left join interface__ipobj O on O.interface=I.id ' +
                    ' left join ipobj J ON J.id=O.ipobj ' +
                    ' left join firewall F on F.id=I.firewall ' +
                    ' WHERE I.id = ' + connection.escape(id);
                //' AND (I.firewall=' + connection.escape(idfirewall) + ' OR I.firewall is NULL)';
                //logger.debug("getInterfaceFullPro ->", sql);
                connection.query(sql, (error, row) => {
                    if (error)
                        reject(error);
                    else {
                        //GET ALL IPOBJ UNDER INTERFACE
                        //logger.debug("INTERFACE -> " , row[0]);
                        IPObj.getAllIpobjsInterfacePro(row[0])
                            .then((dataI: any) => {
                                Promise.all(dataI.ipobjs.map(data => IPObj.getIpobjPro(data)))
                                    .then(dataO => {
                                        //dataI.ipobjs = dataO;
                                        //logger.debug("-------------------------> FINAL de IPOBJS UNDER INTERFACE : " + id + " ----");
                                        //resolve({"id": position.id, "name": position.name, "position_order": position.position_order, "ipobjs": dataI});
                                        var _interface = new data_policy_position_ipobjs(row[0], 0, 'I');
                                        _interface.ipobjs = dataO;
                                        resolve(_interface);
                                        //resolve(dataO);
                                    })
                                    .catch(e => {
                                        reject(e);
                                    });
                            })
                            .catch(e => {
                                resolve({});
                            });
                    }
                });
            });
        });
    };

    //Get data of interface 
    public static getInterface_data(id, type, callback) {
        db.get((error, connection) => {
            if (error)
                callback(error, null);
            var sql = 'SELECT * FROM ' + tableName + ' WHERE id = ' + connection.escape(id) + ' AND interface_type=' + connection.escape(type);

            connection.query(sql, (error, row) => {
                if (error || (row.length === 0))
                    callback(error, null);
                else
                    callback(null, row);
            });
        });
    };

    // Get interface address.
    public static getInterfaceAddr(dbCon, _interface) {
        return new Promise((resolve, reject) => {
            dbCon.query(`select id,interface,ip_version from ipobj where interface=${_interface}`, (error, result) => {
                if (error) return reject(error);
                resolve(result);
            });
        });
    };

    // Get all host addresses.
    public static getHostAddr(dbCon, host) {
        return new Promise((resolve, reject) => {
            dbCon.query(`select interface from interface__ipobj where ipobj=${host}`, async (error, interfaces) => {
                if (error) return reject(error);

                let result = [];
                try {
                    for (let _interface of interfaces) {
                        result = result.concat(await this.getInterfaceAddr(dbCon, _interface.interface));
                    }
                } catch (error) { return reject(error) }

                resolve(result);
            });
        });
    };

    /* Search where is in RULES ALL interfaces from OTHER FIREWALL  */
    public static searchInterfaceUsageOutOfThisFirewall(req) {
        return new Promise(async (resolve, reject) => {

            let answer: any = {};
            answer.restrictions = {};
            answer.restrictions.InterfaceInRules_I = [];
            answer.restrictions.InterfaceInRules_O = [];
            answer.restrictions.IpobjInterfaceInRule = [];
            answer.restrictions.IpobjInterfaceInGroup = [];
            answer.restrictions.IpobjInterfaceInOpenvpn = [];

            try {
                let interfaces: Array<any> = await this.getInterfaces(req.dbCon, req.body.fwcloud, req.body.firewall);
                for (let interfaz of interfaces) {
                    // The last parameter of this functions indicates search out of hte indicated firewall.
                    const data: any = await this.searchInterfaceUsage(interfaz.id, interfaz.interface_type, req.body.fwcloud, req.body.firewall);
                    if (data.result) {
                        answer.restrictions.InterfaceInRules_I = answer.restrictions.InterfaceInRules_I.concat(data.restrictions.InterfaceInRules_I);
                        answer.restrictions.InterfaceInRules_O = answer.restrictions.InterfaceInRules_O.concat(data.restrictions.InterfaceInRules_O);
                        answer.restrictions.IpobjInterfaceInRule = answer.restrictions.IpobjInterfaceInRule.concat(data.restrictions.IpobjInterfaceInRule);
                        answer.restrictions.IpobjInterfaceInGroup = answer.restrictions.IpobjInterfaceInGroup.concat(data.restrictions.IpobjInterfaceInGroup);
                        answer.restrictions.IpobjInterfaceInOpenvpn = answer.restrictions.IpobjInterfaceInOpenvpn.concat(data.restrictions.IpobjInterfaceInOpenvpn);
                    }
                }
            } catch (error) { return reject(error) }

            resolve(answer);
        });
    };


    /* Search where is in RULES interface in OTHER FIREWALLS  */
    public static searchInterfaceUsage(id, type, fwcloud, diff_firewall) {
        return new Promise((resolve, reject) => {
            //SEARCH INTERFACE DATA
            this.getInterface_data(id, type, async (error, data) => {
                if (error) return reject(error);

                let search: any = {};
                search.result = false;
                if (data && data.length > 0) {
                    try {
                        search.restrictions = {};
                        search.restrictions.InterfaceInRules_I = await PolicyRuleToInterface.SearchInterfaceInRules(id, type, fwcloud, null, diff_firewall); //SEARCH INTERFACE IN RULES I POSITIONS
                        search.restrictions.InterfaceInRules_O = await PolicyRuleToIPObj.searchInterfaceInRule(id, type, fwcloud, null, diff_firewall); //SEARCH INTERFACE IN RULES O POSITIONS
                        search.restrictions.IpobjInterfaceInRule = await PolicyRuleToIPObj.searchIpobjInterfaceInRule(id, type, fwcloud, null, diff_firewall); //SEARCH IPOBJ UNDER INTERFACES WITH IPOBJ IN RULES
                        search.restrictions.IpobjInterfaceInGroup = await PolicyRuleToIPObj.searchIpobjInterfaceInGroup(id, type); //SEARCH IPOBJ UNDER INTERFACES WITH IPOBJ IN GROUPS
                        search.restrictions.IpobjInterfaceInOpenvpn = await IPObj.searchIpobjInterfaceInOpenvpn(id, fwcloud, diff_firewall); //SEARCH IPOBJ UNDER INTERFACES USED IN OPENVPN
                        search.restrictions.InterfaceInFirewall = await this.searchInterfaceInFirewall(id, type, fwcloud); //SEARCH INTERFACE IN FIREWALL
                        search.restrictions.InterfaceInHost = await InterfaceIPObj.getInterface__ipobj_hosts(id, fwcloud); //SEARCH INTERFACE IN HOSTS
                        search.restrictions.LastInterfaceWithAddrInHostInRule = await IPObj.searchLastInterfaceWithAddrInHostInRule(id, fwcloud);

                        for (let key in search.restrictions) {
                            if (search.restrictions[key].length > 0) {
                                search.result = true;
                                break;
                            }
                        }
                        resolve(search);
                    } catch (error) { reject(error) }
                } else resolve(search);
            });
        });
    };


    //Search Interfaces in Firewalls
    public static searchInterfaceInFirewall(_interface, type, fwcloud) {
        return new Promise((resolve, reject) => {
            db.get((error, connection) => {
                if (error) return reject(error);

                var sql = 'SELECT I.id obj_id,I.name obj_name, I.interface_type obj_type_id,T.type obj_type_name, ' +
                    'C.id cloud_id, C.name cloud_name, F.id firewall_id, F.name firewall_name   ' +
                    'from interface I ' +
                    'inner join ipobj_type T on T.id=I.interface_type ' +
                    'INNER JOIN firewall F on F.id=I.firewall   ' +
                    'inner join fwcloud C on C.id=F.fwcloud ' +
                    ' WHERE I.id=' + _interface + ' AND I.interface_type=' + type + ' AND F.fwcloud=' + fwcloud;
                connection.query(sql, (error, rows) => {
                    if (error) return reject(error);
                    resolve(rows);
                });
            });
        });
    };


    //Add new interface from user
    public static insertInterface(dbCon, interfaceData) {
        return new Promise((resolve, reject) => {
            dbCon.query(`INSERT INTO ${tableName} SET ?`, interfaceData, (error, result) => {
                if (error) return reject(error);
                resolve(result.affectedRows > 0 ? result.insertId : null);
            });
        });
    };

    public static createLoInterface(fwcloud, fwId) {
        return new Promise((resolve, reject) => {
            db.get((error, connection) => {
                if (error) return reject(error);

                // Loopback interface.
                const interfaceData = {
                    id: null,
                    firewall: fwId,
                    name: 'lo',
                    labelName: '',
                    type: 10,
                    interface_type: 10,
                    comment: 'Loopback interface.',
                    mac: ''
                };

                // Create the IPv4 loopbackup interface address.
                connection.query('INSERT INTO ' + tableName + ' SET ?', interfaceData, async (error, result) => {
                    if (error) return reject(error);

                    const interfaceId = result.insertId;
                    const ipobjData = {
                        id: null,
                        fwcloud: fwcloud,
                        interface: interfaceId,
                        name: 'lo',
                        type: 5,
                        protocol: null,
                        address: '127.0.0.1',
                        netmask: '255.0.0.0',
                        diff_serv: null,
                        ip_version: 4,
                        icmp_code: null,
                        icmp_type: null,
                        tcp_flags_mask: null,
                        tcp_flags_settings: null,
                        range_start: null,
                        range_end: null,
                        source_port_start: 0,
                        source_port_end: 0,
                        destination_port_start: 0,
                        destination_port_end: 0,
                        options: null,
                        comment: 'IPv4 loopback interface address.'
                    };
                    await IPObj.insertIpobj(connection, ipobjData);
                    resolve(interfaceId);
                });
            });
        });
    };


    //Update interface from user
    public static updateInterface(interfaceData, callback) {
        db.get((error, connection) => {
            if (error)
                callback(error, null);
            var sql = 'UPDATE ' + tableName + ' SET name = ' + connection.escape(interfaceData.name) + ',' +
                'labelName = ' + connection.escape(interfaceData.labelName) + ', ' +
                'type = ' + connection.escape(interfaceData.type) + ', ' +
                'comment = ' + connection.escape(interfaceData.comment) + ', ' +
                'mac = ' + connection.escape(interfaceData.mac) + ' ' +
                ' WHERE id = ' + interfaceData.id;
            logger.debug(sql);
            connection.query(sql, async (error, result) => {
                if (error) {
                    callback(error, null);
                } else {
                    if (result.affectedRows > 0) {
                        await modelEventService.emit('update', Interface, interfaceData.id);
                        callback(null, { "result": true });
                    } else {
                        callback(null, { "result": false });
                    }
                }
            });
        });
    };

    //Clone interfaces and IPOBJ
    public static cloneFirewallInterfaces(iduser, fwcloud, idfirewall, idNewfirewall) {
        return new Promise((resolve, reject) => {
            db.get((error, connection) => {
                if (error) return reject(error);
                const sql = 'select ' + connection.escape(idNewfirewall) + ' as newfirewall, I.*,' +
                    ' IF(f1.cluster is null,f1.name,(select name from cluster where id=f1.cluster)) as org_name, ' +
                    ' IF(f2.cluster is null,f2.name,(select name from cluster where id=f2.cluster)) as clon_name ' +
                    ' from interface I, firewall f1, firewall f2' +
                    ' where I.firewall=' + connection.escape(idfirewall) +
                    ' and f1.id=' + connection.escape(idfirewall) +
                    ' and f2.id=' + connection.escape(idNewfirewall);
                connection.query(sql, (error, rows) => {
                    if (error) return reject(error);
                    //Bucle por interfaces
                    Promise.all(rows.map(data => this.cloneInterface(data)))
                        .then(data => resolve(data))
                        .catch(e => reject(e));
                });
            });
        });
    };

    public static cloneInterface(rowData) {
        return new Promise((resolve, reject) => {
            db.get(async (error, dbCon) => {
                if (error) return reject(error);

                //CREATE NEW INTERFACE
                //Create New objet with data interface
                var interfaceData = {
                    id: null,
                    firewall: rowData.newfirewall,
                    name: rowData.name,
                    labelName: rowData.labelName,
                    type: rowData.type,
                    interface_type: rowData.interface_type,
                    comment: rowData.comment,
                    mac: rowData.mac,
                };
                let id_org = rowData.id;
                let id_clon;
                try {
                    id_clon = await this.insertInterface(dbCon, interfaceData);
                } catch (error) { return reject(error) }

                //SELECT ALL IPOBJ UNDER INTERFACE
                const sql = 'select ' + id_clon + ' as newinterface, O.*, ' +
                    dbCon.escape(rowData.org_name) + ' as org_name,' +
                    dbCon.escape(rowData.clon_name) + ' as clon_name' +
                    ' from ipobj O ' +
                    ' where O.interface=' + dbCon.escape(rowData.id);
                dbCon.query(sql, (error, rows) => {
                    if (error) return reject(error);

                    for (var i = 0; i < rows.length; i++) {
                        if (rows[i].name.indexOf(rows[i].org_name + ":", 0) === 0)
                            rows[i].name = rows[i].name.replace(new RegExp("^" + rows[i].org_name + ":"), rows[i].clon_name + ":");
                    }
                    //Bucle por IPOBJS
                    Promise.all(rows.map(data => IPObj.cloneIpobj(data)))
                        .then(data => resolve({ "id_org": id_org, "id_clon": id_clon, "addr": data }))
                        .catch(e => reject(e));
                });
            });
        });
    };




    //Remove interface with id to remove
    //FALTA BORRADO EN CASCADA 
    public static deleteInterface(fwcloud, idfirewall, id, type, callback) {
        db.get((error, connection) => {
            if (error)
                callback(error, null);
            var sqlExists = 'SELECT * FROM ' + tableName + '  WHERE id = ' + connection.escape(id) + ' AND interface_type=' + connection.escape(type) + ' AND firewall=' + connection.escape(idfirewall);
            connection.query(sqlExists, (error, row) => {
                //If exists Id from interface to remove
                if (row) {
                    db.get((error, connection) => {
                        var sql = 'DELETE FROM ' + tableName + ' WHERE id = ' + connection.escape(id) + ' AND interface_type=' + connection.escape(type) + ' AND firewall=' + connection.escape(idfirewall);
                        connection.query(sql, (error, result) => {
                            if (error) {
                                logger.debug(error);
                                callback(error, null);
                            } else {
                                if (result.affectedRows > 0)
                                    callback(null, { "result": true, "msg": "deleted" });
                                else
                                    callback(null, { "result": false, "msg": "notExist" });
                            }
                        });
                    });
                } else {
                    callback(null, { "result": false, "msg": "notExist" });
                }
            });
        });
    };

    public static deleteInterfaceFW(dbCon, _interface) {
        return new Promise((resolve, reject) => {
            const sql = `DELETE FROM ${tableName} WHERE type=10 AND id=${_interface}`;
            dbCon.query(sql, (error, result) => {
                if (error) return reject(error);
                resolve();
            });
        });
    };


    public static deleteInterfaceHOST(dbCon, _interface) {
        return new Promise((resolve, reject) => {
            const sql = `DELETE FROM ${tableName} WHERE type=11 AND id=${_interface}`;
            dbCon.query(sql, (error, result) => {
                if (error) return reject(error);
                resolve();
            });
        });
    };


    //Remove all IPOBJ UNDER INTERFACES UNDER FIREWALL
    public static deleteInterfacesIpobjFirewall(firewall) {
        return new Promise((resolve, reject) => {
            db.get((error, dbCon) => {
                if (error) return reject(error);

                dbCon.query(`select id from interface where firewall=${firewall}`, async (error, interfaces) => {
                    if (error) return reject(error);

                    try {
                        for (let _interface of interfaces)
                            await IPObj.deleteIpobjInterface(dbCon, _interface.id);
                        resolve();
                    } catch (error) { reject(error) }
                });
            });
        });
    };


    //Remove ALL interface from Firewall
    public static deleteInterfaceFirewall(firewall) {
        return new Promise((resolve, reject) => {
            db.get((error, connection) => {
                if (error) return reject(error);

                var sql = `DELETE FROM ${tableName} WHERE firewall=${firewall}`;
                connection.query(sql, (error, result) => {
                    if (error) return reject(error);
                    if (result.affectedRows > 0)
                        resolve({ "result": true, "msg": "deleted" });
                    else
                        resolve({ "result": false, "msg": "notExist" });
                });
            });
        });
    };


    //Move rules from one firewall to other.
    public static moveToOtherFirewall(dbCon, src_firewall, dst_firewall) {
        return new Promise((resolve, reject) => {
            dbCon.query(`UPDATE ${tableName} SET firewall=${dst_firewall} WHERE firewall=${src_firewall}`, async (error, result) => {
                if (error) return reject(error);
                await modelEventService.emit('update', Interface, {
                    firewall: src_firewall
                });
                resolve();
            });
        });
    };

}