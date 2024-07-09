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

import Model from '../../Model';
import { Firewall } from '../../../models/firewall/Firewall';
import { PolicyRuleToOpenVPN } from '../../../models/policy/PolicyRuleToOpenVPN';
import { Interface } from '../../../models/interface/Interface';
import {
  PrimaryGeneratedColumn,
  Column,
  Entity,
  ManyToOne,
  JoinColumn,
  OneToMany,
  ManyToMany,
  JoinTable,
} from 'typeorm';
const config = require('../../../config/config');
import { IPObj } from '../../ipobj/IPObj';
const readline = require('readline');
import { Tree } from '../../../models/tree/Tree';
import { Crt } from '../pki/Crt';
import { OpenVPNOption } from './openvpn-option.model';
import { IPObjGroup } from '../../ipobj/IPObjGroup';
import { OpenVPNPrefix } from './OpenVPNPrefix';
import { RoutingRule } from '../../routing/routing-rule/routing-rule.model';
import { Route } from '../../routing/route/route.model';
import { RouteToOpenVPN } from '../../routing/route/route-to-openvpn.model';
import { RoutingRuleToOpenVPN } from '../../routing/routing-rule/routing-rule-to-openvpn.model';
import { OpenVPNStatusHistory } from './status/openvpn-status-history';
import db from '../../../database/database-manager';
const fwcError = require('../../../utils/error_table');
const fs = require('fs');
const ip = require('ip');

const tableName: string = 'openvpn';

@Entity(tableName)
export class OpenVPN extends Model {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  install_dir: string;

  @Column()
  install_name: string;

  @Column()
  comment: string;

  @Column()
  status: number;

  @Column()
  created_at: Date;

  @Column()
  updated_at: Date;

  @Column()
  created_by: number;

  @Column()
  updated_by: number;

  @Column()
  installed_at: Date;

  @Column({ name: 'openvpn' })
  parentId: number;

  @ManyToOne((type) => OpenVPN, (openVPN) => openVPN.childs)
  @JoinColumn({
    name: 'openvpn',
  })
  parent: OpenVPN;

  @OneToMany((type) => OpenVPN, (openVPN) => openVPN.parent)
  childs: Array<OpenVPN>;

  @Column({ name: 'firewall' })
  firewallId: number;

  @ManyToOne((type) => Firewall, (firewall) => firewall.openVPNs)
  @JoinColumn({
    name: 'firewall',
  })
  firewall: Firewall;

  @Column({ name: 'crt' })
  crtId: number;

  @ManyToOne((type) => Crt, (crt) => crt.openVPNs)
  @JoinColumn({
    name: 'crt',
  })
  crt: Crt;

  @OneToMany((type) => OpenVPNOption, (options) => options.openVPN)
  openVPNOptions: Array<OpenVPNOption>;

  @ManyToMany((type) => IPObjGroup, (ipObjGroup) => ipObjGroup.openVPNs)
  @JoinTable({
    name: 'openvpn__ipobj_g',
    joinColumn: {
      name: 'openvpn',
    },
    inverseJoinColumn: {
      name: 'ipobj_g',
    },
  })
  ipObjGroups: Array<IPObjGroup>;

  @OneToMany((type) => PolicyRuleToOpenVPN, (policyRuleToOpenVPN) => policyRuleToOpenVPN.openVPN)
  policyRuleToOpenVPNs: Array<PolicyRuleToOpenVPN>;

  @OneToMany((type) => OpenVPNPrefix, (model) => model.openVPN)
  openVPNPrefixes: Array<OpenVPNPrefix>;

  @OneToMany(() => RoutingRuleToOpenVPN, (model) => model.openVPN)
  routingRuleToOpenVPNs: RoutingRuleToOpenVPN[];

  @OneToMany(() => RouteToOpenVPN, (model) => model.openVPN)
  routeToOpenVPNs: RouteToOpenVPN[];

  @OneToMany(() => OpenVPNStatusHistory, (model) => model.openVPNServer)
  historyRecords: OpenVPNStatusHistory[];

  public getTableName(): string {
    return tableName;
  }

  // Insert new OpenVPN configuration register in the database.
  public static addCfg(req) {
    return new Promise((resolve, reject) => {
      const cfg = {
        openvpn: req.body.openvpn,
        firewall: req.body.firewall,
        crt: req.body.crt,
        install_dir: req.body.install_dir,
        install_name: req.body.install_name,
        comment: req.body.comment,
        status: 1,
      };
      req.dbCon.query(`insert into ${tableName} SET ?`, cfg, (error, result) => {
        if (error) return reject(error);
        resolve(result.insertId);
      });
    });
  }

  public static updateCfg(req): Promise<void> {
    return new Promise((resolve, reject) => {
      const sql = `UPDATE ${tableName} SET install_dir=${req.dbCon.escape(req.body.install_dir)},
                install_name=${req.dbCon.escape(req.body.install_name)},
                comment=${req.dbCon.escape(req.body.comment)}
                WHERE id=${req.body.openvpn}`;
      req.dbCon.query(sql, (error, result) => {
        if (error) return reject(error);
        resolve();
      });
    });
  }

  public static addCfgOpt(req, opt): Promise<void> {
    return new Promise((resolve, reject) => {
      req.dbCon.query('insert into openvpn_opt SET ?', opt, (error, result) => {
        if (error) return reject(error);
        resolve();
      });
    });
  }

  public static delCfgOptAll(req): Promise<void> {
    return new Promise((resolve, reject) => {
      const sql = 'delete from openvpn_opt where openvpn=' + req.body.openvpn;
      req.dbCon.query(sql, (error, result) => {
        if (error) return reject(error);
        resolve();
      });
    });
  }

  public static delCfg(dbCon, fwcloud, openvpn): Promise<void> {
    return new Promise((resolve, reject) => {
      // Get all the ipobj referenced by this OpenVPN configuration.
      const sql = `select OBJ.id,OBJ.type from openvpn_opt OPT
                inner join ipobj OBJ on OBJ.id=OPT.ipobj
                where OPT.openvpn=${openvpn} and OPT.name!='remote'`;
      dbCon.query(sql, (error, ipobj_list) => {
        if (error) return reject(error);

        dbCon.query(`delete from openvpn_opt where openvpn=${openvpn}`, (error, result) => {
          if (error) return reject(error);

          dbCon.query(`delete from openvpn_prefix where openvpn=${openvpn}`, (error, result) => {
            if (error) return reject(error);

            dbCon.query(`delete from ${tableName} where id=${openvpn}`, async (error, result) => {
              if (error) return reject(error);

              // Remove all the ipobj referenced by this OpenVPN configuration.
              // In the restrictions check we have already checked that it is possible to remove them.
              try {
                for (const ipobj of ipobj_list) {
                  await IPObj.deleteIpobj(dbCon, fwcloud, ipobj.id);
                  await Tree.deleteObjFromTree(fwcloud, ipobj.id, ipobj.type);
                }
              } catch (error) {
                return reject(error);
              }

              resolve();
            });
          });
        });
      });
    });
  }

  public static delCfgAll(dbCon, fwcloud, firewall): Promise<void> {
    return new Promise((resolve, reject) => {
      // Remove all the ipobj referenced by this OpenVPN configuration.
      // In the restrictions check we have already checked that it is possible to remove them.
      // IMPORTANT: Order by CRT type for remove clients before servers. If we don't do it this way,
      // and the OpenVPN server is removed first, we will get a database foreign key constraint fails error.
      const sql = `select VPN.id,CRT.type from ${tableName} VPN
                inner join crt CRT on CRT.id=VPN.crt
                where VPN.firewall=${firewall} order by CRT.type asc`;
      dbCon.query(sql, async (error, result) => {
        if (error) return reject(error);

        try {
          for (const openvpn of result) {
            await this.delCfg(dbCon, fwcloud, openvpn.id);
          }
        } catch (error) {
          return reject(error);
        }

        resolve();
      });
    });
  }

  public static getCfgId(req) {
    return new Promise((resolve, reject) => {
      const sql = `select id from ${tableName} where firewall=${req.body.firewall} and crt=${req.body.crt}`;
      req.dbCon.query(sql, (error, result) => {
        if (error) return reject(error);
        resolve(result[0].id);
      });
    });
  }

  public static getCfg(req) {
    return new Promise((resolve, reject) => {
      let sql = `select * from ${tableName} where id=${req.body.openvpn}`;
      req.dbCon.query(sql, (error, result) => {
        if (error) return reject(error);

        const data = result[0];
        sql = 'select * from openvpn_opt where openvpn=' + req.body.openvpn;
        req.dbCon.query(sql, (error, result) => {
          if (error) return reject(error);

          data.options = result;
          resolve(data);
        });
      });
    });
  }

  public static getOptData(dbCon, openvpn, name) {
    return new Promise((resolve, reject) => {
      const sql =
        'select * from openvpn_opt where openvpn=' + openvpn + ' and name=' + dbCon.escape(name);
      dbCon.query(sql, (error, result) => {
        if (error) return reject(error);
        resolve(result.length === 0 ? null : result[0]);
      });
    });
  }

  // Get certificate data form file.
  public static getCRTData(file) {
    return new Promise((resolve, reject) => {
      let data = '';
      let onData = 0;
      const rs = fs.createReadStream(file);

      rs.on('error', (error) => reject(error));

      const rl = readline.createInterface({
        input: rs,
        crlfDelay: Infinity,
      });

      rl.on('line', (line) => {
        if (onData) data += line + '\n';
        else if (line.indexOf('-----BEGIN ') === 0) {
          data += line + '\n';
          onData = 1;
        }
      });

      rl.on('close', () => {
        resolve(data);
      });
    });
  }

  // Get data of an OpenVPN server clients.
  public static getOpenvpnClients(dbCon, openvpn) {
    return new Promise((resolve, reject) => {
      const sql = `select VPN.id,CRT.cn,VPN.status from openvpn VPN 
                inner join crt CRT on CRT.id=VPN.crt
                where openvpn=${openvpn}`;
      dbCon.query(sql, (error, result) => {
        if (error) return reject(error);
        resolve(result);
      });
    });
  }

  // Get data of OpenVPN servers of a firewall.
  public static getOpenvpnServersByFirewall(dbCon, firewall) {
    return new Promise((resolve, reject) => {
      const sql = `select VPN.id,CRT.cn from openvpn VPN 
                inner join crt CRT on CRT.id=VPN.crt
                where VPN.firewall=${firewall} and CRT.type=2`;
      dbCon.query(sql, (error, result) => {
        if (error) return reject(error);
        resolve(result);
      });
    });
  }

  // Get OpenVPN client configuration data.
  public static getOpenvpnInfo(dbCon, fwcloud, openvpn, type) {
    return new Promise((resolve, reject) => {
      const sql = `select VPN.*, FW.fwcloud, FW.id firewall_id, FW.name firewall_name, CRT.cn, CA.cn as CA_cn, O.address, FW.cluster cluster_id,
                IF(FW.cluster is null,null,(select name from cluster where id=FW.cluster)) as cluster_name,
                IF(VPN.openvpn is null,VPN.openvpn,(select crt.cn from openvpn inner join crt on crt.id=openvpn.crt where openvpn.id=VPN.openvpn)) as openvpn_server_cn
                ${type === 2 ? `,O.netmask` : ``}
                from openvpn VPN 
                inner join crt CRT on CRT.id=VPN.crt
                inner join ca CA on CA.id=CRT.ca
                inner join firewall FW on FW.id=VPN.firewall
                inner join openvpn_opt OPT on OPT.openvpn=${openvpn}
                inner join ipobj O on O.id=OPT.ipobj
                where FW.fwcloud=${fwcloud} and VPN.id=${openvpn} ${type === 1 ? `and OPT.name='ifconfig-push'` : ``}`;
      dbCon.query(sql, (error, result) => {
        if (error) return reject(error);
        for (let i = 0; i < result.length; i++) {
          result[i].type = type === 1 ? 311 : 312;
        }
        resolve(result);
      });
    });
  }

  public static getOpenvpnServersByCloud(dbCon, fwcloud) {
    return new Promise((resolve, reject) => {
      const sql = `select VPN.id,CRT.cn from openvpn VPN 
                inner join crt CRT on CRT.id=VPN.crt
                inner join ca CA on CA.id=CRT.ca
                where CA.fwcloud=${fwcloud} and CRT.type=2`; // 2 = Server certificate.
      dbCon.query(sql, (error, result) => {
        if (error) return reject(error);
        resolve(result);
      });
    });
  }

  public static dumpCfg(dbCon, fwcloud, openvpn) {
    return new Promise((resolve, reject) => {
      // First obtain the CN of the certificate.
      let sql = `select CRT.cn, CRT.ca, CRT.type, FW.name as fw_name, CL.name as cl_name,
                VPN.install_name as srv_config1, VPNSRV.install_name as srv_config2 from crt CRT
                INNER JOIN openvpn VPN ON VPN.crt=CRT.id
                LEFT JOIN openvpn VPNSRV ON VPNSRV.id=VPN.openvpn
                INNER JOIN firewall FW ON FW.id=VPN.firewall
                LEFT JOIN cluster CL ON CL.id=FW.cluster
			    WHERE VPN.id=${openvpn}`;

      dbCon.query(sql, (error, result) => {
        if (error) return reject(error);

        const ca_dir = config.get('pki').data_dir + '/' + fwcloud + '/' + result[0].ca + '/';
        const ca_crt_path = ca_dir + 'ca.crt';
        const crt_path = ca_dir + 'issued/' + result[0].cn + '.crt';
        const key_path = ca_dir + 'private/' + result[0].cn + '.key';
        const dh_path = result[0].type === 2 ? ca_dir + 'dh.pem' : '';

        // Header description.
        let des = '# FWCloud.net - Developed by SOLTECSIS (https://soltecsis.com)\n';
        des += `# Generated: ${Date()}\n`;
        des += `# Certificate Common Name: ${result[0].cn} \n`;
        des += result[0].cl_name
          ? `# Firewall Cluster: ${result[0].cl_name}\n`
          : `# Firewall: ${result[0].fw_name}\n`;
        if (result[0].srv_config1 && result[0].srv_config1.endsWith('.conf'))
          result[0].srv_config1 = result[0].srv_config1.slice(0, -5);
        if (result[0].srv_config2 && result[0].srv_config2.endsWith('.conf'))
          result[0].srv_config2 = result[0].srv_config2.slice(0, -5);
        des += `# OpenVPN Server: ${result[0].srv_config1 ? result[0].srv_config1 : result[0].srv_config2}\n`;
        des += `# Type: ${result[0].srv_config1 ? 'Server' : 'Client'}\n\n`;

        // Get all the configuration options.
        sql = `select name,ipobj,arg,scope,comment from openvpn_opt where openvpn=${openvpn} order by openvpn_opt.order`;
        dbCon.query(sql, async (error, result) => {
          if (error) return reject(error);

          try {
            // Generate the OpenVPN config file.
            let ovpn_cfg = des;
            let ovpn_ccd = '';

            // First add all the configuration options.
            for (const opt of result) {
              let cfg_line =
                (opt.comment ? '# ' + opt.comment.replace('\n', '\n# ') + '\n' : '') + opt.name;
              if (opt.ipobj) {
                // Get the ipobj data.
                const ipobj: any = await IPObj.getIpobjInfo(dbCon, fwcloud, opt.ipobj);
                if (ipobj.type === 7) {
                  // Network
                  const netmask =
                    ipobj.netmask[0] === '/'
                      ? ip.cidrSubnet(`${ipobj.address}${ipobj.netmask}`).subnetMask
                      : ipobj.netmask;
                  cfg_line += ' ' + ipobj.address + ' ' + netmask;
                } else if (ipobj.type === 5) {
                  // Address
                  cfg_line += ' ' + ipobj.address;
                  if (opt.name === 'ifconfig-push') cfg_line += ' ' + ipobj.netmask;
                  else if (opt.name === 'remote') cfg_line += ' ' + opt.arg;
                } else if (ipobj.type === 9) {
                  // DNS Name
                  cfg_line += ' ' + ipobj.name;
                  if (opt.name === 'remote') cfg_line += ' ' + opt.arg;
                }
              } else if (opt.arg) cfg_line += ' ' + opt.arg;

              if (opt.scope === 0)
                // CCD file
                ovpn_ccd += cfg_line + '\n';
              // Config file
              else ovpn_cfg += cfg_line + '\n';
            }

            // Now read the files data and put it into de config files.
            if (dh_path)
              // Configuración OpenVPN de servidor.
              ovpn_cfg += '\n<dh>\n' + ((await this.getCRTData(dh_path)) as string) + '</dh>\n';
            ovpn_cfg += '\n<ca>\n' + ((await this.getCRTData(ca_crt_path)) as string) + '</ca>\n';
            ovpn_cfg += '\n<cert>\n' + ((await this.getCRTData(crt_path)) as string) + '</cert>\n';
            ovpn_cfg += '\n<key>\n' + ((await this.getCRTData(key_path)) as string) + '</key>\n';

            resolve({ cfg: ovpn_cfg, ccd: ovpn_ccd });
          } catch (error) {
            reject(error);
          }
        });
      });
    });
  }

  public static updateOpenvpnStatus(dbCon, openvpn, status_action) {
    return new Promise((resolve, reject) => {
      dbCon.query(
        `UPDATE openvpn SET status=status${status_action} WHERE id=${openvpn}`,
        (error, result) => {
          if (error) return reject(error);
          resolve({ result: true });
        },
      );
    });
  }

  public static updateOpenvpnInstallDate(dbCon, openvpn) {
    return new Promise((resolve, reject) => {
      dbCon.query(`UPDATE openvpn SET installed_at=NOW() WHERE id=${openvpn}`, (error, result) => {
        if (error) return reject(error);
        resolve({ result: true });
      });
    });
  }

  public static updateOpenvpnStatusIPOBJ(req, ipobj, status_action): Promise<void> {
    return new Promise((resolve, reject) => {
      const sql = `UPDATE openvpn VPN
                INNER JOIN openvpn_opt OPT ON OPT.openvpn=VPN.id
                INNER JOIN ipobj O ON O.id=OPT.ipobj
                SET VPN.status=VPN.status${status_action}
                WHERE O.fwcloud=${req.body.fwcloud} AND O.id=${ipobj}`;
      req.dbCon.query(sql, (error, result) => {
        if (error) return reject(error);
        resolve();
      });
    });
  }

  public static freeVpnIP(req) {
    return new Promise((resolve, reject) => {
      // Search for the VPN LAN and mask.
      let sql = `select OBJ.address,OBJ.netmask from openvpn_opt OPT
                inner join ipobj OBJ on OBJ.id=OPT.ipobj
                where OPT.openvpn=${req.body.openvpn} and OPT.name='server' and OPT.ipobj is not null`;
      req.dbCon.query(sql, (error, result) => {
        if (error) return reject(error);

        // If we have no VPN LAN we can not give any free IP.
        if (result.length === 0) return reject(fwcError.other('OpenVPN LAN not found'));

        // net will contain information about the VPN network.
        const ipobj = result[0];
        const netmask =
          ipobj.netmask[0] === '/'
            ? ip.cidrSubnet(`${ipobj.address}${ipobj.netmask}`).subnetMask
            : ipobj.netmask;
        const net = ip.subnet(ipobj.address, netmask);
        net.firstLong = ip.toLong(net.firstAddress) + 1; // The first usable IP is for the OpenVPN server.
        net.lastLong = ip.toLong(net.lastAddress);

        // Obtain the VPN LAN used IPs.
        sql = `select OBJ.address from openvpn VPN
                    inner join openvpn_opt OPT on OPT.openvpn=VPN.id
                    inner join ipobj OBJ on OBJ.id=OPT.ipobj
                    where VPN.openvpn=${req.body.openvpn} and OPT.ipobj is not null and OBJ.type=5`; // 5=ADDRESS
        req.dbCon.query(sql, (error, result) => {
          if (error) return reject(error);

          let freeIPLong;
          let found;
          for (freeIPLong = net.firstLong; freeIPLong <= net.lastLong; freeIPLong++) {
            found = 0;
            for (const ipCli of result) {
              if (freeIPLong === ip.toLong(ipCli.address)) {
                found = 1;
                break;
              }
            }
            if (!found) return resolve({ ip: ip.fromLong(freeIPLong), netmask: netmask });
          }
          reject(fwcError.other('There are no free VPN IPs'));
        });
      });
    });
  }

  public static searchOpenvpnUsage(
    dbCon: any,
    fwcloud: number,
    openvpn: number,
    extendedSearch?: boolean,
  ) {
    return new Promise(async (resolve, reject) => {
      try {
        const search: any = {};
        search.result = false;
        search.restrictions = {};

        /* Verify that the OpenVPN configuration is not used in any
                    - Rule (table policy_r__openvpn)
                    - IPBOJ group.
                    - OpenVPN is the last in a CRT prefix used in a rule or group.
                */
        search.restrictions.OpenvpnInRule = await PolicyRuleToOpenVPN.searchOpenvpnInRule(
          dbCon,
          fwcloud,
          openvpn,
        );
        search.restrictions.OpenvpnInGroup = await PolicyRuleToOpenVPN.searchOpenvpnInGroup(
          dbCon,
          fwcloud,
          openvpn,
        );
        search.restrictions.LastOpenvpnInPrefixInRule =
          await PolicyRuleToOpenVPN.searchLastOpenvpnInPrefixInRule(dbCon, fwcloud, openvpn);
        search.restrictions.LastOpenvpnInPrefixInGroup =
          await PolicyRuleToOpenVPN.searchLastOpenvpnInPrefixInGroup(dbCon, fwcloud, openvpn);

        search.restrictions.OpenVPNInRoute = await this.searchOpenVPNInRoute(fwcloud, openvpn);
        search.restrictions.OpenVPNInGroupInRoute = await this.searchOpenVPNInGroupInRoute(
          fwcloud,
          openvpn,
        );
        search.restrictions.OpenVPNInRoutingRule = await this.searchOpenVPNInRoutingRule(
          fwcloud,
          openvpn,
        );
        search.restrictions.OpenVPNInGroupInRoutingRule =
          await this.searchOpenVPNInGroupInRoutingRule(fwcloud, openvpn);

        if (extendedSearch) {
          // Include the rules that use the groups in which the OpenVPN is being used.
          search.restrictions.OpenvpnInGroupInRule = [];
          for (let i = 0; i < search.restrictions.OpenvpnInGroup.length; i++) {
            const data: any = await IPObjGroup.searchGroupUsage(
              search.restrictions.OpenvpnInGroup[i].group_id,
              fwcloud,
            );
            search.restrictions.OpenvpnInGroupInRule.push(...data.restrictions.GroupInRule);
          }

          // Include the rules that use prefixes in which the OpenVPN is being used, including the
          // groups (used in rules) in which these prefixes are being used.
          const prefixes = await OpenVPNPrefix.getOpenvpnClientPrefixes(dbCon, openvpn);
          search.restrictions.OpenvpnInPrefixInRule = [];
          search.restrictions.OpenvpnInPrefixInGroupInRule = [];
          for (let i = 0; i < prefixes.length; i++) {
            const data: any = await OpenVPNPrefix.searchPrefixUsage(
              dbCon,
              fwcloud,
              prefixes[i].id,
              true,
            );
            search.restrictions.OpenvpnInPrefixInRule.push(...data.restrictions.PrefixInRule);
            search.restrictions.OpenvpnInPrefixInGroupInRule.push(
              ...data.restrictions.PrefixInGroupInRule,
            );
          }
        }

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
    });
  }

  public static async searchOpenVPNInRoute(fwcloud: number, openvpn: number): Promise<any> {
    return await db
      .getSource()
      .manager.getRepository(Route)
      .createQueryBuilder('route')
      .addSelect('firewall.id', 'firewall_id')
      .addSelect('firewall.name', 'firewall_name')
      .addSelect('cluster.id', 'cluster_id')
      .addSelect('cluster.name', 'cluster_name')
      .innerJoin('route.routeToOpenVPNs', 'routeToOpenVPNs')
      .innerJoin('routeToOpenVPNs.openVPN', 'openvpn', 'openvpn.id = :openvpn', {
        openvpn: openvpn,
      })
      .innerJoinAndSelect('route.routingTable', 'table')
      .innerJoin('table.firewall', 'firewall')
      .leftJoin('firewall.cluster', 'cluster')
      .where(`firewall.fwCloudId = :fwcloud`, { fwcloud: fwcloud })
      .getRawMany();
  }

  public static async searchOpenVPNInRoutingRule(fwcloud: number, openvpn: number): Promise<any> {
    return await db
      .getSource()
      .manager.getRepository(RoutingRule)
      .createQueryBuilder('routing_rule')
      .addSelect('firewall.id', 'firewall_id')
      .addSelect('firewall.name', 'firewall_name')
      .addSelect('cluster.id', 'cluster_id')
      .addSelect('cluster.name', 'cluster_name')
      .innerJoin('routing_rule.routingRuleToOpenVPNs', 'routingRuleToOpenVPNs')
      .innerJoin('routingRuleToOpenVPNs.openVPN', 'openvpn', 'openvpn.id = :openvpn', {
        openvpn: openvpn,
      })
      .innerJoinAndSelect('routing_rule.routingTable', 'table')
      .innerJoin('table.firewall', 'firewall')
      .leftJoin('firewall.cluster', 'cluster')
      .where(`firewall.fwCloudId = :fwcloud`, { fwcloud: fwcloud })
      .getRawMany();
  }

  public static async searchOpenVPNInGroupInRoute(fwcloud: number, openvpn: number): Promise<any> {
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
      .innerJoin('ipObjGroup.openVPNs', 'openvpn', 'openvpn.id = :openvpn', { openvpn: openvpn })
      .innerJoin('table.firewall', 'firewall')
      .leftJoin('firewall.cluster', 'cluster')
      .where(`firewall.fwCloudId = :fwcloud`, { fwcloud: fwcloud })
      .getRawMany();
  }

  public static async searchOpenVPNInGroupInRoutingRule(
    fwcloud: number,
    openvpn: number,
  ): Promise<any> {
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
      .innerJoin('ipObjGroup.openVPNs', 'openvpn', 'openvpn.id = :openvpn', { openvpn: openvpn })
      .innerJoin('routing_rule.routingTable', 'table')
      .innerJoin('table.firewall', 'firewall')
      .leftJoin('firewall.cluster', 'cluster')
      .where(`firewall.fwCloudId = :fwcloud`, { fwcloud: fwcloud })
      .getRawMany();
  }

  public static searchOpenvpnUsageOutOfThisFirewall(req) {
    return new Promise((resolve, reject) => {
      // First get all firewalls OpenVPN configurations.
      const sql = 'select id from openvpn where firewall=' + req.body.firewall;

      req.dbCon.query(sql, async (error, result) => {
        if (error) return reject(error);

        const answer: any = {};
        answer.restrictions = {};
        answer.restrictions.OpenvpnInRule = [];
        answer.restrictions.OpenVPNInRoute = [];
        answer.restrictions.OpenVPNInRoutingRule = [];
        answer.restrictions.OpenvpnInGroup = [];

        try {
          for (const openvpn of result) {
            const data: any = await this.searchOpenvpnUsage(
              req.dbCon,
              req.body.fwcloud,
              openvpn.id,
            );
            if (data.result) {
              answer.restrictions.OpenvpnInRule = answer.restrictions.OpenvpnInRule.concat(
                data.restrictions.OpenvpnInRule,
              );
              answer.restrictions.OpenVPNInRoute = answer.restrictions.OpenVPNInRoute.concat(
                data.restrictions.OpenVPNInRoute,
              );
              answer.restrictions.OpenVPNInRoutingRule =
                answer.restrictions.OpenVPNInRoutingRule.concat(
                  data.restrictions.OpenVPNInRoutingRule,
                );
              answer.restrictions.OpenvpnInGroup = answer.restrictions.OpenvpnInGroup.concat(
                data.restrictions.OpenvpnInGroup,
              );
            }
          }

          // Remove items of this firewall.
          answer.restrictions.OpenvpnInRule = answer.restrictions.OpenvpnInRule.filter(
            (item) => item.firewall_id != req.body.firewall,
          );
          answer.restrictions.OpenVPNInRoute = answer.restrictions.OpenVPNInRoute.filter(
            (item) => item.firewall_id != req.body.firewall,
          );
          answer.restrictions.OpenVPNInRoutingRule =
            answer.restrictions.OpenVPNInRoutingRule.filter(
              (item) => item.firewall_id != req.body.firewall,
            );
        } catch (error) {
          reject(error);
        }

        resolve(answer);
      });
    });
  }

  public static searchOpenvpnChild(dbCon, fwcloud, openvpn) {
    return new Promise((resolve, reject) => {
      const sql = `SELECT VPN.id FROM openvpn VPN
                INNER JOIN firewall FW ON FW.id=VPN.firewall
                WHERE FW.fwcloud=${fwcloud} AND VPN.openvpn=${openvpn}`;
      dbCon.query(sql, async (error, result) => {
        if (error) return reject(error);

        if (result.length > 0) resolve({ result: true, restrictions: { OpenvpnHasChild: true } });
        else resolve({ result: false });
      });
    });
  }

  public static searchIPObjInOpenvpnOpt(dbCon, ipobj, name) {
    return new Promise((resolve, reject) => {
      dbCon.query(
        `select openvpn from openvpn_opt where ipobj=${ipobj} and name=${dbCon.escape(name)}`,
        (error, result) => {
          if (error) return reject(error);
          resolve(result.length < 1 ? false : true);
        },
      );
    });
  }

  // Get the ID of all OpenVPN configurations who's status field is not zero.
  public static getOpenvpnStatusNotZero(req, data) {
    return new Promise((resolve, reject) => {
      const sql = `SELECT VPN.id,VPN.status FROM openvpn VPN
                INNER JOIN firewall FW on FW.id=VPN.firewall
                WHERE VPN.status!=0 AND FW.fwcloud=${req.body.fwcloud}`;
      req.dbCon.query(sql, (error, rows) => {
        if (error) return reject(error);
        data.openvpn_status = rows;
        resolve(data);
      });
    });
  }

  public static addToGroup(dbCon: any, openvpn: number, ipobj_g: number) {
    return new Promise((resolve, reject) => {
      dbCon.query(`INSERT INTO openvpn__ipobj_g values(${openvpn},${ipobj_g})`, (error, result) => {
        if (error) return reject(error);
        resolve(result.insertId);
      });
    });
  }

  public static removeFromGroup(req) {
    return new Promise((resolve, reject) => {
      const sql = `DELETE FROM openvpn__ipobj_g WHERE ipobj_g=${req.body.ipobj_g} AND openvpn=${req.body.ipobj}`;
      req.dbCon.query(sql, (error, result) => {
        if (error) return reject(error);
        resolve(result.insertId);
      });
    });
  }

  public static createOpenvpnServerInterface(req, cfg): Promise<void> {
    return new Promise(async (resolve, reject) => {
      try {
        let openvpn_opt: any = await this.getOptData(req.dbCon, cfg, 'dev');
        if (openvpn_opt) {
          const interface_name = openvpn_opt.arg;

          // If we already have an interface with the same name then do nothing.
          const interfaces = await Interface.getInterfaces(
            req.dbCon,
            req.body.fwcloud,
            req.body.firewall,
          );
          for (const _interface of interfaces) {
            if (_interface.name === interface_name) return resolve();
          }

          // Create the OpenVPN server network interface.
          const interfaceData = {
            id: null,
            firewall: req.body.firewall,
            name: interface_name,
            labelName: '',
            type: 10,
            interface_type: 10,
            comment: '',
            mac: '',
          };

          const interfaceId = await Interface.insertInterface(req.dbCon, interfaceData);
          if (interfaceId) {
            const interfaces_node: any = await Tree.getNodeUnderFirewall(
              req.dbCon,
              req.body.fwcloud,
              req.body.firewall,
              'FDI',
            );
            if (interfaces_node) {
              const nodeId = await Tree.newNode(
                req.dbCon,
                req.body.fwcloud,
                interface_name,
                interfaces_node.id,
                'IFF',
                interfaceId,
                10,
              );

              // Create the network address for the new interface.
              openvpn_opt = await this.getOptData(req.dbCon, cfg, 'server');
              if (openvpn_opt && openvpn_opt.ipobj) {
                // Get the ipobj data.
                const ipobj: any = await IPObj.getIpobjInfo(
                  req.dbCon,
                  req.body.fwcloud,
                  openvpn_opt.ipobj,
                );
                if (ipobj.type === 7) {
                  // Network
                  const net = ip.subnet(ipobj.address, ipobj.netmask);

                  const ipobjData = {
                    id: null,
                    fwcloud: req.body.fwcloud,
                    interface: interfaceId,
                    name: interface_name,
                    type: 5,
                    protocol: null,
                    address: net.firstAddress,
                    netmask: ipobj.netmask,
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
                  };

                  const ipobjId = await IPObj.insertIpobj(req.dbCon, ipobjData);
                  await Tree.newNode(
                    req.dbCon,
                    req.body.fwcloud,
                    `${interface_name} (${net.firstAddress})`,
                    nodeId,
                    'OIA',
                    ipobjId,
                    5,
                  );
                }
              }
            }
          }
        }

        resolve();
      } catch (error) {
        reject(error);
      }
    });
  }

  //Move rules from one firewall to other.
  public static moveToOtherFirewall(dbCon, src_firewall, dst_firewall): Promise<void> {
    return new Promise((resolve, reject) => {
      dbCon.query(
        `UPDATE ${tableName} SET firewall=${dst_firewall} WHERE firewall=${src_firewall}`,
        (error, result) => {
          if (error) return reject(error);
          resolve();
        },
      );
    });
  }
}
