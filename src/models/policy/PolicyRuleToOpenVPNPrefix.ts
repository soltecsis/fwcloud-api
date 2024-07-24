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
import { Column, Entity, PrimaryColumn, ManyToOne, JoinColumn } from 'typeorm';
import { PolicyRule } from './PolicyRule';
import { PolicyPosition } from './PolicyPosition';
import { OpenVPNPrefix } from '../vpn/openvpn/OpenVPNPrefix';
import Query from '../../database/Query';
import RequestData from '../data/RequestData';

const tableName: string = 'policy_r__openvpn_prefix';

@Entity(tableName)
export class PolicyRuleToOpenVPNPrefix extends Model {
  @PrimaryColumn({ name: 'rule' })
  policyRuleId: number;

  @PrimaryColumn({ name: 'prefix' })
  openVPNPrefixId: number;

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

  @ManyToOne(() => PolicyPosition, (policyPosition) => policyPosition.policyRuleToOpenVPNPrefixes)
  @JoinColumn({
    name: 'position',
  })
  policyPosition: PolicyPosition;

  @ManyToOne(() => OpenVPNPrefix, (openVPNPrefix) => openVPNPrefix.policyRuleToOpenVPNPrefixes)
  @JoinColumn({
    name: 'prefix',
  })
  openVPNPrefix: OpenVPNPrefix;

  @ManyToOne(() => PolicyRule, (policyRule) => policyRule.policyRuleToOpenVPNPrefixes)
  @JoinColumn({
    name: 'rule',
  })
  policyRule: PolicyRule;

  public getTableName(): string {
    return tableName;
  }

  //Add new policy_r__openvpn_prefix
  public static insertInRule = (req: RequestData): Promise<number> => {
    return new Promise((resolve, reject) => {
      const policyPrefix = {
        rule: req.body.rule,
        prefix: req.body.prefix,
        position: req.body.position,
        position_order: req.body.position_order,
      };
      req.dbCon.query(
        `insert into ${tableName} set ?`,
        policyPrefix,
        (error, result: { insertId: number }) => {
          if (error) return reject(error);
          resolve(result.insertId);
        },
      );
    });
  };

  public static checkPrefixPosition = (dbCon: Query, position: number): Promise<number> => {
    return new Promise((resolve, reject) => {
      dbCon.query(
        `select type from ipobj_type__policy_position where type=401 and position=${position}`,
        (error, rows: Array<{ type: number }>) => {
          if (error) return reject(error);
          resolve(rows.length > 0 ? 1 : 0);
        },
      );
    });
  };

  public static checkExistsInPosition = (
    dbCon: Query,
    rule: number,
    prefix: number,
    openvpn: number,
    position: number,
  ): Promise<number> => {
    return new Promise((resolve, reject) => {
      const sql = `SELECT rule FROM ${tableName}
                WHERE rule=${rule} AND prefix=${prefix} AND position=${position}`;
      dbCon.query(sql, (error, rows: Array<{ rule: number }>) => {
        if (error) return reject(error);
        resolve(rows.length > 0 ? 1 : 0);
      });
    });
  };

  public static moveToNewPosition(req: RequestData): Promise<void> {
    return new Promise((resolve, reject) => {
      const sql = `UPDATE ${tableName} SET rule=${req.body.new_rule}, position=${req.body.new_position}
                WHERE rule=${req.body.rule} AND prefix=${req.body.prefix} AND position=${req.body.position}`;
      req.dbCon.query(sql, (error) => {
        if (error) return reject(error);
        resolve();
      });
    });
  }

  public static deleteFromRulePosition(req: RequestData): Promise<void> {
    return new Promise((resolve, reject) => {
      const sql = `DELETE FROM ${tableName} WHERE rule=${req.body.rule} AND prefix=${req.body.prefix} AND position=${req.body.position}`;
      req.dbCon.query(sql, (error) => {
        if (error) return reject(error);
        resolve();
      });
    });
  }

  public static deleteFromRule(dbCon: Query, rule: number): Promise<void> {
    return new Promise((resolve, reject) => {
      dbCon.query(`DELETE FROM ${tableName} WHERE rule=${rule}`, (error) => {
        if (error) return reject(error);
        resolve();
      });
    });
  }

  //Duplicate policy_r__openvpn_prefix RULES
  public static duplicatePolicy_r__prefix(
    dbCon: Query,
    rule: number,
    new_rule: number,
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const sql = `INSERT INTO ${tableName} (rule, prefix, position, position_order)
                (SELECT ${new_rule}, prefix, position, position_order
                from ${tableName} where rule=${rule} order by  position, position_order)`;
      dbCon.query(sql, (error) => {
        if (error) return reject(error);
        resolve();
      });
    });
  }
}
