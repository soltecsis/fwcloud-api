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
import { Firewall } from '../../firewall/Firewall';
import { PolicyRuleToWireGuard } from '../../policy/PolicyRuleToWireGuard';
import { Interface } from '../../interface/Interface';
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
import { IPObj } from '../../ipobj/IPObj';
import readline from 'readline';
import { Tree } from '../../tree/Tree';
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
import { Request } from 'express';
import Query from '../../../database/Query';
import fwcError from '../../../utils/error_table';
import fs from 'fs';

const utilsModel = require('../../../utils/utils.js');
const sodium = require('libsodium-wrappers');

const tableName: string = 'wireguard';

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

  @Column({ name: 'wireguard' })
  parentId: number;

  @ManyToOne((type) => WireGuard, (wireGuard) => wireGuard.childs)
  @JoinColumn({
    name: 'wireguard',
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
    name: 'wireguard__ipobj_g',
    joinColumn: {
      name: 'wireguard',
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

  public getTableName(): string {
    return tableName;
  }

  public static async generateKeyPair(): Promise<{ public_key: string; private_key: string }> {
    // Ensure the library is initialized
    await sodium.ready;

    // Generate key pair suitable for WireGuard (X25519 / curve25519)
    const { publicKey, privateKey } = sodium.crypto_kx_keypair();

    // Encode to base64 for use in wg config
    return {
      public_key: sodium.to_base64(publicKey, sodium.base64_variants.ORIGINAL),
      private_key: sodium.to_base64(privateKey, sodium.base64_variants.ORIGINAL),
    };
  }

  // Insert new WireGuard configuration register in the database.
  public static addCfg(req: Request): Promise<number> {
    return new Promise(async (resolve, reject) => {
      try {
        const keys = await this.generateKeyPair();

        const cfg = {
          firewall: req.body.firewall,
          crt: req.body.crt,
          install_dir: req.body.install_dir,
          install_name: req.body.install_name,
          comment: req.body.comment || null,
          status: 1,
          public_key: await utilsModel.encrypt(keys.public_key),
          private_key: await utilsModel.encrypt(keys.private_key),
          wireguard: req.body.wireguard || null,
        };

        req.dbCon.query(
          `insert into ${tableName} (firewall, crt, install_dir, install_name, comment, status, public_key, private_key, wireguard) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            cfg.firewall,
            cfg.crt,
            cfg.install_dir,
            cfg.install_name,
            cfg.comment,
            cfg.status,
            cfg.public_key,
            cfg.private_key,
            cfg.wireguard,
          ],
          (error, result) => {
            if (error) {
              return reject(error);
            }
            resolve(result.insertId);
          },
        );
      } catch (error) {
        reject(error);
      }
    });
  }

  public static updateCfg(req: Request): Promise<void> {
    return new Promise((resolve, reject) => {
      const sql = `UPDATE ${tableName} SET install_dir=${req.dbCon.escape(req.body.install_dir)},
                install_name=${req.dbCon.escape(req.body.install_name)},
                comment=${req.dbCon.escape(req.body.comment)}
                WHERE id=${req.body.wireguard}`;
      req.dbCon.query(sql, (error, _) => {
        if (error) return reject(error);
        resolve();
      });
    });
  }

  public static addCfgOpt(req: Request, opt: any): Promise<void> {
    return new Promise((resolve, reject) => {
      // Try to update first. If no rows are affected, insert.
      const updateSql = `UPDATE wireguard_opt SET ? WHERE wireguard = ? AND name = ?`;
      req.dbCon.query(updateSql, [opt, opt.wireguard, opt.name], (updateError, updateResult) => {
        if (updateError) return reject(updateError);
        if (updateResult.affectedRows > 0) {
          return resolve();
        }
        // If not updated, insert new
        req.dbCon.query('INSERT INTO wireguard_opt SET ?', opt, (insertError) => {
          if (insertError) return reject(insertError);
          resolve();
        });
      });
    });
  }

  public static updateCfgOptByipobj(
    dbCon: Query,
    ipobj: number,
    name: string,
    arg: string,
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const sql = `UPDATE wireguard_opt SET arg=${dbCon.escape(arg)} WHERE ipobj=${ipobj} and name=${dbCon.escape(name)}`;
      dbCon.query(sql, (error, _) => {
        if (error) return reject(error);
        resolve();
      });
    });
  }

  public static updateIpObjCfgOpt(
    dbCon: Query,
    ipobj: number,
    wireGuard: number,
    name: string,
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const sql = `UPDATE wireguard_opt SET ipobj=${ipobj} WHERE wireguard=${wireGuard} and name=${dbCon.escape(name)}`;
      dbCon.query(sql, (error, _) => {
        if (error) return reject(error);
        resolve();
      });
    });
  }

  public static isWireGuardServer(dbCon: Query, wireGuard: number): Promise<boolean> {
    return new Promise((resolve, reject) => {
      const sql = `SELECT wireguard FROM ${tableName} WHERE id=${wireGuard}`;
      dbCon.query(sql, (error, result) => {
        if (error) return reject(error);
        if (result.length === 0) return resolve(false);
        // If wireguard is null, it is a server.
        resolve(result[0].wireguard === null);
      });
    });
  }

  public static checkIpobjInWireGuardOpt(dbCon: Query, ipobj: number): Promise<any> {
    return new Promise((resolve, reject) => {
      const sql = `SELECT * FROM wireguard_opt WHERE ipobj=${ipobj}`;
      dbCon.query(sql, (error, result) => {
        if (error) return reject(error);
        resolve(result);
      });
    });
  }

  public static addPrefix(wireguardId: number, prefix: { name: string }): Promise<void> {
    return new Promise((resolve, reject) => {
      const sql = `insert into wireguard_prefix SET wireguard=${wireguardId}, name=${prefix.name}`;
      db.getSource()
        .manager.query(sql)
        .then((_) => resolve())
        .catch((error) => reject(error));
    });
  }

  public static delCfgOptAll(req: Request): Promise<void> {
    return new Promise((resolve, reject) => {
      const sql = 'delete from wireguard_opt where wireguard=' + req.body.wireguard;
      req.dbCon.query(sql, (error, _) => {
        if (error) return reject(error);
        resolve();
      });
    });
  }

  public static delCfgOptByScope(req, scope: number): Promise<void> {
    return new Promise((resolve, reject) => {
      const sql = `delete from wireguard_opt where wireguard=${req.body.wireguard} and scope=${req.dbCon.escape(scope)}`;
      req.dbCon.query(sql, (error, _) => {
        if (error) return reject(error);
        resolve();
      });
    });
  }

  public static delCfg(
    dbCon: Query,
    fwcloud: number,
    wireGuard: number,
    isClient = false,
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      // Get all the ipobj referenced by this WireGuard configuration.
      const sql = `select OBJ.id,OBJ.type from wireguard_opt OPT
                inner join ipobj OBJ on OBJ.id=OPT.ipobj
                where OPT.wireguard=${wireGuard} and OPT.name!='Endpoint'`;
      dbCon.query(sql, (error, ipobj_list) => {
        if (error) return reject(error);

        if (isClient) {
          dbCon.query(`delete from wireguard_opt where wireguard_cli=${wireGuard}`, (error, _) => {
            if (error) return reject(error);
            // Continue with the rest of the deletion process
          });
        }
        dbCon.query(`delete from wireguard_opt where wireguard=${wireGuard}`, (error, _) => {
          if (error) return reject(error);
          dbCon.query(`delete from wireguard_prefix where wireguard=${wireGuard}`, (error, _) => {
            if (error) return reject(error);

            dbCon.query(`delete from ${tableName} where id=${wireGuard}`, async (error, _) => {
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
            });
          });
        });
      });
    });
  }

  public static delCfgAll(dbCon: Query, fwcloud: number, firewall: number): Promise<void> {
    return new Promise((resolve, reject) => {
      // Remove all the ipobj referenced by this WireGuard configuration.
      // In the restrictions check we have already checked that it is possible to remove them.
      // IMPORTANT: Order by CRT type for remove clients before servers. If we don't do it this way,
      // and the WireGuard server is removed first, we will get a database foreign key constraint fails error.
      const sql = `select VPN.id,CRT.type,VPN.wireguard from ${tableName} VPN
                inner join crt CRT on CRT.id=VPN.crt
                where VPN.firewall=${firewall} order by CRT.type asc`;
      dbCon.query(sql, async (error, result) => {
        if (error) return reject(error);
        try {
          // First delete client configurations, if exist
          const clientConfigs = result.filter((r) => r.type === 1 && r.wireguard !== null);
          for (const wireGuard of clientConfigs) {
            await this.delCfg(dbCon, fwcloud, wireGuard.id, true);
          }
          // Afterwards, delete server configurations
          const serverConfigs = result.filter((r) => r.type !== 1);
          for (const wireGuard of serverConfigs) {
            await this.delCfg(dbCon, fwcloud, wireGuard.id);
          }
        } catch (error) {
          return reject(error);
        }

        resolve();
      });
    });
  }

  public static getCfgId(req: Request) {
    return new Promise((resolve, reject) => {
      const sql = `select id from ${tableName} where firewall=${req.body.firewall} and crt=${req.body.crt}`;
      req.dbCon.query(sql, (error, result) => {
        if (error) return reject(error);
        resolve(result[0].id);
      });
    });
  }

  public static getCfg(dbCon: Query, wireGuard: number): Promise<any> {
    return new Promise((resolve, reject) => {
      let sql = `select * from ${tableName} where id=${wireGuard}`;
      dbCon.query(sql, (error, wireguard_result) => {
        if (error) return reject(error);

        const data = wireguard_result[0];
        const type = data.wireguard === null ? 322 : 321;

        if (data.wireguard !== null) {
          sql = `select * from ${tableName} where id=${data.wireguard}`;
          dbCon.query(sql, async (error, result) => {
            if (error) return reject(error);
            const serverPublicKey = await utilsModel.decryptWireguardData(result[0]);
            data.server_public_key = serverPublicKey.public_key;
          });
        }

        sql = `select * from wireguard_opt where wireguard=${wireGuard}`;
        dbCon.query(sql, async (error, result) => {
          if (error) return reject(error);

          data.options = result;
          try {
            const wireguard_data = (
              await Promise.all(
                wireguard_result.map((wireguard: WireGuard) =>
                  utilsModel.decryptWireguardData(wireguard),
                ),
              )
            )[0];

            wireguard_data.type = type;

            resolve(wireguard_data);
          } catch (error) {
            return reject(error);
          }
        });
      });
    });
  }

  public static getOptData(dbCon: Query, wireGuard: number, name?: string) {
    return new Promise((resolve, reject) => {
      let sql = `select * from wireguard_opt where wireguard=${wireGuard}`;
      if (name) {
        sql += ` and name=${dbCon.escape(name)}`;
      }
      dbCon.query(sql, (error, result) => {
        if (error) return reject(error);
        if (name) {
          resolve(result.length === 0 ? null : result[0]);
        } else {
          resolve(result);
        }
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
  public static getWireGuardClientsInfo(dbCon: Query, wireGuard: number): Promise<any[]> {
    return new Promise((resolve, reject) => {
      let sql = `SELECT VPN.*, CRT.cn, VPN.status 
                   FROM wireguard VPN 
                   INNER JOIN crt CRT ON CRT.id = VPN.crt
                   WHERE VPN.wireguard = ?`;

      dbCon.query(sql, [wireGuard], async (error: any, result: WireGuard[]) => {
        if (error) return reject(error);
        if (result.length === 0) return resolve([]); // If there are no VPNs, return an empty array

        const vpnIds = result.map((vpn) => vpn.id);
        if (vpnIds.length === 0) return resolve(result);
        try {
          result = await Promise.all(result.map((vpn) => utilsModel.decryptWireguardData(vpn)));
        } catch (error) {
          return reject(error);
        }

        // Second query: Get all the wireguard_opt of these VPNs
        sql = `SELECT * FROM wireguard_opt WHERE wireguard IN (${vpnIds.join(',')})`;

        dbCon.query(sql, (error, optionResults) => {
          if (error) return reject(error);

          // Get the IP object IDs of the options
          const ipObjIds = optionResults
            .map((opt: any) => opt.ipobj)
            .filter((id: number) => id !== null);
          // If there is no ipobj, return the result without making another query
          if (ipObjIds.length === 0) {
            const optionsMap = optionResults.reduce((acc: any, option: any) => {
              if (!acc[option.wireguard]) acc[option.wireguard] = [];
              option.ipobj = null;
              acc[option.wireguard].push(option);
              return acc;
            }, {});

            const finalResult = result.map((vpn) => ({
              ...vpn,
              options: optionsMap[vpn.id] || [],
            }));

            return resolve(finalResult);
          }

          // Third query: Get the information of the ipobj with the obtained IDs
          sql = `SELECT * FROM ipobj WHERE id IN (${ipObjIds.join(',')})`;

          dbCon.query(sql, (error, ipObjResults) => {
            if (error) return reject(error);

            const ipObjMap = ipObjResults.reduce((acc: any, ip: any) => {
              acc[ip.id] = ip;
              return acc;
            }, {});

            // Add the ipobj information inside each option
            const optionsMap = optionResults.reduce((acc: any, option: any) => {
              if (!acc[option.wireguard]) acc[option.wireguard] = [];
              option.ipobj = ipObjMap[option.ipobj] || null;
              acc[option.wireguard].push(option);
              return acc;
            }, {});

            const finalResult = result.map((vpn) => ({
              ...vpn,
              options: optionsMap[vpn.id] || [],
            }));

            resolve(finalResult);
          });
        });
      });
    });
  }

  // Get the CN of the WireGuard server certificate and the IDs of the WireGuard clients
  public static getWireGuardClients(dbCon: Query, wireGuard: number): Promise<any[]> {
    return new Promise((resolve, reject) => {
      // First, get all WireGuard clients linked to the given server
      const sqlClient = `
        SELECT 
          VPN.id, 
          CRT.cn
        FROM wireguard VPN
        INNER JOIN crt CRT ON CRT.id = VPN.crt
        WHERE VPN.wireguard = ?
        ORDER BY CRT.cn
      `;

      dbCon.query(sqlClient, [wireGuard], async (error: any, clients: any[]) => {
        if (error) return reject(error);
        if (clients.length === 0) return resolve([]);

        try {
          const enrichedClients = await Promise.all(
            clients.map(async (vpn) => {
              // Get the client's IP address (if any)
              const addressRes: any = await new Promise((res, rej) => {
                dbCon.query(
                  `SELECT IP.address , IP.netmask
                 FROM wireguard_opt OPT 
                 INNER JOIN ipobj IP ON IP.id = OPT.ipobj 
                 WHERE OPT.wireguard = ?`,
                  [vpn.id],
                  (err, rows) => (err ? rej(err) : res(rows)),
                );
              });

              const address =
                addressRes.length > 0 ? addressRes[0].address + addressRes[0].netmask : null;

              // Get the AllowedIPs defined for this client from the server's configuration
              const allowedRes: any = await new Promise((res, rej) => {
                dbCon.query(
                  `SELECT * 
                 FROM wireguard_opt 
                 WHERE wireguard = ? AND wireguard_cli = ? AND name = 'AllowedIPs'`,
                  [wireGuard, vpn.id],
                  (err, rows) => (err ? rej(err) : res(rows)),
                );
              });

              const allowed = allowedRes.length > 0 ? allowedRes[0].arg : null;

              // Concatenate address and allowed IPs, if both exist
              const allowedips = address
                ? allowed
                  ? `${address}, ${allowed}`
                  : address
                : allowed || null;

              return {
                ...vpn,
                allowedips,
              };
            }),
          );

          resolve(enrichedClients);
        } catch (err) {
          reject(err);
        }
      });
    });
  }

  // Get WireGuard client configuration data.
  public static getWireGuardInfo(dbCon: Query, fwcloud: number, wireGuard: number, type: number) {
    return new Promise((resolve, reject) => {
      const sql = `select VPN.*, FW.fwcloud, FW.id firewall_id, FW.name firewall_name, CRT.cn, CA.cn as CA_cn, 
            IF(${type} = 322, 
              (select ipobj.address from wireguard_opt 
               inner join ipobj on ipobj.id = wireguard_opt.ipobj 
               where wireguard_opt.wireguard = VPN.id and wireguard_opt.name = '<<vpn_network>>' limit 1), 
              O.address
            ) as address,
            FW.cluster cluster_id,
            IF(FW.cluster is null,null,(select name from cluster where id=FW.cluster)) as cluster_name,
            IF(VPN.wireguard is null,VPN.wireguard,(select crt.cn from wireguard inner join crt on crt.id=wireguard.crt where wireguard.id=VPN.wireguard)) as wireguard_server_cn
            ${type === 322 ? `,O.netmask` : ``}
            from wireguard VPN 
            inner join crt CRT on CRT.id=VPN.crt
            inner join ca CA on CA.id=CRT.ca
            inner join firewall FW on FW.id=VPN.firewall
            inner join wireguard_opt OPT on OPT.wireguard=${wireGuard}
            inner join ipobj O on O.id=OPT.ipobj
            where FW.fwcloud=${fwcloud} and VPN.id=${wireGuard}`;

      dbCon.query(sql, (error, result) => {
        if (error) {
          return reject(error);
        }
        for (let i = 0; i < result.length; i++) {
          result[i].type = type === 1 ? 321 : 322;
        }
        resolve(result);
      });
    });
  }

  public static getWireGuardServersByCloud(dbCon: Query, fwcloud: number) {
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

  public static dumpCfg(dbCon: Query, wireGuard: number) {
    return new Promise((resolve, reject) => {
      // First obtain the CN of the certificate.
      const sqlCN = `select CRT.cn, CRT.ca, CRT.type, FW.name as fw_name, CL.name as cl_name,
                VPN.install_name as srv_config1, VPNSRV.install_name as srv_config2 from crt CRT
                INNER JOIN wireguard VPN ON VPN.crt=CRT.id
                LEFT JOIN wireguard VPNSRV ON VPNSRV.id=VPN.wireguard
                INNER JOIN firewall FW ON FW.id=VPN.firewall
                LEFT JOIN cluster CL ON CL.id=FW.cluster
              WHERE VPN.id=${wireGuard}`;

      dbCon.query(sqlCN, async (error, result) => {
        if (error) return reject(error);

        // Header description.
        let wg_cfg = '# FWCloud.net - Developed by SOLTECSIS (https://soltecsis.com)\n';
        wg_cfg += `# Generated: ${Date()}\n`;
        wg_cfg += `# Certificate Common Name: ${result[0].cn} \n`;
        wg_cfg += result[0].cl_name
          ? `# Firewall Cluster: ${result[0].cl_name}\n`
          : `# Firewall: ${result[0].fw_name}\n`;
        if (result[0].srv_config1 && result[0].srv_config1.endsWith('.conf'))
          result[0].srv_config1 = result[0].srv_config1.slice(0, -5);
        if (result[0].srv_config2 && result[0].srv_config2.endsWith('.conf'))
          result[0].srv_config2 = result[0].srv_config2.slice(0, -5);
        wg_cfg += `# Wireguard Server: ${result[0].srv_config1 ? result[0].srv_config1 : result[0].srv_config2}\n`;
        wg_cfg += `# Type: ${result[0].srv_config1 ? 'Server' : 'Client'}\n\n`;

        const sql = `SELECT *
                  FROM wireguard WG
                  LEFT JOIN firewall FW ON FW.id = WG.firewall
                  LEFT JOIN cluster CL ON CL.id=FW.cluster
                  WHERE WG.id=${wireGuard}`;
        dbCon.query(sql, async (error, result) => {
          if (error) return reject(error);
          if (!result || result.length === 0)
            return reject(new Error('WireGuard configuration not found'));
          const wgRow = result[0];

          wg_cfg += `[Interface]\n`;
          wg_cfg += `PrivateKey = ${await utilsModel.decrypt(wgRow.private_key)}\n`;

          const sqlOpts = `SELECT *
                        FROM wireguard_opt OPT
                        WHERE OPT.wireguard=${wireGuard}
                        AND OPT.name IN ('Address', 'ListenPort', 'DNS', 'MTU', 'Table', 'PreUp', 'PostUp', 'PreDown', 'PostDown', 'SaveConfig', 'FwMark')
                        ORDER BY OPT.order`;
          dbCon.query(sqlOpts, (optError, optResult) => {
            if (optError) return reject(optError);
            const interfaceLines = optResult.map((opt: WireGuardOption) => {
              const commentLines = opt.comment ? opt.comment.replace(/\n/g, '\n# ') : '';
              const formattedComment = commentLines ? `#${commentLines}\n` : '';
              return `${formattedComment}${opt.name} = ${opt.arg}`;
            });
            wg_cfg += interfaceLines.length ? interfaceLines.join('\n') + '\n\n' : '\n';

            const sqlCheckIsClient = `SELECT wireguard FROM wireguard WHERE id=${wireGuard}`;
            dbCon.query(sqlCheckIsClient, (error, result) => {
              if (error) return reject(error);
              if (result.length === 0)
                return reject(new Error('WireGuard configuration not found'));
              const isClient = result[0].wireguard !== null;
              const sqlPeers = isClient
                ? `SELECT PEER.*, OPT.name option_name, OPT.arg option_value, OPT.comment option_comment
                FROM wireguard_opt OPT
                INNER JOIN wireguard PEER ON PEER.id=OPT.wireguard
                WHERE OPT.wireguard=${wireGuard} AND OPT.name IN ('Address', 'AllowedIPs', 'Endpoint', 'PersistentKeepalive', '<<disable>>', 'PresharedKey') AND OPT.wireguard_cli IS NULL
                ORDER BY OPT.name`
                : `SELECT PEER.*, CRT.cn as peer_cn, OPT.name option_name, OPT.arg option_value, OPT.comment option_comment
                FROM wireguard PEER 
                INNER JOIN wireguard_opt OPT ON OPT.wireguard=PEER.id
                  LEFT JOIN crt CRT ON PEER.crt=CRT.id 
                WHERE PEER.wireguard=${wireGuard} AND OPT.name IN ('Address', 'PresharedKey', '<<disable>>', 'PersistentKeepalive')
                ORDER BY OPT.name`;

              dbCon.query(sqlPeers, async (peerError, peerResult) => {
                if (peerError) return reject(peerError);
                const peerGroups = peerResult.reduce((groups: any, peer: any) => {
                  if (!groups[peer.id]) {
                    groups[peer.id] = { ...peer, options: [] };
                  }
                  groups[peer.id].options.push({
                    option_name: peer.option_name,
                    option_value: peer.option_value,
                    option_comment: peer.option_comment,
                  });
                  return groups;
                }, {});

                for (const peerId in peerGroups) {
                  const peer = peerGroups[peerId];

                  if (!isClient) {
                    const sqlClientOpts = `SELECT * FROM wireguard_opt WHERE wireguard_cli=${peerId} AND wireguard = ${wireGuard}`;
                    const clientOptResult = await new Promise((resolve, reject) => {
                      dbCon.query(sqlClientOpts, (clientOptError, clientOptResult) => {
                        if (clientOptError) return reject(clientOptError);
                        resolve(clientOptResult);
                      });
                    });

                    (clientOptResult as any[]).forEach((opt) => {
                      peer.options.push({
                        option_name: opt.name,
                        option_value: opt.arg,
                        option_comment: opt.comment,
                      });
                    });
                  }

                  const disableOption = peer.options.find(
                    (option: any) => option.option_name === '<<disable>>',
                  );
                  const addressOption = peer.options.find(
                    (option: any) => option.option_name === 'Address',
                  )?.option_value;
                  const allowedIPsOption = peer.options.find(
                    (option: any) => option.option_name === 'AllowedIPs',
                  )?.option_value;

                  const formatOption = async (option: any, isDisabled: boolean) => {
                    const comment = option.option_comment
                      ? `# ${option.option_comment.replace(/\n/g, '\n# ')}\n`
                      : '';

                    // Allowed options for peer in server config file
                    const allowedOptionsServer = [
                      'AllowedIPs',
                      'PresharedKey',
                      'PersistentKeepalive',
                    ];

                    // Filter by client or server
                    if (!isClient) {
                      if (!allowedOptionsServer.includes(option.option_name)) {
                        return ''; // Don't include options that are not allowed
                      }
                    }

                    switch (option.option_name) {
                      case '<<disable>>':
                      case 'Address':
                        return '';
                      case 'AllowedIPs': {
                        if (isClient && !allowedIPsOption) return '';

                        let normalizedAddress: string | null = null;

                        if (!isClient && addressOption) {
                          const [ip] = addressOption.split('/');
                          normalizedAddress = `${ip}/32`;
                        }

                        // Build IPs list (duplicated values removed)
                        const allIPs = [
                          ...(normalizedAddress ? [normalizedAddress] : []),
                          ...(allowedIPsOption
                            ? allowedIPsOption.split(',').map((ip) => ip.trim())
                            : []),
                        ];

                        const uniqueIPs = Array.from(new Set(allIPs));

                        return `${comment}${isDisabled ? '# ' : ''}AllowedIPs = ${uniqueIPs.join(', ')}\n`;
                      }

                      default:
                        return `${comment}${isDisabled ? '# ' : ''}${option.option_name} = ${option.option_value}\n`;
                    }
                  };

                  const formatPeerSection = async (peer: any, isDisabled: boolean) => {
                    let section: string;
                    if (isClient) {
                      const serverIdSql = `SELECT * from ${tableName} where id = (SELECT wireguard FROM wireguard WHERE id=${wireGuard})`;
                      const serverResult = await new Promise((resolve, reject) => {
                        dbCon.query(serverIdSql, (error, result) => {
                          if (error) return reject(error);
                          resolve(result[0]);
                        });
                      });
                      section = isDisabled
                        ? `# CLIENT BLOCKED\n# [Peer]\n# PublicKey = ${await utilsModel.decrypt((serverResult as { public_key: string }).public_key)}\n`
                        : `[Peer]\nPublicKey = ${await utilsModel.decrypt((serverResult as { public_key: string }).public_key)}\n`;
                    } else {
                      section = isDisabled
                        ? `# CLIENT BLOCKED\n# [Peer]\n# ${peer.peer_cn}\n# PublicKey = ${await utilsModel.decrypt(peer.public_key)}\n`
                        : `[Peer]\n# ${peer.peer_cn}\nPublicKey = ${await utilsModel.decrypt(peer.public_key)}\n`;
                    }
                    for (const option of peer.options) {
                      section += await formatOption(option, isDisabled);
                    }
                    return section + '\n';
                  };

                  wg_cfg += await formatPeerSection(peer, !!disableOption);
                }
                resolve({ cfg: wg_cfg });
              });
            });
          });
        });
      });
    });
  }

  public static updateWireGuardStatus(dbCon: Query, wireGuard: number, status_action: string) {
    return new Promise((resolve, reject) => {
      dbCon.query(
        `UPDATE wireguard SET status=status${status_action} WHERE id=${wireGuard}`,
        (error) => {
          if (error) return reject(error);
          resolve({ result: true });
        },
      );
    });
  }

  public static updateWireGuardInstallDate(dbCon: Query, wireGuard: number) {
    return new Promise((resolve, reject) => {
      dbCon.query(`UPDATE wireguard SET installed_at=NOW() WHERE id=${wireGuard}`, (error) => {
        if (error) return reject(error);
        resolve({ result: true });
      });
    });
  }

  public static updateWireGuardStatusIPOBJ(
    req: Request,
    ipobj: number,
    status_action: string,
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const sql = `UPDATE wireguard VPN
                INNER JOIN wireguard_opt OPT ON OPT.wireguard=VPN.id
                INNER JOIN ipobj O ON O.id=OPT.ipobj
                SET VPN.status=VPN.status${status_action}
                WHERE O.fwcloud=${req.body.fwcloud} AND O.id=${ipobj}`;
      req.dbCon.query(sql, (error) => {
        if (error) return reject(error);
        resolve();
      });
    });
  }

  public static freeVpnIP(req: Request) {
    return new Promise((resolve, reject) => {
      // Search for the VPN LAN and mask.
      let sql = `select OBJ.address,OBJ.netmask from wireguard_opt OPT
                inner join ipobj OBJ on OBJ.id=OPT.ipobj
                where OPT.wireguard=${req.body.wireguard} and OPT.name='Address' and OPT.ipobj is not null`;
      req.dbCon.query(sql, (error, result) => {
        if (error) return reject(error);

        // If we have no VPN LAN we can not give any free IP.
        if (result.length === 0) return reject(fwcError.other('WireGuard LAN not found'));

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
                    where VPN.wireguard=${req.body.wireguard} and OPT.ipobj is not null and OBJ.type=5`; // 5=ADDRESS
        req.dbCon.query(sql, (error, result) => {
          if (error) return reject(error);

          let freeIPLong: number;
          let found: boolean;
          for (freeIPLong = firstLong; freeIPLong <= lastLong; freeIPLong++) {
            found = false;
            for (const ipCli of result) {
              if (freeIPLong === IpUtils.toLong(ipCli.address)) {
                found = true;
                break;
              }
            }
            if (!found)
              return resolve({ ip: IpUtils.fromLong(freeIPLong), netmask: ipobj.netmask });
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
            const data: any = IPObjGroup.searchGroupUsage(
              search.restrictions.WireGuardInGroup[i].group_id,
              fwcloud,
            );
            search.restrictions.WireGuardInGroupInRule.push(...data.restrictions.GroupInRule);
          }

          if (search.restrictions.LastWireGuardInPrefixInRule.length == 0) {
            // Include the rules that use prefixes in which the WireGuard is being used, including the
            // groups (used in rules) in which these prefixes are being used.
            const prefixes = await WireGuardPrefix.getWireGuardClientPrefixes(dbCon, wireGuard);
            search.restrictions.WireGuardInPrefixInRule = [];
            search.restrictions.WireGuardInPrefixInGroupInRule = [];
            if (Array.isArray(prefixes)) {
              for (let i = 0; i < prefixes.length; i++) {
                const data: any = await WireGuardPrefix.searchPrefixUsage(
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
              console.error('The method did not return an array');
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

  public static async searchWireGuardInRoute(fwcloud: number, wireguard: number): Promise<any> {
    return await db
      .getSource()
      .manager.getRepository(Route)
      .createQueryBuilder('route')
      .addSelect('firewall.id', 'firewall_id')
      .addSelect('firewall.name', 'firewall_name')
      .addSelect('cluster.id', 'cluster_id')
      .addSelect('cluster.name', 'cluster_name')
      .innerJoin('route.routeToWireGuards', 'routeToWireGuards')
      .innerJoin('routeToWireGuards.wireGuard', 'wireguard', 'wireguard.id = :wireguard', {
        wireguard: wireguard,
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
      .innerJoin('routingRuleToWireGuards.wireGuard', 'wireguard', 'wireguard.id = :wireguard', {
        wireguard: wireGuard,
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
      .innerJoin('ipObjGroup.wireGuards', 'wireguard', 'wireguard.id = :wireguard', {
        wireguard: wireGuard,
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
      .innerJoin('ipObjGroup.wireGuards', 'wireguard', 'wireguard.id = :wireguard', {
        wireguard: wireGuard,
      })
      .innerJoin('routing_rule.routingTable', 'table')
      .innerJoin('table.firewall', 'firewall')
      .leftJoin('firewall.cluster', 'cluster')
      .where(`firewall.fwCloudId = :fwcloud`, { fwcloud: fwcloud })
      .getRawMany();
  }

  public static searchWireGuardUsageOutOfThisFirewall(req: Request) {
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
            (item: any): boolean => item.firewall_id != req.body.firewall,
          );
          answer.restrictions.WireGuardInRoute = answer.restrictions.WireGuardInRoute.filter(
            (item: any): boolean => item.firewall_id != req.body.firewall,
          );
          answer.restrictions.WireGuardInRoutingRule =
            answer.restrictions.WireGuardInRoutingRule.filter(
              (item: any): boolean => item.firewall_id != req.body.firewall,
            );
        } catch (error) {
          reject(error);
        }

        resolve(answer);
      });
    });
  }

  public static searchWireGuardChild(
    dbCon: Query,
    fwcloud: number,
    wireGuard: number,
  ): Promise<{ result: boolean; restrictions?: any }> {
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

  public static searchIPObjInWireGuardOpt(dbCon: Query, ipobj: number, name: string) {
    return new Promise((resolve, reject) => {
      dbCon.query(
        `select wireguard from wireguard_opt where ipobj=${ipobj} and name=${dbCon.escape(name)}`,
        (error, result) => {
          if (error) return reject(error);
          resolve(result.length >= 1);
        },
      );
    });
  }

  // Get the ID of all WireGuard configurations who's status field is not zero.
  public static getWireGuardStatusNotZero(req: Request, data: any) {
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
        (error: any, result: any) => {
          if (error) return reject(error);
          resolve(result.insertId);
        },
      );
    });
  }

  public static removeFromGroup(req: Request) {
    return new Promise((resolve, reject) => {
      const sql = `DELETE FROM wireguard__ipobj_g WHERE ipobj_g=${req.body.ipobj_g} AND wireguard=${req.body.wireguard}`;
      req.dbCon.query(sql, (error, result) => {
        if (error) return reject(error);
        resolve(result.insertId);
      });
    });
  }

  private static async handleWireGuardInterface(
    req: Request,
    cfg: number | null,
    isUpdate: boolean,
  ): Promise<void> {
    try {
      const wireGuardOpt = await this.getOptData(req.dbCon, cfg ?? req.body.wireguard, 'Address');
      if (!wireGuardOpt) return;

      const interfaceName = req.body.install_name.replace(/\.conf$/, '');
      const [ip, cidr] = (wireGuardOpt as { arg: string }).arg.split('/');
      const interfaceIp = { ip, netmask: `/${cidr}` };

      const interfaces = await Interface.getInterfaces(
        req.dbCon,
        req.body.fwcloud,
        req.body.firewall,
      );

      const targetInterface = interfaces.find((_interface) => _interface.name === interfaceName);

      if (isUpdate) {
        if (!targetInterface) return;

        const fullInterfaces = await new Promise((resolve, reject) => {
          Interface.getInterfacesFull(req.body.firewall, req.body.fwcloud, (error, data) => {
            if (error) return reject(error);
            resolve(data);
          });
        });

        const ipobjs =
          (fullInterfaces as any[]).find((i: any) => i.name === interfaceName)?.ipobjs || [];
        const ipobj = ipobjs.find((i: any) => i.name === interfaceName);

        if (!ipobj) return;

        const ipobjData = {
          ...ipobj,
          address: interfaceIp.ip,
          netmask: interfaceIp.netmask,
        };

        await IPObj.updateIpobj(req.dbCon, ipobjData);
        await WireGuard.updateIpObjCfgOpt(
          req.dbCon,
          ipobj.id,
          cfg ?? req.body.wireguard,
          'Address',
        );
        await Tree.updateFwc_Tree_OBJ(req, {
          name: interfaceName,
          id: ipobj.id,
          type: 5,
          interface: targetInterface.id,
          address: interfaceIp.ip,
        });
      } else {
        if (targetInterface) {
          const fullInterfaces = await new Promise((resolve, reject) => {
            Interface.getInterfacesFull(req.body.firewall, req.body.fwcloud, (err, data) => {
              if (err) return reject(err);
              resolve(data);
            });
          });

          const ipobjs =
            (fullInterfaces as any[]).find((i: any) => i.name === interfaceName)?.ipobjs || [];
          const ipobj = ipobjs.find((i: any) => i.name === interfaceName);

          if (ipobj) {
            await WireGuard.updateIpObjCfgOpt(
              req.dbCon,
              ipobj.id,
              cfg ?? req.body.wireguard,
              'Address',
            );
          } else {
            const ipobjData = {
              id: null,
              fwcloud: req.body.fwcloud,
              interface: targetInterface.id,
              name: interfaceName,
              type: 5,
              protocol: null,
              address: interfaceIp.ip,
              netmask: interfaceIp.netmask,
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
            await WireGuard.updateIpObjCfgOpt(
              req.dbCon,
              ipobjId as number,
              cfg ?? req.body.wireguard,
              'Address',
            );
            const interfaceNode = (
              await Tree.getNodeInfo(req.dbCon, req.body.fwcloud, 'IFF', targetInterface.id)
            )[0];

            await Tree.newNode(
              req.dbCon,
              req.body.fwcloud,
              `${interfaceName} (${interfaceIp.ip})`,
              interfaceNode.id,
              'OIA',
              ipobjId,
              5,
            );
          }
          return;
        }

        const interfaceData = {
          id: null,
          firewall: req.body.firewall,
          name: interfaceName,
          labelName: '',
          type: 10,
          interface_type: 10,
          comment: '',
          mac: '',
        };

        const interfaceId = await Interface.insertInterface(req.dbCon, interfaceData);
        if (!interfaceId) return;

        const interfacesNode = await Tree.getNodeUnderFirewall(
          req.dbCon,
          req.body.fwcloud,
          req.body.firewall,
          'FDI',
        );
        if (!interfacesNode) return;

        const nodeId = await Tree.newNode(
          req.dbCon,
          req.body.fwcloud,
          interfaceName,
          (interfacesNode as { id: number }).id,
          'IFF',
          interfaceId,
          10,
        );

        const vpnNetworkOpt = await this.getOptData(req.dbCon, cfg, '<<vpn_network>>');
        if ((vpnNetworkOpt as { ipobj: number })?.ipobj) {
          const ipobj: any = await IPObj.getIpobjInfo(
            req.dbCon,
            req.body.fwcloud,
            (vpnNetworkOpt as { ipobj: number }).ipobj,
          );
          if (ipobj.type === 7 || ipobj.type === 5) {
            const ipobjData = {
              id: null,
              fwcloud: req.body.fwcloud,
              interface: interfaceId,
              name: interfaceName,
              type: 5,
              protocol: null,
              address: interfaceIp.ip,
              netmask: interfaceIp.netmask,
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
            await WireGuard.updateIpObjCfgOpt(
              req.dbCon,
              ipobjId as number,
              cfg ?? req.body.wireguard,
              'Address',
            );
            await Tree.newNode(
              req.dbCon,
              req.body.fwcloud,
              `${interfaceName} (${interfaceIp.ip})`,
              nodeId,
              'OIA',
              ipobjId,
              5,
            );
          }
        }
      }
    } catch (error) {
      console.error('Error in handleWireGuardInterface:', error);
      throw error;
    }
  }

  public static async createWireGuardServerInterface(req: Request, cfg: number): Promise<void> {
    await this.handleWireGuardInterface(req, cfg, false);
  }

  public static async updateWireGuardServerInterface(req: Request): Promise<void> {
    await this.handleWireGuardInterface(req, null, true);
  }

  //Move rules from one firewall to other.
  public static moveToOtherFirewall(
    dbCon: Query,
    src_firewall: number,
    dst_firewall: number,
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      dbCon.query(
        `UPDATE ${tableName} SET firewall=${dst_firewall} WHERE firewall=${src_firewall}`,
        (error) => {
          if (error) return reject(error);
          resolve();
        },
      );
    });
  }
  public static getConfigFilename(dbCon: Query, firewall: number) {
    return new Promise((resolve, reject) => {
      const sql = `select install_name from wireguard WHERE firewall = ?`;
      dbCon.query(sql, [firewall], (error, result) => {
        if (error) return reject(error);
        if (!result.length) return resolve('wg0.conf');

        const usedNumbers = result
          .map((row: WireGuard) => row.install_name)
          .filter((name: string) => /^wg\d+\.conf$/.test(name))
          .map((name: string) => parseInt(name.match(/\d+/)[0]))
          .sort((a: any, b: any) => a - b);

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

  public static getPeerOptions(
    dbCon: Query,
    wireGuard: number,
    wireguard_cli: number,
  ): Promise<{ publicKey: string; options: any[] }> {
    return new Promise((resolve, reject) => {
      // First, we get the client's publicKey.
      const sqlClient = `SELECT public_key FROM wireguard WHERE id = ? AND wireguard = ?`;

      dbCon.query(sqlClient, [wireguard_cli, wireGuard], async (error, clientResult) => {
        if (error) return reject(error);
        if (clientResult.length === 0) return resolve({ publicKey: '', options: [] });
        const publicKey = await utilsModel.decrypt(clientResult[0].public_key);

        const sql = `
          SELECT WO.*
          FROM wireguard_opt WO
          WHERE (
            WO.name = 'Address' AND WO.wireguard = ?
          ) OR (
            WO.wireguard = ? AND WO.wireguard_cli = ?
          )
        `;

        dbCon.query(sql, [wireguard_cli, wireGuard, wireguard_cli], (error, rows) => {
          if (error) return reject(error);
          resolve({ publicKey, options: rows || [] });
        });
      });
    });
  }
}
