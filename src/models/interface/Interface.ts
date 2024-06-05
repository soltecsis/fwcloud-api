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

import Model from '../Model';
import db from '../../database/database-manager';

import { PolicyRuleToIPObj } from '../../models/policy/PolicyRuleToIPObj';
import { PolicyRuleToInterface } from '../../models/policy/PolicyRuleToInterface';
import { InterfaceIPObj } from '../../models/interface/InterfaceIPObj';
import { IPObj } from '../../models/ipobj/IPObj';
import {
  Column,
  PrimaryGeneratedColumn,
  Entity,
  ManyToOne,
  JoinColumn,
  OneToMany,
  getRepository,
} from 'typeorm';
import { Firewall } from '../firewall/Firewall';
import { logger } from '../../fonaments/abstract-application';
import { Route } from '../routing/route/route.model';
import { RoutingRuleToInterface } from '../routing/routing-rule-to-interface/routing-rule-to-interface.model';
import { RouteToIPObj } from '../routing/route/route-to-ipobj.model';
import { RoutingRuleToIPObj } from '../routing/routing-rule/routing-rule-to-ipobj.model';
import { DHCPRule } from '../system/dhcp/dhcp_r/dhcp_r.model';
import { KeepalivedRule } from '../system/keepalived/keepalived_r/keepalived_r.model';
const data_policy_position_ipobjs = require('../../models/data/data_policy_position_ipobjs');

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

  @Column({ name: 'firewall' })
  firewallId: number;

  @ManyToOne((type) => Firewall, (firewall) => firewall.interfaces)
  @JoinColumn({
    name: 'firewall',
  })
  firewall: Firewall;

  @OneToMany((type) => IPObj, (ipObj) => ipObj.interface)
  ipObjs: Array<IPObj>;

  @OneToMany(
    (type) => InterfaceIPObj,
    (interfaceIPObj) => interfaceIPObj.hostInterface,
  )
  hosts!: Array<InterfaceIPObj>;

  @OneToMany(
    (type) => PolicyRuleToInterface,
    (policyRuleToInterface) => policyRuleToInterface.policyRuleInterface,
  )
  policyRuleToInterfaces: Array<PolicyRuleToInterface>;

  @OneToMany((type) => Route, (model) => model.routingTable)
  routes: Route[];

  @OneToMany(
    () => RoutingRuleToInterface,
    (routingRuleToInterface) => routingRuleToInterface.interface,
  )
  routingRuleToInterfaces: RoutingRuleToInterface[];

  @OneToMany((type) => PolicyRuleToIPObj, (model) => model.interface)
  policyRuleToIPObjs: Array<PolicyRuleToIPObj>;

  public getTableName(): string {
    return tableName;
  }

  //Get All interface by firewall
  public static getInterfaces(dbCon, fwcloud, firewall): Promise<Array<any>> {
    return new Promise((resolve, reject) => {
      const sql = `select I.* from ${tableName} I
				inner join firewall F on F.id=I.firewall
				where I.firewall=${firewall} and F.fwcloud=${fwcloud}`;
      dbCon.query(sql, (error, rows) => {
        if (error) return reject(error);
        resolve(rows);
      });
    });
  }

  //Get All interface by firewall and IPOBJ UNDER Interfaces
  public static getInterfacesFull(idfirewall, fwcloud, callback) {
    db.get((error, connection) => {
      if (error) return callback(error, null);

      const sql =
        'SELECT ' +
        fwcloud +
        ' as fwcloud, I.*, T.id id_node, T.id_parent id_parent_node FROM ' +
        tableName +
        ' I' +
        ' inner join fwc_tree T on T.id_obj=I.id and T.obj_type=I.interface_type AND T.node_type="IFF" AND T.fwcloud=' +
        fwcloud +
        ' WHERE I.firewall=' +
        idfirewall +
        ' ORDER BY I.id';

      connection.query(sql, (error, rows) => {
        if (error) callback(error, null);
        else {
          //logger().debug("-----> BUSCANDO INTERFACES FIREWALL: ", idfirewall, " CLOUD: ", fwcloud);
          //Bucle por interfaces
          Promise.all(rows.map((data) => IPObj.getAllIpobjsInterfacePro(data)))
            .then((data) => callback(null, data))
            .catch((e) => callback(e, null));
        }
      });
    });
  }

  //Get All interface by HOST
  public static getInterfacesHost(idhost, fwcloud, callback) {
    db.get((error, connection) => {
      if (error) callback(error, null);
      //var sql = 'SELECT * FROM ' + tableName + ' WHERE (firewall=' + connection.escape(idfirewall) + ' OR firewall is NULL) ' + ' ORDER BY id';
      const sql =
        'SELECT I.*,  T.id id_node, T.id_parent id_parent_node, J.fwcloud  FROM ' +
        tableName +
        ' I ' +
        ' inner join fwc_tree T on T.id_obj=I.id and T.obj_type=I.interface_type AND (T.fwcloud=' +
        connection.escape(fwcloud) +
        ' OR T.fwcloud IS NULL) ' +
        ' inner join interface__ipobj O on O.interface=I.id left join ipobj J ON J.id=O.ipobj' +
        ' WHERE (O.ipobj=' +
        connection.escape(idhost) +
        ')';

      connection.query(sql, (error, rows) => {
        if (error) callback(error, null);
        else callback(null, rows);
      });
    });
  }

  //Get All interface by HOST and IPOBJECTS UNDER INTERFACES
  public static getInterfacesHost_Full_Pro(idhost, fwcloud) {
    return new Promise((resolve, reject) => {
      db.get((error, connection) => {
        if (error) reject(error);
        //SELECT INTERFACES UNDER HOST
        const sql =
          'SELECT I.*,  T.id id_node, T.id_parent id_parent_node, J.fwcloud  FROM ' +
          tableName +
          ' I ' +
          ' inner join fwc_tree T on T.id_obj=I.id and T.obj_type=I.interface_type AND (T.fwcloud=' +
          connection.escape(fwcloud) +
          ' OR T.fwcloud IS NULL) ' +
          ' inner join interface__ipobj O on O.interface=I.id left join ipobj J ON J.id=O.ipobj' +
          ' WHERE (O.ipobj=' +
          connection.escape(idhost) +
          ')';

        connection.query(sql, (error, rows) => {
          if (error) reject(error);
          else {
            //BUCLE DE INTERFACES del HOST -> Obtenemos IPOBJS por cada Interface
            Promise.all(rows.map((data) => this.getInterfaceFullProData(data)))
              .then((dataI) => {
                //dataI es una Inteface y sus ipobjs
                //logger().debug("-------------------------> FINAL INTERFACES UNDER HOST : ");
                resolve(dataI);
              })
              .catch((e) => {
                reject(e);
              });
          }
        });
      });
    });
  }

  //Get interface by  id and interface
  public static getInterfaceHost(idhost, fwcloud, id, callback) {
    db.get((error, connection) => {
      if (error) callback(error, null);
      const sql =
        'SELECT I.*,  T.id id_node, T.id_parent id_parent_node, ' +
        ' IF(I.interface_type=10,  F.fwcloud , J.fwcloud) as fwcloud, ' +
        ' F.id as firewall_id, F.name as firewall_name, F.cluster as cluster_id, C.name as cluster_name, ' +
        ' J.id as host_id, J.name as host_name ' +
        ' FROM ' +
        tableName +
        ' I ' +
        ' inner join fwc_tree T on T.id_obj=I.id and T.obj_type=I.interface_type ' +
        ' AND (T.fwcloud=' +
        connection.escape(fwcloud) +
        ' OR T.fwcloud IS NULL) ' +
        ' left join interface__ipobj O on O.interface=I.id ' +
        ' left join ipobj J ON J.id=O.ipobj ' +
        ' left join firewall F on F.id=I.firewall ' +
        ' left join cluster C on C.id=F.cluster ' +
        ' WHERE I.id = ' +
        connection.escape(id);

      //logger().debug("INTERFACE SQL: " + sql);
      connection.query(sql, (error, row) => {
        if (error) {
          logger().debug('ERROR getinterface: ', error, '\n', sql);
          callback(error, null);
        } else callback(null, row);
      });
    });
  }

  //Get interface by  id and interface
  public static getInterface(fwcloud, id) {
    return new Promise((resolve, reject) => {
      db.get((error, dbCon) => {
        if (error) return reject(error);
        const sql = `SELECT I.*,
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
  }

  public static getInterfaceFullProData(data) {
    return new Promise((resolve, reject) => {
      this.getInterfaceFullPro(data.idfirewall, data.fwcloud, data.id)
        .then((dataI) => {
          resolve(dataI);
        })
        .catch((e) => {
          reject(e);
        });
    });
  }

  //Get interface by  id and interface
  public static getInterfaceFullPro(idfirewall, fwcloud, id) {
    return new Promise((resolve, reject) => {
      db.get((error, connection) => {
        if (error) reject(error);
        //SELECT INTERFACE
        const sql =
          'SELECT I.*,  T.id id_node, T.id_parent id_parent_node, ' +
          ' IF(I.interface_type=10,  F.fwcloud , J.fwcloud) as fwcloud ' +
          ' FROM ' +
          tableName +
          ' I ' +
          ' inner join fwc_tree T on T.id_obj=I.id and T.obj_type=I.interface_type ' +
          ' AND (T.fwcloud=' +
          connection.escape(fwcloud) +
          ' OR T.fwcloud IS NULL) ' +
          ' left join interface__ipobj O on O.interface=I.id ' +
          ' left join ipobj J ON J.id=O.ipobj ' +
          ' left join firewall F on F.id=I.firewall ' +
          ' WHERE I.id = ' +
          connection.escape(id);
        //' AND (I.firewall=' + connection.escape(idfirewall) + ' OR I.firewall is NULL)';
        //logger().debug("getInterfaceFullPro ->", sql);
        connection.query(sql, (error, row) => {
          if (error) reject(error);
          else {
            //GET ALL IPOBJ UNDER INTERFACE
            //logger().debug("INTERFACE -> " , row[0]);
            IPObj.getAllIpobjsInterfacePro(row[0])
              .then((dataI: any) => {
                Promise.all(dataI.ipobjs.map((data) => IPObj.getIpobjPro(data)))
                  .then((dataO) => {
                    //dataI.ipobjs = dataO;
                    //logger().debug("-------------------------> FINAL de IPOBJS UNDER INTERFACE : " + id + " ----");
                    //resolve({"id": position.id, "name": position.name, "position_order": position.position_order, "ipobjs": dataI});
                    const _interface = new data_policy_position_ipobjs(
                      row[0],
                      0,
                      'I',
                    );
                    _interface.ipobjs = dataO;
                    resolve(_interface);
                    //resolve(dataO);
                  })
                  .catch((e) => {
                    reject(e);
                  });
              })
              .catch((e) => {
                resolve({});
              });
          }
        });
      });
    });
  }

  //Get data of interface
  public static getInterface_data(id, type, callback) {
    db.get((error, connection) => {
      if (error) callback(error, null);
      const sql =
        'SELECT * FROM ' +
        tableName +
        ' WHERE id = ' +
        connection.escape(id) +
        ' AND interface_type=' +
        connection.escape(type);

      connection.query(sql, (error, row) => {
        if (error || row.length === 0) callback(error, null);
        else callback(null, row);
      });
    });
  }

  // Get interface address.
  public static getInterfaceAddr(dbCon, _interface): Promise<IPObj[]> {
    return new Promise((resolve, reject) => {
      dbCon.query(
        `select id,interface,ip_version from ipobj where interface=${_interface}`,
        (error, result) => {
          if (error) return reject(error);
          resolve(result);
        },
      );
    });
  }

  // Get all host addresses.
  public static getHostAddr(dbCon, host) {
    return new Promise((resolve, reject) => {
      dbCon.query(
        `select interface from interface__ipobj where ipobj=${host}`,
        async (error, interfaces) => {
          if (error) return reject(error);

          let result = [];
          try {
            for (const _interface of interfaces) {
              result = result.concat(
                await this.getInterfaceAddr(dbCon, _interface.interface),
              );
            }
          } catch (error) {
            return reject(error);
          }

          resolve(result);
        },
      );
    });
  }

  /* Search where is in RULES ALL interfaces from OTHER FIREWALL  */
  public static searchInterfaceUsageOutOfThisFirewall(req) {
    return new Promise(async (resolve, reject) => {
      const answer: any = {};
      answer.restrictions = {};
      answer.restrictions.InterfaceInRules_I = [];
      answer.restrictions.InterfaceInRules_O = [];
      answer.restrictions.IpobjInterfaceInRule = [];
      answer.restrictions.IpobjInterfaceInRoute = [];
      answer.restrictions.IpobjInterfaceInRoutingRule = [];
      answer.restrictions.IpobjInterfaceInGroup = [];
      answer.restrictions.IpobjInterfaceInOpenvpn = [];

      try {
        const interfaces: Array<any> = await this.getInterfaces(
          req.dbCon,
          req.body.fwcloud,
          req.body.firewall,
        );
        for (const interfaz of interfaces) {
          // The last parameter of this functions indicates search out of hte indicated firewall.
          const data: any = await this.searchInterfaceUsage(
            interfaz.id,
            interfaz.interface_type,
            req.body.fwcloud,
            req.body.firewall,
          );
          if (data.result) {
            answer.restrictions.InterfaceInRules_I =
              answer.restrictions.InterfaceInRules_I.concat(
                data.restrictions.InterfaceInRules_I,
              );
            answer.restrictions.InterfaceInRules_O =
              answer.restrictions.InterfaceInRules_O.concat(
                data.restrictions.InterfaceInRules_O,
              );
            answer.restrictions.IpobjInterfaceInRule =
              answer.restrictions.IpobjInterfaceInRule.concat(
                data.restrictions.IpobjInterfaceInRule,
              );
            answer.restrictions.IpobjInterfaceInRoute =
              answer.restrictions.IpobjInterfaceInRoute.concat(
                data.restrictions.IpobjInterfaceInRoute,
              );
            answer.restrictions.IpobjInterfaceInRoutingRule =
              answer.restrictions.IpobjInterfaceInRoutingRule.concat(
                data.restrictions.IpobjInterfaceInRoutingRule,
              );
            answer.restrictions.IpobjInterfaceInGroup =
              answer.restrictions.IpobjInterfaceInGroup.concat(
                data.restrictions.IpobjInterfaceInGroup,
              );
            answer.restrictions.IpobjInterfaceInOpenvpn =
              answer.restrictions.IpobjInterfaceInOpenvpn.concat(
                data.restrictions.IpobjInterfaceInOpenvpn,
              );
          }
        }

        // Remove items of this firewall.
        answer.restrictions.IpobjInterfaceInRule =
          answer.restrictions.IpobjInterfaceInRule.filter(
            (item) => item.firewall_id != req.body.firewall,
          );
        answer.restrictions.IpobjInterfaceInRoute =
          answer.restrictions.IpobjInterfaceInRoute.filter(
            (item) => item.firewall_id != req.body.firewall,
          );
        answer.restrictions.IpobjInterfaceInRoutingRule =
          answer.restrictions.IpobjInterfaceInRoutingRule.filter(
            (item) => item.firewall_id != req.body.firewall,
          );
      } catch (error) {
        return reject(error);
      }

      resolve(answer);
    });
  }

  /* Search where is in RULES interface in OTHER FIREWALLS  */
  public static searchInterfaceUsage(id, type, fwcloud, diff_firewall) {
    return new Promise((resolve, reject) => {
      //SEARCH INTERFACE DATA
      this.getInterface_data(id, type, async (error, data) => {
        if (error) return reject(error);

        const search: any = {};
        search.result = false;
        if (data && data.length > 0) {
          try {
            search.restrictions = {};
            search.restrictions.InterfaceInRules_I =
              await PolicyRuleToInterface.SearchInterfaceInRules(
                id,
                type,
                fwcloud,
                null,
                diff_firewall,
              ); //SEARCH INTERFACE IN RULES I POSITIONS
            search.restrictions.InterfaceInRules_O =
              await PolicyRuleToIPObj.searchInterfaceInRule(
                id,
                type,
                fwcloud,
                null,
                diff_firewall,
              ); //SEARCH INTERFACE IN RULES O POSITIONS
            search.restrictions.IpobjInterfaceInRule =
              await PolicyRuleToIPObj.searchIpobjInterfaceInRule(
                id,
                type,
                fwcloud,
                null,
                diff_firewall,
              ); //SEARCH IPOBJ UNDER INTERFACES WITH IPOBJ IN RULES
            search.restrictions.IpobjInterfaceInGroup =
              await PolicyRuleToIPObj.searchIpobjInterfaceInGroup(id, type); //SEARCH IPOBJ UNDER INTERFACES WITH IPOBJ IN GROUPS
            search.restrictions.IpobjInterfaceInOpenvpn =
              await IPObj.searchIpobjInterfaceInOpenvpn(
                id,
                fwcloud,
                diff_firewall,
              ); //SEARCH IPOBJ UNDER INTERFACES USED IN OPENVPN
            search.restrictions.InterfaceInFirewall =
              await this.searchInterfaceInFirewall(id, type, fwcloud); //SEARCH INTERFACE IN FIREWALL
            search.restrictions.InterfaceInHost =
              await InterfaceIPObj.getInterface__ipobj_hosts(id, fwcloud); //SEARCH INTERFACE IN HOSTS
            search.restrictions.LastInterfaceWithAddrInHostInRule =
              await IPObj.searchLastInterfaceWithAddrInHostInRule(id, fwcloud);

            search.restrictions.InterfaceInRoute = await getRepository(Route)
              .createQueryBuilder('route')
              .addSelect('firewall.id', 'firewall_id')
              .addSelect('firewall.name', 'firewall_name')
              .addSelect('cluster.id', 'cluster_id')
              .addSelect('cluster.name', 'cluster_name')
              .innerJoinAndSelect(
                'route.interface',
                'interface',
                'interface.id = :interface',
                { interface: id },
              )
              .innerJoinAndSelect('route.routingTable', 'table')
              .innerJoin('table.firewall', 'firewall')
              .leftJoin('firewall.cluster', 'cluster')
              .where(`firewall.fwCloudId = :fwcloud`, { fwcloud: fwcloud })
              .getRawMany();

            search.restrictions.IpobjInterfaceInRoute = await getRepository(
              RouteToIPObj,
            )
              .createQueryBuilder('routeToIPObj')
              .addSelect('firewall.id', 'firewall_id')
              .addSelect('firewall.name', 'firewall_name')
              .addSelect('cluster.id', 'cluster_id')
              .addSelect('cluster.name', 'cluster_name')
              .innerJoin('routeToIPObj.ipObj', 'ipobj')
              .innerJoin(
                'ipobj.interface',
                'interface',
                'interface.id = :interface',
                { interface: id },
              )
              .innerJoinAndSelect('routeToIPObj.route', 'route')
              .innerJoinAndSelect('route.routingTable', 'table')
              .innerJoin('table.firewall', 'firewall')
              .leftJoin('firewall.cluster', 'cluster')
              .where('firewall.fwCloudId = :fwcloud', { fwcloud })
              .getRawMany();

            search.restrictions.IpobjInterfaceInRoutingRule =
              await getRepository(RoutingRuleToIPObj)
                .createQueryBuilder('routingRuleToIPObj')
                .addSelect('firewall.id', 'firewall_id')
                .addSelect('firewall.name', 'firewall_name')
                .addSelect('cluster.id', 'cluster_id')
                .addSelect('cluster.name', 'cluster_name')
                .innerJoin('routingRuleToIPObj.ipObj', 'ipobj')
                .innerJoin(
                  'ipobj.interface',
                  'interface',
                  'interface.id = :interface',
                  { interface: id },
                )
                .innerJoinAndSelect('routingRuleToIPObj.routingRule', 'rule')
                .innerJoin('rule.routingTable', 'table')
                .innerJoin('table.firewall', 'firewall')
                .leftJoin('firewall.cluster', 'cluster')
                .where('firewall.fwCloudId = :fwcloud', { fwcloud })
                .getRawMany();

            search.restrictions.InterfaceInDhcpRule =
              await this.searchInterfaceInDhcpRule(id, fwcloud);

            search.restrictions.InterfaceInKeepalivedRule =
              await this.searchInterfaceInKeepalivedRule(id, fwcloud);

            for (const key in search.restrictions) {
              if (search.restrictions[key].length > 0) {
                search.result = true;
                break;
              }
            }

            resolve(search);
          } catch (error) {
            reject(error);
          }
        } else resolve(search);
      });
    });
  }

  //Search Interfaces in Firewalls
  public static searchInterfaceInFirewall(_interface, type, fwcloud) {
    return new Promise((resolve, reject) => {
      db.get((error, connection) => {
        if (error) return reject(error);

        const sql =
          'SELECT I.id obj_id,I.name obj_name, I.interface_type obj_type_id,T.type obj_type_name, ' +
          'C.id cloud_id, C.name cloud_name, F.id firewall_id, F.name firewall_name, CL.id cluster_id, CL.name cluster_name ' +
          'from interface I ' +
          'inner join ipobj_type T on T.id=I.interface_type ' +
          'INNER JOIN firewall F on F.id=I.firewall ' +
          'LEFT JOIN cluster CL on CL.id=F.cluster ' +
          'inner join fwcloud C on C.id=F.fwcloud ' +
          ' WHERE I.id=' +
          _interface +
          ' AND I.interface_type=' +
          type +
          ' AND F.fwcloud=' +
          fwcloud;
        connection.query(sql, (error, rows) => {
          if (error) return reject(error);
          resolve(rows);
        });
      });
    });
  }

  public static searchInterfaceInFirewallByName(
    dbCon,
    fwcloud,
    firewall,
    ifName,
  ) {
    return new Promise((resolve, reject) => {
      const sql = `SELECT I.id from interface I
			INNER JOIN ipobj_type T on T.id=I.interface_type
			INNER JOIN firewall F on F.id=I.firewall
			INNER JOIN fwcloud C on C.id=F.fwcloud
			WHERE I.name=${dbCon.escape(ifName)} AND I.interface_type=10 and I.firewall=${firewall} AND F.fwcloud=${fwcloud}`;

      dbCon.query(sql, (error, rows) => {
        if (error) return reject(error);

        resolve(rows.length === 0 ? '' : rows[0].id);
      });
    });
  }

  public static async searchInterfaceInDhcpRule(
    id: string,
    fwcloud: string,
  ): Promise<any> {
    return await getRepository(DHCPRule)
      .createQueryBuilder('dhcp_rule')
      .addSelect('dhcp_rule.id', 'dhcp_rule_id')
      .addSelect('dhcp_rule.rule_type', 'dhcp_rule_type')
      .addSelect('interface.id', 'interface_id')
      .addSelect('interface.name', 'interface_name')
      .addSelect('firewall.id', 'firewall_id')
      .addSelect('firewall.name', 'firewall_name')
      .addSelect('cluster.id', 'cluster_id')
      .addSelect('cluster.name', 'cluster_name')
      .leftJoin(
        'dhcp_rule.interface',
        'interface',
        'interface.id = :interface',
        { interface: id },
      )
      .innerJoin('dhcp_rule.firewall', 'firewall')
      .leftJoin('firewall.cluster', 'cluster')
      .where('firewall.fwCloudId = :fwcloud AND interface.id IS NOT NULL', {
        fwcloud,
      })
      .orderBy('dhcp_rule.rule_type', 'ASC')
      .getRawMany();
  }

  public static async searchInterfaceInKeepalivedRule(
    id: string,
    fwcloud: string,
  ) {
    return await getRepository(KeepalivedRule)
      .createQueryBuilder('keepalived_rule')
      .addSelect('keepalived_rule.id', 'keepalived_rule_id')
      .addSelect('keepalived_rule.rule_type', 'keepalived_rule_type')
      .addSelect('interface.id', 'interface_id')
      .addSelect('interface.name', 'interface_name')
      .addSelect('firewall.id', 'firewall_id')
      .addSelect('firewall.name', 'firewall_name')
      .addSelect('cluster.id', 'cluster_id')
      .addSelect('cluster.name', 'cluster_name')
      .leftJoin(
        'keepalived_rule.interface',
        'interface',
        'interface.id = :interface',
        { interface: id },
      )
      .innerJoin('keepalived_rule.firewall', 'firewall')
      .leftJoin('firewall.cluster', 'cluster')
      .where('firewall.fwCloudId = :fwcloud AND interface.id IS NOT NULL', {
        fwcloud,
      })
      .getRawMany();
  }

  //Add new interface from user
  public static insertInterface(dbCon, interfaceData) {
    return new Promise((resolve, reject) => {
      dbCon.query(
        `INSERT INTO ${tableName} SET ?`,
        interfaceData,
        (error, result) => {
          if (error) return reject(error);
          resolve(result.affectedRows > 0 ? result.insertId : null);
        },
      );
    });
  }

  public static createLoInterface(
    dbCon: any,
    fwcloud: number,
    firewall: number,
  ): Promise<any> {
    return new Promise((resolve, reject) => {
      // Loopback interface.
      const interfaceData = {
        id: null,
        firewall: firewall,
        name: 'lo',
        labelName: '',
        type: 10,
        interface_type: 10,
        comment: 'Loopback interface.',
        mac: '',
      };

      // Create the IPv4 loopbackup interface address.
      dbCon.query(
        'INSERT INTO ' + tableName + ' SET ?',
        interfaceData,
        async (error, result) => {
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
            netmask: '/8',
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
            comment: 'IPv4 loopback interface address.',
          };
          const ipv4Id = await IPObj.insertIpobj(dbCon, ipobjData);

          ipobjData.address = '::1';
          ipobjData.netmask = '/128';
          ipobjData.ip_version = 6;
          ipobjData.comment = 'IPv6 loopback interface address.';
          const ipv6Id = await IPObj.insertIpobj(dbCon, ipobjData);

          resolve({ ifId: interfaceId, ipv4Id: ipv4Id, ipv6Id: ipv6Id });
        },
      );
    });
  }

  //Update interface from user
  public static updateInterface(interfaceData, callback) {
    db.get(async (error, connection) => {
      if (error) {
        callback(error, null);
        return;
      }

      const checkDhcpReferences = async () => {
        return new Promise((resolve, reject) => {
          const dhcpCheckSql =
            'SELECT COUNT(*) as count FROM dhcp_r WHERE interface = ?';
          connection.query(
            dhcpCheckSql,
            [interfaceData.id],
            (error, result) => {
              if (error) {
                reject(error);
              } else {
                resolve(result[0].count);
              }
            },
          );
        });
      };

      await checkDhcpReferences()
        .then((count: number) => {
          if (
            count > 0 &&
            (interfaceData.mac === null ||
              interfaceData.mac === '' ||
              interfaceData.mac === undefined)
          ) {
            const errorMessage =
              'The interface cannot be updated. There are references in dhcp_r.';
            callback({ data: errorMessage }, null);
          } else {
            const sql = `
							UPDATE ${tableName}
							SET name = ${connection.escape(interfaceData.name)},
								labelName = ${connection.escape(interfaceData.labelName)},
								type = ${connection.escape(interfaceData.type)},
								comment = ${connection.escape(interfaceData.comment)},
								mac = ${connection.escape(interfaceData.mac)}
							WHERE id = ${interfaceData.id}`;

            logger().debug(sql);

            connection.query(sql, (error, result) => {
              if (error) {
                callback(error, null);
              } else {
                if (result.affectedRows > 0) {
                  callback(null, { result: true });
                } else {
                  callback(null, { result: false });
                }
              }
            });
          }
        })
        .catch((error) => {
          callback(error, null);
        });

      const checkKeepalivedReferences = async () => {
        return new Promise((resolve, reject) => {
          const keepalivedCheckSql =
            'SELECT COUNT(*) as count FROM keepalived_r WHERE interface = ?';
          connection.query(
            keepalivedCheckSql,
            [interfaceData.id],
            (error, result) => {
              if (error) {
                return reject(error);
              } else {
                resolve(result[0].count);
              }
            },
          );
        });
      };

      await checkKeepalivedReferences()
        .then((count: number) => {
          if (
            count > 0 &&
            (interfaceData.mac === null ||
              interfaceData.mac === '' ||
              interfaceData.mac === undefined)
          ) {
            const errorMessage =
              'The interface cannot be updated. There are references in keepalice rules.';
            callback(errorMessage, null);
          } else {
            const sql = `
							UPDATE ${tableName}
							SET name = ${connection.escape(interfaceData.name)}, 
								labelName = ${connection.escape(interfaceData.labelName)},
								type = ${connection.escape(interfaceData.type)},
								comment = ${connection.escape(interfaceData.comment)},
								mac = ${connection.escape(interfaceData.mac)}
							WHERE id = ${connection.escape(interfaceData.id)}`;

            logger().debug(sql);

            connection.query(sql, (error, result) => {
              if (error) {
                callback(error, null);
              } else {
                if (result.affectedRows > 0) {
                  callback(null, { result: true });
                } else {
                  callback(null, { result: false });
                }
              }
            });
          }
        })
        .catch((error) => {
          callback(error, null);
        });
    });
  }

  //Clone interfaces and IPOBJ
  public static cloneFirewallInterfaces(
    iduser,
    fwcloud,
    idfirewall,
    idNewfirewall,
  ) {
    return new Promise((resolve, reject) => {
      db.get((error, connection) => {
        if (error) return reject(error);
        const sql =
          'select ' +
          connection.escape(idNewfirewall) +
          ' as newfirewall, I.*,' +
          ' IF(f1.cluster is null,f1.name,(select name from cluster where id=f1.cluster)) as org_name, ' +
          ' IF(f2.cluster is null,f2.name,(select name from cluster where id=f2.cluster)) as clon_name ' +
          ' from interface I, firewall f1, firewall f2' +
          ' where I.firewall=' +
          connection.escape(idfirewall) +
          ' and f1.id=' +
          connection.escape(idfirewall) +
          ' and f2.id=' +
          connection.escape(idNewfirewall);
        connection.query(sql, (error, rows) => {
          if (error) return reject(error);
          //Bucle por interfaces
          Promise.all(rows.map((data) => this.cloneInterface(data)))
            .then((data) => resolve(data))
            .catch((e) => reject(e));
        });
      });
    });
  }

  public static cloneInterface(rowData) {
    return new Promise((resolve, reject) => {
      db.get(async (error, dbCon) => {
        if (error) return reject(error);

        //CREATE NEW INTERFACE
        //Create New objet with data interface
        const interfaceData = {
          id: null,
          firewall: rowData.newfirewall,
          name: rowData.name,
          labelName: rowData.labelName,
          type: rowData.type,
          interface_type: rowData.interface_type,
          comment: rowData.comment,
          mac: rowData.mac,
        };
        const id_org = rowData.id;
        let id_clon;
        try {
          id_clon = await this.insertInterface(dbCon, interfaceData);
        } catch (error) {
          return reject(error);
        }

        //SELECT ALL IPOBJ UNDER INTERFACE
        const sql =
          'select ' +
          id_clon +
          ' as newinterface, O.*, ' +
          dbCon.escape(rowData.org_name) +
          ' as org_name,' +
          dbCon.escape(rowData.clon_name) +
          ' as clon_name' +
          ' from ipobj O ' +
          ' where O.interface=' +
          dbCon.escape(rowData.id);
        dbCon.query(sql, (error, rows) => {
          if (error) return reject(error);

          for (let i = 0; i < rows.length; i++) {
            if (rows[i].name.indexOf(rows[i].org_name + ':', 0) === 0)
              rows[i].name = rows[i].name.replace(
                new RegExp('^' + rows[i].org_name + ':'),
                rows[i].clon_name + ':',
              );
          }
          //Bucle por IPOBJS
          Promise.all(rows.map((data) => IPObj.cloneIpobj(data)))
            .then((data) =>
              resolve({ id_org: id_org, id_clon: id_clon, addr: data }),
            )
            .catch((e) => reject(e));
        });
      });
    });
  }

  //Remove interface with id to remove
  //FALTA BORRADO EN CASCADA
  public static deleteInterface(fwcloud, idfirewall, id, type, callback) {
    db.get((error, connection) => {
      if (error) callback(error, null);
      const sqlExists =
        'SELECT * FROM ' +
        tableName +
        '  WHERE id = ' +
        connection.escape(id) +
        ' AND interface_type=' +
        connection.escape(type) +
        ' AND firewall=' +
        connection.escape(idfirewall);
      connection.query(sqlExists, (error, row) => {
        //If exists Id from interface to remove
        if (row) {
          db.get((error, connection) => {
            const sql =
              'DELETE FROM ' +
              tableName +
              ' WHERE id = ' +
              connection.escape(id) +
              ' AND interface_type=' +
              connection.escape(type) +
              ' AND firewall=' +
              connection.escape(idfirewall);
            connection.query(sql, (error, result) => {
              if (error) {
                logger().debug(error);
                callback(error, null);
              } else {
                if (result.affectedRows > 0)
                  callback(null, { result: true, msg: 'deleted' });
                else callback(null, { result: false, msg: 'notExist' });
              }
            });
          });
        } else {
          callback(null, { result: false, msg: 'notExist' });
        }
      });
    });
  }

  public static deleteInterfaceFW(dbCon, _interface): Promise<void> {
    return new Promise((resolve, reject) => {
      const sql = `DELETE FROM ${tableName} WHERE type=10 AND id=${_interface}`;
      dbCon.query(sql, (error, result) => {
        if (error) return reject(error);
        resolve();
      });
    });
  }

  public static deleteInterfaceHOST(dbCon, _interface): Promise<void> {
    return new Promise((resolve, reject) => {
      const sql = `DELETE FROM ${tableName} WHERE type=11 AND id=${_interface}`;
      dbCon.query(sql, (error, result) => {
        if (error) return reject(error);
        resolve();
      });
    });
  }

  //Remove all IPOBJ UNDER INTERFACES UNDER FIREWALL
  public static deleteInterfacesIpobjFirewall(firewall): Promise<void> {
    return new Promise((resolve, reject) => {
      db.get((error, dbCon) => {
        if (error) return reject(error);

        dbCon.query(
          `select id from interface where firewall=${firewall}`,
          async (error, interfaces) => {
            if (error) return reject(error);

            try {
              for (const _interface of interfaces)
                await IPObj.deleteIpobjInterface(dbCon, _interface.id);
              resolve();
            } catch (error) {
              reject(error);
            }
          },
        );
      });
    });
  }

  //Remove ALL interface from Firewall
  public static deleteInterfaceFirewall(firewall) {
    return new Promise((resolve, reject) => {
      db.get((error, connection) => {
        if (error) return reject(error);

        const sql = `DELETE FROM ${tableName} WHERE firewall=${firewall}`;
        connection.query(sql, (error, result) => {
          if (error) return reject(error);
          if (result.affectedRows > 0)
            resolve({ result: true, msg: 'deleted' });
          else resolve({ result: false, msg: 'notExist' });
        });
      });
    });
  }

  //Move rules from one firewall to other.
  public static moveToOtherFirewall(
    dbCon,
    src_firewall,
    dst_firewall,
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      dbCon.query(
        `UPDATE ${tableName} SET firewall=${dst_firewall} WHERE firewall=${src_firewall}`,
        async (error, result) => {
          if (error) return reject(error);
          resolve();
        },
      );
    });
  }

  // Convert the 'ip a' data to a json response.
  public static ifsDataToJson(rawData: string) {
    return new Promise((resolve, reject) => {
      interface ifData_type {
        name: string;
        mac: string;
        ipv4: string[];
        ipv6: string[];
      }

      let match: RegExpMatchArray;
      let matchNext: RegExpMatchArray;
      const ifsRawData: string[] = [];
      const ifsData: ifData_type[] = [];
      let currentData: string = '';

      try {
        // Remove \r\n at the beginning of the data to be processed.
        rawData = rawData.trimLeft();

        // Set the pointer over the first interface.
        // If we don't found it return empty result.
        // eslint-disable-next-line no-useless-escape
        if (!(match = rawData.match(/^[0-9]{1,4}\: /))) return resolve([]);
        rawData = rawData.substring(match.index);

        // First see how many interfaces we have in the raw data received and fill
        // the ifsRawData array with the raw data for each interface.
        /* eslint-disable no-useless-escape */
        for (; (matchNext = rawData.match(/\n[0-9]{1,4}\: /)); ) {
          match = rawData.match(/^[0-9]{1,4}\: /);
          /* eslint-disable no-useless-escape */
          ifsRawData.push(rawData.substring(match[0].length, matchNext.index));
          rawData = rawData.substring(matchNext.index + 1);
        }
        // eslint-disable-next-line no-useless-escape
        match = rawData.match(/^[0-9]{1,4}\: /);
        ifsRawData.push(rawData.substring(match[0].length, rawData.length));

        // Process the raw data of each interface.
        for (currentData of ifsRawData) {
          const ifData: ifData_type = {
            name: '',
            mac: '',
            ipv4: [],
            ipv6: [],
          };

          // Get the interface name.
          // eslint-disable-next-line no-useless-escape
          if (!(match = currentData.match(/\: /))) continue; // If the pattern is not found we have bad data.
          ifData.name = currentData.substring(0, match.index);
          // For interfaces with name like this one: ens193.40@ens193:
          // take as interface name the substring before the '@' character.
          // eslint-disable-next-line no-useless-escape
          if ((match = ifData.name.match(/\@/)))
            ifData.name = ifData.name.substring(0, match.index);

          // Now the MAC address.
          if ((match = currentData.match(/\n {4}link\/ether /))) {
            currentData = currentData.substring(match.index + match[0].length);
            ifData.mac = currentData.substring(0, 17);
          }

          // The IPv4 address array.
          while ((match = currentData.match(/\n {4}inet /))) {
            currentData = currentData.substring(match.index + match[0].length);
            if (!(match = currentData.match(/ /))) break; // If the pattern is not found we have bad data.
            ifData.ipv4.push(currentData.substring(0, match.index));
          }

          // The IPv6 address array.
          while ((match = currentData.match(/\n {4}inet6 /))) {
            currentData = currentData.substring(match.index + match[0].length);
            if (!(match = currentData.match(/ /))) break; // If the pattern is not found we have bad data.
            ifData.ipv6.push(currentData.substring(0, match.index));
          }

          ifsData.push(ifData);
        }

        resolve(ifsData);
      } catch (error) {
        reject(error);
      }
    });
  }
}
