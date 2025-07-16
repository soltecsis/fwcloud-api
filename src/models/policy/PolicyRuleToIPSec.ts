/*
    Copyright 2025 SOLTECSIS SOLUCIONES TECNOLOGICAS, SLU
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
import { Entity, Column, PrimaryColumn, ManyToOne, JoinColumn } from 'typeorm';
import { PolicyPosition } from './PolicyPosition';
import { IPSec } from '../vpn/ipsec/IPSec';
import { PolicyRule } from './PolicyRule';
import { Request } from 'express';
import Query from '../../database/Query';

const tableName: string = 'policy_r__ipsec';

@Entity(tableName)
export class PolicyRuleToIPSec extends Model {
  @PrimaryColumn({ name: 'rule' })
  policyRuleId: number;

  @PrimaryColumn({ name: 'ipsec' })
  ipsecId: number;

  @PrimaryColumn({ name: 'position' })
  policyPositionId: number;

  @Column()
  position_order: number;

  @Column()
  created_at: Date;

  @Column()
  updated_at: Date;

  @Column()
  created_by: number;

  @Column()
  updated_by: number;

  @ManyToOne((type) => PolicyPosition, (policyPosition) => policyPosition.policyRuleToIPSecs)
  @JoinColumn({
    name: 'position',
  })
  policyPosition: PolicyPosition;

  @ManyToOne((type) => IPSec, (ipsec) => ipsec.policyRuleToIPSecs)
  @JoinColumn({
    name: 'ipsec',
  })
  ipSec: IPSec;

  @ManyToOne((type) => PolicyRule, (policyRule) => policyRule.policyRuleToIPSecs)
  @JoinColumn({
    name: 'rule',
  })
  policyRule: PolicyRule;

  public getTableName(): string {
    return tableName;
  }

  //Add new policy_r__ipsec
  public static insertInRule(req: Request): Promise<unknown> {
    return new Promise(async (resolve, reject) => {
      const policyIPSec = {
        rule: req.body.rule,
        ipsec: req.body.ipsec,
        position: req.body.position,
        position_order: req.body.position_order,
      };
      req.dbCon.query(
        `insert into ${tableName} (rule, ipsec, position, position_order) values (?, ?, ?, ?)`,
        [policyIPSec.rule, policyIPSec.ipsec, policyIPSec.position, policyIPSec.position_order],
        async (error, result) => {
          if (error) return reject(error);
          resolve(result.insertId);
        },
      );
    });
  }

  public static checkIPSecPosition(dbCon: Query, position: any): Promise<unknown> {
    return new Promise((resolve, reject) => {
      dbCon.query(
        `select type from ipobj_type__policy_position where type=321 and position=${position}`,
        (error, rows) => {
          if (error) return reject(error);
          resolve(rows.length > 0 ? 1 : 0);
        },
      );
    });
  }

  public static checkExistsInPosition(
    dbCon: Query,
    rule: number,
    ipsec: number,
    position: number,
  ): Promise<unknown> {
    return new Promise((resolve, reject) => {
      const sql = `SELECT rule FROM ${tableName}
                WHERE rule=${rule} AND ipsec=${ipsec} AND position=${position}`;
      dbCon.query(sql, (error, rows) => {
        if (error) return reject(error);
        resolve(rows.length > 0 ? 1 : 0);
      });
    });
  }

  public static moveToNewPosition(req: Request): Promise<void> {
    return new Promise((resolve, reject) => {
      const sql = `UPDATE ${tableName} SET rule=${req.body.new_rule}, position=${req.body.new_position}
                WHERE rule=${req.body.rule} AND ipsec=${req.body.ipsec} AND position=${req.body.position}`;
      req.dbCon.query(sql, async (error, _) => {
        if (error) return reject(error);
        resolve();
      });
    });
  }

  public static deleteFromRulePosition(req: Request): Promise<void> {
    return new Promise(async (resolve, reject) => {
      const sql = `DELETE FROM ${tableName} WHERE rule=${req.body.rule} AND ipsec=${req.body.ipsec} AND position=${req.body.position}`;
      req.dbCon.query(sql, async (error, _) => {
        if (error) return reject(error);
        resolve();
      });
    });
  }

  public static deleteFromRule(dbCon, rule): Promise<void> {
    return new Promise(async (resolve, reject) => {
      dbCon.query(`DELETE FROM ${tableName} WHERE rule=${rule}`, async (error, rows) => {
        if (error) return reject(error);
        resolve();
      });
    });
  }

  //Duplicate policy_r__ipsec RULES
  public static duplicatePolicy_r__ipsec(dbCon, rule, new_rule): Promise<void> {
    return new Promise((resolve, reject) => {
      const sql = `INSERT INTO ${tableName} (rule, ipsec, position,position_order)
                (SELECT ${new_rule}, ipsec, position, position_order
                from ${tableName} where rule=${rule} order by  position, position_order)`;
      dbCon.query(sql, async (error, result) => {
        if (error) return reject(error);
        resolve();
      });
    });
  }

  public static searchIPSecInRule(dbCon: Query, fwcloud: number, ipsec: number) {
    return new Promise((resolve, reject) => {
      const sql = `select O.*, FW.id as firewall_id, FW.name as firewall_name, 
                O.ipsec obj_id, CRT.cn obj_name,
                R.id as rule_id, R.type rule_type, (select id from ipobj_type where id=331) as obj_type_id,
                PT.name rule_type_name, O.position as rule_position_id, P.name rule_position_name,
                FW.cluster as cluster_id, IF(FW.cluster is null,null,(select name from cluster where id=FW.cluster)) as cluster_name
            from policy_r__ipsec O
                inner join policy_r R on R.id=O.rule
                inner join firewall FW on FW.id=R.firewall
                inner join policy_position P on P.id=O.position
                inner join policy_type PT on PT.id=R.type
                inner join ipsec VPN on VPN.id=O.ipsec
                inner join crt CRT on CRT.id=VPN.crt
                where FW.fwcloud=${fwcloud} and O.ipsec=${ipsec}`;
      dbCon.query(sql, (error, rows) => {
        if (error) return reject(error);
        resolve(rows);
      });
    });
  }

  public static searchIPSecInGroup(dbCon: Query, fwcloud: number, ipsec: number) {
    return new Promise((resolve, reject) => {
      const sql = `select P.*, P.ipobj_g group_id, G.name group_name, G.type as group_type,
                (select id from ipobj_type where id=331) as obj_type_id, CRT.cn obj_name
                from ipsec__ipobj_g P
                inner join ipsec VPN on VPN.id=P.ipsec			
                inner join crt CRT on CRT.id=VPN.crt
                inner join ipobj_g G on G.id=P.ipobj_g
                where G.fwcloud=${fwcloud} and P.ipsec=${ipsec}`;
      dbCon.query(sql, (error, rows) => {
        if (error) return reject(error);
        resolve(rows);
      });
    });
  }

  public static getConfigsUnderIPSecPrefix(
    dbCon: Query,
    ipsec_server_id: number,
    prefix_name: string,
  ) {
    return new Promise((resolve, reject) => {
      // Get all IPSec client configs under an IPSec configuration server whose CRT common name matches the prefix name.
      const sql = `select VPN.id from ipsec VPN
                inner join crt CRT on CRT.id=VPN.crt
                where VPN.ipsec=${ipsec_server_id} and CRT.type=1 and CRT.cn like CONCAT(${dbCon.escape(prefix_name)},'%')`;
      dbCon.query(sql, (error, rows) => {
        if (error) return reject(error);
        resolve(rows);
      });
    });
  }

  public static searchLastIPSecInPrefixInRule(dbCon: Query, fwcloud: number, ipsec: number) {
    return new Promise((resolve, reject) => {
      // Fisrt get all the IPSec prefixes in rules to which the IPSec configuration belongs.
      const sql = `select P.rule rule_id, P.prefix, PRE.ipsec, PRE.name, R.type rule_type, (select id from ipobj_type where id=331) as obj_type_id, CRT.cn obj_name,
                PT.name rule_type_name, P.position rule_position_id, PP.name rule_position_name, R.firewall firewall_id, F.name firewall_name,
                F.cluster as cluster_id, IF(F.cluster is null,null,(select name from cluster where id=F.cluster)) as cluster_name
                from policy_r__ipsec_prefix P
                inner join policy_r R on R.id=P.rule
                inner join firewall F on F.id = R.firewall
                inner join policy_position PP on PP.id=P.position
                inner join policy_type PT on PT.id=R.type
                inner join ipsec_prefix PRE on PRE.id=P.prefix
                inner join ipsec VPN on VPN.ipsec=PRE.ipsec
                inner join crt CRT on CRT.id=VPN.crt
                inner join ca CA on CA.id=CRT.ca
                where CA.fwcloud=${fwcloud} and VPN.id=${ipsec} and CRT.type=1 and CRT.cn like CONCAT(PRE.name,'%')`;
      dbCon.query(sql, async (error, rows) => {
        if (error) return reject(error);

        const result = [];
        try {
          for (const row of rows) {
            const data: any = await this.getConfigsUnderIPSecPrefix(dbCon, row.ipsec, row.name);
            // We are the last IPSec client config in the prefix used in and IPSec server and in a rule.
            if (data.length === 1 && data[0].id === ipsec) result.push(row);
          }
        } catch (error) {
          return reject(error);
        }

        resolve(result);
      });
    });
  }

  public static searchLastIPSecInPrefixInGroup(dbCon: Query, fwcloud: number, ipsec: number) {
    return new Promise((resolve, reject) => {
      // Fisrt get all the IPSec prefixes in groups to which the IPSec configuration belongs.
      const sql = `select P.prefix, PRE.ipsec, PRE.name, GR.id group_id, GR.name group_name
                from ipsec_prefix__ipobj_g P
                inner join ipobj_g GR on GR.id=P.ipobj_g
                inner join ipsec_prefix PRE on PRE.id=P.prefix
                inner join ipsec VPN on VPN.ipsec=PRE.ipsec
                inner join crt CRT on CRT.id=VPN.crt
                inner join ca CA on CA.id=CRT.ca
                where CA.fwcloud=${fwcloud} and VPN.id=${ipsec} and CRT.type=1 and CRT.cn like CONCAT(PRE.name,'%')`;
      dbCon.query(sql, async (error, rows) => {
        if (error) return reject(error);

        const result = [];
        try {
          for (const row of rows) {
            const data: any = await this.getConfigsUnderIPSecPrefix(dbCon, row.ipsec, row.name);
            // We are the last ipsec client config in the prefix used in and IPSec server and in a rule.
            if (data.length === 1 && data[0].id === ipsec) result.push(row);
          }
        } catch (error) {
          return reject(error);
        }

        resolve(result);
      });
    });
  }
}
