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
import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  JoinColumn,
  ManyToOne,
  OneToMany,
  Not,
  IsNull,
  In,
} from 'typeorm';

import { Interface } from '../../models/interface/Interface';
import { OpenVPNPrefix } from '../../models/vpn/openvpn/OpenVPNPrefix';
import { OpenVPN } from '../../models/vpn/openvpn/OpenVPN';
import { WireGuard } from '../vpn/wireguard/WireGuard';
import { WireGuardPrefix } from '../../models/vpn/wireguard/WireGuardPrefix';

const utilsModel = require('../../utils/utils.js');
import { PolicyRule } from '../../models/policy/PolicyRule';
import { PolicyGroup } from '../../models/policy/PolicyGroup';
import { Tree } from '../tree/Tree';
import { FwCloud } from '../fwcloud/FwCloud';
import { Cluster } from './Cluster';
import { DatabaseService } from '../../database/database.service';
import { app } from '../../fonaments/abstract-application';
import * as path from 'path';

const config = require('../../config/config');
const firewall_Data = require('../../models/data/data_firewall');
const fwcError = require('../../utils/error_table');

import { RoutingTable } from '../routing/routing-table/routing-table.model';
import { RoutingGroup } from '../routing/routing-group/routing-group.model';
import { RouteGroup } from '../routing/route-group/route-group.model';
import { AvailablePolicyCompilers } from '../../compiler/policy/PolicyCompiler';
import { IPObj } from '../ipobj/IPObj';
import { IPObjGroup } from '../ipobj/IPObjGroup';
import { Communication } from '../../communications/communication';
import { SSHCommunication } from '../../communications/ssh.communication';
import { AgentCommunication } from '../../communications/agent.communication';
import { Route } from '../routing/route/route.model';
import { RoutingRule } from './../routing/routing-rule/routing-rule.model';
import { HAProxyGroup } from '../system/haproxy/haproxy_g/haproxy_g.model';
import { HAProxyRule } from '../system/haproxy/haproxy_r/haproxy_r.model';
import { DHCPGroup } from '../system/dhcp/dhcp_g/dhcp_g.model';
import { DHCPRule } from '../system/dhcp/dhcp_r/dhcp_r.model';
import { KeepalivedGroup } from '../system/keepalived/keepalived_g/keepalived_g.model';
import { KeepalivedRule } from '../system/keepalived/keepalived_r/keepalived_r.model';

const tableName: string = 'firewall';

export enum FirewallInstallCommunication {
  SSH = 'ssh',
  Agent = 'agent',
}

export enum FirewallInstallProtocol {
  HTTPS = 'https',
  HTTP = 'http',
}

export enum PluginsFlags {
  openvpn = 'openvpn',
  geoip = 'geoip',
  crowdsec = 'crowdsec',
  ntopng = 'ntopng',
  suricata = 'suricata',
  keepalived = 'keepalived',
  zeek = 'zeek',
  elasticsearch = 'elasticsearch',
  filebeat = 'filebeat',
  websafety = 'websafety',
  kibana = 'kibana',
  logstash = 'logstash',
  dnssafety = 'dnssafety',
  isc_bind9 = 'isc-bind9',
  isc_dhcp = 'isc-dhcp',
  haproxy = 'haproxy',
  wireguard = 'wireguard',
  ipsec = 'ipsec',
}

// Special rules codes.
export enum FireWallOptMask {
  STATEFUL = 0x0001,
  IPv4_FORWARDING = 0x0002,
  IPv6_FORWARDING = 0x0004,
  DEBUG = 0x0008,
  LOG_ALL = 0x0010,
  DOCKER_COMPAT = 0x0020,
  CROWDSEC_COMPAT = 0x0040,
  FAIL2BAN_COMPAT = 0x0080,
}

@Entity(tableName)
export class Firewall extends Model {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  @Column()
  comment: string;

  @Column()
  created_at: Date;

  @Column()
  updated_at: Date;

  @Column()
  compiled_at: Date;

  @Column()
  installed_at: Date;

  @Column()
  by_user: number;

  @Column()
  status: number;

  @Column({
    type: 'enum',
    enum: FirewallInstallCommunication,
  })
  install_communication: FirewallInstallCommunication;

  @Column({
    type: 'enum',
    enum: FirewallInstallProtocol,
  })
  install_protocol: FirewallInstallProtocol;

  @Column()
  install_apikey: string;

  @Column()
  install_user: string;

  @Column()
  install_pass: string;

  @Column()
  install_interface: number;

  @Column()
  install_ipobj: number;

  @Column()
  save_user_pass: number;

  @Column()
  fwmaster: number;

  @Column()
  install_port: number;

  @Column()
  options: number;

  @Column({ name: 'fwcloud' })
  fwCloudId: number;

  @ManyToOne((type) => FwCloud, (fwcloud) => fwcloud.firewalls)
  @JoinColumn({
    name: 'fwcloud',
  })
  fwCloud: FwCloud;

  @Column({ name: 'cluster' })
  clusterId: number;

  @ManyToOne((type) => Cluster, (cluster) => cluster.firewalls)
  @JoinColumn({
    name: 'cluster',
  })
  cluster: Cluster;

  @OneToMany((type) => Interface, (_interface) => _interface.firewall)
  interfaces: Array<Interface>;

  @OneToMany((type) => OpenVPN, (openVPN) => openVPN.firewall)
  openVPNs: Array<OpenVPN>;

  @OneToMany((type) => WireGuard, (wireGuard) => wireGuard.firewall)
  wireGuards: Array<WireGuard>;

  @OneToMany((type) => PolicyGroup, (policyGroup) => policyGroup.firewall)
  policyGroups: Array<PolicyGroup>;

  @OneToMany((type) => PolicyRule, (policyRule) => policyRule.firewall)
  policyRules: Array<PolicyRule>;

  @OneToMany((type) => RoutingTable, (routingTable) => routingTable.firewall)
  routingTables: RoutingTable[];

  @OneToMany((type) => RoutingGroup, (routingGroup) => routingGroup.firewall)
  routingGroups: RoutingGroup[];

  @OneToMany((type) => RouteGroup, (model) => model.firewall)
  routeGroups: RouteGroup[];

  @OneToMany((type) => RoutingRule, (routingRule) => routingRule.firewallApplyTo)
  routingRules: RoutingRule[];

  @OneToMany((type) => Route, (route) => route.firewallApplyTo)
  routes: Route[];

  @OneToMany((type) => HAProxyGroup, (haproxyGroup) => haproxyGroup.firewall)
  haproxyGroups: HAProxyGroup[];

  @OneToMany((type) => HAProxyRule, (haproxyRule) => haproxyRule.firewall)
  haproxyRules: HAProxyRule[];

  @OneToMany((type) => DHCPGroup, (dhcpGroup) => dhcpGroup.firewall)
  dhcpGroups: DHCPGroup[];

  @OneToMany((type) => DHCPRule, (dhcpRule) => dhcpRule.firewall)
  dhcpRules: DHCPRule[];

  @OneToMany((type) => KeepalivedGroup, (keepalivedGroup) => keepalivedGroup.firewall)
  keepalivedGroups: KeepalivedGroup[];

  @OneToMany((type) => KeepalivedRule, (keepalivedRule) => keepalivedRule.firewall)
  keepalivedRules: KeepalivedRule[];

  public getTableName(): string {
    return tableName;
  }

  /**
   * Returns communication manager. If the firewall is configured to use SSH, custom optional credentials can be provided
   *
   * @param sshuser
   * @param sshpassword
   * @returns
   */
  async getCommunication(
    custom: { sshuser?: string; sshpassword?: string } = {},
  ): Promise<Communication<unknown>> {
    if (this.install_communication === FirewallInstallCommunication.SSH) {
      return new SSHCommunication({
        host: (
          await db
            .getSource()
            .manager.getRepository(IPObj)
            .findOneOrFail({ where: { id: this.install_ipobj } })
        ).address,
        port: this.install_port,
        username: custom.sshuser ?? utilsModel.decrypt(this.install_user),
        password: custom.sshpassword ?? utilsModel.decrypt(this.install_pass),
        options: this.options,
      });
    }

    return new AgentCommunication({
      protocol: this.install_protocol,
      host: (
        await db
          .getSource()
          .manager.getRepository(IPObj)
          .findOneOrFail({ where: { id: this.install_ipobj } })
      ).address,
      port: this.install_port,
      apikey: utilsModel.decrypt(this.install_apikey),
    });
  }

  public getPolicyFilePath(): string {
    if (this.fwCloudId && this.id) {
      return path.join(
        app().config.get('policy').data_dir,
        this.fwCloudId.toString(),
        this.id.toString(),
        app().config.get('policy').script_name,
      );
    }

    return null;
  }

  public async resetCompilationStatus(): Promise<Firewall> {
    this.status = 0;
    this.compiled_at = null;
    this.installed_at = null;

    return await (
      await app().getService<DatabaseService>(DatabaseService.name)
    ).dataSource.manager.save(this);
  }

  /**
   * Returns true if the firewall has at least one rule which is marked
   */
  public async hasMarkedRules(): Promise<boolean> {
    return (
      (
        await db
          .getSource()
          .manager.getRepository(PolicyRule)
          .find({
            where: {
              firewallId: this.id,
              markId: Not(IsNull()),
            },
          })
      ).length > 0
    );
  }

  public static getClusterId(dbCon: any, firewall: number): Promise<number | null> {
    return new Promise((resolve, reject) => {
      dbCon.query(`select cluster from ${tableName} where id=${firewall}`, (error, rows) => {
        if (error) return reject(error);
        if (rows.length !== 1) return reject(fwcError.NOT_FOUND);
        resolve(rows[0].cluster);
      });
    });
  }

  public static getFWCloud(dbCon: any, firewall: number): Promise<number | null> {
    return new Promise((resolve, reject) => {
      dbCon.query(`select fwcloud from ${tableName} where id=${firewall}`, (error, rows) => {
        if (error) return reject(error);
        if (rows.length !== 1) return reject(fwcError.NOT_FOUND);
        resolve(rows[0].fwcloud);
      });
    });
  }

  public static getLastClusterNodeId(dbCon: any, cluster: number): Promise<number> {
    return new Promise((resolve, reject) => {
      dbCon.query(
        `select id from ${tableName} where cluster=${cluster} order by id desc limit 1`,
        (error, rows) => {
          if (error) return reject(error);
          if (rows.length !== 1) return reject(fwcError.NOT_FOUND);
          resolve(rows[0].id);
        },
      );
    });
  }

  /**
   * Get Firewall by User and ID
   *
   * @method getFirewall
   *
   * @param {Integer} iduser User identifier
   * @param {Integer} id firewall identifier
   * @param {Function} callback    Function callback response
   *
   */
  public static getFirewall(req) {
    return new Promise((resolve, reject) => {
      const sql = `SELECT T.*, I.name as interface_name, O.name as ip_name, O.address as ip, M.id as id_fwmaster
				FROM ${tableName} T
				INNER JOIN user__fwcloud U ON T.fwcloud=U.fwcloud AND U.user=${req.session.user_id}
				LEFT join interface I on I.id=T.install_interface
				LEFT join ipobj O on O.id=T.install_ipobj and O.interface=I.id
				LEFT JOIN firewall M on M.cluster=T.cluster and M.fwmaster=1
				WHERE T.id=${req.body.firewall} AND T.fwcloud=${req.body.fwcloud}`;

      req.dbCon.query(sql, async (error, rows) => {
        if (error) return reject(error);
        if (rows.length !== 1) return reject(fwcError.NOT_FOUND);

        try {
          const firewall_data: any = (
            await Promise.all(rows.map((data) => utilsModel.decryptFirewallData(data)))
          )[0];
          resolve(firewall_data);
        } catch (error) {
          return reject(error);
        }
      });
    });
  }

  /**
   * Get Firewalls by User and Cloud
   *
   * @method getFirewallCloud
   *
   * @param {Integer} iduser User identifier
   * @param {Integer} idCloud Cloud identifier
   * @param {Function} callback    Function callback response
   *
   *       callback(error, Rows)
   *
   * @return {ARRAY of Firewall objects} Returns `ARRAY OBJECT FIREWALL DATA`
   *
   * Table: __firewall__
   *
   *           id	int(11) AI PK
   *           cluster	int(11)
   *           fwcloud	int(11)
   *           name	varchar(255)
   *           comment	longtext
   *           created_at	datetime
   *           updated_at	datetime
   *           by_user	int(11)
   */
  public static getFirewallCloud(req) {
    return new Promise((resolve, reject) => {
      const sql = `SELECT T.*, I.name as interface_name, O.name as ip_name, O.address as ip
			FROM ${tableName} T INNER JOIN user__fwcloud U ON T.fwcloud=U.fwcloud AND U.user=${req.session.user_id}
			LEFT join interface I on I.id=T.install_interface
			LEFT join ipobj O on O.id=T.install_ipobj and O.interface=I.id
			WHERE T.fwcloud=${req.body.fwcloud}`;

      req.dbCon.query(sql, (error, rows) => {
        if (error) return reject(error);
        Promise.all(rows.map((data) => utilsModel.decryptFirewallData(data)))
          .then((data) => resolve(data))
          .catch((error) => reject(error));
      });
    });
  }

  /**
   * Get Firewall SSH connection data
   *
   * @method getFirewallSSH
   *
   * @param {Integer} iduser User identifier
   * @param {Integer} id firewall identifier
   * @param {Function} callback    Function callback response
   *
   *       callback(error, Rows)
   *
   * @return {Firewall object} Returns `OBJECT FIREWALL DATA`
   *
   * Table: __firewall__
   *
   *           id	int(11) AI PK
   *           cluster	int(11)
   *           fwcloud	int(11)
   *           name	varchar(255)
   *           comment	longtext
   *           created_at	datetime
   *           updated_at	datetime
   *           by_user	int(11)
   */
  public static getFirewallSSH(req) {
    return new Promise(async (resolve, reject) => {
      try {
        const data: any = await this.getFirewall(req);

        // Obtain SSH connSettings for the firewall to which we want install the policy.
        const SSHconn = {
          host: data.ip,
          port: data.install_port,
          username: data.install_user,
          password: data.install_pass,
        };

        // If we have ssh user and pass in the body of the request, then these data have preference over the data stored in database.
        if (req.body.sshuser && req.body.sshpass) {
          SSHconn.username = req.body.sshuser;
          SSHconn.password = req.body.sshpass;
        }

        // If we have no user or password for the ssh connection, then error.
        if (!SSHconn.username || !SSHconn.password)
          throw fwcError.other('User or password for the SSH connection not found');

        data.SSHconn = SSHconn;
        resolve(data);
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Get Firewall Access by Locked
   *
   * @method getFirewallLockedAccess
   *
   * @param {Integer} iduser User identifier
   * @param {Integer} idfirewall firewall identifier
   * @param {Integer} fwcloud fwcloud identifier
   * @param {Function} callback    Function callback response
   *
   *       callback(error, Rows)
   *
   * @return {Boolean} Returns `LOCKED STATUS`
   *
   */
  public static getFirewallAccess(accessData) {
    return new Promise((resolve, reject) => {
      db.get((error, connection) => {
        if (error) return reject(error);

        //CHECK FIREWALL PERIMSSIONS
        const sql = `SELECT T.* FROM ${tableName} T
				INNER JOIN user__fwcloud U ON T.fwcloud=U.fwcloud AND U.user=${accessData.iduser}
				WHERE T.id=${accessData.firewall}	AND T.fwcloud=${accessData.fwcloud}`;
        connection.query(sql, (error, row) => {
          if (error) return reject(error);

          resolve(row && row.length > 0 ? true : false);
        });
      });
    });
  }

  /**
   * Get Firewalls by User and Cluster
   *
   * @method getFirewallCluster
   *
   * @param {Integer} iduser User identifier
   * @param {Integer} idcluster Cluster identifier
   * @param {Function} callback    Function callback response
   *
   *       callback(error, Rows)
   *
   * @return {ARRAY of Firewall objects} Returns `ARRAY OBJECT FIREWALL DATA`
   *
   * Table: __firewall__
   *
   *           id	int(11) AI PK
   *           cluster	int(11)
   *           fwcloud	int(11)
   *           name	varchar(255)
   *           comment	longtext
   *           created_at	datetime
   *           updated_at	datetime
   *           by_user	int(11)
   */
  public static getFirewallCluster(iduser, idcluster, callback) {
    db.get((error, connection) => {
      if (error) return callback(error, null);
      const sql = `SELECT T.*, I.name as interface_name, O.name as ip_name, O.address as ip
			FROM ${tableName} T 
			INNER JOIN user__fwcloud U ON T.fwcloud=U.fwcloud AND U.user=${iduser}
			LEFT join interface I on I.id=T.install_interface
			LEFT join ipobj O on O.id=T.install_ipobj and O.interface=I.id
			WHERE cluster=${idcluster} ORDER BY T.fwmaster desc, T.id`;
      connection.query(sql, (error, rows) => {
        if (error) callback(error, null);
        else {
          Promise.all(rows.map((data) => utilsModel.decryptFirewallData(data)))
            .then((data) => {
              Promise.all(data.map((data) => this.getfirewallData(data))).then((dataF) => {
                callback(null, dataF);
              });
            })
            .catch((e) => {
              callback(e, null);
            });
        }
      });
    });
  }

  private static getfirewallData(row) {
    return new Promise((resolve, reject) => {
      const firewall = new firewall_Data(row);
      resolve(firewall);
    });
  }

  public static getFirewallClusterMaster(iduser, idcluster, callback) {
    db.get((error, connection) => {
      if (error) callback(error, null);
      const sql = `SELECT T.*, I.name as interface_name, O.name as ip_name, O.address as ip
					FROM ${tableName} T 
					INNER JOIN user__fwcloud U ON T.fwcloud=U.fwcloud AND U.user=${iduser}
					LEFT join interface I on I.id=T.install_interface
					LEFT join ipobj O on O.id=T.install_ipobj and O.interface=I.id
					WHERE cluster=${idcluster} AND fwmaster=1`;
      connection.query(sql, async (error, rows) => {
        if (error) callback(error, null);
        else {
          try {
            const firewall_data: any = await Promise.all(
              rows.map((data) => utilsModel.decryptFirewallData(data)),
            );
            callback(null, firewall_data);
          } catch (error) {
            return callback(error, null);
          }
        }
      });
    });
  }

  /**
   * ADD New Firewall
   *
   * @method insertFirewall
   *
   * @param iduser {Integer}  User identifier
   * @param firewallData {Firewall Object}  Firewall Object data
   *       @param firewallData.id {NULL}
   *       @param firewallData.cluster {Integer} Cluster ID
   *       @param firewallData.fwcloud {Integer} FWcloud ID
   *       @param firewallData.name {string} Firewall Name
   *       @param [firewallData.comment] {String}  comment text
   * @param {Function} callback    Function callback response
   *
   *       callback(error, Rows)
   *
   * @return {CALLBACK RESPONSE}
   *
   * @example
   * #### RESPONSE OK:
   *
   *       callback(null, {"insertId": fwid});
   *
   * #### RESPONSE ERROR:
   *
   *       callback(error, null);
   *
   */
  public static insertFirewall(firewallData) {
    return new Promise((resolve, reject) => {
      db.get((error, connection) => {
        if (error) return reject(error);

        connection.query(`INSERT INTO ${tableName} SET ?`, firewallData, (error, result) => {
          if (error) return reject(error);
          resolve(result.insertId);
        });
      });
    });
  }

  /**
   * UPDATE Firewall
   *
   * @method updateFirewall
   *
   * @param iduser {Integer}  User identifier
   * @param firewallData {Firewall Object}  Firewall Object data
   *       @param firewallData.id {NULL}
   *       @param firewallData.cluster {Integer} Cluster ID
   *       @param firewallData.fwcloud {Integer} FWcloud ID
   *       @param firewallData.name {string} Firewall Name
   *       @param [firewallData.comment] {String}  comment text
   * @param {Function} callback    Function callback response
   *
   *       callback(error, Rows)
   *
   * @return {CALLBACK RESPONSE}
   *
   * @example
   * #### RESPONSE OK:
   *
   *       callback(null, {"result": true});
   *
   * #### RESPONSE ERROR:
   *
   *       callback(error, null);
   *
   */
  public static updateFirewall(dbCon, iduser, firewallData) {
    return new Promise((resolve, reject) => {
      const sqlExists = `SELECT T.id FROM ${tableName} T 
			INNER JOIN user__fwcloud U ON T.fwcloud=U.fwcloud AND U.user=${iduser}
			WHERE T.id=${firewallData.id}`;
      dbCon.query(sqlExists, (error, row) => {
        if (error) return reject(error);

        if (row && row.length > 0) {
          const sql = `UPDATE ${tableName} SET name=${dbCon.escape(firewallData.name)},
					comment=${dbCon.escape(firewallData.comment)},
					install_user=${dbCon.escape(firewallData.install_user)},
					install_pass=${dbCon.escape(firewallData.install_pass)},
					save_user_pass=${firewallData.save_user_pass},
					install_communication="${firewallData.install_communication}",
					install_protocol="${firewallData.install_protocol}",
					install_interface=${firewallData.install_interface},
					install_ipobj=${firewallData.install_ipobj},
					install_port=${firewallData.install_port},
					install_apikey="${firewallData.install_apikey}",
					by_user=${iduser},
					options=${firewallData.options},
					plugins=${firewallData.plugins}
					WHERE id=${firewallData.id}`;
          dbCon.query(sql, (error, result) => {
            if (error) return reject(error);
            resolve(true);
          });
        } else resolve(false);
      });
    });
  }

  // Get the ID of all firewalls who's status field is not zero.
  public static getFirewallStatusNotZero(fwcloud, data) {
    return new Promise((resolve, reject) => {
      db.get((error, connection) => {
        if (error) return reject(error);

        const sql = `SELECT id,cluster,status FROM ${tableName} WHERE status!=0 AND fwcloud=${fwcloud}`;
        connection.query(sql, (error, rows) => {
          if (error) return reject(error);
          if (data) {
            data.fw_status = rows;
            resolve(data);
          } else resolve(rows);
        });
      });
    });
  }

  public static updateFirewallStatus(fwcloud, firewall, status_action) {
    return new Promise((resolve, reject) => {
      db.get((error, connection) => {
        if (error) return reject(error);
        const sql = `UPDATE ${tableName} SET status=status${status_action} WHERE id=${firewall} AND fwcloud=${fwcloud}`;
        connection.query(sql, (error, result) => {
          if (error) return reject(error);
          resolve({ result: true });
        });
      });
    });
  }

  public static updateFirewallCompileDate(fwcloud, firewall): Promise<void> {
    return new Promise((resolve, reject) => {
      db.get((error, connection) => {
        if (error) return reject(error);
        const sql = `UPDATE ${tableName} SET compiled_at=NOW() WHERE id=${firewall} AND fwcloud=${fwcloud}`;
        connection.query(sql, (error, result) => {
          if (error) return reject(error);
          resolve();
        });
      });
    });
  }

  public static updateFirewallInstallDate(fwcloud, firewall): Promise<void> {
    return new Promise((resolve, reject) => {
      db.get((error, connection) => {
        if (error) return reject(error);
        const sql = `UPDATE ${tableName} SET installed_at=NOW() WHERE id=${firewall} AND fwcloud=${fwcloud}`;
        connection.query(sql, (error, result) => {
          if (error) return reject(error);
          resolve();
        });
      });
    });
  }

  public static promoteToMaster(dbCon, firewall): Promise<void> {
    return new Promise((resolve, reject) => {
      dbCon.query(`UPDATE ${tableName} SET fwmaster=1 WHERE id=${firewall}`, (error, result) => {
        if (error) return reject(error);
        resolve();
      });
    });
  }

  public static async updateFirewallStatusIPOBJ(fwcloudId: any, ipObjIds: number[]): Promise<void> {
    if (ipObjIds.length === 0) {
      return;
    }

    const ipObjs: IPObj[] = await db
      .getSource()
      .manager.getRepository(IPObj)
      .find({
        where: {
          id: In(ipObjIds),
          fwCloudId: fwcloudId,
        },
      });

    if (ipObjs.length === 0) {
      return;
    }

    const query = db
      .getSource()
      .manager.getRepository(Firewall)
      .createQueryBuilder('firewall')
      .where('firewall.fwCloudId = :fwcloudId', { fwcloudId })
      .andWhere((qb) => {
        const subqueryPolicy = qb
          .subQuery()
          .select('firewall.id')
          .from(Firewall, 'firewall')
          .innerJoin('firewall.policyRules', 'policy_rule')
          .innerJoin('policy_rule.policyRuleToIPObjs', 'policyRuleToIPObjs')
          .innerJoin('policyRuleToIPObjs.ipObj', 'ipobj', 'ipobj.id IN (:ipobjIds)', {
            ipobjIds: ipObjs.map((item) => item.id).join(','),
          });

        const subQueryRoutesFrom = qb
          .subQuery()
          .select('firewall.id')
          .from(Firewall, 'firewall')
          .innerJoin('firewall.routingTables', 'table')
          .innerJoin('table.routes', 'route')
          .innerJoin('route.routeToIPObjs', 'routeToIPObjs')
          .innerJoin('routeToIPObjs.ipObj', 'ipobj', 'ipobj.id IN (:ipobjIds)', {
            ipobjIds: ipObjs.map((item) => item.id).join(','),
          });

        const subQueryRoutesGateway = qb
          .subQuery()
          .select('firewall.id')
          .from(Firewall, 'firewall')
          .innerJoin('firewall.routingTables', 'table')
          .innerJoin('table.routes', 'route')
          .innerJoin('route.gateway', 'gateway', 'gateway.id IN (:ipobjIds)', {
            ipobjIds: ipObjs.map((item) => item.id).join(','),
          });

        const subQueryRoutingRules = qb
          .subQuery()
          .select('firewall.id')
          .from(Firewall, 'firewall')
          .innerJoin('firewall.routingTables', 'table')
          .innerJoin('table.routingRules', 'rule')
          .innerJoin('rule.routingRuleToIPObjs', 'routingRuleToIPObjs')
          .innerJoin('routingRuleToIPObjs.ipObj', 'ipobj', 'ipobj.id IN (:ipobjIds)', {
            ipobjIds: ipObjs.map((item) => item.id).join(','),
          });

        return `firewall.id IN ${subqueryPolicy.getQuery()} OR firewall.id IN ${subQueryRoutesFrom.getQuery()} OR firewall.id IN ${subQueryRoutesGateway.getQuery()} OR firewall.id IN ${subQueryRoutingRules.getQuery()}`;
      });

    const firewalls = await query.getMany();

    if (firewalls.length > 0) {
      await db
        .getSource()
        .manager.getRepository(Firewall)
        .update(
          {
            id: In(firewalls.map((firewall) => firewall.id)),
          },
          {
            status: 3,
            compiled_at: null,
            installed_at: null,
          },
        );
    }

    //If the ipobj belongs to a group or groups, then update firewalls affected by these groups
    const groupContainers: IPObjGroup[] = await db
      .getSource()
      .manager.getRepository(IPObjGroup)
      .createQueryBuilder('group')
      .innerJoin('group.ipObjToIPObjGroups', 'ipObjToIPObjGroups')
      .innerJoin('ipObjToIPObjGroups.ipObj', 'ipobj', 'ipobj.id IN (:id)', {
        id: ipObjs.map((item) => item.id).join(','),
      })
      .getMany();

    if (groupContainers.length > 0) {
      await this.updateFirewallStatusIPOBJGroup(
        fwcloudId,
        groupContainers.map((group) => group.id),
      );
    }

    // We must see if the ADDRESS is part of a network interface and then update the status of the firewalls that use that network interface.
    const interfacesUsingAddress: Interface[] = await db
      .getSource()
      .manager.getRepository(Interface)
      .createQueryBuilder('interface')
      .innerJoin('interface.ipObjs', 'ipobj', 'ipobj.id IN (:id)', {
        id: ipObjs.map((item) => item.id).join(','),
      })
      .where('ipobj.ipObjType = :addressType', { addressType: 5 })
      .getMany();

    if (interfacesUsingAddress.length > 0) {
      await this.updateFirewallStatusInterface(
        fwcloudId,
        interfacesUsingAddress.map((item) => item.id),
      );
    }
  }

  public static async updateFirewallStatusIPOBJGroup(
    fwcloudId: any,
    ipObjGroupIds: number[],
  ): Promise<void> {
    if (ipObjGroupIds.length === 0) {
      return;
    }

    const ipObjGroups: IPObjGroup[] = await db
      .getSource()
      .manager.getRepository(IPObjGroup)
      .find({
        where: {
          id: In(ipObjGroupIds),
          fwCloudId: fwcloudId,
        },
      });

    if (ipObjGroups.length === 0) {
      return;
    }

    const query = db
      .getSource()
      .manager.getRepository(Firewall)
      .createQueryBuilder('firewall')
      .where('firewall.fwCloudId = :fwcloudId', { fwcloudId: fwcloudId })
      .andWhere((qb) => {
        const subqueryPolicy = qb
          .subQuery()
          .select('firewall.id')
          .from(Firewall, 'firewall')
          .innerJoin('firewall.policyRules', 'policy_rule')
          .innerJoin('policy_rule.policyRuleToIPObjs', 'policyRuleToIPObjs')
          .innerJoin('policyRuleToIPObjs.ipObjGroup', 'group', 'group.id IN (:id)', {
            id: ipObjGroupIds,
          });

        const subQueryRoutes = qb
          .subQuery()
          .select('firewall.id')
          .from(Firewall, 'firewall')
          .innerJoin('firewall.routingTables', 'table')
          .innerJoin('table.routes', 'route')
          .innerJoin('route.routeToIPObjGroups', 'routeToIPObjGroups')
          .innerJoin('routeToIPObjGroups.ipObjGroup', 'group', 'group.id IN (:ids)', {
            ids: ipObjGroups.map((item) => item.id).join(','),
          });

        const subQueryRoutingRules = qb
          .subQuery()
          .select('firewall.id')
          .from(Firewall, 'firewall')
          .innerJoin('firewall.routingTables', 'table')
          .innerJoin('table.routingRules', 'rule')
          .innerJoin('rule.routingRuleToIPObjGroups', 'routingRuleToIPObjGroups')
          .innerJoin('routingRuleToIPObjGroups.ipObjGroup', 'group', 'group.id IN (:ids)', {
            ids: ipObjGroups.map((item) => item.id).join(','),
          });

        return `firewall.id IN ${subqueryPolicy.getQuery()} OR firewall.id IN ${subQueryRoutes.getQuery()} OR firewall.id IN ${subQueryRoutingRules.getQuery()}`;
      });

    const firewalls = await query.getMany();

    if (firewalls.length > 0) {
      await db
        .getSource()
        .manager.getRepository(Firewall)
        .update(
          {
            id: In(firewalls.map((firewall) => firewall.id)),
          },
          {
            status: 3,
            compiled_at: null,
            installed_at: null,
          },
        );
    }
  }

  public static async updateFirewallStatusInterface(
    fwcloudId: number,
    interfaceIds: number[],
  ): Promise<void> {
    if (interfaceIds.length === 0) {
      return;
    }

    const interfaces: Interface[] = await db
      .getSource()
      .manager.getRepository(Interface)
      .createQueryBuilder('int')
      .innerJoin('int.firewall', 'firewall')
      .innerJoin('firewall.fwCloud', 'fwcloud', 'fwcloud.id = :fwcloudId', {
        fwcloudId,
      })
      .where('int.id IN (:interfaceIds)', { interfaceIds })
      .getMany();

    if (interfaces.length > 0) {
      const query = db
        .getSource()
        .manager.getRepository(Firewall)
        .createQueryBuilder('firewall')
        .where('firewall.fwCloudId = :fwcloudId', { fwcloudId })
        .andWhere((qb) => {
          const subqueryPolicy = qb
            .subQuery()
            .select('firewall.id')
            .from(Firewall, 'firewall')
            .innerJoin('firewall.policyRules', 'policy_rule')
            .innerJoin('policy_rule.policyRuleToInterfaces', 'policyRuleToInterfaces')
            .innerJoin('policyRuleToInterfaces.policyRuleInterface', 'int', 'int.id IN (:intIds)', {
              intIds: interfaces.map((item) => item.id).join(','),
            });

          const subqueryRoutes = qb
            .subQuery()
            .select('firewall.id')
            .from(Firewall, 'firewall')
            .innerJoin('firewall.routingTables', 'table')
            .innerJoin('table.routes', 'route')
            .innerJoin('route.interface', 'int', 'int.id IN (:intIds)', {
              intIds: interfaces.map((item) => item.id).join(','),
            });

          return `firewall.id IN ${subqueryPolicy.getQuery()} OR firewall.id IN ${subqueryRoutes.getQuery()}`;
        });

      const firewalls = await query.getMany();
      if (firewalls.length > 0) {
        await db
          .getSource()
          .manager.getRepository(Firewall)
          .update(
            {
              id: In(firewalls.map((firewall) => firewall.id)),
            },
            {
              status: 3,
              compiled_at: null,
              installed_at: null,
            },
          );
      }
    }

    // We must see too if the interface belongs to a host which is used by firewalls.
    const hosts: IPObj[] = await db
      .getSource()
      .manager.getRepository(IPObj)
      .createQueryBuilder('ipObj')
      .innerJoin('ipObj.hosts', 'hosts', 'hosts.hostInterface IN (:interfaceIds)', {
        interfaceIds: interfaceIds,
      })
      .getMany();

    if (hosts.length > 0) {
      await this.updateFirewallStatusIPOBJ(
        fwcloudId,
        hosts.map((item) => item.id),
      );
    }
  }

  public static cloneFirewall(iduser, firewallData) {
    return new Promise((resolve, reject) => {
      db.get((error, connection) => {
        if (error) return reject(error);
        const sqlExists = `SELECT T.id FROM ${tableName} T 
					INNER JOIN user__fwcloud U ON T.fwcloud=U.fwcloud AND U.user=${iduser}
					WHERE T.id=${firewallData.id}`;
        connection.query(sqlExists, (error, row) => {
          //NEW FIREWALL
          if (row && row.length > 0) {
            const sql =
              'insert into firewall(cluster,fwcloud,name,comment,by_user,status,fwmaster,install_port,options,install_user,install_pass) ' +
              ' select cluster,fwcloud,' +
              connection.escape(firewallData.name) +
              ',' +
              connection.escape(firewallData.comment) +
              ',' +
              connection.escape(iduser) +
              ' , 3, fwmaster, install_port, options, "", "" ' +
              ' from firewall where id= ' +
              firewallData.id +
              ' and fwcloud=' +
              firewallData.fwcloud;
            connection.query(sql, (error, result) => {
              if (error) return reject(error);
              resolve({ insertId: result.insertId });
            });
          } else reject(fwcError.NOT_FOUND);
        });
      });
    });
  }

  public static updateFWMaster(iduser, fwcloud, cluster, idfirewall, fwmaster) {
    return new Promise((resolve, reject) => {
      db.get((error, connection) => {
        if (error) return reject(error);
        const sqlExists = `SELECT T.id FROM ${tableName} T 
					INNER JOIN user__fwcloud U ON T.fwcloud=U.fwcloud AND U.user=${iduser}
					WHERE T.id=${idfirewall}`;
        connection.query(sqlExists, (error, row) => {
          if (error) return reject(error);
          if (row && row.length > 0) {
            const sql =
              'UPDATE ' +
              tableName +
              ' SET ' +
              'fwmaster = ' +
              fwmaster +
              ', ' +
              'by_user = ' +
              connection.escape(iduser) +
              ' WHERE id = ' +
              idfirewall +
              ' AND fwcloud=' +
              fwcloud +
              ' AND cluster=' +
              cluster;
            connection.query(sql, (error, result) => {
              if (error) return reject(error);
              if (fwmaster == 1) {
                const sql =
                  'UPDATE ' +
                  tableName +
                  ' SET ' +
                  'fwmaster = 0, ' +
                  'by_user = ' +
                  connection.escape(iduser) +
                  ' WHERE id <> ' +
                  idfirewall +
                  ' AND fwcloud=' +
                  fwcloud +
                  ' AND cluster=' +
                  cluster;
                connection.query(sql, (error, result) => {
                  if (error) return reject(error);
                  resolve({ result: true });
                });
              } else resolve({ result: true });
            });
          } else reject(fwcError.NOT_FOUND);
        });
      });
    });
  }

  public static updateFirewallCluster(firewallData) {
    return new Promise((resolve, reject) => {
      db.get((error, connection) => {
        if (error) return reject(error);
        const sqlExists = `SELECT T.id FROM ${tableName} T 
					INNER JOIN user__fwcloud U ON T.fwcloud=U.fwcloud	AND U.user=${firewallData.by_user}
					WHERE T.id=${firewallData.id}`;
        connection.query(sqlExists, (error, row) => {
          if (error) return reject(error);
          if (row && row.length > 0) {
            const sql =
              'UPDATE ' +
              tableName +
              ' SET cluster = ' +
              connection.escape(firewallData.cluster) +
              ',' +
              'by_user = ' +
              connection.escape(firewallData.by_user) +
              ' ' +
              ' WHERE id = ' +
              firewallData.id;
            connection.query(sql, (error, result) => {
              if (error) return reject(error);
              resolve({ result: true });
            });
          } else resolve({ result: false });
        });
      });
    });
  }

  public static removeFirewallClusterSlaves(cluster, fwcloud, callback) {
    db.get((error, connection) => {
      if (error) callback(error, null);

      const sql =
        'DELETE FROM ' +
        tableName +
        ' WHERE cluster = ' +
        connection.escape(cluster) +
        ' AND fwcloud=' +
        connection.escape(fwcloud) +
        ' AND fwmaster=0';
      connection.query(sql, (error, result) => {
        if (error) {
          callback(error, null);
        } else {
          callback(null, { result: true });
        }
      });
    });
  }

  /**
   * UPDATE Firewall lock status
   *
   * @method updateFirewallLock
   *
   * @param iduser {Integer}  User identifier
   * @param firewallData {Firewall Object}  Firewall Object data
   *       @param firewallData.id {NULL}
   *       @param firewallData.fwcloud {Integer} FWcloud ID
   *       @param firewallData.locked {Integer} Locked status
   * @param {Function} callback    Function callback response
   *
   *       callback(error, Rows)
   *
   * @return {CALLBACK RESPONSE}
   *
   * @example
   * #### RESPONSE OK:
   *
   *       callback(null, {"result": true});
   *
   * #### RESPONSE ERROR:
   *
   *       callback(error, null);
   *
   */
  public static updateFirewallLock(firewallData, callback) {
    const locked = 1;
    db.get((error, connection) => {
      if (error) callback(error, null);
      const sqlExists = `SELECT T.id FROM ${tableName} T 
				INNER JOIN user__fwcloud U ON T.fwcloud=U.fwcloud AND U.user=${firewallData.iduser}
				WHERE T.id=${firewallData.id}	AND (locked=0 OR (locked=1 AND locked_by=${firewallData.iduser}))`;
      connection.query(sqlExists, (error, row) => {
        if (row && row.length > 0) {
          const sql =
            'UPDATE ' +
            tableName +
            ' SET locked = ' +
            connection.escape(locked) +
            ',' +
            'locked_at = CURRENT_TIMESTAMP ,' +
            'locked_by = ' +
            connection.escape(firewallData.iduser) +
            ' ' +
            ' WHERE id = ' +
            firewallData.id;
          connection.query(sql, (error, result) => {
            if (error) {
              callback(error, null);
            } else {
              callback(null, { result: true });
            }
          });
        } else {
          callback(null, { result: false });
        }
      });
    });
  }

  /**
   * UNLOCK Firewall status
   *
   * @method updateFirewallUnlock
   *
   * @param iduser {Integer}  User identifier
   * @param firewallData {Firewall Object}  Firewall Object data
   *       @param firewallData.id {NULL}
   *       @param firewallData.fwcloud {Integer} FWcloud ID
   *       @param firewallData.locked {Integer} Locked status
   * @param {Function} callback    Function callback response
   *
   *       callback(error, Rows)
   *
   * @return {CALLBACK RESPONSE}
   *
   * @example
   * #### RESPONSE OK:
   *
   *       callback(null, {"result": true});
   *
   * #### RESPONSE ERROR:
   *
   *       callback(error, null);
   *
   */
  public static updateFirewallUnlock(firewallData, callback) {
    const locked = 0;
    db.get((error, connection) => {
      if (error) callback(error, null);
      const sqlExists = `SELECT T.id FROM ${tableName} T 
				INNER JOIN user__fwcloud U ON T.fwcloud=U.fwcloud AND U.user=${firewallData.iduser}
				WHERE T.id=${firewallData.id} AND (locked=1 AND locked_by=${firewallData.iduser})`;
      connection.query(sqlExists, (error, row) => {
        if (row && row.length > 0) {
          const sql =
            'UPDATE ' +
            tableName +
            ' SET locked = ' +
            connection.escape(locked) +
            ',' +
            'locked_at = CURRENT_TIMESTAMP ,' +
            'locked_by = ' +
            connection.escape(firewallData.iduser) +
            ' ' +
            ' WHERE id = ' +
            firewallData.id;
          connection.query(sql, (error, result) => {
            if (error) {
              callback(error, null);
            } else {
              callback(null, { result: true });
            }
          });
        } else {
          callback(null, { result: false });
        }
      });
    });
  }

  /**
   * DELETE Firewall
   *
   * @method deleteFirewall
   *
   * @param user {Integer}  User identifier
   * @param id {Integer}  Firewall identifier
   * @param {Function} callback    Function callback response
   *
   *       callback(error, Rows)
   *
   * @return {CALLBACK RESPONSE}
   *
   * @example
   * #### RESPONSE OK:
   *
   *       callback(null, {"result": true, "msg": "deleted"});
   *
   * #### RESPONSE ERROR:
   *
   *       callback(null, {"result": false});
   *
   */
  public static deleteFirewall = (user, fwcloud, firewall): Promise<void> => {
    return new Promise((resolve, reject) => {
      db.get((error, dbCon) => {
        if (error) return reject(error);

        const sql =
          'select id from fwc_tree where node_type="FW" and id_obj=' +
          firewall +
          ' and fwcloud=' +
          fwcloud;
        dbCon.query(sql, async (error, row) => {
          if (error) return reject(error);

          //If exists Id from firewall to remove
          if (row && row.length > 0) {
            try {
              await PolicyRule.deletePolicy_r_Firewall(firewall); //DELETE POLICY, Objects in Positions and firewall rule groups.
              await OpenVPNPrefix.deletePrefixAll(dbCon, fwcloud, firewall); // Remove all firewall openvpn prefixes.
              await OpenVPN.delCfgAll(dbCon, fwcloud, firewall); // Remove all OpenVPN configurations for this firewall.
              await WireGuardPrefix.deletePrefixAll(dbCon, fwcloud, firewall); // Remove all firewall WireGuard prefixes.
              await WireGuard.delCfgAll(dbCon, fwcloud, firewall); // Remove all WireGuard configurations for this firewall.
              await Interface.deleteInterfacesIpobjFirewall(firewall); // DELETE IPOBJS UNDER INTERFACES
              await Interface.deleteInterfaceFirewall(firewall); //DELETE INTEFACES
              await Tree.deleteFwc_TreeFullNode({
                id: row[0].id,
                fwcloud: fwcloud,
                iduser: user,
              }); //DELETE TREE NODES From firewall
              await utilsModel.deleteFolder(
                config.get('policy').data_dir + '/' + fwcloud + '/' + firewall,
              ); // DELETE DATA DIRECTORY FOR THIS FIREWALL
              await Firewall.deleteFirewallRow(dbCon, fwcloud, firewall);
              resolve();
            } catch (error) {
              return reject(error);
            }
          } else reject(fwcError.NOT_FOUND);
        });
      });
    });
  };

  public static deleteFirewallRow = (dbCon, fwcloud, firewall): Promise<void> => {
    return new Promise((resolve, reject) => {
      dbCon.query(
        `DELETE FROM ${tableName} WHERE id=${firewall} AND fwcloud=${fwcloud}`,
        (error, result) => {
          if (error) return reject(error);
          resolve();
        },
      );
    });
  };

  public static checkBodyFirewall(body, isNew) {
    try {
      return new Promise((resolve, reject) => {
        let param: any = '';
        if (!isNew) {
          param = body.id;
          if (param === undefined || param === '' || isNaN(param) || param == null) {
            reject('Firewall ID not valid');
          }
        }
        param = body.cluster;
        if (param === undefined || param === '' || isNaN(param) || param == null) {
          body.cluster = null;
        }

        param = body.name;
        if (param === undefined || param === '' || param == null) {
          reject('Firewall name not valid');
        }

        param = body.save_user_pass;
        if (param === undefined || param === '' || param == null || param == 0) {
          body.save_user_pass = false;
        } else body.save_user_pass = true;
        param = body.install_user;
        if (param === undefined || param === '' || param == null) {
          body.install_user = '';
        }
        param = body.install_pass;
        if (param === undefined || param === '' || param == null) {
          body.install_pass = '';
        }
        param = body.install_interface;
        if (param === undefined || param === '' || isNaN(param) || param == null) {
          body.install_interface = null;
        }
        param = body.install_ipobj;
        if (param === undefined || param === '' || isNaN(param) || param == null) {
          body.install_ipobj = null;
        }
        param = body.install_port;
        if (param === undefined || param === '' || isNaN(param) || param == null) {
          body.install_port = 22;
        }
        param = body.install_protocol;
        if (param === undefined || param === '' || param == null) {
          body.install_protocol = FirewallInstallProtocol.HTTPS;
        }
        param = body.install_apikey;
        if (param === undefined || param === '' || param == null) {
          body.install_apikey = null;
        }
        param = body.fwmaster;
        if (param === undefined || param === '' || isNaN(param) || param == null) {
          body.fwmaster = 0;
        }
        resolve(body);
      });
    } catch (e) {
      console.error(e);
    }
  }

  public static getFirewallOptions(fwcloud: number, firewall: number): Promise<number> {
    return new Promise((resolve, reject) => {
      db.get((error, connection) => {
        if (error) return reject(error);

        connection.query(
          `SELECT options FROM ${tableName} WHERE fwcloud=${fwcloud} AND id=${firewall}`,
          (error, rows) => {
            if (error) return reject(error);
            if (rows.length !== 1) return reject(fwcError.NOT_FOUND);
            resolve(rows[0].options);
          },
        );
      });
    });
  }

  public static getFirewallCompiler(
    fwcloud: number,
    firewall: number,
  ): Promise<AvailablePolicyCompilers> {
    return new Promise(async (resolve, reject) => {
      try {
        // Compiler defined for the firewall is stored in the 3 more significative bits of the 16 bit options field.
        const compilerNumber = (await this.getFirewallOptions(fwcloud, firewall)) & 0xf000;

        if (compilerNumber == 0x0000) resolve('IPTables');
        else if (compilerNumber == 0x1000) resolve('NFTables');
        else reject(fwcError.NOT_FOUND);
      } catch (error) {
        reject(error);
      }
    });
  }

  public static getMasterFirewallId = (fwcloud, cluster) => {
    return new Promise((resolve, reject) => {
      db.get((error, connection) => {
        if (error) return reject(error);

        const sql =
          'SELECT id FROM ' +
          tableName +
          ' WHERE fwcloud=' +
          connection.escape(fwcloud) +
          ' AND cluster=' +
          connection.escape(cluster) +
          ' AND fwmaster=1';
        connection.query(sql, (error, rows) => {
          if (error) return reject(error);
          if (rows.length !== 1) return reject(fwcError.NOT_FOUND);
          resolve(rows[0].id);
        });
      });
    });
  };

  public static searchFirewallRestrictions = (req) => {
    return new Promise(async (resolve, reject) => {
      try {
        const search: any = {};
        search.result = false;
        search.restrictions = {};

        const orgFirewallId = req.body.firewall;
        if (req.body.cluster)
          req.body.firewall = await Firewall.getMasterFirewallId(
            req.body.fwcloud,
            req.body.cluster,
          );

        /* Verify that the nex firewall/cluster objets are not been used in any rule of other firewall:
					- Interfaces and address of interface.
					- OpenVPN configuration.
							  - OpenVPN prefix configuration.
					- WireGuard configuration.
							  - WireGuard prefix configuration.	  	
						  Verify that these objects are not being used in any group as well.
				*/
        const r1: any = await Interface.searchInterfaceUsageOutOfThisFirewall(req);
        const r2: any = await OpenVPN.searchOpenvpnUsageOutOfThisFirewall(req);
        const r3: any = await OpenVPNPrefix.searchPrefixUsageOutOfThisFirewall(req);
        const r4: any = await WireGuard.searchWireGuardUsageOutOfThisFirewall(req);
        const r5: any = await WireGuardPrefix.searchPrefixUsageOutOfThisFirewall(req);

        //TODO: UTILIZAR OBJECTHELERS? utils.mergeObj() is deprectaded. Use ObjectHelers.merge() instead
        if (r1) search.restrictions = utilsModel.mergeObj(search.restrictions, r1.restrictions);
        if (r2) search.restrictions = utilsModel.mergeObj(search.restrictions, r2.restrictions);
        if (r3) search.restrictions = utilsModel.mergeObj(search.restrictions, r3.restrictions);
        if (r4) search.restrictions = utilsModel.mergeObj(search.restrictions, r4.restrictions);
        if (r5) search.restrictions = utilsModel.mergeObj(search.restrictions, r5.restrictions);

        for (const key in search.restrictions) {
          if (search.restrictions[key].length > 0) {
            search.result = true;
            break;
          }
        }
        if (req.body.cluster) req.body.firewall = orgFirewallId;
        resolve(search);
      } catch (error) {
        reject(error);
      }
    });
  };
}
