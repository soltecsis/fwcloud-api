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
  PrimaryColumn,
  Column,
  Entity,
  ManyToOne,
  JoinColumn,
  OneToMany,
  ManyToMany,
} from 'typeorm';
import { PolicyType } from './PolicyType';
import { IPObjType } from '../ipobj/IPObjType';
import { PolicyRuleToInterface } from './PolicyRuleToInterface';
import { PolicyRuleToOpenVPNPrefix } from './PolicyRuleToOpenVPNPrefix';
import { PolicyRuleToIPObj } from './PolicyRuleToIPObj';
import { PolicyRuleToOpenVPN } from './PolicyRuleToOpenVPN';
import { IPObjTypeToPolicyPosition } from '../ipobj/IPObjTypeToPolicyPosition';
import { logger } from '../../fonaments/abstract-application';

const tableName: string = 'policy_position';

export const RulePositionsMap = new Map<string, number>([
  ['IPv4:INPUT:In', 20],
  ['IPv4:INPUT:Source', 1],
  ['IPv4:INPUT:Destination', 2],
  ['IPv4:INPUT:Service', 3],
  ['IPv4:OUTPUT:Out', 21],
  ['IPv4:OUTPUT:Source', 4],
  ['IPv4:OUTPUT:Destination', 5],
  ['IPv4:OUTPUT:Service', 6],
  ['IPv4:FORWARD:In', 22],
  ['IPv4:FORWARD:Out', 25],
  ['IPv4:FORWARD:Source', 7],
  ['IPv4:FORWARD:Destination', 8],
  ['IPv4:FORWARD:Service', 9],
  ['IPv4:SNAT:Out', 24],
  ['IPv4:SNAT:Source', 11],
  ['IPv4:SNAT:Destination', 12],
  ['IPv4:SNAT:Service', 13],
  ['IPv4:SNAT:Translated Source', 14],
  ['IPv4:SNAT:Translated Service', 16],
  ['IPv4:DNAT:In', 36],
  ['IPv4:DNAT:Source', 30],
  ['IPv4:DNAT:Destination', 31],
  ['IPv4:DNAT:Service', 32],
  ['IPv4:DNAT:Translated Destination', 34],
  ['IPv4:DNAT:Translated Service', 35],

  ['IPv6:INPUT:In', 51],
  ['IPv6:INPUT:Source', 37],
  ['IPv6:INPUT:Destination', 38],
  ['IPv6:INPUT:Service', 39],
  ['IPv6:OUTPUT:Out', 52],
  ['IPv6:OUTPUT:Source', 40],
  ['IPv6:OUTPUT:Destination', 41],
  ['IPv6:OUTPUT:Service', 42],
  ['IPv6:FORWARD:In', 53],
  ['IPv6:FORWARD:Out', 55],
  ['IPv6:FORWARD:Source', 43],
  ['IPv6:FORWARD:Destination', 44],
  ['IPv6:FORWARD:Service', 45],
  ['IPv6:SNAT:Out', 54],
  ['IPv6:SNAT:Source', 46],
  ['IPv6:SNAT:Destination', 47],
  ['IPv6:SNAT:Service', 48],
  ['IPv6:SNAT:Translated Source', 49],
  ['IPv6:SNAT:Translated Service', 50],
  ['IPv6:DNAT:In', 61],
  ['IPv6:DNAT:Source', 56],
  ['IPv6:DNAT:Destination', 57],
  ['IPv6:DNAT:Service', 58],
  ['IPv6:DNAT:Translated Destination', 59],
  ['IPv6:DNAT:Translated Service', 60],
]);

export type PositionNode = {
  id: number;
  name: string;
  content: string;
  policy_type: number;
  position_order: number;
  single_object: number;
  fwcloud: number;
  firewall: number;
  rule: number;
  ipobjs: [];
};

@Entity(tableName)
export class PolicyPosition extends Model {
  @PrimaryColumn()
  id: number;

  @Column()
  name: string;

  @Column({ name: 'policy_type' })
  policyTypeId: number;

  @Column()
  position_order: number;

  @Column()
  content: string;

  @Column()
  single_object: number;

  @ManyToOne((type) => PolicyType, (type) => type.policyPositions)
  @JoinColumn({
    name: 'policy_type',
  })
  policyType: PolicyType;

  @ManyToMany((type) => IPObjType, (ipObjType) => ipObjType.policyPositions)
  ipObjTypes: Array<IPObjType>;

  @OneToMany(
    (type) => PolicyRuleToInterface,
    (policyRuleToInterface) => policyRuleToInterface.policyPosition,
  )
  policyRuleToInterfaces: Array<PolicyRuleToInterface>;

  @OneToMany((type) => PolicyRuleToIPObj, (policyRuleToIPObj) => policyRuleToIPObj.policyPosition)
  policyRuleToIPObjs: Array<PolicyRuleToIPObj>;

  @OneToMany(
    (type) => PolicyRuleToOpenVPN,
    (policyRuleToOpenVPN) => policyRuleToOpenVPN.policyPosition,
  )
  policyRuleToOpenVPNs: Array<PolicyRuleToOpenVPN>;

  @OneToMany(
    (type) => PolicyRuleToOpenVPNPrefix,
    (policyRuleToOpenVPNPrefix) => policyRuleToOpenVPNPrefix.policyPosition,
  )
  policyRuleToOpenVPNPrefixes: Array<PolicyRuleToOpenVPNPrefix>;

  @OneToMany((type) => IPObjTypeToPolicyPosition, (model) => model.policyPosition)
  ipObjTypeToPolicyPositions!: Array<IPObjTypeToPolicyPosition>;

  public getTableName(): string {
    return tableName;
  }

  //Get All policy_position
  public static getPolicy_positions(callback) {
    db.get((error, connection) => {
      if (error) callback(error, null);
      connection.query('SELECT * FROM ' + tableName + ' ORDER BY position_order', (error, rows) => {
        if (error) callback(error, null);
        else callback(null, rows);
      });
    });
  }

  //Get policy_position by type
  public static getPolicyPositionsByType(dbCon, type) {
    return new Promise((resolve, reject) => {
      dbCon.query(
        `SELECT * FROM ${tableName} WHERE policy_type=${type} ORDER BY position_order`,
        (error, result) => {
          if (error) return reject(error);
          resolve(result);
        },
      );
    });
  }

  //Get policy_position by  type
  public static checkPolicyRulePosition(dbCon, rule, position) {
    return new Promise((resolve, reject) => {
      const sql = `select PP.id from ${tableName} PP
                inner join policy_r R on R.type=PP.policy_type
                where R.id=${rule} and PP.id=${position}`;

      dbCon.query(sql, (error, result) => {
        if (error) return reject(error);
        resolve(result.length === 1 ? true : false);
      });
    });
  }

  //Get policy_position by type
  public static getRulePositions(
    dbCon: any,
    fwcloud: number,
    firewall: number,
    rule: number,
    type: number,
  ): Promise<PositionNode[]> {
    return new Promise((resolve, reject) => {
      dbCon.query(
        `select * from ${tableName} WHERE policy_type=${type} order by position_order`,
        (error, positions) => {
          if (error) return reject(error);

          for (let i = 0; i < positions.length; i++) {
            positions[i].fwcloud = fwcloud;
            positions[i].firewall = firewall;
            positions[i].rule = rule;
          }

          resolve(positions);
        },
      );
    });
  }

  //Get policy_position by  id
  public static getPolicy_position(id, callback) {
    db.get((error, connection) => {
      if (error) callback(error, null);
      const sql = 'SELECT * FROM ' + tableName + ' WHERE id = ' + connection.escape(id);
      connection.query(sql, (error, row) => {
        if (error) callback(error, null);
        else callback(null, row);
      });
    });
  }

  //Add new policy_position
  public static insertPolicy_position(policy_positionData, callback) {
    db.get((error, connection) => {
      if (error) callback(error, null);
      connection.query(
        'INSERT INTO ' + tableName + ' SET ?',
        policy_positionData,
        (error, result) => {
          if (error) {
            callback(error, null);
          } else {
            //devolvemos la última id insertada
            callback(null, { insertId: result.insertId });
          }
        },
      );
    });
  }

  //Update policy_position
  public static updatePolicy_position(policy_positionData, callback) {
    db.get((error, connection) => {
      if (error) callback(error, null);
      const sql =
        'UPDATE ' +
        tableName +
        ' SET name = ' +
        connection.escape(policy_positionData.name) +
        ', ' +
        'policy_type = ' +
        connection.escape(policy_positionData.poicy_type) +
        ', ' +
        'position_order = ' +
        connection.escape(policy_positionData.position_order) +
        ', ' +
        'content = ' +
        connection.escape(policy_positionData.content) +
        ' ' +
        ' WHERE id = ' +
        policy_positionData.id;
      logger().debug(sql);
      connection.query(sql, (error, result) => {
        if (error) {
          callback(error, null);
        } else {
          callback(null, { result: true });
        }
      });
    });
  }

  //Remove policy_position with id to remove
  public static deletePolicy_position(id, callback) {
    db.get((error, connection) => {
      if (error) callback(error, null);
      const sqlExists = 'SELECT * FROM ' + tableName + ' WHERE id = ' + connection.escape(id);
      connection.query(sqlExists, (error, row) => {
        //If exists Id from policy_position to remove
        if (row) {
          db.get((error, connection) => {
            const sql = 'DELETE FROM ' + tableName + ' WHERE id = ' + connection.escape(id);
            connection.query(sql, (error, result) => {
              if (error) {
                callback(error, null);
              } else {
                callback(null, { result: true });
              }
            });
          });
        } else {
          callback(null, { result: false });
        }
      });
    });
  }
}
