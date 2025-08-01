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
import { PolicyRuleToIPSec } from '../../policy/PolicyRuleToIPSec';
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
import { IPSecOption } from './ipsec-option.model';
import { IPSecPrefix } from './IPSecPrefix';
import { RoutingRuleToIPSec } from '../../routing/routing-rule/routing-rule-to-ipsec.model';
import { RouteToIPSec } from '../../routing/route/route-to-ipsec.model';
import { Request } from 'express';
import Query from '../../../database/Query';
import fwcError from '../../../utils/error_table';
import fs from 'fs';
import { IPSEC_OPTIONS } from '../../../routes/vpn/ipsec/dto/store.dto';

const utilsModel = require('../../../utils/utils.js');
const sodium = require('libsodium-wrappers');

const tableName: string = 'ipsec';

@Entity(tableName)
export class IPSec extends Model {
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

  @Column({ name: 'ipsec' })
  parentId: number;

  @ManyToOne((type) => IPSec, (ipSec) => ipSec.childs)
  @JoinColumn({
    name: 'ipsec',
  })
  parent: IPSec;

  @OneToMany((type) => IPSec, (ipSec) => ipSec.parent)
  childs: Array<IPSec>;

  @Column({ name: 'firewall' })
  firewallId: number;

  @ManyToOne((type) => Firewall, (firewall) => firewall.ipSecs)
  @JoinColumn({
    name: 'firewall',
  })
  firewall: Firewall;

  @Column({ name: 'crt' })
  crtId: number;

  @ManyToOne((type) => Crt, (crt) => crt.ipSecs)
  @JoinColumn({
    name: 'crt',
  })
  crt: Crt;

  @OneToMany((type) => IPSecOption, (options) => options.ipSec)
  IPSecOptions: Array<IPSecOption>;

  @ManyToMany((type) => IPObjGroup, (ipObjGroup) => ipObjGroup.ipSecs)
  @JoinTable({
    name: 'ipsec__ipobj_g',
    joinColumn: {
      name: 'ipsec',
    },
    inverseJoinColumn: {
      name: 'ipobj_g',
    },
  })
  ipObjGroups: Array<IPObjGroup>;

  @OneToMany((type) => PolicyRuleToIPSec, (policyRuleToIPSec) => policyRuleToIPSec.ipSec)
  policyRuleToIPSecs: Array<PolicyRuleToIPSec>;

  @OneToMany((type) => IPSecPrefix, (model) => model.ipSec)
  ipSecPrefixes: Array<IPSecPrefix>;

  @OneToMany(() => RoutingRuleToIPSec, (model) => model.ipSec)
  routingRuleToIPSecs: RoutingRuleToIPSec[];

  @OneToMany(() => RouteToIPSec, (model) => model.ipSec)
  routeToIPSecs: RouteToIPSec[];

  public getTableName(): string {
    return tableName;
  }

  // Insert new IPSec configuration register in the database.
  public static addCfg(req: Request): Promise<number> {
    return new Promise(async (resolve, reject) => {
      try {
        const cfg = {
          firewall: req.body.firewall,
          crt: req.body.crt,
          install_dir: req.body.install_dir,
          install_name: req.body.install_name,
          comment: req.body.comment || null,
          status: req.body.ipsec !== undefined ? 0 : 1, // Remove "install" flag for clients
          ipsec: req.body.ipsec || null,
        };

        req.dbCon.query(
          `insert into ${tableName} (firewall, crt, install_dir, install_name, comment, status, ipsec) VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [
            cfg.firewall,
            cfg.crt,
            cfg.install_dir,
            cfg.install_name,
            cfg.comment,
            cfg.status,
            cfg.ipsec,
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
                WHERE id=${req.body.ipsec}`;
      req.dbCon.query(sql, (error, _) => {
        if (error) return reject(error);
        resolve();
      });
    });
  }

  public static addCfgOpt(req: Request, opt: any): Promise<void> {
    return new Promise((resolve, reject) => {
      // Try to update first. If no rows are affected, insert.
      const updateSql = `UPDATE ipsec_opt SET ? WHERE ipsec = ? AND ipsec_cli = ? AND name = ?`;
      req.dbCon.query(
        updateSql,
        [opt, opt.ipsec, opt.ipsec_cli, opt.name],
        (updateError, updateResult) => {
          if (updateError) return reject(updateError);
          if (updateResult.affectedRows > 0) {
            return resolve();
          }
          // If not updated, insert new
          req.dbCon.query('INSERT INTO ipsec_opt SET ?', opt, (insertError) => {
            if (insertError) return reject(insertError);
            resolve();
          });
        },
      );
    });
  }

  public static updateCfgOptByipobj(
    dbCon: Query,
    ipobj: number,
    name: string,
    arg: string,
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const sql = `UPDATE ipsec_opt SET arg=${dbCon.escape(arg)} WHERE ipobj=${ipobj} and name=${dbCon.escape(name)}`;
      dbCon.query(sql, (error, _) => {
        if (error) return reject(error);
        resolve();
      });
    });
  }

  public static updateIpObjCfgOpt(
    dbCon: Query,
    ipobj: number,
    ipSec: number,
    name: string,
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const sql = `UPDATE ipsec_opt SET ipobj=${ipobj} WHERE ipsec=${ipSec} and name=${dbCon.escape(name)}`;
      dbCon.query(sql, (error, _) => {
        if (error) return reject(error);
        resolve();
      });
    });
  }

  public static isIPSecServer(dbCon: Query, ipSec: number): Promise<boolean> {
    return new Promise((resolve, reject) => {
      const sql = `SELECT ipsec FROM ${tableName} WHERE id=${ipSec}`;
      dbCon.query(sql, (error, result) => {
        if (error) return reject(error);
        if (result.length === 0) return resolve(false);
        // If ipsec is null, it is a server.
        resolve(result[0].ipsec === null);
      });
    });
  }

  public static checkIpobjInIPSecOpt(dbCon: Query, ipobj: number): Promise<any> {
    return new Promise((resolve, reject) => {
      const sql = `SELECT * FROM ipsec_opt WHERE ipobj=${ipobj}`;
      dbCon.query(sql, (error, result) => {
        if (error) return reject(error);
        resolve(result);
      });
    });
  }

  public static addPrefix(ipsecId: number, prefix: { name: string }): Promise<void> {
    return new Promise((resolve, reject) => {
      const sql = `insert into ipsec_prefix SET ipsec=?, name=?`;
      db.getSource()
        .manager.query(sql, [ipsecId, prefix.name])
        .then((_) => resolve())
        .catch((error) => reject(error));
    });
  }

  public static delCfgOptAll(req: Request): Promise<void> {
    return new Promise((resolve, reject) => {
      const sql = 'delete from ipsec_opt where ipsec=' + req.body.ipsec;
      req.dbCon.query(sql, (error, _) => {
        if (error) return reject(error);
        resolve();
      });
    });
  }

  public static delCfgOptByScope(req: Request, scope: number): Promise<void> {
    return new Promise((resolve, reject) => {
      let sql: string;
      if (scope === 8) {
        sql = `delete from ipsec_opt where ipsec=${req.body.ipsec} and ipsec_cli=${req.body.ipsec_cli} and scope=${scope}`;
      } else {
        sql = `delete from ipsec_opt where ipsec=${req.body.ipsec} and scope=${scope}`;
      }
      req.dbCon.query(sql, (error, _) => {
        if (error) return reject(error);
        resolve();
      });
    });
  }

  public static delCfg(
    dbCon: Query,
    fwcloud: number,
    ipSec: number,
    isClient = false,
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      // Get all the ipobj referenced by this IPSec configuration.
      const sql = `select OBJ.id,OBJ.type from ipsec_opt OPT
                inner join ipobj OBJ on OBJ.id=OPT.ipobj
                where OPT.ipsec=${ipSec} and OPT.name!='right'`;
      dbCon.query(sql, (error, ipobj_list) => {
        if (error) return reject(error);

        if (isClient) {
          dbCon.query(`delete from ipsec_opt where ipsec_cli=${ipSec}`, (error, _) => {
            if (error) return reject(error);
            // Continue with the rest of the deletion process
          });
        }
        dbCon.query(`delete from ipsec_opt where ipsec=${ipSec}`, (error, _) => {
          if (error) return reject(error);
          dbCon.query(`delete from ipsec_prefix where ipsec=${ipSec}`, (error, _) => {
            if (error) return reject(error);

            dbCon.query(`delete from ${tableName} where id=${ipSec}`, async (error, _) => {
              if (error) return reject(error);

              // Remove all the ipobj referenced by this IPSec configuration.
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
      // Remove all the ipobj referenced by this IPSec configuration.
      // In the restrictions check we have already checked that it is possible to remove them.
      // IMPORTANT: Order by CRT type for remove clients before servers. If we don't do it this way,
      // and the IPSec server is removed first, we will get a database foreign key constraint fails error.
      const sql = `select VPN.id,CRT.type,VPN.ipsec from ${tableName} VPN
                inner join crt CRT on CRT.id=VPN.crt
                where VPN.firewall=${firewall} order by CRT.type asc`;
      dbCon.query(sql, async (error, result) => {
        if (error) return reject(error);
        try {
          // First delete client configurations, if exist
          const clientConfigs = result.filter((r) => r.type === 1 && r.ipsec !== null);
          for (const ipSec of clientConfigs) {
            await this.delCfg(dbCon, fwcloud, ipSec.id, true);
          }
          // Afterwards, delete server configurations
          const serverConfigs = result.filter((r) => r.type !== 1);
          for (const ipSec of serverConfigs) {
            await this.delCfg(dbCon, fwcloud, ipSec.id);
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
        resolve(result.length === 0 ? null : result[0].id);
      });
    });
  }

  public static getCfg(dbCon: Query, ipSec: number): Promise<any> {
    return new Promise((resolve, reject) => {
      let sql = `select * from ${tableName} where id=${ipSec}`;
      dbCon.query(sql, (error, ipsec_result) => {
        if (error) return reject(error);
        if (ipsec_result.length === 0) resolve([]);
        const data = ipsec_result[0];
        const type = data.ipsec === null ? 332 : 331; // 332 = Server, 331 = Client
        //IS CLIENT
        if (data.ipsec !== null) {
          sql = `select * from ${tableName} where id=${data.ipsec}`;
          dbCon.query(sql, async (error, result) => {
            if (error) return reject(error);
          });
        }

        sql = `select * from ipsec_opt where ipsec=${ipSec}`;
        dbCon.query(sql, async (error, result) => {
          if (error) return reject(error);

          data.options = result;
          try {
            const ipsec_data = data;

            ipsec_data.type = type;
            resolve(ipsec_data);
          } catch (error) {
            return reject(error);
          }
        });
      });
    });
  }

  public static getOptData(
    dbCon: Query,
    ipSec: number,
    name?: string,
    ipsec_cli?: number,
  ): Promise<any> {
    return new Promise((resolve, reject) => {
      let sql = `select * from ipsec_opt where ipsec=${ipSec}`;
      if (ipsec_cli) {
        sql += ` and ipsec_cli=${ipsec_cli}`;
      }
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

  // Get data of an IPSec server clients.
  public static getIPSecClientsInfo(dbCon: Query, ipSec: number): Promise<any[]> {
    return new Promise((resolve, reject) => {
      let sql = `SELECT VPN.*, CRT.cn, VPN.status 
                   FROM ipsec VPN 
                   INNER JOIN crt CRT ON CRT.id = VPN.crt
                   WHERE VPN.ipsec = ?`;

      dbCon.query(sql, [ipSec], async (error: any, result: IPSec[]) => {
        if (error) return reject(error);
        if (result.length === 0) return resolve([]); // If there are no VPNs, return an empty array

        const vpnIds = result.map((vpn) => vpn.id);
        if (vpnIds.length === 0) return resolve(result);

        // Second query: Get all the ipsec_opt of these VPNs
        sql = `SELECT * FROM ipsec_opt WHERE ipsec IN (${vpnIds.join(',')})`;

        dbCon.query(sql, (error, optionResults) => {
          if (error) return reject(error);

          // Get the IP object IDs of the options
          const ipObjIds = optionResults
            .map((opt: any) => opt.ipobj)
            .filter((id: number) => id !== null);
          // If there is no ipobj, return the result without making another query
          if (ipObjIds.length === 0) {
            const optionsMap = optionResults.reduce((acc: any, option: any) => {
              if (!acc[option.ipsec]) acc[option.ipsec] = [];
              option.ipobj = null;
              acc[option.ipsec].push(option);
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
              if (!acc[option.ipsec]) acc[option.ipsec] = [];
              option.ipobj = ipObjMap[option.ipobj] || null;
              acc[option.ipsec].push(option);
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

  // Get the CN of the IPSec server certificate and the IDs of the IPSec clients
  public static getIPSecClients(dbCon: Query, ipSec: number): Promise<any[]> {
    return new Promise((resolve, reject) => {
      // First, get all IPSec clients linked to the given server
      const sqlClient = `
        SELECT 
          IPS.id, 
          CRT.cn
        FROM ipsec IPS
        INNER JOIN crt CRT ON CRT.id = IPS.crt
        WHERE IPS.ipsec = ?
        ORDER BY CRT.cn
      `;

      dbCon.query(sqlClient, [ipSec], async (error: any, clients: any[]) => {
        if (error) return reject(error);
        if (clients.length === 0) return resolve([]);

        try {
          const enrichedClients = await Promise.all(
            clients.map(async (vpn) => {
              // Get the client's IP address (if any)
              const rightSourceIpRes: any = await new Promise((res, rej) => {
                dbCon.query(
                  `SELECT *
                 FROM ipsec_opt OPT 
                 WHERE OPT.ipsec = ? AND OPT.name = 'leftsourceip'`,
                  [vpn.id],
                  (err, rows) => (err ? rej(err) : res(rows)),
                );
              });
              const rightsourceip = rightSourceIpRes.length > 0 ? rightSourceIpRes[0].arg : null;
              // Get the Rightsubnet defined for this client from the server's configuration
              const rightsubnetRes: any = await new Promise((res, rej) => {
                dbCon.query(
                  `SELECT * 
                 FROM ipsec_opt 
                 WHERE ipsec = ? AND ipsec_cli = ? AND name = 'rightsubnet'`,
                  [ipSec, vpn.id],
                  (err, rows) => (err ? rej(err) : res(rows)),
                );
              });
              const rightsubnet = rightsubnetRes.length > 0 ? rightsubnetRes[0].arg : null;

              return {
                ...vpn,
                rightsubnet,
                rightsourceip,
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

  // Get data of IPSec servers of a firewall.
  public static getIPSecServersByFirewall(dbCon: Query, firewall: number) {
    return new Promise((resolve, reject) => {
      const sql = `select VPN.id,CRT.cn from ipsec VPN 
                inner join crt CRT on CRT.id=VPN.crt
                where VPN.firewall=${firewall} and CRT.type=2`;
      dbCon.query(sql, (error, result) => {
        if (error) return reject(error);
        resolve(result);
      });
    });
  }

  // Get IPSec client configuration data.
  public static getIPSecInfo(dbCon: Query, fwcloud: number, ipSec: number, type: number) {
    return new Promise((resolve, reject) => {
      const optName = type === 332 ? 'left' : 'leftsourceip';
      const sql = `select IPS.*, FW.fwcloud, FW.id firewall_id, FW.name firewall_name, CRT.cn, CA.cn as CA_cn,
            IF(${type} = 332,
              (select ipobj.address from ipsec_opt
               inner join ipobj on ipobj.id = ipsec_opt.ipobj
               where ipsec_opt.ipsec = IPS.id and ipsec_opt.name = 'leftsubnet' limit 1),
              O.address
            ) as address,
            FW.cluster cluster_id,
            IF(FW.cluster is null,null,(select name from cluster where id=FW.cluster)) as cluster_name,
            IF(IPS.ipsec is null,IPS.ipsec,(select crt.cn from ipsec inner join crt on crt.id=ipsec.crt where ipsec.id=IPS.ipsec)) as ipsec_server_cn
            ${type === 332 ? `,O.netmask` : ``}
            from ipsec IPS
            inner join crt CRT on CRT.id=IPS.crt
            inner join ca CA on CA.id=CRT.ca
            inner join firewall FW on FW.id=IPS.firewall
            inner join ipsec_opt OPT on OPT.ipsec=${ipSec} and OPT.name='${optName}'
            inner join ipobj O on O.id=OPT.ipobj
            where FW.fwcloud=${fwcloud} and IPS.id=${ipSec}`;

      dbCon.query(sql, (error, result) => {
        if (error) return reject(error);

        for (let i = 0; i < result.length; i++) {
          result[i].type = type === 1 ? 331 : 332;
        }
        resolve(result);
      });
    });
  }

  public static getIPSecServersByCloud(dbCon: Query, fwcloud: number) {
    return new Promise((resolve, reject) => {
      const sql = `select VPN.id,CRT.cn from ipsec VPN 
                inner join crt CRT on CRT.id=VPN.crt
                inner join ca CA on CA.id=CRT.ca
                where CA.fwcloud=${fwcloud} and CRT.type=2`; // 2 = Server certificate.
      dbCon.query(sql, (error, result) => {
        if (error) return reject(error);
        resolve(result);
      });
    });
  }

  public static async dumpCfg(dbCon: Query, ipSec: number) {
    return new Promise(async (resolve, reject) => {
      try {
        // Get certificate and firewall info
        const sqlCN = `
          SELECT CRT.cn, CRT.ca, CRT.type, FW.name as fw_name, CL.name as cl_name,
                 VPN.install_name as srv_config1, VPNSRV.install_name as srv_config2
          FROM crt CRT
          INNER JOIN ipsec VPN ON VPN.crt=CRT.id
          LEFT JOIN ipsec VPNSRV ON VPNSRV.id=VPN.ipsec
          INNER JOIN firewall FW ON FW.id=VPN.firewall
          LEFT JOIN cluster CL ON CL.id=FW.cluster
          WHERE VPN.id=?
        `;
        const [certInfo] = await new Promise<any[]>((res, rej) =>
          dbCon.query(sqlCN, [ipSec], (err, rows) => (err ? rej(err) : res(rows))),
        );
        if (!certInfo) return reject(fwcError.other('Certificate info not found'));

        // Header
        let ips_cfg = '# FWCloud.net - Developed by SOLTECSIS (https://soltecsis.com)\n';
        ips_cfg += `# Generated: ${Date()}\n`;
        ips_cfg += `# Certificate Common Name: ${certInfo.cn} \n`;
        ips_cfg += certInfo.cl_name
          ? `# Firewall Cluster: ${certInfo.cl_name}\n`
          : `# Firewall: ${certInfo.fw_name}\n`;
        if (certInfo.srv_config1 && certInfo.srv_config1.endsWith('.conf'))
          certInfo.srv_config1 = certInfo.srv_config1.slice(0, -5);
        if (certInfo.srv_config2 && certInfo.srv_config2.endsWith('.conf'))
          certInfo.srv_config2 = certInfo.srv_config2.slice(0, -5);
        ips_cfg += `# IPSec Server: ${certInfo.srv_config1 ? certInfo.srv_config1 : certInfo.srv_config2}\n`;
        ips_cfg += `# Type: ${certInfo.srv_config1 ? 'Server' : 'Client'}\n\n`;
        ips_cfg += `config setup\n`;

        // Get IPSec config
        const sql = `
          SELECT *
          FROM ipsec IPS
          LEFT JOIN firewall FW ON FW.id = IPS.firewall
          LEFT JOIN cluster CL ON CL.id=FW.cluster
          WHERE IPS.id=?
        `;
        const [ipsecResult] = await new Promise<any[]>((res, rej) =>
          dbCon.query(sql, [ipSec], (err, rows) => (err ? rej(err) : res(rows))),
        );
        if (!ipsecResult) return reject(fwcError.other('IPSec configuration not found'));

        // Get options
        const optionsList = IPSEC_OPTIONS.map((opt) => `'${opt}'`).join(',');
        const sqlOpts = `
          SELECT *
          FROM ipsec_opt OPT
          WHERE OPT.ipsec = ?
            AND OPT.ipsec_cli IS NULL
            AND OPT.name IN (${optionsList})
            AND OPT.name != '<<disable>>'
          ORDER BY OPT.order
        `;
        const optResult: IPSecOption[] = await new Promise((res, rej) =>
          dbCon.query(sqlOpts, [ipSec], (err, rows) => (err ? rej(err) : res(rows))),
        );

        // charondebug
        const charondebugOpt = optResult.find((opt) => opt.name === 'charondebug');
        if (charondebugOpt) {
          if (certInfo.srv_config1) {
            ips_cfg += ` charondebug="${charondebugOpt.arg}"\n\nconn %default\n`;
          } else {
            ips_cfg += ` charondebug="${charondebugOpt.arg}"\n\nconn ${certInfo.cn}\n`;
          }
        }

        // Other options
        const filteredOpts = optResult.filter((opt) => opt.name !== 'charondebug');
        const interfaceLines = filteredOpts.map((opt) => {
          const commentLines = opt.comment ? opt.comment.replace(/\n/g, '\n# ') : '';
          const formattedComment = commentLines ? `#${commentLines}\n` : '';
          return ` ${formattedComment}${opt.name} = ${opt.arg}`;
        });
        ips_cfg += interfaceLines.length ? interfaceLines.join('\n') + '\n\n' : '\n';

        // Check if client
        const sqlCheckIsClient = `SELECT ipsec FROM ipsec WHERE id=?`;
        const [checkResult] = await new Promise<any[]>((res, rej) =>
          dbCon.query(sqlCheckIsClient, [ipSec], (err, rows) => (err ? rej(err) : res(rows))),
        );
        if (!checkResult) return reject(new Error('IPSec configuration not found'));
        const isClient = checkResult.ipsec !== null;

        // Get peers
        let sqlPeers: string;
        if (isClient) {
          sqlPeers = `
            SELECT PEER.*, OPT.name option_name, OPT.arg option_value, OPT.comment option_comment
            FROM ipsec_opt OPT
            INNER JOIN ipsec PEER ON PEER.id=OPT.ipsec
            WHERE OPT.ipsec=? 
              AND OPT.name IN ('<<disable>>') 
              AND OPT.ipsec_cli IS NULL
            ORDER BY OPT.name
          `;
        } else {
          sqlPeers = `
            SELECT PEER.*, OPT.name option_name, OPT.arg option_value, OPT.comment option_comment
            FROM ipsec PEER 
            INNER JOIN ipsec_opt OPT ON OPT.ipsec=PEER.id 
            LEFT JOIN crt CRT ON PEER.crt=CRT.id
            WHERE PEER.ipsec=? 
              AND OPT.name IN ('rightsubnet', 'also', 'auto', '<<disable>>')
            ORDER BY OPT.name
          `;
        }
        const peerResult: any[] = await new Promise((res, rej) =>
          dbCon.query(sqlPeers, [ipSec], (err, rows) => (err ? rej(err) : res(rows))),
        );

        // Group peers by id
        const peerGroups = peerResult.reduce((groups: any, peer: any) => {
          if (!groups[peer.id]) groups[peer.id] = { ...peer, options: [] };
          groups[peer.id].options.push({
            option_name: peer.option_name,
            option_value: peer.option_value,
            option_comment: peer.option_comment,
            option_isClient: peer.ipsec_cli !== null,
          });
          return groups;
        }, {});

        // Helper to format options
        const formatOption = async (option: any, isDisabled: boolean) => {
          const comment = option.option_comment
            ? `# ${option.option_comment.replace(/\n/g, '\n# ')}\n`
            : '';
          const allowedOptionsServer = [
            'rightid',
            'rightcert',
            'rightsubnet',
            'rightsourceip',
            'also',
            'auto',
          ];
          if (!isClient) {
            if (!allowedOptionsServer.includes(option.option_name) || option.option_isClient) {
              return '';
            }
          }
          switch (option.option_name) {
            case '<<disable>>':
              return '';
            case 'rightsubnet': {
              const value = option.option_value || '';
              const ipsRaw = value
                .split(',')
                .map((ip: string) => ip.trim())
                .filter(Boolean);
              const normalizedIps = ipsRaw.map((ip: string) => {
                const ipOnly = ip.split('/')[0];
                return `${ipOnly}/32`;
              });
              if (!normalizedIps.length) return '';
              return ` ${comment}${isDisabled ? '# ' : ''}rightsubnet = ${normalizedIps.join(', ')}\n`;
            }
            default:
              return ` ${comment}${isDisabled ? '# ' : ''}${option.option_name} = ${option.option_value}\n`;
          }
        };

        // Helper to format peer section
        const formatPeerSection = async (peer: any, isDisabled: boolean) => {
          let section = '';
          if (!isClient) {
            const rightcert = peer.options.find(
              (opt: any) => opt.option_name === 'rightcert',
            )?.option_value;
            if (rightcert) section += `conn ${rightcert.split('.')[0]}\n`;
          }
          for (const option of peer.options) {
            section += await formatOption(option, isDisabled);
          }
          return section + '\n';
        };

        // Process each peer
        for (const peerId in peerGroups) {
          const peer = peerGroups[peerId];
          if (!isClient) {
            // Get client options and rightsourceip for server
            const sqlClientOpts = `
              SELECT * FROM ipsec_opt 
              WHERE 
                (ipsec_cli = ? AND ipsec = ?)
                OR 
                (ipsec = ? AND name IN ('leftid', 'leftcert'))
            `;
            const clientOptResult: any[] = await new Promise((res, rej) =>
              dbCon.query(sqlClientOpts, [peerId, ipSec, peerId], (err, rows) =>
                err ? rej(err) : res(rows),
              ),
            );
            const rightsourceip = await IPSec.getInterfaceIp(dbCon, Number(peerId));
            peer.options.push({
              option_name: 'rightsourceip',
              option_value: rightsourceip.split('/')[0], // Get only the IP part
              option_comment: '',
            });
            clientOptResult.forEach((opt) => {
              let optionName = opt.name;
              if (optionName === 'leftid') optionName = 'rightid';
              if (optionName === 'leftcert') optionName = 'rightcert';
              peer.options.push({
                option_name: optionName,
                option_value: opt.arg,
                option_comment: opt.comment,
              });
            });
          }
          const disableOption = peer.options.find(
            (option: any) => option.option_name === '<<disable>>',
          );
          ips_cfg += await formatPeerSection(peer, !!disableOption);
        }
        resolve({ cfg: ips_cfg });
      } catch (error) {
        reject(error);
      }
    });
  }

  public static updateIPSecStatus(dbCon: Query, ipSec: number, status_action: string) {
    return new Promise((resolve, reject) => {
      dbCon.query(`UPDATE ipsec SET status=status${status_action} WHERE id=${ipSec}`, (error) => {
        if (error) return reject(error);
        resolve({ result: true });
      });
    });
  }

  public static updateIPSecInstallDate(dbCon: Query, ipSec: number) {
    return new Promise((resolve, reject) => {
      dbCon.query(`UPDATE ipsec SET installed_at=NOW() WHERE id=${ipSec}`, (error) => {
        if (error) return reject(error);
        resolve({ result: true });
      });
    });
  }

  public static updateIPSecStatusIPOBJ(
    req: Request,
    ipobj: number,
    status_action: string,
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const sql = `UPDATE ipsec VPN
                INNER JOIN ipsec_opt OPT ON OPT.ipsec=VPN.id
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
      let sql = `select OBJ.address,OBJ.netmask from ipsec_opt OPT
                inner join ipobj OBJ on OBJ.id=OPT.ipobj
                where OPT.ipsec=${req.body.ipsec} and OPT.name='left' and OPT.ipobj is not null`;
      req.dbCon.query(sql, (error, result) => {
        if (error) return reject(error);

        // If we have no VPN LAN we can not give any free IP.
        if (result.length === 0) return reject(fwcError.other('IPSec LAN not found'));

        // net will contain information about the VPN network.
        const ipobj = result[0];
        const netmask =
          ipobj.netmask[0] === '/'
            ? IpUtils.cidrSubnet(`${ipobj.address}${ipobj.netmask}`).subnetMask
            : ipobj.netmask;
        const net = IpUtils.subnet(ipobj.address, netmask);
        const firstLong = IpUtils.toLong(net.firstAddress) + 1; // The first usable IP is for the IPSec server.
        const lastLong = IpUtils.toLong(net.lastAddress);

        // Obtain the VPN LAN used IPs.
        sql = `select OBJ.address from ipsec VPN
                    inner join ipsec_opt OPT on OPT.ipsec=VPN.id
                    inner join ipobj OBJ on OBJ.id=OPT.ipobj
                    where VPN.ipsec=${req.body.ipsec} and OPT.ipobj is not null and OBJ.type=5`; // 5=ADDRESS
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

  public static searchIPSecUsage(
    dbCon: any,
    fwcloud: number,
    ipSec: number,
    extendedSearch?: boolean,
  ): Promise<any> {
    return new Promise(async (resolve, reject) => {
      try {
        const search: any = {};
        search.result = false;
        search.restrictions = {};

        /* Verify that the IPSec configuration is not used in any
                    - Rule (table policy_r__IPSec)
                    - IPBOJ group.
                    - IPSec is the last in a CRT prefix used in a rule or group.
                */
        search.restrictions.IPSecInRule = await PolicyRuleToIPSec.searchIPSecInRule(
          dbCon,
          fwcloud,
          ipSec,
        );
        search.restrictions.IPSecInGroup = await PolicyRuleToIPSec.searchIPSecInGroup(
          dbCon,
          fwcloud,
          ipSec,
        );
        search.restrictions.LastIPSecInPrefixInRule =
          await PolicyRuleToIPSec.searchLastIPSecInPrefixInRule(dbCon, fwcloud, ipSec);
        search.restrictions.LastIPSecInPrefixInGroup =
          await PolicyRuleToIPSec.searchLastIPSecInPrefixInGroup(dbCon, fwcloud, ipSec);

        search.restrictions.IPSecInRoute = await this.searchIPSecInRoute(fwcloud, ipSec);
        search.restrictions.IPSecInGroupInRoute = await this.searchIPSecInGroupInRoute(
          fwcloud,
          ipSec,
        );
        search.restrictions.IPSecInRoutingRule = await this.searchIPSecInRoutingRule(
          fwcloud,
          ipSec,
        );
        search.restrictions.IPSecInGroupInRoutingRule = await this.searchIPSecInGroupInRoutingRule(
          fwcloud,
          ipSec,
        );

        if (extendedSearch) {
          // Include the rules that use the groups in which the IPSec is being used.
          search.restrictions.IPSecInGroupInRule = [];
          for (let i = 0; i < search.restrictions.IPSecInGroup.length; i++) {
            const data: any = await IPObjGroup.searchGroupUsage(
              search.restrictions.IPSecInGroup[i].group_id,
              fwcloud,
            );
            search.restrictions.IPSecInGroupInRule.push(...data.restrictions.GroupInRule);
          }

          if (search.restrictions.LastIPSecInPrefixInRule.length == 0) {
            // Include the rules that use prefixes in which the IPSec is being used, including the
            // groups (used in rules) in which these prefixes are being used.
            const prefixes = await IPSecPrefix.getIPSecClientPrefixes(dbCon, ipSec);
            search.restrictions.IPSecInPrefixInRule = [];
            search.restrictions.IPSecInPrefixInGroupInRule = [];
            if (Array.isArray(prefixes)) {
              for (let i = 0; i < prefixes.length; i++) {
                const data: any = await IPSecPrefix.searchPrefixUsage(
                  dbCon,
                  fwcloud,
                  prefixes[i].id,
                  true,
                );
                search.restrictions.IPSecInPrefixInRule.push(...data.restrictions.PrefixInRule);
                search.restrictions.IPSecInPrefixInGroupInRule.push(
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

  public static async searchIPSecInRoute(fwcloud: number, ipsec: number): Promise<any> {
    return await db
      .getSource()
      .manager.getRepository(Route)
      .createQueryBuilder('route')
      .addSelect('firewall.id', 'firewall_id')
      .addSelect('firewall.name', 'firewall_name')
      .addSelect('cluster.id', 'cluster_id')
      .addSelect('cluster.name', 'cluster_name')
      .innerJoin('route.routeToIPSecs', 'routeToIPSecs')
      .innerJoin('routeToIPSecs.ipSec', 'ipsec', 'ipsec.id = :ipsec', {
        ipsec: ipsec,
      })
      .innerJoinAndSelect('route.routingTable', 'table')
      .innerJoin('table.firewall', 'firewall')
      .leftJoin('firewall.cluster', 'cluster')
      .where(`firewall.fwCloudId = :fwcloud`, { fwcloud: fwcloud })
      .getRawMany();
  }

  public static async searchIPSecInRoutingRule(fwcloud: number, ipSec: number): Promise<any> {
    return await db
      .getSource()
      .manager.getRepository(RoutingRule)
      .createQueryBuilder('routing_rule')
      .addSelect('firewall.id', 'firewall_id')
      .addSelect('firewall.name', 'firewall_name')
      .addSelect('cluster.id', 'cluster_id')
      .addSelect('cluster.name', 'cluster_name')
      .innerJoin('routing_rule.routingRuleToIPSecs', 'routingRuleToIPSecs')
      .innerJoin('routingRuleToIPSecs.ipSec', 'ipsec', 'ipsec.id = :ipsec', {
        ipsec: ipSec,
      })
      .innerJoinAndSelect('routing_rule.routingTable', 'table')
      .innerJoin('table.firewall', 'firewall')
      .leftJoin('firewall.cluster', 'cluster')
      .where(`firewall.fwCloudId = :fwcloud`, { fwcloud: fwcloud })
      .getRawMany();
  }

  public static async searchIPSecInGroupInRoute(fwcloud: number, ipSec: number): Promise<any> {
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
      .innerJoin('ipObjGroup.ipSecs', 'ipsec', 'ipsec.id = :ipsec', {
        ipsec: ipSec,
      })
      .innerJoin('table.firewall', 'firewall')
      .leftJoin('firewall.cluster', 'cluster')
      .where(`firewall.fwCloudId = :fwcloud`, { fwcloud: fwcloud })
      .getRawMany();
  }

  public static async searchIPSecInGroupInRoutingRule(
    fwcloud: number,
    ipSec: number,
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
      .innerJoin('ipObjGroup.ipSecs', 'ipsec', 'ipsec.id = :ipsec', {
        ipsec: ipSec,
      })
      .innerJoin('routing_rule.routingTable', 'table')
      .innerJoin('table.firewall', 'firewall')
      .leftJoin('firewall.cluster', 'cluster')
      .where(`firewall.fwCloudId = :fwcloud`, { fwcloud: fwcloud })
      .getRawMany();
  }

  public static searchIPSecUsageOutOfThisFirewall(req: Request) {
    return new Promise((resolve, reject) => {
      // First get all firewalls IPSec configurations.
      const sql = 'select id from ipsec where firewall=' + req.body.firewall;

      req.dbCon.query(sql, async (error, result) => {
        if (error) return reject(error);

        const answer: any = {};
        answer.restrictions = {};
        answer.restrictions.IPSecInRule = [];
        answer.restrictions.IPSecInRoute = [];
        answer.restrictions.IPSecInRoutingRule = [];
        answer.restrictions.IPSecInGroup = [];

        try {
          for (const IPSec of result) {
            const data: any = await this.searchIPSecUsage(req.dbCon, req.body.fwcloud, IPSec.id);
            if (data.result) {
              answer.restrictions.IPSecInRule = answer.restrictions.IPSecInRule.concat(
                data.restrictions.IPSecInRule,
              );
              answer.restrictions.IPSecInRoute = answer.restrictions.IPSecInRoute.concat(
                data.restrictions.IPSecInRoute,
              );
              answer.restrictions.IPSecInRoutingRule =
                answer.restrictions.IPSecInRoutingRule.concat(data.restrictions.IPSecInRoutingRule);
              answer.restrictions.IPSecInGroup = answer.restrictions.IPSecInGroup.concat(
                data.restrictions.IPSecInGroup,
              );
            }
          }

          // Remove items of this firewall.
          answer.restrictions.IPSecInRule = answer.restrictions.IPSecInRule.filter(
            (item: any): boolean => item.firewall_id != req.body.firewall,
          );
          answer.restrictions.IPSecInRoute = answer.restrictions.IPSecInRoute.filter(
            (item: any): boolean => item.firewall_id != req.body.firewall,
          );
          answer.restrictions.IPSecInRoutingRule = answer.restrictions.IPSecInRoutingRule.filter(
            (item: any): boolean => item.firewall_id != req.body.firewall,
          );
        } catch (error) {
          reject(error);
        }

        resolve(answer);
      });
    });
  }

  public static searchIPSecChild(
    dbCon: Query,
    fwcloud: number,
    ipSec: number,
  ): Promise<{ result: boolean; restrictions?: any }> {
    return new Promise((resolve, reject) => {
      const sql = `SELECT VPN.id FROM ipsec VPN
                INNER JOIN firewall FW ON FW.id=VPN.firewall
                WHERE FW.fwcloud=${fwcloud} AND VPN.ipsec=${ipSec}`;
      dbCon.query(sql, async (error, result) => {
        if (error) return reject(error);

        if (result.length > 0) resolve({ result: true, restrictions: { IPSecHasChild: true } });
        else resolve({ result: false });
      });
    });
  }

  public static searchIPObjInIPSecOpt(dbCon: Query, ipobj: number, name: string) {
    return new Promise((resolve, reject) => {
      dbCon.query(
        `select ipsec from ipsec_opt where ipobj=${ipobj} and name=${dbCon.escape(name)}`,
        (error, result) => {
          if (error) return reject(error);
          resolve(result.length >= 1);
        },
      );
    });
  }

  // Get the ID of all IPSec configurations who's status field is not zero.
  public static getIPSecStatusNotZero(req: Request, data: any) {
    return new Promise((resolve, reject) => {
      const sql = `SELECT VPN.id,VPN.status FROM ipsec VPN
                INNER JOIN firewall FW on FW.id=VPN.firewall
                WHERE VPN.status!=0 AND FW.fwcloud=${req.body.fwcloud}`;
      req.dbCon.query(sql, (error, rows) => {
        if (error) return reject(error);
        data.ipsec_status = rows;
        resolve(data);
      });
    });
  }

  public static addToGroup(dbCon: any, ipSec: number, ipobj_g: number) {
    return new Promise((resolve, reject) => {
      dbCon.query(
        `INSERT INTO ipsec__ipobj_g values(${ipSec},${ipobj_g})`,
        (error: any, result: any) => {
          if (error) return reject(error);
          resolve(result.insertId);
        },
      );
    });
  }

  public static removeFromGroup(req: Request) {
    return new Promise((resolve, reject) => {
      const sql = `DELETE FROM ipsec__ipobj_g WHERE ipobj_g=${req.body.ipobj_g} AND ipsec=${req.body.ipobj}`;
      req.dbCon.query(sql, (error, result) => {
        if (error) return reject(error);
        resolve(result.insertId);
      });
    });
  }

  private static async handleIPSecInterface(
    req: Request,
    cfg: number | null,
    isUpdate: boolean,
  ): Promise<void> {
    try {
      const ipSecOpt = await this.getOptData(req.dbCon, cfg ?? req.body.ipsec, 'left');
      if (!ipSecOpt) return;

      const interfaceName = req.body.install_name.replace(/\.conf$/, '');
      const getInterfaceIp = await IPSec.getInterfaceIp(req.dbCon, cfg ?? req.body.ipsec);
      let ip = '';
      let netmask = '';
      if (getInterfaceIp) {
        const match = getInterfaceIp.match(/^(.+?)(\/\d+)$/);
        if (match) {
          ip = match[1];
          netmask = match[2];
        }
      }
      const interfaceIp = { ip, netmask };

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
        await IPSec.updateIpObjCfgOpt(req.dbCon, ipobj.id, cfg ?? req.body.ipsec, 'left');
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
            await IPSec.updateIpObjCfgOpt(req.dbCon, ipobj.id, cfg ?? req.body.ipsec, 'left');
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
            await IPSec.updateIpObjCfgOpt(
              req.dbCon,
              ipobjId as number,
              cfg ?? req.body.ipsec,
              'left',
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

        const vpnNetworkOpt = await this.getOptData(req.dbCon, cfg, 'leftsubnet');
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
            await IPSec.updateIpObjCfgOpt(
              req.dbCon,
              ipobjId as number,
              cfg ?? req.body.ipsec,
              'left',
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
      console.error('Error in handleIPSecInterface:', error);
      throw error;
    }
  }

  public static async createIPSecServerInterface(req: Request, cfg: number): Promise<void> {
    await this.handleIPSecInterface(req, cfg, false);
  }

  public static async updateIPSecServerInterface(req: Request): Promise<void> {
    await this.handleIPSecInterface(req, null, true);
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
      const sql = `select install_name from ipsec WHERE firewall = ?`;
      dbCon.query(sql, [firewall], (error, result) => {
        if (error) return reject(error);
        if (!result.length) return resolve('ips0.conf');

        const usedNumbers = result
          .map((row: IPSec) => row.install_name)
          .filter((name: string) => /^ips\d+\.conf$/.test(name))
          .map((name: string) => parseInt(name.match(/\d+/)[0]))
          .sort((a: any, b: any) => a - b);

        let nextNumber = 0;
        for (const number of usedNumbers) {
          if (number !== nextNumber) break;
          nextNumber++;
        }

        const newFilename = `ips${nextNumber}.conf`;
        resolve(newFilename);
      });
    });
  }

  public static async getInterfaceIp(dbCon: Query, ipsec_cli: number): Promise<string | null> {
    return new Promise((resolve, reject) => {
      dbCon.query(
        `SELECT IP.address, IP.netmask
       FROM ipobj IP
       INNER JOIN ipsec_opt OPT ON IP.id = OPT.ipobj
       WHERE OPT.ipsec = ?`,
        [ipsec_cli],
        (err, rows) => {
          if (err) return reject(err);
          if (rows.length > 0) {
            resolve(`${rows[0].address}${rows[0].netmask}`);
          } else {
            resolve(null);
          }
        },
      );
    });
  }

  public static getPeerOptions(
    dbCon: Query,
    ipSec: number,
    ipsec_cli: number,
  ): Promise<{ options: any[] }> {
    return new Promise(async (resolve, reject) => {
      try {
        const [getPeerOptions, getClientOptions, rightSourceIpValue] = await Promise.all([
          IPSec.getOptData(dbCon, ipSec, undefined, ipsec_cli) as Promise<any[]>,
          IPSec.getOptData(dbCon, ipsec_cli) as Promise<any[]>,
          IPSec.getInterfaceIp(dbCon, ipsec_cli),
        ]);

        const rightSubnet = getPeerOptions.find((opt) => opt.name === 'rightsubnet')?.arg || '';
        const rightId = getClientOptions.find((opt) => opt.name === 'leftid')?.arg || '';
        const rightCert = getClientOptions.find((opt) => opt.name === 'leftcert')?.arg || '';
        const autoOption = getPeerOptions.find((opt) => opt.name === 'auto')?.arg || 'add';
        const alsoOption = getPeerOptions.find((opt) => opt.name === 'also')?.arg || '';

        const finalOptions = [
          {
            name: 'rightsubnet',
            arg: rightSubnet,
            ipsec: ipSec,
            ipsec_cli: ipsec_cli,
            ipobj: null,
            order: 0,
            scope: 8,
            comment: null,
          },
          {
            name: 'rightsourceip',
            arg: rightSourceIpValue || '',
            ipsec: ipSec,
            ipsec_cli: ipsec_cli,
            ipobj: null,
            order: 0,
            scope: 8,
            comment: null,
          },
          {
            name: 'rightid',
            arg: rightId,
            ipsec: ipSec,
            ipsec_cli: ipsec_cli,
            ipobj: null,
            order: 0,
            scope: 8,
            comment: null,
          },
          {
            name: 'rightcert',
            arg: rightCert,
            ipsec: ipSec,
            ipsec_cli: ipsec_cli,
            ipobj: null,
            order: 0,
            scope: 8,
            comment: null,
          },
          {
            name: 'auto',
            arg: autoOption,
            ipsec: ipSec,
            ipsec_cli: ipsec_cli,
            ipobj: null,
            order: 0,
            scope: 8,
            comment: null,
          },
          {
            name: 'also',
            arg: alsoOption,
            ipsec: ipSec,
            ipsec_cli: ipsec_cli,
            ipobj: null,
            order: 0,
            scope: 8,
            comment: null,
          },
        ].filter((opt) => opt !== null);

        resolve({
          options: finalOptions,
        });
      } catch (err) {
        reject(err);
      }
    });
  }

  public static updatePeerOptions(
    dbCon: Query,
    ipsec: number,
    ipsec_cli: number,
    options: any[],
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const sql = `
        UPDATE ipsec_opt
        SET arg = ?
        WHERE ipsec = ? AND ipsec_cli = ? AND name = ?
      `;

      const promises = options.map((option) => {
        return new Promise<void>((resolve, reject) => {
          dbCon.query(sql, [option.arg, ipsec, ipsec_cli, option.name], (error) => {
            if (error) return reject(error);
            resolve();
          });
        });
      });

      Promise.all(promises)
        .then(() => resolve())
        .catch((error) => reject(error));
    });
  }
}
