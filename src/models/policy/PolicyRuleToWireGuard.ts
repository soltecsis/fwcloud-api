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
import { WireGuard } from '../vpn/wireguard/WireGuard';
import { PolicyRule } from './PolicyRule';

const tableName: string = 'policy_r__wireguard';

@Entity(tableName)
export class PolicyRuleToWireGuard extends Model {
  @PrimaryColumn({ name: 'rule' })
  policyRuleId: number;

  @PrimaryColumn({ name: 'wireguard' })
  wireGuardId: number;

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

  @ManyToOne((type) => PolicyPosition, (policyPosition) => policyPosition.policyRuleToWireGuards)
  @JoinColumn({
    name: 'position',
  })
  policyPosition: PolicyPosition;

  @ManyToOne((type) => WireGuard, (wireGuard) => wireGuard.policyRuleToWireGuards)
  @JoinColumn({
    name: 'wireguard',
  })
  wireGuard: WireGuard;

  @ManyToOne((type) => PolicyRule, (policyRule) => policyRule.policyRuleToWireGuards)
  @JoinColumn({
    name: 'rule',
  })
  policyRule: PolicyRule;

  public getTableName(): string {
    return tableName;
  }

  //Add new policy_r__wireGuard
  public static insertInRule(req) {
    return new Promise(async (resolve, reject) => {
      const policyWireGuard = {
        rule: req.body.rule,
        wireGuard: req.body.wireguard,
        position: req.body.position,
        position_order: req.body.position_order,
      };
      req.dbCon.query(`insert into ${tableName} set ?`, policyWireGuard, async (error, result) => {
        if (error) return reject(error);
        resolve(result.insertId);
      });
    });
  }

  public static checkWireGuardPosition(dbCon, position) {
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

  public static checkExistsInPosition(dbCon, rule, wireGuard, position) {
    return new Promise((resolve, reject) => {
      const sql = `SELECT rule FROM ${tableName}
                WHERE rule=${rule} AND wireguard=${wireGuard} AND position=${position}`;
      dbCon.query(sql, (error, rows) => {
        if (error) return reject(error);
        resolve(rows.length > 0 ? 1 : 0);
      });
    });
  }

  public static moveToNewPosition(req): Promise<void> {
    return new Promise((resolve, reject) => {
      const sql = `UPDATE ${tableName} SET rule=${req.body.new_rule}, position=${req.body.new_position}
                WHERE rule=${req.body.rule} AND wireguard=${req.body.wireGuard} AND position=${req.body.position}`;
      req.dbCon.query(sql, async (error, rows) => {
        if (error) return reject(error);
        resolve();
      });
    });
  }

  public static deleteFromRulePosition(req): Promise<void> {
    return new Promise(async (resolve, reject) => {
      const sql = `DELETE FROM ${tableName} WHERE rule=${req.body.rule} AND wireguard=${req.body.wireGuard} AND position=${req.body.position}`;
      req.dbCon.query(sql, async (error, rows) => {
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

  //Duplicate policy_r__wireGuard RULES
  public static duplicatePolicy_r__wireGuard(dbCon, rule, new_rule): Promise<void> {
    return new Promise((resolve, reject) => {
      const sql = `INSERT INTO ${tableName} (rule, wireguard, position,position_order)
                (SELECT ${new_rule}, wireguard, position, position_order
                from ${tableName} where rule=${rule} order by  position, position_order)`;
      dbCon.query(sql, async (error, result) => {
        if (error) return reject(error);
        resolve();
      });
    });
  }

  public static searchWireGuardInRule(dbCon, fwcloud, wireGuard) {
    return new Promise((resolve, reject) => {
      const sql = `select O.*, FW.id as firewall_id, FW.name as firewall_name, 
                O.wireguard obj_id, CRT.cn obj_name,
                R.id as rule_id, R.type rule_type, (select id from ipobj_type where id=321) as obj_type_id,
                PT.name rule_type_name, O.position as rule_position_id, P.name rule_position_name,
                FW.cluster as cluster_id, IF(FW.cluster is null,null,(select name from cluster where id=FW.cluster)) as cluster_name
            from policy_r__wireguard O
                inner join policy_r R on R.id=O.rule
                inner join firewall FW on FW.id=R.firewall
                inner join policy_position P on P.id=O.position
                inner join policy_type PT on PT.id=R.type
                inner join wireguard VPN on VPN.id=O.wireguard
                inner join crt CRT on CRT.id=VPN.crt
                where FW.fwcloud=${fwcloud} and O.wireguard=${wireGuard}`;
      dbCon.query(sql, (error, rows) => {
        if (error) return reject(error);
        resolve(rows);
      });
    });
  }

  public static searchWireGuardInGroup(dbCon, fwcloud, wireGuard) {
    return new Promise((resolve, reject) => {
      const sql = `select P.*, P.ipobj_g group_id, G.name group_name, G.type as group_type,
                (select id from ipobj_type where id=321) as obj_type_id, CRT.cn obj_name
                from wireguard__ipobj_g P
                inner join wireguard VPN on VPN.id=P.wireguard			
                inner join crt CRT on CRT.id=VPN.crt
                inner join ipobj_g G on G.id=P.ipobj_g
                where G.fwcloud=${fwcloud} and P.wireGuard=${wireGuard}`;
      dbCon.query(sql, (error, rows) => {
        if (error) return reject(error);
        resolve(rows);
      });
    });
  }

  public static getConfigsUnderWireGuardPrefix(dbCon, wireGuard_server_id, prefix_name) {
    return new Promise((resolve, reject) => {
      // Get all WireGuard client configs under an WireGuard configuration server whose CRT common name matches the prefix name.
      const sql = `select VPN.id from wireguard VPN
                inner join crt CRT on CRT.id=VPN.crt
                where VPN.wireguard=${wireGuard_server_id} and CRT.type=1 and CRT.cn like CONCAT(${dbCon.escape(prefix_name)},'%')`;
      dbCon.query(sql, (error, rows) => {
        if (error) return reject(error);
        resolve(rows);
      });
    });
  }

  public static searchLastWireGuardInPrefixInRule(dbCon, fwcloud, wireGuard) {
    return new Promise((resolve, reject) => {
      // Fisrt get all the WireGuard prefixes in rules to which the WireGuard configuration belongs.
      const sql = `select P.rule rule_id, P.prefix, PRE.wireguard, PRE.name, R.type rule_type, (select id from ipobj_type where id=321) as obj_type_id, CRT.cn obj_name,
                PT.name rule_type_name, P.position rule_position_id, PP.name rule_position_name, R.firewall firewall_id, F.name firewall_name,
                F.cluster as cluster_id, IF(F.cluster is null,null,(select name from cluster where id=F.cluster)) as cluster_name
                from policy_r__wireguard_prefix P
                inner join policy_r R on R.id=P.rule
                inner join firewall F on F.id = R.firewall
                inner join policy_position PP on PP.id=P.position
                inner join policy_type PT on PT.id=R.type
                inner join wireguard_prefix PRE on PRE.id=P.prefix
                inner join wireguard VPN on VPN.wireguard=PRE.wireguard
                inner join crt CRT on CRT.id=VPN.crt
                inner join ca CA on CA.id=CRT.ca
                where CA.fwcloud=${fwcloud} and VPN.id=${wireGuard} and CRT.type=1 and CRT.cn like CONCAT(PRE.name,'%')`;
      dbCon.query(sql, async (error, rows) => {
        if (error) return reject(error);

        const result = [];
        try {
          for (const row of rows) {
            const data: any = await this.getConfigsUnderWireGuardPrefix(
              dbCon,
              row.wireGuard,
              row.name,
            );
            // We are the last WireGuard client config in the prefix used in and WireGuard server and in a rule.
            if (data.length === 1 && data[0].id === wireGuard) result.push(row);
          }
        } catch (error) {
          return reject(error);
        }

        resolve(result);
      });
    });
  }

  public static searchLastWireGuardInPrefixInGroup(dbCon, fwcloud, wireGuard) {
    return new Promise((resolve, reject) => {
      // Fisrt get all the WireGuard prefixes in groups to which the WireGuard configuration belongs.
      const sql = `select P.prefix, PRE.wireguard, PRE.name, GR.id group_id, GR.name group_name
                from wireguard_prefix__ipobj_g P
                inner join ipobj_g GR on GR.id=P.ipobj_g
                inner join wireguard_prefix PRE on PRE.id=P.prefix
                inner join wireguard VPN on VPN.wireguard=PRE.wireguard
                inner join crt CRT on CRT.id=VPN.crt
                inner join ca CA on CA.id=CRT.ca
                where CA.fwcloud=${fwcloud} and VPN.id=${wireGuard} and CRT.type=1 and CRT.cn like CONCAT(PRE.name,'%')`;
      dbCon.query(sql, async (error, rows) => {
        if (error) return reject(error);

        const result = [];
        try {
          for (const row of rows) {
            const data: any = await this.getConfigsUnderWireGuardPrefix(
              dbCon,
              row.wireGuard,
              row.name,
            );
            // We are the last wireGuard client config in the prefix used in and WireGuard server and in a rule.
            if (data.length === 1 && data[0].id === wireGuard) result.push(row);
          }
        } catch (error) {
          return reject(error);
        }

        resolve(result);
      });
    });
  }

  public static searchWireGuardInPrefixInRule(dbCon, fwcloud, wireGuard) {
    return new Promise((resolve, reject) => {
      // Get all the WireGuard prefixes in rules to which the WireGuard configuration belongs.
      const sql = `select R.firewall,P.rule from policy_r__wireguard_prefix P
                inner join wireguard_prefix PRE on PRE.id=P.prefix
                inner join wireguard VPN on VPN.wireguard=PRE.wireguard
                inner join crt CRT on CRT.id=VPN.crt
                inner join policy_r R on R.id=P.rule
                inner join firewall F on F.id=R.firewall
                where F.fwcloud=${fwcloud} and VPN.id=${wireGuard} and CRT.type=1 and CRT.cn like CONCAT(PRE.name,'%')`;
      dbCon.query(sql, async (error, result) => {
        if (error) return reject(error);
        resolve(result);
      });
    });
  }

  public static searchWireGuardInPrefixInGroup(dbCon, fwcloud, wireGuard) {
    return new Promise((resolve, reject) => {
      // Get all the WireGuard prefixes in groups to which the WireGuard configuration belongs.
      const sql = `select P.ipobj_g from wireguard_prefix__ipobj_g P
                inner join wireguard_prefix PRE on PRE.id=P.prefix
                inner join wireguard VPN on VPN.wireguard=PRE.wireguard
                inner join crt CRT on CRT.id=VPN.crt
                inner join ca CA on CA.id=CRT.ca
                where CA.fwcloud=${fwcloud} and VPN.id=${wireGuard} and CRT.type=1 and CRT.cn like CONCAT(PRE.name,'%')`;
      dbCon.query(sql, async (error, result) => {
        if (error) return reject(error);
        resolve(result);
      });
    });
  }
}
