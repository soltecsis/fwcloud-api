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
import { PolicyRuleToWireGuard } from '../../../models/policy/PolicyRuleToWireGuard';
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
import { IPObjGroup } from '../../ipobj/IPObjGroup';
import { RoutingRule } from '../../routing/routing-rule/routing-rule.model';
import { Route } from '../../routing/route/route.model';
import db from '../../../database/database-manager';
import { IpUtils } from '../../../utils/ip-utils';
import { WireGuardOption } from './wireguard-option.model';
import { WireGuardPrefix } from './WireGuardPrefix';
import { RoutingRuleToWireGuard } from '../../routing/routing-rule/routing-rule-to-wireguard.model';
import { RouteToWireGuard } from '../../routing/route/route-to-wireguard.model';
import { WireGuardStatusHistory } from './status/wireguard-status-history';

const utilsModel = require('../../../utils/utils.js');

const fwcError = require('../../../utils/error_table');
const fs = require('fs');

const tableName: string = 'wireguard';

const sodium = require('libsodium-wrappers');
@Entity(tableName)
export class WireGuard extends Model {
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

  @Column({ type: 'varchar', length: 255 })
  public_key: string;

  @Column({ type: 'varchar', length: 255 })
  private_key: string;

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

  @Column({ name: 'wireGuard' })
  parentId: number;

  @ManyToOne((type) => WireGuard, (wireGuard) => wireGuard.childs)
  @JoinColumn({
    name: 'wireGuard',
  })
  parent: WireGuard;

  @OneToMany((type) => WireGuard, (wireGuard) => wireGuard.parent)
  childs: Array<WireGuard>;

  @Column({ name: 'firewall' })
  firewallId: number;

  @ManyToOne((type) => Firewall, (firewall) => firewall.wireGuards)
  @JoinColumn({
    name: 'firewall',
  })
  firewall: Firewall;

  @Column({ name: 'crt' })
  crtId: number;

  @ManyToOne((type) => Crt, (crt) => crt.wireGuards)
  @JoinColumn({
    name: 'crt',
  })
  crt: Crt;

  @OneToMany((type) => WireGuardOption, (options) => options.wireGuard)
  WireGuardOptions: Array<WireGuardOption>;

  @ManyToMany((type) => IPObjGroup, (ipObjGroup) => ipObjGroup.wireGuards)
  @JoinTable({
    name: 'wireGuard__ipobj_g',
    joinColumn: {
      name: 'wireGuard',
    },
    inverseJoinColumn: {
      name: 'ipobj_g',
    },
  })
  ipObjGroups: Array<IPObjGroup>;

  @OneToMany(
    (type) => PolicyRuleToWireGuard,
    (policyRuleToWireGuard) => policyRuleToWireGuard.wireGuard,
  )
  policyRuleToWireGuards: Array<PolicyRuleToWireGuard>;

  @OneToMany((type) => WireGuardPrefix, (model) => model.wireGuard)
  wireGuardPrefixes: Array<WireGuardPrefix>;

  @OneToMany(() => RoutingRuleToWireGuard, (model) => model.wireGuard)
  routingRuleToWireGuards: RoutingRuleToWireGuard[];

  @OneToMany(() => RouteToWireGuard, (model) => model.wireGuard)
  routeToWireGuards: RouteToWireGuard[];

  @OneToMany(() => WireGuardStatusHistory, (model) => model.wireGuardServer)
  historyRecords: WireGuardStatusHistory[];
  static parentId: any;

  public getTableName(): string {
    return tableName;
  }

  public static async generateKeyPair(): Promise<{ public_key: string; private_key: string }> {
    // Ensure the library is initialized
    await sodium.ready;

    // Generate a private key (32 random bytes)
    const privateKey = sodium.randombytes_buf(sodium.crypto_box_SECRETKEYBYTES);

    // Derive the public key from the private key
    const publicKey = sodium.crypto_scalarmult_base(privateKey);

    // Convert to Base64
    const privateKeyBase64 = sodium.to_base64(privateKey);
    const publicKeyBase64 = sodium.to_base64(publicKey);

    return { public_key: publicKeyBase64, private_key: privateKeyBase64 };
  }

  // Insert new WireGuard configuration register in the database.
  public static addCfg(req): Promise<number> {
    return new Promise(async (resolve, reject) => {
      try {
        if (!req.firewall) {
          throw new Error("Missing 'firewall' value in the request");
        }
        if (!req.crt) {
          throw new Error("Missing 'crt' value in the request");
        }
        if (!req.install_dir) {
          throw new Error("Missing 'install_dir' value in the request");
        }
        if (!req.install_name) {
          throw new Error("Missing 'install_name' value in the request");
        }

        const keys = await this.generateKeyPair();

        const cfg = {
          firewallId: req.firewall,
          crtId: req.crt,
          install_dir: req.install_dir,
          install_name: req.install_name,
          comment: req.comment || null,
          status: 1,
          public_key: await utilsModel.encrypt(keys.public_key),
          private_key: await utilsModel.encrypt(keys.private_key),
        };

        await this.insert(cfg)
          .then((result) => {
            resolve(result.identifiers[0].id);
          })
          .catch((error) => {
            reject(error);
          });
      } catch (error) {
        console.error('addCfg error:', error);
        reject(error);
      }
    });
  }

  public static updateCfg(req): Promise<void> {
    return new Promise((resolve, reject) => {
      const sql = `UPDATE ${tableName} SET install_dir=${req.dbCon.escape(req.body.install_dir)},
                install_name=${req.dbCon.escape(req.body.install_name)},
                comment=${req.dbCon.escape(req.body.comment)}
                WHERE id=${req.body.wireGuard}`;
      req.dbCon.query(sql, (error, result) => {
        if (error) return reject(error);
        resolve();
      });
    });
  }

  public static addCfgOpt(req, opt): Promise<void> {
    return new Promise((resolve, reject) => {
      req.dbCon.query('insert into wireguard_opt SET ?', opt, (error, result) => {
        if (error) return reject(error);
        resolve();
      });
    });
  }

  public static addPrefix(wireguardId: number, prefix: { name: string }): Promise<void> {
    return new Promise((resolve, reject) => {
      const sql = `insert into wireguard_prefix SET wireguard=${wireguardId}, name=${prefix.name}`;
      db.getSource()
        .manager.query(sql)
        .then((result) => resolve())
        .catch((error) => reject(error));
    });
  }

  public static delCfgOptAll(req): Promise<void> {
    return new Promise((resolve, reject) => {
      const sql = 'delete from wireguard_opt where wireGuard=' + req.body.WireGuard;
      req.dbCon.query(sql, (error, result) => {
        if (error) return reject(error);
        resolve();
      });
    });
  }

  public static delCfg(dbCon, fwcloud, wireGuard): Promise<void> {
    return new Promise((resolve, reject) => {
      // Get all the ipobj referenced by this WireGuard configuration.
      const sql = `select OBJ.id,OBJ.type from wireguard_opt OPT
                inner join ipobj OBJ on OBJ.id=OPT.ipobj
                where OPT.wireguard=${wireGuard} and OPT.name!='remote'`;
      dbCon.query(sql, (error, ipobj_list) => {
        if (error) return reject(error);

        dbCon.query(`delete from wireguard_opt where wireguard=${wireGuard}`, (error, result) => {
          if (error) return reject(error);

          dbCon.query(
            `delete from wireguard_prefix where wireguard=${wireGuard}`,
            (error, result) => {
              if (error) return reject(error);

              dbCon.query(
                `delete from ${tableName} where id=${wireGuard}`,
                async (error, result) => {
                  if (error) return reject(error);

                  // Remove all the ipobj referenced by this WireGuard configuration.
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
                },
              );
            },
          );
        });
      });
    });
  }

  public static delCfgAll(dbCon, fwcloud, firewall): Promise<void> {
    return new Promise((resolve, reject) => {
      // Remove all the ipobj referenced by this WireGuard configuration.
      // In the restrictions check we have already checked that it is possible to remove them.
      // IMPORTANT: Order by CRT type for remove clients before servers. If we don't do it this way,
      // and the WireGuard server is removed first, we will get a database foreign key constraint fails error.
      const sql = `select VPN.id,CRT.type from ${tableName} VPN
                inner join crt CRT on CRT.id=VPN.crt
                where VPN.firewall=${firewall} order by CRT.type asc`;
      dbCon.query(sql, async (error, result) => {
        if (error) return reject(error);

        try {
          for (const wireGuard of result) {
            await this.delCfg(dbCon, fwcloud, wireGuard.id);
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

  public static getCfg(req): Promise<any> {
    return new Promise((resolve, reject) => {
      let sql = `select * from ${tableName} where id=${req.body.wireguard}`;
      req.dbCon.query(sql, (error, result) => {
        if (error) return reject(error);

        const data = result[0];
        sql = 'select * from wireguard_opt where wireguard=' + req.body.wireguard;
        req.dbCon.query(sql, (error, result) => {
          if (error) return reject(error);

          data.options = result;
          resolve(data);
        });
      });
    });
  }

  public static getOptData(dbCon, wireGuard, name) {
    return new Promise((resolve, reject) => {
      const sql =
        'select * from wireguard_opt where wireguard=' +
        wireGuard +
        ' and name=' +
        dbCon.escape(name);
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

  // Get data of an WireGuard server clients.
  public static getWireGuardClients(dbCon, wireGuard) {
    return new Promise((resolve, reject) => {
      const sql = `select VPN.id,CRT.cn,VPN.status from wireguard VPN 
                inner join crt CRT on CRT.id=VPN.crt
                where wireguard=${wireGuard}`;
      dbCon.query(sql, (error, result) => {
        if (error) return reject(error);
        resolve(result);
      });
    });
  }

  // Get data of WireGuard servers of a firewall.
  public static getWireGuardServersByFirewall(dbCon, firewall) {
    return new Promise((resolve, reject) => {
      const sql = `select VPN.id,CRT.cn from wireguard VPN 
                inner join crt CRT on CRT.id=VPN.crt
                where VPN.firewall=${firewall} and CRT.type=2`;
      dbCon.query(sql, (error, result) => {
        if (error) return reject(error);
        resolve(result);
      });
    });
  }

  // Get WireGuard client configuration data.
  public static getWireGuardInfo(dbCon, fwcloud, wireGuard, type) {
    return new Promise((resolve, reject) => {
      const sql = `select VPN.*, FW.fwcloud, FW.id firewall_id, FW.name firewall_name, CRT.cn, CA.cn as CA_cn, O.address, FW.cluster cluster_id,
                IF(FW.cluster is null,null,(select name from cluster where id=FW.cluster)) as cluster_name,
                IF(VPN.wireguard is null,VPN.wireguard,(select crt.cn from wireguard inner join crt on crt.id=wireguard.crt where wireguard.id=VPN.wireguard)) as wireguard_server_cn
                ${type === 2 ? `,O.netmask` : ``}
                from wireguard VPN 
                inner join crt CRT on CRT.id=VPN.crt
                inner join ca CA on CA.id=CRT.ca
                inner join firewall FW on FW.id=VPN.firewall
                inner join wireguard_opt OPT on OPT.wireguard=${wireGuard}
                inner join ipobj O on O.id=OPT.ipobj
                where FW.fwcloud=${fwcloud} and VPN.id=${wireGuard} ${type === 1 ? `and OPT.name='ifconfig-push'` : ``}`;
      dbCon.query(sql, (error, result) => {
        if (error) return reject(error);
        for (let i = 0; i < result.length; i++) {
          result[i].type = type === 1 ? 321 : 322;
        }
        resolve(result);
      });
    });
  }

  public static getWireGuardServersByCloud(dbCon, fwcloud) {
    return new Promise((resolve, reject) => {
      const sql = `select VPN.id,CRT.cn from wireguard VPN 
                inner join crt CRT on CRT.id=VPN.crt
                inner join ca CA on CA.id=CRT.ca
                where CA.fwcloud=${fwcloud} and CRT.type=2`; // 2 = Server certificate.
      dbCon.query(sql, (error, result) => {
        if (error) return reject(error);
        resolve(result);
      });
    });
  }

  public static dumpCfg(dbCon, fwcloud, wireGuard) {
    return new Promise((resolve, reject) => {
      // First obtain the CN of the certificate.
      let sql = `select CRT.cn, CRT.ca, CRT.type, FW.name as fw_name, CL.name as cl_name,
                VPN.install_name as srv_config1, VPNSRV.install_name as srv_config2 from crt CRT
                INNER JOIN wireguard VPN ON VPN.crt=CRT.id
                LEFT JOIN wireguard VPNSRV ON VPNSRV.id=VPN.wireguard
                INNER JOIN firewall FW ON FW.id=VPN.firewall
                LEFT JOIN cluster CL ON CL.id=FW.cluster
			    WHERE VPN.id=${wireGuard}`;

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
        des += `# Wireguard Server: ${result[0].srv_config1 ? result[0].srv_config1 : result[0].srv_config2}\n`;
        des += `# Type: ${result[0].srv_config1 ? 'Server' : 'Client'}\n\n`;

        // Get all the configuration options.
        sql = `select name,ipobj,arg,scope,comment from wireguard_opt where wireguard=${wireGuard} order by Wireguard_opt.order`;
        dbCon.query(sql, async (error, result) => {
          if (error) return reject(error);

          try {
            // Generate the WireGuard config file.
            let wireguard_cfg = des;
            let wireguard_ccd = '';

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
                      ? IpUtils.cidrSubnet(`${ipobj.address}${ipobj.netmask}`).subnetMask
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
                wireguard_ccd += cfg_line + '\n';
              // Config file
              else wireguard_cfg += cfg_line + '\n';
            }

            // Now read the files data and put it into de config files.
            if (dh_path)
              // Configuración WireGuard de servidor.
              wireguard_cfg +=
                '\n<dh>\n' + ((await this.getCRTData(dh_path)) as string) + '</dh>\n';
            wireguard_cfg +=
              '\n<ca>\n' + ((await this.getCRTData(ca_crt_path)) as string) + '</ca>\n';
            wireguard_cfg +=
              '\n<cert>\n' + ((await this.getCRTData(crt_path)) as string) + '</cert>\n';
            wireguard_cfg +=
              '\n<key>\n' + ((await this.getCRTData(key_path)) as string) + '</key>\n';

            resolve({ cfg: wireguard_cfg, ccd: wireguard_ccd });
          } catch (error) {
            reject(error);
          }
        });
      });
    });
  }

  public static updateWireGuardStatus(dbCon, wireGuard, status_action) {
    return new Promise((resolve, reject) => {
      dbCon.query(
        `UPDATE wireguard SET status=status${status_action} WHERE id=${wireGuard}`,
        (error, result) => {
          if (error) return reject(error);
          resolve({ result: true });
        },
      );
    });
  }

  public static updateWireGuardInstallDate(dbCon, wireGuard) {
    return new Promise((resolve, reject) => {
      dbCon.query(
        `UPDATE wireguard SET installed_at=NOW() WHERE id=${wireGuard}`,
        (error, result) => {
          if (error) return reject(error);
          resolve({ result: true });
        },
      );
    });
  }

  public static updateWireGuardStatusIPOBJ(req, ipobj, status_action): Promise<void> {
    return new Promise((resolve, reject) => {
      const sql = `UPDATE wireguard VPN
                INNER JOIN wireguard_opt OPT ON OPT.wireguard=VPN.id
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
      let sql = `select OBJ.address,OBJ.netmask from wireguard_opt OPT
                inner join ipobj OBJ on OBJ.id=OPT.ipobj
                where OPT.wireguard=${req.body.wireguard} and OPT.name='server' and OPT.ipobj is not null`;
      req.dbCon.query(sql, (error, result) => {
        if (error) return reject(error);

        // If we have no VPN LAN we can not give any free IP.
        if (result.length === 0) return reject(fwcError.other('wireguard LAN not found'));

        // net will contain information about the VPN network.
        const ipobj = result[0];
        const netmask =
          ipobj.netmask[0] === '/'
            ? IpUtils.cidrSubnet(`${ipobj.address}${ipobj.netmask}`).subnetMask
            : ipobj.netmask;
        const net = IpUtils.subnet(ipobj.address, netmask);
        const firstLong = IpUtils.toLong(net.firstAddress) + 1; // The first usable IP is for the WireGuard server.
        const lastLong = IpUtils.toLong(net.lastAddress);

        // Obtain the VPN LAN used IPs.
        sql = `select OBJ.address from wireguard VPN
                    inner join wireguard_opt OPT on OPT.wireguard=VPN.id
                    inner join ipobj OBJ on OBJ.id=OPT.ipobj
                    where VPN.wireguard=${req.body.wireGuard} and OPT.ipobj is not null and OBJ.type=5`; // 5=ADDRESS
        req.dbCon.query(sql, (error, result) => {
          if (error) return reject(error);

          let freeIPLong;
          let found;
          for (freeIPLong = firstLong; freeIPLong <= lastLong; freeIPLong++) {
            found = 0;
            for (const ipCli of result) {
              if (freeIPLong === IpUtils.toLong(ipCli.address)) {
                found = 1;
                break;
              }
            }
            if (!found) return resolve({ ip: IpUtils.fromLong(freeIPLong), netmask: netmask });
          }
          reject(fwcError.other('There are no free VPN IPs'));
        });
      });
    });
  }

  public static searchWireGuardUsage(
    dbCon: any,
    fwcloud: number,
    wireGuard: number,
    extendedSearch?: boolean,
  ): Promise<any> {
    return new Promise(async (resolve, reject) => {
      try {
        const search: any = {};
        search.result = false;
        search.restrictions = {};

        /* Verify that the WireGuard configuration is not used in any
                    - Rule (table policy_r__WireGuard)
                    - IPBOJ group.
                    - WireGuard is the last in a CRT prefix used in a rule or group.
                */
        search.restrictions.WireGuardInRule = await PolicyRuleToWireGuard.searchWireGuardInRule(
          dbCon,
          fwcloud,
          wireGuard,
        );
        search.restrictions.WireGuardInGroup = await PolicyRuleToWireGuard.searchWireGuardInGroup(
          dbCon,
          fwcloud,
          wireGuard,
        );
        search.restrictions.LastWireGuardInPrefixInRule =
          await PolicyRuleToWireGuard.searchLastWireGuardInPrefixInRule(dbCon, fwcloud, wireGuard);
        search.restrictions.LastWireGuardInPrefixInGroup =
          await PolicyRuleToWireGuard.searchLastWireGuardInPrefixInGroup(dbCon, fwcloud, wireGuard);

        search.restrictions.WireGuardInRoute = await this.searchWireGuardInRoute(
          fwcloud,
          wireGuard,
        );
        search.restrictions.WireGuardInGroupInRoute = await this.searchWireGuardInGroupInRoute(
          fwcloud,
          wireGuard,
        );
        search.restrictions.WireGuardInRoutingRule = await this.searchWireGuardInRoutingRule(
          fwcloud,
          wireGuard,
        );
        search.restrictions.WireGuardInGroupInRoutingRule =
          await this.searchWireGuardInGroupInRoutingRule(fwcloud, wireGuard);

        if (extendedSearch) {
          // Include the rules that use the groups in which the WireGuard is being used.
          search.restrictions.WireGuardInGroupInRule = [];
          for (let i = 0; i < search.restrictions.WireGuardInGroup.length; i++) {
            //TODO: FALTA AWAIT

            const data: any = IPObjGroup.searchGroupUsage(
              search.restrictions.WireGuardInGroup[i].group_id,
              fwcloud,
            );
            search.restrictions.WireGuardInGroupInRule.push(...data.restrictions.GroupInRule);
          }

          if (search.restrictions.LastWireGuardInPrefixInRule.length == 0) {
            // Include the rules that use prefixes in which the WireGuard is being used, including the
            // groups (used in rules) in which these prefixes are being used.
            //TODO: FALTA AWAIT
            const prefixes = WireGuardPrefix.getWireGuardClientPrefixes(dbCon, wireGuard);
            search.restrictions.WireGuardInPrefixInRule = [];
            search.restrictions.WireGuardInPrefixInGroupInRule = [];
            if (Array.isArray(prefixes)) {
              for (let i = 0; i < prefixes.length; i++) {
                //TODO: FALTA AWAIT

                const data: any = WireGuardPrefix.searchPrefixUsage(
                  dbCon,
                  fwcloud,
                  prefixes[i].id,
                  true,
                );
                search.restrictions.WireGuardInPrefixInRule.push(...data.restrictions.PrefixInRule);
                search.restrictions.WireGuardInPrefixInGroupInRule.push(
                  ...data.restrictions.PrefixInGroupInRule,
                );
              }
            } else {
              console.error('El método no devolvió un arreglo.');
            }
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

  public static async searchWireGuardInRoute(fwcloud: number, wireGuard: number): Promise<any> {
    return await db
      .getSource()
      .manager.getRepository(Route)
      .createQueryBuilder('route')
      .addSelect('firewall.id', 'firewall_id')
      .addSelect('firewall.name', 'firewall_name')
      .addSelect('cluster.id', 'cluster_id')
      .addSelect('cluster.name', 'cluster_name')
      .innerJoin('route.routeToWireGuards', 'routeToWireGuards')
      .innerJoin('routeToWireGuards.wireGuard', 'wireGuard', 'wireGuard.id = :wireGuard', {
        wireGuard: wireGuard,
      })
      .innerJoinAndSelect('route.routingTable', 'table')
      .innerJoin('table.firewall', 'firewall')
      .leftJoin('firewall.cluster', 'cluster')
      .where(`firewall.fwCloudId = :fwcloud`, { fwcloud: fwcloud })
      .getRawMany();
  }

  public static async searchWireGuardInRoutingRule(
    fwcloud: number,
    wireGuard: number,
  ): Promise<any> {
    return await db
      .getSource()
      .manager.getRepository(RoutingRule)
      .createQueryBuilder('routing_rule')
      .addSelect('firewall.id', 'firewall_id')
      .addSelect('firewall.name', 'firewall_name')
      .addSelect('cluster.id', 'cluster_id')
      .addSelect('cluster.name', 'cluster_name')
      .innerJoin('routing_rule.routingRuleToWireGuards', 'routingRuleToWireGuards')
      .innerJoin('routingRuleToWireGuards.wireGuard', 'wireGuard', 'wireGuard.id = :wireGuard', {
        WireGuard: WireGuard,
      })
      .innerJoinAndSelect('routing_rule.routingTable', 'table')
      .innerJoin('table.firewall', 'firewall')
      .leftJoin('firewall.cluster', 'cluster')
      .where(`firewall.fwCloudId = :fwcloud`, { fwcloud: fwcloud })
      .getRawMany();
  }

  public static async searchWireGuardInGroupInRoute(
    fwcloud: number,
    wireGuard: number,
  ): Promise<any> {
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
      .innerJoin('ipObjGroup.WireGuards', 'wireGuard', 'wireGuard.id = :wireGuard', {
        wireGuard: wireGuard,
      })
      .innerJoin('table.firewall', 'firewall')
      .leftJoin('firewall.cluster', 'cluster')
      .where(`firewall.fwCloudId = :fwcloud`, { fwcloud: fwcloud })
      .getRawMany();
  }

  public static async searchWireGuardInGroupInRoutingRule(
    fwcloud: number,
    wireGuard: number,
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
      .innerJoin('ipObjGroup.WireGuards', 'wireGuard', 'wireGuard.id = :wireGuard', {
        wireGuard: wireGuard,
      })
      .innerJoin('routing_rule.routingTable', 'table')
      .innerJoin('table.firewall', 'firewall')
      .leftJoin('firewall.cluster', 'cluster')
      .where(`firewall.fwCloudId = :fwcloud`, { fwcloud: fwcloud })
      .getRawMany();
  }

  public static searchWireGuardUsageOutOfThisFirewall(req) {
    return new Promise((resolve, reject) => {
      // First get all firewalls WireGuard configurations.
      const sql = 'select id from wireguard where firewall=' + req.body.firewall;

      req.dbCon.query(sql, async (error, result) => {
        if (error) return reject(error);

        const answer: any = {};
        answer.restrictions = {};
        answer.restrictions.WireGuardInRule = [];
        answer.restrictions.WireGuardInRoute = [];
        answer.restrictions.WireGuardInRoutingRule = [];
        answer.restrictions.WireGuardInGroup = [];

        try {
          for (const WireGuard of result) {
            const data: any = await this.searchWireGuardUsage(
              req.dbCon,
              req.body.fwcloud,
              WireGuard.id,
            );
            if (data.result) {
              answer.restrictions.WireGuardInRule = answer.restrictions.WireGuardInRule.concat(
                data.restrictions.WireGuardInRule,
              );
              answer.restrictions.WireGuardInRoute = answer.restrictions.WireGuardInRoute.concat(
                data.restrictions.WireGuardInRoute,
              );
              answer.restrictions.WireGuardInRoutingRule =
                answer.restrictions.WireGuardInRoutingRule.concat(
                  data.restrictions.WireGuardInRoutingRule,
                );
              answer.restrictions.WireGuardInGroup = answer.restrictions.WireGuardInGroup.concat(
                data.restrictions.WireGuardInGroup,
              );
            }
          }

          // Remove items of this firewall.
          answer.restrictions.WireGuardInRule = answer.restrictions.WireGuardInRule.filter(
            (item) => item.firewall_id != req.body.firewall,
          );
          answer.restrictions.WireGuardInRoute = answer.restrictions.WireGuardInRoute.filter(
            (item) => item.firewall_id != req.body.firewall,
          );
          answer.restrictions.WireGuardInRoutingRule =
            answer.restrictions.WireGuardInRoutingRule.filter(
              (item) => item.firewall_id != req.body.firewall,
            );
        } catch (error) {
          reject(error);
        }

        resolve(answer);
      });
    });
  }

  public static searchWireGuardChild(dbCon, fwcloud, wireGuard) {
    return new Promise((resolve, reject) => {
      const sql = `SELECT VPN.id FROM wireguard VPN
                INNER JOIN firewall FW ON FW.id=VPN.firewall
                WHERE FW.fwcloud=${fwcloud} AND VPN.wireguard=${wireGuard}`;
      dbCon.query(sql, async (error, result) => {
        if (error) return reject(error);

        if (result.length > 0) resolve({ result: true, restrictions: { WireGuardHasChild: true } });
        else resolve({ result: false });
      });
    });
  }

  public static searchIPObjInWireGuardOpt(dbCon, ipobj, name) {
    return new Promise((resolve, reject) => {
      dbCon.query(
        `select wireguard from wireguard_opt where ipobj=${ipobj} and name=${dbCon.escape(name)}`,
        (error, result) => {
          if (error) return reject(error);
          resolve(result.length < 1 ? false : true);
        },
      );
    });
  }

  // Get the ID of all WireGuard configurations who's status field is not zero.
  public static getWireGuardStatusNotZero(req, data) {
    return new Promise((resolve, reject) => {
      const sql = `SELECT VPN.id,VPN.status FROM wireguard VPN
                INNER JOIN firewall FW on FW.id=VPN.firewall
                WHERE VPN.status!=0 AND FW.fwcloud=${req.body.fwcloud}`;
      req.dbCon.query(sql, (error, rows) => {
        if (error) return reject(error);
        data.wireGuard_status = rows;
        resolve(data);
      });
    });
  }

  public static addToGroup(dbCon: any, wireGuard: number, ipobj_g: number) {
    return new Promise((resolve, reject) => {
      dbCon.query(
        `INSERT INTO wireguard__ipobj_g values(${wireGuard},${ipobj_g})`,
        (error, result) => {
          if (error) return reject(error);
          resolve(result.insertId);
        },
      );
    });
  }

  public static removeFromGroup(req) {
    return new Promise((resolve, reject) => {
      const sql = `DELETE FROM wireguard__ipobj_g WHERE ipobj_g=${req.body.ipobj_g} AND wireguard=${req.body.ipobj}`;
      req.dbCon.query(sql, (error, result) => {
        if (error) return reject(error);
        resolve(result.insertId);
      });
    });
  }

  public static createWireGuardServerInterface(req, cfg): Promise<void> {
    return new Promise(async (resolve, reject) => {
      try {
        let wireGuard_opt: any = await this.getOptData(req.dbCon, cfg, 'dev');
        if (wireGuard_opt) {
          const interface_name = wireGuard_opt.arg;

          // If we already have an interface with the same name then do nothing.
          const interfaces = await Interface.getInterfaces(
            req.dbCon,
            req.body.fwcloud,
            req.body.firewall,
          );
          for (const _interface of interfaces) {
            if (_interface.name === interface_name) return resolve();
          }

          // Create the WireGuard server network interface.
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
              wireGuard_opt = await this.getOptData(req.dbCon, cfg, 'server');
              if (wireGuard_opt && wireGuard_opt.ipobj) {
                // Get the ipobj data.
                const ipobj: any = await IPObj.getIpobjInfo(
                  req.dbCon,
                  req.body.fwcloud,
                  wireGuard_opt.ipobj,
                );
                if (ipobj.type === 7) {
                  // Network
                  const net = IpUtils.subnet(ipobj.address, ipobj.netmask);

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

  public static getConfigFilename(dbCon) {
    return new Promise((resolve, reject) => {
      const sql = `select install_name from wireguard`;
      dbCon.query(sql, (error, result) => {
        if (error) return reject(error);
        if (!result.length) return resolve('wg0.conf');

        const usedNumbers = result
          .map((row) => row.install_name)
          .filter((name) => /^wg\d+\.conf$/.test(name))
          .map((name) => parseInt(name.match(/\d+/)[0]))
          .sort((a, b) => a - b);

        let nextNumber = 0;
        for (const number of usedNumbers) {
          if (number !== nextNumber) break;
          nextNumber++;
        }

        const newFilename = `wg${nextNumber}.conf`;
        resolve(newFilename);
      });
    });
  }
}
