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
import {
  PolicyRuleToIPObj,
  PolicyRuleToIPObjInRuleData,
} from '../../models/policy/PolicyRuleToIPObj';
import { IPObjGroup } from './IPObjGroup';
import { InterfaceIPObj } from '../../models/interface/InterfaceIPObj';
import { IPObjToIPObjGroup } from '../../models/ipobj/IPObjToIPObjGroup';
import { Interface } from '../../models/interface/Interface';
import Model from '../Model';
import { Column, Entity, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { FwCloud } from '../fwcloud/FwCloud';
import { logger } from '../../fonaments/abstract-application';
import { IPObjType } from './IPObjType';
import { OpenVPNOption } from '../vpn/openvpn/openvpn-option.model';
import { Route } from '../routing/route/route.model';
import { RoutingRule } from '../routing/routing-rule/routing-rule.model';
import { RouteToIPObj } from '../routing/route/route-to-ipobj.model';
import { RoutingRuleToIPObj } from '../routing/routing-rule/routing-rule-to-ipobj.model';
import { DHCPRuleToIPObj } from '../system/dhcp/dhcp_r/dhcp_r-to-ipobj.model';
import { HAProxyRuleToIPObj } from '../system/haproxy/haproxy_r/haproxy_r-to_ipobj.model';
import { DHCPRule } from '../system/dhcp/dhcp_r/dhcp_r.model';
import { KeepalivedToIPObj } from '../system/keepalived/keepalived_r/keepalived_r-to-ipobj';
import { KeepalivedRule } from '../system/keepalived/keepalived_r/keepalived_r.model';
import { HAProxyRule } from '../system/haproxy/haproxy_r/haproxy_r.model';
import Query from '../../database/Query';

import ip from 'ip';
import asyncMod from 'async';
import host_Data from '../../models/data/data_ipobj_host';
import interface_Data from '../../models/data/data_interface';
const ipobj_Data = require('../../models/data/data_ipobj');
import data_policy_position_ipobjs from '../../models/data/data_policy_position_ipobjs';
import fwcError from '../../utils/error_table';
import ipobjs_Data from '../data/data_ipobj';
import { OpenVPN } from '../vpn/openvpn/OpenVPN';
import RequestData from '../data/RequestData';
import { PolicyRule } from '../policy/PolicyRule';

interface SearchIpobjUsage {
  result?: boolean;
  restrictions?: {
    IpobjInRule?: Array<PolicyRuleToIPObjInRuleData>;
    IpobjInGroup?: Array<{
      obj_id: number;
      obj_name: string;
      obj_type_id: number;
      obj_type_name: string;
      cloud_id: number;
      cloud_name: string;
      group_id: number;
      group_name: string;
      group_type: string;
    }>;
    IpobjInGroupInRule?: Array<PolicyRuleToIPObjInRuleData>;
    IpobjInOpenVPN?: Array<
      OpenVPN & {
        cloud_id: number;
        cloud_name: string;
        firewall_id: number;
        firewall_name: string;
        cluster_id: number;
        cluster_name: string;
      }
    >;
    IpobjInRoute?: Array<SearchRoute & { ipobj_id: number; ipobj_type: number }>;
    IpobjInRouteAsGateway?: Array<SearchRoute & { gateway_id: number; gateway_type: number }>;
    IpobjInGroupInRoute?: Array<SearchRoute>;
    IpobjInRoutingRule?: Array<SearchRoute>;
    IpobjInGroupInRoutingRule?: Array<SearchRoute>;
    IpobjInDhcpRule?: Array<
      {
        network_id: number;
        network_name: string;
        range_id: number;
        range_name: string;
        router_id: number;
        router_name: string;
        dhcp_range: number;
        dhcp_router: number;
      } & SearchRoute
    >;
    IpobjInKeepalivedRule?: Array<SearchRoute>;
    IPObjInHAProxyRule?: Array<
      {
        frontendIp_id: number;
        frontendIp_name: string;
        frontendPort_id: number;
        frontendPort_name: string;
      } & SearchRoute
    >;
    InterfaceHostInRule?: Array<PolicyRuleToIPObjInRuleData>;
    AddrHostInRule?: Array<PolicyRuleToIPObjInRuleData>;
    AddrHostInGroup?: Array<{
      obj_id: number;
      obj_name: string;
      obj_type_id: number;
      obj_type_name: string;
      cloud_id: number;
      cloud_name: string;
      group_id: number;
      group_name: string;
      group_type: string;
    }>;
    AddrHostInOpenvpn?: Array<
      OpenVPN & {
        id: number;
        cloud_id: number;
        cloud_name: string;
        firewall_id: number;
        firewall_name: string;
        cluster_id: number;
        cluster_name: string;
      }
    >;
    InterfaceHostInDhcpRule?: Array<
      {
        dhcp_rule_id: number;
        dhcp_rule_type: number;
        interface_id: number;
        interface_name: string;
      } & SearchRoute
    >;
    InterfaceHostInKeepalivedRule?: Array<KeepalivedRule>;
    InterfaceHostInHAProxyRule?: Array<{
      haproxy_rule_id: number;
      haproxy_rule_type: number;
      haproxy_rule_order: number;
      haproxy_rule_active: number;
      haproxy_rule_style: number;
      haproxy_rule_cfg_text: string;
      haproxy_rule_comment: string;
      firewall_id: number;
      firewall_name: string;
      frontend_ip_id: number;
      frontend_ip_name: string;
      frontend_port_id: number;
      frontend_port_name: string;
      backend_port_id: number;
      backend_port_name: string;
    }>;
    LastAddrInInterfaceInRule?: Array<PolicyRuleToIPObjInRuleData>;
    LastAddrInHostInRule?: Array<PolicyRuleToIPObjInRuleData>;
    LastAddrInGroupHostInRule?: Array<PolicyRule>;
    LastAddrInHostInRoute?: Array<Route>;
    LastAddrInHostInRoutingRule?: Array<RoutingRule>;
    LastAddrInGroupHostInRoute?: Array<Route>;
    LastAddrInGroupHostInRoutingRule?: Array<RoutingRule>;
  };
}

interface SearchRoute {
  firewall_id: number;
  firewall_name: string;
  cluster_id: number;
  cluster_name: string;
}

interface PositionIPOBjData {
  fwcloud: number;
  ipobj: number;
  position_order: number;
  position: number;
  type: string;
  ipobj_g: number;
  newinterface: number;
}

const tableName: string = 'ipobj';

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

  @Column({ name: 'fwcloud' })
  fwCloudId: number;

  @ManyToOne(() => FwCloud, (fwcloud) => fwcloud.ipObjs)
  @JoinColumn({
    name: 'fwcloud',
  })
  fwCloud: FwCloud;

  @Column({ name: 'type' })
  ipObjTypeId: number;

  @ManyToOne(() => IPObjType, (ipObjType) => ipObjType.ipObjs)
  @JoinColumn({
    name: 'type',
  })
  ipObjType: IPObjType;

  @Column({ name: 'interface' })
  interfaceId: number;

  @ManyToOne(() => Interface, (_interface) => _interface.ipObjs)
  @JoinColumn({
    name: 'interface',
  })
  interface: Interface;

  @OneToMany(() => OpenVPNOption, (options) => options.ipObj)
  optionsList: Array<OpenVPNOption>;

  @OneToMany(() => IPObjToIPObjGroup, (ipObjToIPObjGroup) => ipObjToIPObjGroup.ipObj)
  ipObjToIPObjGroups!: Array<IPObjToIPObjGroup>;

  @OneToMany(() => InterfaceIPObj, (interfaceIPObj) => interfaceIPObj.hostIPObj)
  hosts!: Array<InterfaceIPObj>;

  @OneToMany(() => PolicyRuleToIPObj, (policyRuleToIPObj) => policyRuleToIPObj.ipObj)
  policyRuleToIPObjs: Array<PolicyRuleToIPObj>;

  @OneToMany(() => Route, (model) => model.gateway)
  routeGateways: Route[];

  @OneToMany(() => RoutingRuleToIPObj, (model) => model.ipObj, {
    cascade: true,
  })
  routingRuleToIPObjs: RoutingRuleToIPObj[];

  @OneToMany(() => DHCPRuleToIPObj, (model) => model.ipObj, {
    cascade: true,
  })
  dhcpRuleToIPObjs: DHCPRuleToIPObj[];

  @OneToMany(() => KeepalivedToIPObj, (model) => model.ipObj, {
    cascade: true,
  })
  keepalivedRuleToIPObjs: KeepalivedToIPObj[];

  @OneToMany(() => RouteToIPObj, (model) => model.ipObj, {
    cascade: true,
  })
  routeToIPObjs: RouteToIPObj[];

  @OneToMany(() => HAProxyRuleToIPObj, (model) => model.ipObj, {
    cascade: true,
  })
  haproxyRuleToIPObjs: HAProxyRuleToIPObj[];

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
  public static getIpobj(
    dbCon: Query,
    fwcloud: number,
    id: number,
  ): Promise<
    Array<
      IPObj & {
        id_node?: number;
        id_parent_node?: number;
        cluster_id?: number;
        cluster_name?: string;
        firewall_id?: number;
        firewall_name?: string;
        host_id?: number;
        host_name?: string;
        if_id?: number;
        if_name?: string;
      }
    >
  > {
    return new Promise((resolve, reject) => {
      const sql = `SELECT I.* FROM ${tableName} I
			WHERE I.id=${id} AND (I.fwcloud=${fwcloud} OR I.fwcloud IS NULL)`;

      dbCon.query(
        sql,
        async (
          error: Error,
          rows: Array<
            IPObj & {
              cluster_id: number;
              cluster_name: string;
              firewall_id: number;
              firewall_name: string;
              host_id: number;
              host_name: string;
              if_id: number;
              if_name: string;
            }
          >,
        ) => {
          if (error) return reject(error);

          if (rows.length > 0) {
            if (rows[0].ipObjTypeId === 8) {
              //CHECK IF IPOBJ IS a HOST
              this.getIpobj_Host_Full(fwcloud, id.toString(), (errorhost, datahost) => {
                if (errorhost) return reject(errorhost);
                resolve(datahost);
              });
            } else if (rows[0].ipObjTypeId === 5 && rows[0].interface != null) {
              // Address that is part of an interface.
              try {
                await this.addressParentsData(dbCon, rows[0]);
                resolve(rows);
              } catch (error) {
                return reject(error);
              }
            } else resolve(rows);
          } else resolve(rows);
        },
      );
    });
  }

  public static addressParentsData(
    connection: Query,
    addr: IPObj & {
      cluster_id: number;
      cluster_name: string;
      firewall_id: number;
      firewall_name: string;
      host_id: number;
      host_name: string;
      if_id: number;
      if_name: string;
    },
  ) {
    return new Promise((resolve, reject) => {
      const sql =
        'select I.name' +
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
        ' where I.id=' +
        connection.escape(addr.interface);
      connection.query(
        sql,
        (
          error,
          rows: Array<{
            name: string;
            firewall_id?: number;
            firewall_name?: string;
            cluster_id?: number;
            cluster_name?: string;
            host_id?: number;
            host_name?: string;
          }>,
        ) => {
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
          addr.if_id = addr.interfaceId;
          addr.if_name = rows[0].name;

          resolve(addr);
        },
      );
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
  public static getIpobjPro(position_ipobj: PositionIPOBjData): Promise<any> {
    return new Promise((resolve, reject) => {
      db.get((error, connection) => {
        if (error) return reject(error);

        //SELECT IPOBJ DATA UNDER POSITION
        const sql =
          'SELECT I.*, T.id id_node, T.id_parent id_parent_node ' +
          ' FROM ' +
          tableName +
          ' I ' +
          ' inner join fwc_tree T on T.id_obj=I.id and T.obj_type=I.type AND (T.fwcloud=' +
          connection.escape(position_ipobj.fwcloud) +
          ' OR T.fwcloud IS NULL)' +
          ' inner join fwc_tree P on P.id=T.id_parent ' + //  and P.obj_type<>20 and P.obj_type<>21' +
          ' WHERE I.id = ' +
          connection.escape(position_ipobj.ipobj) +
          ' AND (I.fwcloud=' +
          connection.escape(position_ipobj.fwcloud) +
          ' OR I.fwcloud IS NULL)';

        logger().debug('getIpobjPro -> ', sql);
        connection.query(
          sql,
          (error, row: Array<IPObj & { id_node: number; id_parent_node: number }>) => {
            if (error) {
              reject(error);
            } else {
              if (row.length > 0) {
                //CHECK IF IPOBJ IS a HOST
                if (row[0].ipObjTypeId === 8) {
                  logger().debug('======== > ENCONTRADO HOST: ' + position_ipobj.ipobj);
                  //GET ALL HOST INTERFACES
                  Interface.getInterfacesHost_Full_Pro(position_ipobj.ipobj, position_ipobj.fwcloud)
                    .then((interfacesHost) => {
                      //RETURN IPOBJ HOST DATA
                      const hostdata = new data_policy_position_ipobjs(
                        row[0],
                        position_ipobj.position_order,
                        'O',
                      );
                      hostdata.interfaces = interfacesHost;

                      resolve(hostdata);
                    })
                    .catch(() => {
                      resolve(void 0);
                    });
                } else {
                  //RETURN IPOBJ DATA
                  const ipobj = new data_policy_position_ipobjs(
                    row[0],
                    position_ipobj.position_order,
                    'O',
                  );
                  //logger().debug("------------------- > ENCONTRADO IPOBJ: " + position_ipobj.ipobj + "  EN POSITION: " + position_ipobj.position);
                  resolve(ipobj);
                }
              } else if (position_ipobj.type === 'I') {
                //SEARCH INTERFACE DATA
                Interface.getInterfaceFullPro(position_ipobj.fwcloud, position_ipobj.ipobj)
                  .then((dataInt) => {
                    logger().debug(
                      '------- > ENCONTRADA INTERFACE: ' +
                        position_ipobj.ipobj +
                        '  EN POSITION: ' +
                        position_ipobj.position,
                    );
                    //var ipobj = new data_policy_position_ipobjs(dataInt[0], position_ipobj.position_order, 'I');
                    //RETURN INTERFACE DATA
                    resolve(dataInt);
                  })
                  .catch(() => resolve({}));
              } else if (position_ipobj.type === 'O' && position_ipobj.ipobj_g > 0) {
                logger().debug('======== > ENCONTRADO GROUP: ' + position_ipobj.ipobj_g);
                //GET ALL GROUP's IPOBJS
                IPObjGroup.getIpobj_g_Full_Pro(
                  position_ipobj.fwcloud,
                  position_ipobj.ipobj_g.toString(),
                )
                  .then((ipobjsGroup) => {
                    logger().debug(
                      '-------------------------> FINAL de GROUP : ' +
                        position_ipobj.ipobj_g +
                        ' ----',
                    );
                    //RETURN IPOBJ GROUP DATA
                    const groupdata = new data_policy_position_ipobjs(
                      position_ipobj,
                      position_ipobj.position_order,
                      'G',
                    );
                    groupdata.ipobjs = ipobjsGroup;
                    resolve(groupdata);
                  })
                  .catch(() => {
                    resolve({});
                  });
              } else {
                resolve({});
              }
            }
          },
        );
      });
    });
  }

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
  public static getIpobj_Host_Full(
    fwcloud: number,
    id: string,
    AllDone: (
      err: Error | string | null,
      data: Array<IPObj & { id_node: number; id_parent_node: number }>,
    ) => void,
  ) {
    const hosts = [];
    let host_cont = 0;
    let ipobjs_cont = 0;
    let interfaces_cont = 0;

    db.get((error, connection) => {
      if (error) AllDone(error, null);

      let sqlId = '';
      if (id !== '') sqlId = ' AND G.id = ' + connection.escape(id);
      const sql =
        'SELECT G.*,  T.id id_node, T.id_parent id_parent_node FROM ' +
        tableName +
        ' G ' +
        'inner join fwc_tree T on T.id_obj=G.id and T.obj_type=G.type AND (T.fwcloud=' +
        connection.escape(fwcloud) +
        ' OR T.fwcloud IS NULL) ' +
        'inner join fwc_tree ParentNode ON ParentNode.id = T.id_parent AND ParentNode.node_type = "OIH"' +
        ' WHERE  (G.fwcloud= ' +
        connection.escape(fwcloud) +
        ' OR G.fwcloud is null) ' +
        sqlId;
      logger().debug(sql);
      connection.query(
        sql,
        (error, rows: Array<IPObj & { id_node: number; id_parent_node: number }>) => {
          if (error) AllDone(error, null);
          else if (rows.length > 0) {
            host_cont = rows.length;
            //const row = rows[0];
            asyncMod.map(
              rows,
              (row, callback1: Function) => {
                const host_node = new host_Data(row);

                logger().debug(' ---> DENTRO de HOST: ' + row.id + ' NAME: ' + row.name);
                const idhost = row.id;
                host_node.interfaces = [];

                //GET ALL HOST INTERFACES
                Interface.getInterfacesHost(
                  idhost,
                  fwcloud,
                  (error: Error, data_interfaces: Array<Interface>) => {
                    if (data_interfaces.length > 0) {
                      interfaces_cont = data_interfaces.length;

                      asyncMod.map(
                        data_interfaces,
                        (data_interface: Interface, callback2: Function) => {
                          //GET INTERFACES
                          logger().debug(
                            '--> DENTRO de INTERFACE id:' +
                              data_interface.id +
                              '  Name:' +
                              data_interface.name +
                              '  Type:' +
                              data_interface.interface_type,
                          );

                          const interface_node = new interface_Data(data_interface);
                          const idinterface = data_interface.id;

                          interface_node.ipobjs = [];

                          //GET ALL INTERFACE OBJECTs
                          this.getAllIpobjsInterface(
                            fwcloud,
                            idinterface,
                            (error: Error, data_ipobjs) => {
                              if (data_ipobjs.length > 0) {
                                ipobjs_cont = data_ipobjs.length;

                                asyncMod.map(
                                  data_ipobjs,
                                  (data_ipobj, callback2: Function) => {
                                    //GET OBJECTS
                                    logger().debug(
                                      '--> DENTRO de OBJECT id:' +
                                        data_ipobj.id +
                                        '  Name:' +
                                        data_ipobj.name,
                                    );

                                    const ipobj_node = new ipobj_Data(data_ipobj);
                                    //Añadimos ipobj a array Interfaces
                                    interface_node.ipobjs.push(ipobj_node);
                                    callback2();
                                  }, //Fin de bucle de IPOBJS
                                  function () {
                                    if (interface_node.ipobjs.length >= ipobjs_cont) {
                                      host_node.interfaces.push(interface_node);
                                      if (host_node.interfaces.length >= interfaces_cont) {
                                        hosts.push(host_node);
                                        if (hosts.length >= host_cont) {
                                          AllDone(null, hosts);
                                        }
                                      }
                                    }
                                  },
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
                            },
                          );

                          callback2();
                        }, //Fin de bucle de INTERFACES
                        function () {
                          //                                        if (host_node.interfaces.length >= interfaces_cont) {
                          //                                            hosts.push(host_node);
                          //                                            if (hosts.length >= host_cont) {
                          //                                                AllDone(null, hosts);
                          //                                            }
                          //                                        }
                        },
                      );
                    } else {
                      hosts.push(host_node);
                      if (hosts.length >= host_cont) {
                        AllDone(null, hosts);
                      }
                    }
                  },
                );
                callback1();
              }, //Fin de bucle de GROUPS
              function () {
                if (hosts.length >= host_cont) {
                  AllDone(null, hosts);
                }
              },
            );
          } else {
            AllDone('', null);
          }
        },
      );
    });
  }

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
  public static getAllIpobjsGroup(
    fwcloud: number,
    idgroup: number,
    callback: (error: Error | null, rows: Array<IPObj>) => void,
  ) {
    db.get((error, connection) => {
      if (error) callback(error, null);

      const sql =
        'SELECT * FROM ' +
        tableName +
        ' I ' +
        ' INNER JOIN ipobj__ipobjg G on G.ipobj=I.id ' +
        ' WHERE  G.ipobj_g=' +
        idgroup +
        ' AND (I.fwcloud=' +
        fwcloud +
        ' OR I.fwcloud IS NULL) ORDER BY G.id_gi';
      //var sql = 'SELECT I.*, T.id id_node, T.id_parent id_parent_node  FROM ' + tableModel + ' I ' +
      //	' INNER JOIN ipobj__ipobjg G on G.ipobj=I.id ' +
      //	' inner join fwc_tree T on T.id_obj=I.id and T.obj_type=I.type AND (T.fwcloud=' + fwcloud + ' OR T.fwcloud IS NULL)' +
      //	' inner join fwc_tree P on P.id=T.id_parent  and P.obj_type<>20 and P.obj_type<>21' +
      //	' WHERE G.ipobj_g=' + idgroup + ' AND (I.fwcloud=' + fwcloud + ' OR I.fwcloud IS NULL)' +
      //	' ORDER BY G.id_gi';

      connection.query(sql, (error: Error, rows: Array<IPObj>) => {
        if (error) callback(error, null);
        else callback(null, rows);
      });
    });
  }

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
  public static getAllIpobjsInterface(
    fwcloud: number,
    idinterface: number,
    callback: (
      error: Error | null,
      rows: Array<IPObj & { id_node: number; id_parent_node: number }>,
    ) => void,
  ) {
    db.get((error, connection) => {
      if (error) callback(error, null);

      const sql =
        'SELECT I.*, T.id id_node, T.id_parent id_parent_node  FROM ' +
        tableName +
        ' I ' +
        ' inner join fwc_tree T on T.id_obj=I.id and T.obj_type=I.type AND (T.fwcloud=' +
        connection.escape(fwcloud) +
        ')' +
        ' inner join fwc_tree P on P.id=T.id_parent  and P.obj_type<>20 and P.obj_type<>21' +
        ' WHERE I.interface=' +
        connection.escape(idinterface) +
        ' AND (I.fwcloud=' +
        connection.escape(fwcloud) +
        ' OR I.fwcloud IS NULL)' +
        ' ORDER BY I.id';
      logger().debug(sql);

      connection.query(
        sql,
        (error, rows: Array<IPObj & { id_node: number; id_parent_node: number }>) => {
          if (error) callback(error, null);
          else callback(null, rows);
        },
      );
    });
  }

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
  public static getAllIpobjsInterfacePro(
    data: Interface & { fwcloud: number; id_node: number; id_parent_node: number },
  ): Promise<interface_Data> {
    const fwcloud = data.fwcloud;

    return new Promise((resolve, reject) => {
      db.get((error: Error, connection) => {
        if (error) return reject(error);

        const sql =
          'SELECT I.id as ipobj, I.*, T.id id_node, T.id_parent id_parent_node  FROM ' +
          tableName +
          ' I ' +
          ' inner join fwc_tree T on T.id_obj=I.id and T.obj_type=I.type AND (T.fwcloud=' +
          connection.escape(fwcloud) +
          ' )' +
          ' inner join fwc_tree P on P.id=T.id_parent  and P.obj_type<>20 and P.obj_type<>21' +
          ' WHERE I.interface=' +
          connection.escape(data.id) +
          ' AND (I.fwcloud=' +
          connection.escape(fwcloud) +
          ' OR I.fwcloud IS NULL)' +
          ' ORDER BY I.id';
        //logger().debug("getAllIpobjsInterfacePro -> ", sql);
        const _interface = new interface_Data(data);
        connection.query(
          sql,
          (
            error: Error,
            rows: Array<IPObj & { ipobj: number; id_node: number; id_parent_node: number }>,
          ) => {
            if (error) return reject(error);
            Promise.all(rows.map((data) => this.getIpobjData(data)))
              .then((ipobjs) => {
                _interface.ipobjs = ipobjs;
                resolve(_interface);
              })
              .catch(() => resolve(null));
          },
        );
      });
    });
  }

  private static getIpobjData(row: IPObj) {
    return new Promise((resolve) => {
      const ipobj = new ipobj_Data(row);
      resolve(ipobj);
    });
  }

  public static getIpobjInfo(dbCon: Query, fwcloud: number, ipobj: number) {
    return new Promise<IPObj>((resolve, reject) => {
      const sql = 'SELECT * FROM ipobj WHERE fwcloud=' + fwcloud + ' AND id=' + ipobj;
      dbCon.query(sql, (error, result: Array<IPObj>) => {
        if (error) return reject(error);
        if (result.length < 1) return reject(fwcError.NOT_FOUND);

        resolve(result[0]);
      });
    });
  }

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
  public static insertIpobj(dbCon: Query, ipobjData: any): Promise<number> {
    return new Promise<number>((resolve, reject) => {
      // The IDs for the user defined IP Objects begin from the value 100000.
      // IDs values from 0 to 99999 are reserved for standard IP Objects.
      dbCon.query(
        `SELECT id FROM ${tableName} ORDER BY ID DESC LIMIT 1`,
        (error, result: Array<IPObj>) => {
          if (error) return reject(error);

          ipobjData.id = result[0].id >= 100000 ? result[0].id + 1 : 100000;
          dbCon.query(
            `INSERT INTO ${tableName} SET ?`,
            ipobjData,
            (error, result: { insertId: number }) => {
              if (error) return reject(error);
              resolve(result.insertId);
            },
          );
        },
      );
    });
  }

  public static cloneIpobj(
    ipobjDataclone: IPObj & { newinterface: number; org_name: string; clon_name: string },
  ): Promise<{ id_org: number; id_clon: number }> {
    return new Promise((resolve, reject) => {
      db.get((error, connection) => {
        if (error) return reject(error);

        const ipobjData = {
          id: null,
          fwcloud: ipobjDataclone.fwCloud,
          interface: ipobjDataclone.newinterface,
          name: ipobjDataclone.name,
          type: ipobjDataclone.ipObjType,
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
          comment: ipobjDataclone.comment,
        };
        connection.query(
          'INSERT INTO ' + tableName + ' SET ?',
          [ipobjData],
          (error, result: { insertId: number }) => {
            if (error) return reject(error);
            resolve({ id_org: ipobjDataclone.id, id_clon: result.insertId });
          },
        );
      });
    });
  }

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
  public static updateIpobj(req: RequestData, ipobjData: ipobjs_Data): Promise<void> {
    return new Promise((resolve, reject) => {
      const sql =
        'UPDATE ' +
        tableName +
        ' SET ' +
        'fwcloud = ' +
        ipobjData.fwcloud +
        ',' +
        'interface = ' +
        req.dbCon.escape(ipobjData.interface) +
        ',' +
        'name = ' +
        req.dbCon.escape(ipobjData.name) +
        ',' +
        'type = ' +
        req.dbCon.escape(ipobjData.type) +
        ',' +
        'protocol = ' +
        req.dbCon.escape(ipobjData.protocol) +
        ',' +
        'address = ' +
        req.dbCon.escape(ipobjData.address) +
        ',' +
        'netmask = ' +
        req.dbCon.escape(ipobjData.netmask) +
        ',' +
        'diff_serv = ' +
        req.dbCon.escape(ipobjData.diff_serv) +
        ',' +
        'ip_version = ' +
        req.dbCon.escape(ipobjData.ip_version) +
        ',' +
        'icmp_code = ' +
        req.dbCon.escape(ipobjData.icmp_code) +
        ',' +
        'icmp_type = ' +
        req.dbCon.escape(ipobjData.icmp_type) +
        ',' +
        'tcp_flags_mask = ' +
        req.dbCon.escape(ipobjData.tcp_flags_mask) +
        ',' +
        'tcp_flags_settings = ' +
        req.dbCon.escape(ipobjData.tcp_flags_settings) +
        ',' +
        'range_start = ' +
        req.dbCon.escape(ipobjData.range_start) +
        ',' +
        'range_end = ' +
        req.dbCon.escape(ipobjData.range_end) +
        ',' +
        'source_port_start = ' +
        req.dbCon.escape(ipobjData.source_port_start) +
        ',' +
        'source_port_end = ' +
        req.dbCon.escape(ipobjData.source_port_end) +
        ',' +
        'destination_port_start = ' +
        req.dbCon.escape(ipobjData.destination_port_start) +
        ',' +
        'destination_port_end = ' +
        req.dbCon.escape(ipobjData.destination_port_end) +
        ',' +
        'options = ' +
        req.dbCon.escape(ipobjData.options) +
        ',' +
        'comment = ' +
        req.dbCon.escape(ipobjData.comment) +
        ' ' +
        ' WHERE id = ' +
        ipobjData.id +
        ' AND fwcloud=' +
        ipobjData.fwcloud;
      req.dbCon.query(sql, (error) => {
        if (error) return reject(error);
        resolve();
      });
    });
  }

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
  public static deleteIpobj(dbCon: Query, fwcloud: number, id: number) {
    return new Promise((resolve, reject) => {
      dbCon.query(
        `DELETE FROM ${tableName}  WHERE id=${id} AND fwcloud=${fwcloud}`,
        (error, result: { affectedRows: number }) => {
          if (error) return reject(error);

          if (result.affectedRows > 0) resolve({ result: true, msg: 'deleted' });
          else resolve({ result: false, msg: 'notExist' });
        },
      );
    });
  }

  public static deleteHost(dbCon: Query, fwcloud: number, host: number): Promise<void> {
    return new Promise((resolve, reject) => {
      const sql = `select II.interface as id from interface__ipobj II
			inner join ipobj I on I.id=II.ipobj
			where II.ipobj=${host} and I.fwcloud=${fwcloud}`;
      dbCon.query(sql, async (error: Error, interfaces: Array<{ id: number }>) => {
        if (error) return reject(error);

        try {
          // Delete all objects under this host.
          for (const _interface of interfaces) {
            await InterfaceIPObj.deleteHostInterface(dbCon, host, _interface.id);
            await this.deleteIpobjInterface(dbCon, _interface.id);
            await Interface.deleteInterfaceHOST(dbCon, _interface.id);
          }

          // Delete host ipobj.
          await this.deleteIpobj(dbCon, fwcloud, host);
        } catch (error) {
          return reject(error);
        }

        resolve();
      });
    });
  }

  //DELETE ALL IPOBJ UNDER INTERFACE
  public static deleteIpobjInterface(
    dbCon: Query,
    _interface: number,
  ): Promise<{
    result: boolean;
    msg: string;
  }> {
    return new Promise((resolve, reject) => {
      dbCon.query(
        `DELETE FROM ${tableName} WHERE interface=${_interface}`,
        (error: Error, result: { affectedRows: number }) => {
          if (error) return reject(error);

          if (result.affectedRows > 0) resolve({ result: true, msg: 'deleted' });
          else resolve({ result: false, msg: 'notExist' });
        },
      );
    });
  }

  //UPDATE HOST IF IPOBJ IS UNDER
  public static UpdateHOST(id: number): Promise<{ result: boolean }> {
    return new Promise((resolve, reject) => {
      db.get((error, connection) => {
        if (error) reject(error);
        const sql =
          'UPDATE ipobj H  ' +
          'inner join interface__ipobj II on II.ipobj=H.id ' +
          'inner join interface I on I.id=II.interface ' +
          'inner join ipobj O on O.interface= I.id ' +
          'set H.updated_at= CURRENT_TIMESTAMP ' +
          ' WHERE O.id = ' +
          connection.escape(id);
        logger().debug(sql);
        connection.query(sql, (error, result: { affectedRows: number }) => {
          if (error) {
            logger().debug(error);
            reject(error);
          } else {
            if (result.affectedRows > 0) {
              resolve({ result: true });
            } else {
              resolve({ result: false });
            }
          }
        });
      });
    });
  }

  //UPDATE INTEFACE IF IPOBJ IS UNDER
  public static UpdateINTERFACE(id: number): Promise<{ result: boolean }> {
    return new Promise((resolve, reject) => {
      db.get((error, connection) => {
        if (error) reject(error);
        const sql =
          'UPDATE interface I  ' +
          'inner join ipobj O on O.interface= I.id ' +
          'set I.updated_at= CURRENT_TIMESTAMP ' +
          ' WHERE O.id = ' +
          connection.escape(id);
        logger().debug(sql);
        connection.query(sql, (error, result: { affectedRows: number }) => {
          if (error) {
            logger().debug(error);
            reject(error);
          } else {
            if (result.affectedRows > 0) {
              resolve({ result: true });
            } else {
              resolve({ result: false });
            }
          }
        });
      });
    });
  }

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
  public static checkIpobjInGroup(
    ipobj: number,
    type: number,
    fwcloud: number,
    callback: (error: Error | null, result: { result: boolean }) => void,
  ) {
    logger().debug(
      'CHECK DELETING FROM GROUP ipobj:' + ipobj + ' Type:' + type + '  fwcloud:' + fwcloud,
    );
    db.get((error: Error, connection) => {
      const sql =
        'SELECT count(*) as n FROM ' +
        tableName +
        ' I ' +
        ' INNER JOIN ipobj__ipobjg G on G.ipobj=I.id ' +
        ' WHERE I.id=' +
        connection.escape(ipobj) +
        ' AND I.type=' +
        connection.escape(type) +
        ' AND I.fwcloud=' +
        connection.escape(fwcloud);
      logger().debug(sql);
      connection.query(sql, (error, rows: Array<{ n: number }>) => {
        if (!error) {
          if (rows.length > 0) {
            if (rows[0].n > 0) {
              logger().debug(
                'ALERT DELETING ipobj IN GROUP:' +
                  ipobj +
                  ' type: ' +
                  type +
                  ' fwcloud:' +
                  fwcloud +
                  ' --> FOUND IN ' +
                  rows[0].n +
                  ' GROUPS',
              );
              callback(null, { result: true });
            } else {
              callback(null, { result: false });
            }
          } else callback(null, { result: false });
        } else {
          logger().error(error);
          callback(null, { result: false });
        }
      });
    });
  }

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
  public static async searchIpobjUsage(
    dbCon: Query,
    fwcloud: number,
    id: number,
    type: number,
  ): Promise<SearchIpobjUsage> {
    const search: SearchIpobjUsage = {};
    search.result = false;
    search.restrictions = {};
    search.restrictions.IpobjInRule = await PolicyRuleToIPObj.searchIpobjInRule(id, type, fwcloud); //SEARCH IPOBJ IN RULES
    search.restrictions.IpobjInGroup = await IPObjToIPObjGroup.searchIpobjInGroup(
      id,
      type,
      fwcloud,
    ); //SEARCH IPOBJ IN GROUPS
    search.restrictions.IpobjInGroupInRule = await PolicyRuleToIPObj.searchIpobjInGroupInRule(
      id,
      type,
      fwcloud,
    ); //SEARCH IPOBJ GROUP IN RULES
    search.restrictions.IpobjInOpenVPN = await this.searchIpobjInOpenvpn(id, type, fwcloud); //SEARCH IPOBJ IN OpenVPN CONFIG

    search.restrictions.IpobjInRoute = await this.searchIpobjInRoute(id, fwcloud);
    search.restrictions.IpobjInRouteAsGateway = await this.searchIpobjInRouteAsGateway(id, fwcloud);
    search.restrictions.IpobjInGroupInRoute = await this.searchIpobjInGroupInRoute(id, fwcloud);
    search.restrictions.IpobjInRoutingRule = await this.searchIpobjInRoutingRule(id, fwcloud);
    search.restrictions.IpobjInGroupInRoutingRule = await this.searchIpobjInGroupInRoutingRule(
      id,
      fwcloud,
    );

    search.restrictions.IpobjInDhcpRule = await this.searchIPObjInDhcpRule(id, fwcloud);
    search.restrictions.IpobjInKeepalivedRule = await this.searchIpobjInKeepalivedRule(id, fwcloud);
    search.restrictions.IPObjInHAProxyRule = await this.searchIPObjInHAProxyRule(id, fwcloud);

    if (type === 8) {
      // HOST
      search.restrictions.InterfaceHostInRule = await PolicyRuleToIPObj.searchInterfaceHostInRule(
        dbCon,
        fwcloud,
        id,
      );
      search.restrictions.AddrHostInRule = await PolicyRuleToIPObj.searchAddrHostInRule(
        dbCon,
        fwcloud,
        id,
      );
      search.restrictions.AddrHostInGroup = await IPObjToIPObjGroup.searchAddrHostInGroup(
        dbCon,
        fwcloud,
        id,
      );
      search.restrictions.AddrHostInOpenvpn = await this.searchAddrHostInOpenvpn(
        dbCon,
        fwcloud,
        id,
      );
      search.restrictions.InterfaceHostInDhcpRule = await this.searchInterfaceHostInDhcpRule(
        dbCon,
        fwcloud,
        id,
      );
      search.restrictions.InterfaceHostInKeepalivedRule =
        await this.searchInterfaceHostInKeepalivedRule(dbCon, fwcloud, id);
      search.restrictions.InterfaceHostInHAProxyRule = await this.searchInterfaceHostInHAProxyRule(
        dbCon,
        fwcloud,
        id,
      );
    }

    // Avoid leaving an interface used in a rule without address.
    if (type === 5) {
      // ADDRESS
      search.restrictions.LastAddrInInterfaceInRule =
        await PolicyRuleToIPObj.searchLastAddrInInterfaceInRule(dbCon, id, type, fwcloud);
      search.restrictions.LastAddrInHostInRule = await PolicyRuleToIPObj.searchLastAddrInHostInRule(
        dbCon,
        id,
        type,
        fwcloud,
      );
      search.restrictions.LastAddrInGroupHostInRule =
        await PolicyRuleToIPObj.searchLastAddrInHostInGroup(id, type, fwcloud);
      search.restrictions.LastAddrInHostInRoute = await Route.getRouteWhichLastAddressInHost(
        id,
        type,
        fwcloud,
      );
      search.restrictions.LastAddrInHostInRoutingRule =
        await RoutingRule.getRoutingRuleWhichLastAddressInHost(id, type, fwcloud);
      search.restrictions.LastAddrInGroupHostInRoute =
        await Route.getRouteWhichLastAddressInHostInGroup(id, type, fwcloud);
      search.restrictions.LastAddrInGroupHostInRoutingRule =
        await RoutingRule.getRoutingRuleWhichLastAddressInHostInGroup(id, type, fwcloud);
    }

    for (const key in search.restrictions) {
      const restrictionArray = search.restrictions[key];
      if (Array.isArray(restrictionArray) && restrictionArray.length > 0) {
        search.result = true;
        break;
      }
    }
    return search;
  }

  public static async searchIpobjInRoute(
    ipobj: number,
    fwcloud: number,
  ): Promise<Array<SearchRoute & { ipobj_id: number; ipobj_type: number }>> {
    return await db
      .getSource()
      .manager.getRepository(Route)
      .createQueryBuilder('route')
      .addSelect('firewall.id', 'firewall_id')
      .addSelect('firewall.name', 'firewall_name')
      .addSelect('cluster.id', 'cluster_id')
      .addSelect('cluster.name', 'cluster_name')
      .addSelect('ipObj.id', 'ipobj_id')
      .addSelect('ipObj.type', 'ipobj_type')
      .innerJoin('route.routeToIPObjs', 'routeToIPObjs')
      .innerJoin('routeToIPObjs.ipObj', 'ipObj', 'ipObj.id = :ipobj', {
        ipobj: ipobj,
      })
      .innerJoinAndSelect('route.routingTable', 'table')
      .innerJoin('table.firewall', 'firewall')
      .leftJoin('firewall.cluster', 'cluster')
      .where(`firewall.fwCloudId = :fwcloud`, { fwcloud: fwcloud })
      .getRawMany();
  }

  public static async searchIpobjInRouteAsGateway(
    ipobj: number,
    fwcloud: number,
  ): Promise<Array<SearchRoute & { gateway_id: number; gateway_type: number }>> {
    return await db
      .getSource()
      .manager.getRepository(Route)
      .createQueryBuilder('route')
      .addSelect('firewall.id', 'firewall_id')
      .addSelect('firewall.name', 'firewall_name')
      .addSelect('cluster.id', 'cluster_id')
      .addSelect('cluster.name', 'cluster_name')
      .addSelect('gateway.id', 'gateway_id')
      .addSelect('gateway.type', 'gateway_type')
      .innerJoin('route.gateway', 'gateway', 'gateway.id = :ipobj', {
        ipobj: ipobj,
      })
      .innerJoinAndSelect('route.routingTable', 'table')
      .innerJoin('table.firewall', 'firewall')
      .leftJoin('firewall.cluster', 'cluster')
      .where(`firewall.fwCloudId = :fwcloud`, { fwcloud: fwcloud })
      .getRawMany();
  }

  public static async searchIpobjInRoutingRule(
    ipobj: number,
    fwcloud: number,
  ): Promise<Array<SearchRoute>> {
    return await db
      .getSource()
      .manager.getRepository(RoutingRule)
      .createQueryBuilder('routing_rule')
      .addSelect('firewall.id', 'firewall_id')
      .addSelect('firewall.name', 'firewall_name')
      .addSelect('cluster.id', 'cluster_id')
      .addSelect('cluster.name', 'cluster_name')
      .innerJoin('routing_rule.routingRuleToIPObjs', 'routingRuleToIPObjs')
      .innerJoin('routingRuleToIPObjs.ipObj', 'ipObj', 'ipObj.id = :ipobj', {
        ipobj: ipobj,
      })
      .innerJoin('routing_rule.routingTable', 'table')
      .innerJoin('table.firewall', 'firewall')
      .leftJoin('firewall.cluster', 'cluster')
      .where(`firewall.fwCloudId = :fwcloud`, { fwcloud: fwcloud })
      .getRawMany();
  }

  public static async searchIPObjInDhcpRule(
    IPObj: number,
    FWCloud: number,
  ): Promise<
    Array<
      {
        network_id: number;
        network_name: string;
        range_id: number;
        range_name: string;
        router_id: number;
        router_name: string;
        dhcp_range: number;
        dhcp_router: number;
      } & SearchRoute
    >
  > {
    const resultAsRouter = await db
      .getSource()
      .manager.getRepository(DHCPRule)
      .createQueryBuilder('dhcp_rule')
      .addSelect('network.id', 'network_id')
      .addSelect('network.name', 'network_name')
      .addSelect('range.id', 'range_id')
      .addSelect('range.name', 'range_name')
      .addSelect('router.id', 'router_id')
      .addSelect('router.name', 'router_name')
      .addSelect('dhcp_rule.range', 'dhcp_range')
      .addSelect('dhcp_rule.router', 'dhcp_router')
      .addSelect('firewall.id', 'firewall_id')
      .addSelect('firewall.name', 'firewall_name')
      .addSelect('cluster.id', 'cluster_id')
      .addSelect('cluster.name', 'cluster_name')
      .leftJoin('dhcp_rule.network', 'network', 'network.id = :IPObj', {
        IPObj: IPObj,
      })
      .leftJoin('dhcp_rule.range', 'range', 'range.id = :IPObj')
      .leftJoin('dhcp_rule.router', 'router', 'router.id = :IPObj')
      .innerJoin('dhcp_rule.firewall', 'firewall')
      .leftJoin('firewall.cluster', 'cluster')
      .where(
        `firewall.fwCloudId = :FWCloud AND (network.id IS NOT NULL OR range.id IS NOT NULL OR router.id IS NOT NULL)`,
        { FWCloud: FWCloud },
      )
      .getRawMany();
    const resultAsIpObj = await db
      .getSource()
      .manager.getRepository(DHCPRule)
      .createQueryBuilder('dhcp_rule')
      .addSelect('network.id', 'network_id')
      .addSelect('network.name', 'network_name')
      .addSelect('ipObj.id', 'ipObj_id')
      .addSelect('ipObj.name', 'ipObj_name')
      .addSelect('range.id', 'range_id')
      .addSelect('range.name', 'range_name')
      .addSelect('dhcp_rule.range', 'dhcp_range')
      .addSelect('firewall.id', 'firewall_id')
      .addSelect('firewall.name', 'firewall_name')
      .addSelect('cluster.id', 'cluster_id')
      .addSelect('cluster.name', 'cluster_name')
      .leftJoin('dhcp_rule.network', 'network', 'network.id = :IPObj', {
        IPObj: IPObj,
      })
      .leftJoin('dhcp_rule.range', 'range', 'range.id = :IPObj')
      .leftJoin('dhcp_rule.dhcpRuleToIPObjs', 'dhcpRuleToIPObjs', 'dhcpRuleToIPObjs.ipObj = :IPObj')
      .leftJoin('dhcpRuleToIPObjs.ipObj', 'ipObj')
      .innerJoin('dhcp_rule.firewall', 'firewall')
      .leftJoin('firewall.cluster', 'cluster')
      .where(
        `firewall.fwCloudId = :FWCloud AND (network.id IS NOT NULL OR range.id IS NOT NULL OR ipObj.id IS NOT NULL)`,
        { FWCloud: FWCloud },
      )
      .getRawMany();

    return [...resultAsRouter, ...resultAsIpObj].sort(
      (a, b) => a.dhcp_rule_rule_type - b.dhcp_rule_rule_type,
    );
  }

  public static async searchIpobjInKeepalivedRule(
    id: number,
    fwcloud: number,
  ): Promise<Array<SearchRoute>> {
    return await db
      .getSource()
      .manager.getRepository(KeepalivedRule)
      .createQueryBuilder('keepalived_rule')
      .addSelect('firewall.id', 'firewall_id')
      .addSelect('firewall.name', 'firewall_name')
      .addSelect('cluster.id', 'cluster_id')
      .addSelect('cluster.name', 'cluster_name')
      .leftJoin('keepalived_rule.virtualIps', 'virtualIps')
      .leftJoin('virtualIps.ipObj', 'ipObj', 'ipObj.id = :id', { id: id })
      .innerJoin('keepalived_rule.firewall', 'firewall')
      .leftJoin('firewall.cluster', 'cluster')
      .where(`firewall.fwCloudId = :fwcloud AND (ipObj.id IS NOT NULL)`, {
        fwcloud: fwcloud,
      })
      .getRawMany();
  }

  public static async searchIPObjInHAProxyRule(
    id: number,
    fwcloud: number,
  ): Promise<
    Array<
      {
        frontendIp_id: number;
        frontendIp_name: string;
        frontendPort_id: number;
        frontendPort_name: string;
      } & SearchRoute
    >
  > {
    const resultAsFrontendIpAndPort = await db
      .getSource()
      .manager.getRepository(HAProxyRule)
      .createQueryBuilder('haproxy_rule')
      .addSelect('frontendIp.id', 'frontendIp_id')
      .addSelect('frontendIp.name', 'frontendIp_name')
      .addSelect('frontendPort.id', 'frontendPort_id')
      .addSelect('frontendPort.name', 'frontendPort_name')
      .addSelect('firewall.id', 'firewall_id')
      .addSelect('firewall.name', 'firewall_name')
      .addSelect('cluster.id', 'cluster_id')
      .addSelect('cluster.name', 'cluster_name')
      .leftJoin('haproxy_rule.frontendIp', 'frontendIp', 'frontendIp.id = :id', { id: id })
      .leftJoin('haproxy_rule.frontendPort', 'frontendPort', 'frontendPort.id = :id', { id: id })
      .innerJoin('haproxy_rule.firewall', 'firewall')
      .leftJoin('firewall.cluster', 'cluster')
      .where(
        `firewall.fwCloudId = :fwcloud AND ( frontendIp.id IS NOT NULL OR frontendPort.id IS NOT NULL)`,
        { fwcloud: fwcloud },
      )
      .getRawMany();

    const resultAsBackendIpAndPort = await db
      .getSource()
      .manager.getRepository(HAProxyRule)
      .createQueryBuilder('haproxy_rule')
      .addSelect('backendPort.id', 'backendPort_id')
      .addSelect('backendPort.name', 'backendPort_name')
      .addSelect('ipObj.id', 'backendIps_id')
      .addSelect('ipObj.name', 'backendIps_name')
      .addSelect('firewall.id', 'firewall_id')
      .addSelect('firewall.name', 'firewall_name')
      .addSelect('cluster.id', 'cluster_id')
      .addSelect('cluster.name', 'cluster_name')
      .leftJoin('haproxy_rule.frontendPort', 'frontendPort', 'frontendPort.id = :id', { id: id })
      .leftJoin('haproxy_rule.backendPort', 'backendPort', 'backendPort.id = :id', { id: id })
      .leftJoin('haproxy_rule.backendIps', 'backendIps', 'backendIps.ipObj = :id', { id: id })
      .leftJoin('backendIps.ipObj', 'ipObj')
      .innerJoin('haproxy_rule.firewall', 'firewall')
      .leftJoin('firewall.cluster', 'cluster')
      .where(
        `firewall.fwCloudId = :fwcloud AND (backendPort.id IS NOT NULL OR ipObj.id IS NOT NULL)`,
        { fwcloud: fwcloud },
      )
      .getRawMany();
    return [...resultAsFrontendIpAndPort, ...resultAsBackendIpAndPort].sort(
      (a, b) => a.haproxy_rule_id - b.haproxy_rule_id,
    );
  }

  public static async searchIpobjInGroupInRoute(
    ipobj: number,
    fwcloud: number,
  ): Promise<Array<SearchRoute>> {
    return await db
      .getSource()
      .manager.getRepository(Route)
      .createQueryBuilder('route')
      .addSelect('firewall.id', 'firewall_id')
      .addSelect('firewall.name', 'firewall_name')
      .addSelect('cluster.id', 'cluster_id')
      .addSelect('cluster.name', 'cluster_name')
      .innerJoinAndSelect('route.routingTable', 'table')
      .innerJoin('route.routeToIPObjGroups', 'routeToIPObjGroups')
      .innerJoin('routeToIPObjGroups.ipObjGroup', 'ipObjGroup')
      .innerJoin(
        'ipObjGroup.ipObjToIPObjGroups',
        'ipObjToIPObjGroups',
        'ipObjToIPObjGroups.ipobj = :ipobj',
        { ipobj: ipobj },
      )
      .innerJoin('table.firewall', 'firewall')
      .leftJoin('firewall.cluster', 'cluster')
      .where(`firewall.fwCloudId = :fwcloud`, { fwcloud: fwcloud })
      .getRawMany();
  }

  public static async searchIpobjInGroupInRoutingRule(
    ipobj: number,
    fwcloud: number,
  ): Promise<Array<SearchRoute>> {
    return await db
      .getSource()
      .manager.getRepository(RoutingRule)
      .createQueryBuilder('routing_rule')
      .addSelect('firewall.id', 'firewall_id')
      .addSelect('firewall.name', 'firewall_name')
      .addSelect('cluster.id', 'cluster_id')
      .addSelect('cluster.name', 'cluster_name')
      .innerJoin('routing_rule.routingRuleToIPObjGroups', 'routingRuleToIPObjGroups')
      .innerJoin('routingRuleToIPObjGroups.ipObjGroup', 'ipObjGroup')
      .innerJoin(
        'ipObjGroup.ipObjToIPObjGroups',
        'ipObjToIPObjGroups',
        'ipObjToIPObjGroups.ipobj = :ipobj',
        { ipobj: ipobj },
      )
      .innerJoin('routing_rule.routingTable', 'table')
      .innerJoin('table.firewall', 'firewall')
      .leftJoin('firewall.cluster', 'cluster')
      .where(`firewall.fwCloudId = :fwcloud`, { fwcloud: fwcloud })
      .getRawMany();
  }

  //check if IPOBJ exists in and OpenVPN configuration
  public static searchIpobjInOpenvpn(
    ipobj: number,
    type: number,
    fwcloud: number,
  ): Promise<
    Array<
      OpenVPN & {
        cloud_id: number;
        cloud_name: string;
        firewall_id: number;
        firewall_name: string;
        cluster_id: number;
        cluster_name: string;
      }
    >
  > {
    return new Promise((resolve, reject) => {
      db.get((error, connection) => {
        if (error) return reject(error);

        const sql = `SELECT VPN.*, CRT.cn,
				C.id cloud_id, C.name cloud_name, VPN.firewall firewall_id, F.name firewall_name,
				F.cluster as cluster_id, IF(F.cluster is null,null,(select name from cluster where id=F.cluster)) as cluster_name
				FROM openvpn AS VPN
				inner join crt CRT on CRT.id=VPN.crt
				INNER JOIN openvpn_opt OPT on OPT.openvpn=VPN.id
				INNER JOIN ipobj OBJ on OBJ.id=OPT.ipobj
				INNER JOIN firewall F on F.id=VPN.firewall
				inner join fwcloud C on C.id=F.fwcloud
			 	WHERE OBJ.id=${ipobj} AND OBJ.type=${type} AND (OBJ.fwcloud=${fwcloud} OR OBJ.fwcloud IS NULL)`;
        connection.query(
          sql,
          (
            error,
            rows: Array<
              OpenVPN & {
                cloud_id: number;
                cloud_name: string;
                firewall_id: number;
                firewall_name: string;
                cluster_id: number;
                cluster_name: string;
              }
            >,
          ) => {
            if (error) return reject(error);
            resolve(rows);
          },
        );
      });
    });
  }

  //check if IPOBJ exists in and OpenVPN configuration
  public static addrInIfconfigPushOpenVPN(
    ipobj: number,
    fwcloud: number,
  ): Promise<Array<{ id: number }>> {
    return new Promise((resolve, reject) => {
      db.get((error: Error, connection) => {
        if (error) return reject(error);

        const sql = `SELECT VPN.id
                    FROM openvpn AS VPN
                    INNER JOIN openvpn_opt OPT on OPT.openvpn=VPN.id
                    INNER JOIN firewall F on F.id=VPN.firewall
                    inner JOIN fwcloud C on C.id=F.fwcloud
                    WHERE OPT.ipobj=${ipobj} AND OPT.name='ifconfig-push' AND C.id=${fwcloud}`;
        connection.query(sql, (error: Error, rows: Array<{ id: number }>) => {
          if (error) return reject(error);
          resolve(rows);
        });
      });
    });
  }

  //check if interface ipobj exists in and OpenVPN configuration
  public static searchIpobjInterfaceInOpenvpn(
    _interface: number,
    fwcloud: number,
    diff_firewall: number,
  ): Promise<
    Array<
      OpenVPN & {
        cloud_id: number;
        cloud_name: string;
        firewall_id: number;
        firewall_name: string;
        cluster_id: number;
        cluster_name: string;
      }
    >
  > {
    return new Promise((resolve, reject) => {
      db.get((error, connection) => {
        if (error) return reject(error);

        const sql = `SELECT VPN.*, CRT.cn,
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

        connection.query(
          sql,
          (
            error: Error,
            rows: Array<
              OpenVPN & {
                cloud_id: number;
                cloud_name: string;
                firewall_id: number;
                firewall_name: string;
                cluster_id: number;
                cluster_name: string;
              }
            >,
          ) => {
            if (error) return reject(error);
            resolve(rows);
          },
        );
      });
    });
  }

  //check if interface ipobj exists in and OpenVPN configuration
  public static searchAddrHostInOpenvpn(
    dbCon: Query,
    fwcloud: number,
    host: number,
  ): Promise<
    Array<
      OpenVPN & {
        id: number;
        cloud_id: number;
        cloud_name: string;
        firewall_id: number;
        firewall_name: string;
        cluster_id: number;
        cluster_name: string;
      }
    >
  > {
    return new Promise((resolve, reject) => {
      const sql = `SELECT VPN.*, CRT.cn,
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
      dbCon.query(
        sql,
        (
          error: Error,
          rows: Array<
            OpenVPN & {
              cloud_id: number;
              cloud_name: string;
              firewall_id: number;
              firewall_name: string;
              cluster_id: number;
              cluster_name: string;
            }
          >,
        ) => {
          if (error) return reject(error);
          resolve(rows);
        },
      );
    });
  }

  public static async searchInterfaceHostInDhcpRule(
    dbCon: Query,
    fwcloud: number,
    id: number,
  ): Promise<
    Array<
      {
        dhcp_rule_id: number;
        dhcp_rule_type: number;
        interface_id: number;
        interface_name: string;
      } & SearchRoute
    >
  > {
    return await db
      .getSource()
      .manager.getRepository(DHCPRule)
      .createQueryBuilder('dhcp_rule')
      .addSelect('dhcp_rule.id', 'dhcp_rule_id')
      .addSelect('dhcp_rule.rule_type', 'dhcp_rule_type')
      .addSelect('interface.id', 'interface_id')
      .addSelect('interface.name', 'interface_name')
      .addSelect('firewall.id', 'firewall_id')
      .addSelect('firewall.name', 'firewall_name')
      .addSelect('cluster.id', 'cluster_id')
      .addSelect('cluster.name', 'cluster_name')
      .innerJoin('dhcp_rule.interface', 'interface')
      .innerJoin('interface.hosts', 'hosts')
      .innerJoin('hosts.hostIPObj', 'ipObj', 'ipObj.id = :id', { id })
      .innerJoin('dhcp_rule.firewall', 'firewall')
      .leftJoin('firewall.cluster', 'cluster')
      .where('firewall.fwCloudId = :fwcloud AND interface.id IS NOT NULL', {
        fwcloud,
      })
      .orderBy('dhcp_rule.rule_type', 'ASC')
      .getRawMany();
  }

  public static async searchInterfaceHostInKeepalivedRule(
    dbCon: Query,
    fwcloid: number,
    id: number,
  ): Promise<Array<KeepalivedRule>> {
    return await db
      .getSource()
      .manager.getRepository(KeepalivedRule)
      .createQueryBuilder('keepalived_rule')
      .innerJoin('keepalived_rule.interface', 'interface')
      .innerJoin('interface.hosts', 'hosts')
      .innerJoin('hosts.hostIPObj', 'ipObj', 'ipObj.id = :id', { id })
      .innerJoin('keepalived_rule.firewall', 'firewall')
      .leftJoin('firewall.cluster', 'cluster')
      .where('firewall.fwCloudId = :fwcloud AND interface.id IS NOT NULL', {
        fwcloid,
      })
      .getRawMany();
  }

  public static async searchInterfaceHostInHAProxyRule(
    dbCon: Query,
    fwcloud: number,
    ipObjId: number,
  ): Promise<
    Array<{
      haproxy_rule_id: number;
      haproxy_rule_type: number;
      haproxy_rule_order: number;
      haproxy_rule_active: number;
      haproxy_rule_style: number;
      haproxy_rule_cfg_text: string;
      haproxy_rule_comment: string;
      firewall_id: number;
      firewall_name: string;
      frontend_ip_id: number;
      frontend_ip_name: string;
      frontend_port_id: number;
      frontend_port_name: string;
      backend_port_id: number;
      backend_port_name: string;
    }>
  > {
    return await db
      .getSource()
      .manager.getRepository(HAProxyRule)
      .createQueryBuilder('haproxy_rule')
      .addSelect('haproxy_rule.id', 'haproxy_rule_id')
      .addSelect('haproxy_rule.rule_type', 'haproxy_rule_type')
      .addSelect('haproxy_rule.rule_order', 'haproxy_rule_order')
      .addSelect('haproxy_rule.active', 'haproxy_rule_active')
      .addSelect('haproxy_rule.style', 'haproxy_rule_style')
      .addSelect('haproxy_rule.cfg_text', 'haproxy_rule_cfg_text')
      .addSelect('haproxy_rule.comment', 'haproxy_rule_comment')
      .addSelect('firewall.id', 'firewall_id')
      .addSelect('firewall.name', 'firewall_name')
      .addSelect('frontend_ip.id', 'frontend_ip_id')
      .addSelect('frontend_ip.name', 'frontend_ip_name')
      .addSelect('frontend_port.id', 'frontend_port_id')
      .addSelect('frontend_port.name', 'frontend_port_name')
      .addSelect('backend_port.id', 'backend_port_id')
      .addSelect('backend_port.name', 'backend_port_name')
      .innerJoin('haproxy_rule.frontendIp', 'frontend_ip', 'frontend_ip.id = :ipObjId', { ipObjId })
      .innerJoin('haproxy_rule.frontendPort', 'frontend_port', 'frontend_port.id = :ipObjId', {
        ipObjId,
      })
      .innerJoin('haproxy_rule.backendPort', 'backend_port', 'backend_port.id = :ipObjId', {
        ipObjId,
      })
      .innerJoin('haproxy_rule.firewall', 'firewall', 'firewall.fwCloudId = :fwcloud', { fwcloud })
      .leftJoin('haproxy_rule.group', 'group')
      .leftJoin('haproxy_rule.backendIps', 'backend_ips')
      .leftJoin('backend_ips.ipObj', 'backend_ip')
      .where(
        'firewall.fwCloudId = :fwcloud AND (frontend_ip.id = :ipObjId OR frontend_port.id = :ipObjId OR backend_port.id = :ipObjId)',
        { fwcloud, ipObjId },
      )
      .orderBy('haproxy_rule.rule_order', 'ASC')
      .getRawMany();
  }

  public static searchLastInterfaceWithAddrInHostInRule(
    _interface: number,
    fwcloud: number,
  ): Promise<Array<PolicyRuleToIPObjInRuleData>> {
    return new Promise((resolve, reject) => {
      db.get((error, dbCon) => {
        if (error) return reject(error);

        // If this is a host interface, get data for the rules in with the host is beig used.
        const sql = `SELECT I.id obj_id, I.name obj_name, I.type obj_type_id, T.type obj_type_name,
				C.id cloud_id, C.name cloud_name, R.firewall firewall_id, F.name firewall_name,
				O.rule rule_id, R.rule_order rule_order, R.type rule_type,  PT.name rule_type_name,O.position rule_position_id, P.name rule_position_name,R.comment rule_comment,
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

        dbCon.query(sql, async (error: Error, rows: Array<PolicyRuleToIPObjInRuleData>) => {
          if (error) return reject(error);
          if (rows.length === 0) return resolve(rows);

          try {
            const host = rows[0].obj_id;
            // Get all host addresses.
            const all_host_addr = await Interface.getHostAddr(dbCon, host);
            for (const addr of all_host_addr) {
              // If one of the host addresses hast a different interface, then we are not removing
              // the last host interface with IP addresses.
              if (addr.interface.id != _interface) return resolve([]);
            }
          } catch (error) {
            return reject(error);
          }

          resolve(rows);
        });
      });
    });
  }

  // Search if IP without mask exists.
  public static searchAddr(dbCon: Query, fwcloud: number, addr: string): Promise<number> {
    return new Promise((resolve, reject) => {
      const sql = `select id from ipobj 
            where (fwcloud IS NULL OR fwcloud=${fwcloud}) AND address=${dbCon.escape(addr)} 
            AND type=5 order by id asc`; // 5: ADDRESS

      dbCon.query(sql, (error, rows: Array<{ id: number }>) => {
        if (error) return reject(error);

        resolve(rows.length === 0 ? 0 : rows[0].id);
      });
    });
  }

  // Search if IP with mask exists. (IP is given in CIDR notation)
  public static searchAddrWithMask(
    dbCon: Query,
    fwcloud: number,
    addr: string,
    mask: string,
  ): Promise<number> {
    return new Promise((resolve, reject) => {
      const sql = `select id,address,netmask from ipobj 
            where (fwcloud IS NULL OR fwcloud=${fwcloud}) AND address=${dbCon.escape(addr)} 
            AND (type=5 OR type=7) order by id asc`; // 5: ADDRESS, 7: NETWORK

      dbCon.query(
        sql,
        (error: Error, rows: Array<{ id: number; address: string; netmask: string }>) => {
          if (error) return reject(error);

          // We have two formats for the netmask (for example, 255.255.255.0 or /24).
          // We have to check if the object already exist independently of the netmask format.
          const net1 = ip.cidrSubnet(`${addr}/${mask}`);
          let net2: ip.SubnetInfo;
          for (const row of rows) {
            net2 =
              row.netmask[0] === '/'
                ? ip.cidrSubnet(`${row.address}${row.netmask}`)
                : ip.subnet(row.address, row.netmask);
            if (net1.subnetMaskLength === net2.subnetMaskLength) resolve(row.id);
          }

          resolve(0);
        },
      );
    });
  }

  // Search if IP with mask exists. (IP is given in CIDR notation)
  public static searchIPRange(
    dbCon: Query,
    fwcloud: number,
    start: string,
    end: string,
  ): Promise<number> {
    return new Promise((resolve, reject) => {
      const sql = `select id from ipobj where (fwcloud IS NULL OR fwcloud=${fwcloud}) 
            AND range_start=${dbCon.escape(start)} AND range_end=${dbCon.escape(end)} AND type=6`; // 6: ADDRESS RANGE

      dbCon.query(sql, (error: Error, rows: Array<{ id: number }>) => {
        if (error) return reject(error);

        resolve(rows.length === 0 ? 0 : rows[0].id);
      });
    });
  }

  // Search if IP protocol number exists.
  public static searchIPProtocolByNumber(
    dbCon: Query,
    fwcloud: number,
    protocolNumber: number,
  ): Promise<string | number> {
    return new Promise((resolve, reject) => {
      const sql = `select id from ipobj 
            where (fwcloud IS NULL OR fwcloud=${fwcloud}) AND protocol=${protocolNumber} and type=1`; // 1: IP

      dbCon.query(sql, (error, rows: Array<{ id: number }>) => {
        if (error) return reject(error);

        resolve(rows.length === 0 ? '' : rows[0].id);
      });
    });
  }

  // Search if IP protocol name exists.
  public static searchIPProtocolByName(
    dbCon: Query,
    fwcloud: number,
    protocolName: string,
  ): Promise<string | number> {
    return new Promise((resolve, reject) => {
      const sql = `select id from ipobj 
            where (fwcloud IS NULL OR fwcloud=${fwcloud}) AND name=${dbCon.escape(protocolName)} and type=1`; // 1: IP

      dbCon.query(sql, (error, rows: Array<{ id: number }>) => {
        if (error) return reject(error);

        resolve(rows.length === 0 ? '' : rows[0].id);
      });
    });
  }

  // Search for service port.
  public static searchPort(
    dbCon: Query,
    fwcloud: number,
    protocol: string,
    scrPorts: string[],
    dstPorts: string[],
    tcpFlags: number,
    tcpFlagsSet: number,
  ) {
    return new Promise((resolve, reject) => {
      let sql = `select id from ipobj 
            where (fwcloud IS NULL OR fwcloud=${fwcloud}) AND protocol=${protocol === 'tcp' ? 6 : 17}
            AND source_port_start=${scrPorts[0]} AND source_port_end=${scrPorts[1]}
            AND destination_port_start=${dstPorts[0]} AND destination_port_end=${dstPorts[1]}`;

      if (tcpFlags)
        sql = `${sql} AND tcp_flags_mask=${tcpFlags} AND tcp_flags_settings=${tcpFlagsSet}`;

      dbCon.query(sql, (error, rows: Array<{ id: number }>) => {
        if (error) return reject(error);

        resolve(rows.length === 0 ? 0 : rows[0].id);
      });
    });
  }

  // Search for icmp service.
  public static searchICMP(
    dbCon: Query,
    fwcloud: number,
    type: string,
    code: string,
  ): Promise<number> {
    return new Promise<number>((resolve, reject) => {
      const sql = `select id from ipobj 
            where (fwcloud IS NULL OR fwcloud=${fwcloud}) AND protocol=1 AND type=3
            AND icmp_type=${type} AND icmp_code=${code}`;

      dbCon.query(sql, (error: Error, rows: Array<{ id: number }>) => {
        if (error) return reject(error);

        resolve(rows.length === 0 ? 0 : rows[0].id);
      });
    });
  }
}
