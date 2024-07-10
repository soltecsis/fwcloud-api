/*
    Copyright 2022 SOLTECSIS SOLUCIONES TECNOLOGICAS, SLU
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

import { PolicyRuleToOpenVPN } from '../../models/policy/PolicyRuleToOpenVPN';
import { PolicyRuleToOpenVPNPrefix } from '../../models/policy/PolicyRuleToOpenVPNPrefix';
import { PolicyPosition, PositionNode } from './PolicyPosition';
import { PolicyGroup } from './PolicyGroup';
import { PolicyRuleToInterface } from '../../models/policy/PolicyRuleToInterface';
import { PolicyRuleToIPObj } from '../../models/policy/PolicyRuleToIPObj';
import { Column, Entity, PrimaryGeneratedColumn, ManyToOne, JoinColumn, OneToMany } from 'typeorm';
import { logger } from '../../fonaments/abstract-application';
import { PolicyType } from './PolicyType';
import { Firewall, FireWallOptMask } from '../firewall/Firewall';
import { Mark } from '../ipobj/Mark';
import { PolicyTypesMap } from '../../models/policy/PolicyType';
import Query from '../../database/Query';
const fwcError = require('../../utils/error_table');

const tableName: string = 'policy_r';

// Special rules codes.
export enum SpecialPolicyRules {
  STATEFUL = 1,
  CATCHALL = 2,
  DOCKER = 3,
  CROWDSEC = 4,
  FAIL2BAN = 5,
  HOOKSCRIPT = 6,
}

export enum PolicyRuleOptMask {
  STATEFUL = 0x0001,
  STATELESS = 0x0002,
  LOG = 0x0004,
}

export const SpecialRuleToFireWallOptMask = new Map<SpecialPolicyRules, number>([
  [SpecialPolicyRules.STATEFUL, 0x0001],
  [SpecialPolicyRules.DOCKER, 0x0020],
  [SpecialPolicyRules.CROWDSEC, 0x0040],
  [SpecialPolicyRules.FAIL2BAN, 0x0080],
]);

type RulePosMap = Map<string, []>;

@Entity(tableName)
export class PolicyRule extends Model {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  rule_order: number;

  @Column()
  direction: number;

  @Column()
  action: number;

  @Column()
  time_start: Date;

  @Column()
  time_end: Date;

  @Column()
  comment: string;

  @Column()
  options: number;

  @Column()
  active: number;

  @Column()
  style: string;

  @Column()
  fw_apply_to: number;

  @Column()
  negate: string;

  @Column()
  special: number;

  @Column()
  run_before: string;

  @Column()
  run_after: string;

  @Column()
  created_at: Date;

  @Column()
  updated_at: Date;

  @Column()
  created_by: number;

  @Column()
  updated_by: number;

  @Column({ name: 'idgroup' })
  policyGroupId: number;

  @ManyToOne(() => PolicyGroup, (policyGroup) => policyGroup.policyRules)
  @JoinColumn({
    name: 'idgroup',
  })
  policyGroup: PolicyGroup;

  @Column({ name: 'firewall' })
  firewallId: number;

  @ManyToOne(() => Firewall, (firewall) => firewall.policyRules)
  @JoinColumn({
    name: 'firewall',
  })
  firewall: Firewall;

  @Column({ name: 'mark' })
  markId: number;

  @ManyToOne(() => Mark, (mark) => mark.policyRules)
  @JoinColumn({
    name: 'mark',
  })
  mark: Mark;

  @Column({ name: 'type' })
  policyTypeId: number;

  @ManyToOne(() => PolicyType, (policyType) => policyType.policyRules)
  @JoinColumn({
    name: 'type',
  })
  policyType: PolicyType;

  @OneToMany(
    () => PolicyRuleToInterface,
    (policyRuleToInterface) => policyRuleToInterface.policyRule,
  )
  policyRuleToInterfaces: Array<PolicyRuleToInterface>;

  @OneToMany(() => PolicyRuleToIPObj, (policyRuleToIPObj) => policyRuleToIPObj.policyRule)
  policyRuleToIPObjs: Array<PolicyRuleToIPObj>;

  @OneToMany(() => PolicyRuleToOpenVPN, (policyRuleToOpenVPN) => policyRuleToOpenVPN.policyRule)
  policyRuleToOpenVPNs: Array<PolicyRuleToOpenVPN>;

  @OneToMany(
    () => PolicyRuleToOpenVPNPrefix,
    (policyRuleToOpenVPNPrefix) => policyRuleToOpenVPNPrefix.policyRule,
  )
  policyRuleToOpenVPNPrefixes: Array<PolicyRuleToOpenVPNPrefix>;

  private static clon_data: any;

  public getTableName(): string {
    return tableName;
  }

  //Get All policy_r by firewall and group
  public static getPolicy_rs(idfirewall, idgroup, callback) {
    db.get((error, connection) => {
      if (error) callback(error, null);
      let whereGroup = '';
      if (idgroup !== '') {
        whereGroup = ' AND idgroup=' + connection.escape(idgroup);
      }
      const sql =
        'SELECT * FROM ' +
        tableName +
        ' WHERE firewall=' +
        connection.escape(idfirewall) +
        whereGroup +
        ' ORDER BY rule_order';
      connection.query(sql, (error, rows) => {
        if (error) callback(error, null);
        else callback(null, rows);
      });
    });
  }

  private static buildSQLsForGrid(firewall: number, type: number, rules: number[]): string[] {
    return [
      `select R.rule, R.position, OBJ.id, OBJ.name, OBJ.type, R.position_order, '' as labelName, 
            FW.id as firewall_id, FW.name as firewall_name, CL.id as cluster_id, CL.name as cluster_name, H.id as host_id, H.name as host_name 
            from policy_r__ipobj R 
            inner join ipobj OBJ on OBJ.id=R.ipobj 
            inner join policy_r PR on PR.id=R.rule 
            left join interface I on I.id=OBJ.interface
            left join firewall FW on FW.id=I.firewall  
            left join cluster CL on CL.id=FW.cluster   
            left join interface__ipobj II on II.interface=I.id  
            left join ipobj H on H.id=II.ipobj  
            where PR.firewall=${firewall} and PR.type=${type}
            ${rules ? ` and PR.id IN (${rules.join(', ')})` : ``}

            union select R.rule, R.position, G.id, G.name, G.type, R.position_order, '' as labelName, 
            null as firewall_id, null as firewall_name, null as cluster_id, null as cluster_name, null as host_id, null as host_name 
            from policy_r__ipobj R 
            inner join ipobj_g G on G.id=R.ipobj_g
            inner join policy_r PR on PR.id=R.rule  
            where PR.firewall=${firewall} and PR.type=${type}
            ${rules ? ` and PR.id IN (${rules.join(', ')})` : ``}

            union select R.rule, R.position, I.id, I.name, I.type, R.position_order, I.labelName, 
            FW.id as firewall_id, FW.name as firewall_name, CL.id as cluster_id, CL.name as cluster_name, H.id as host_id, H.name as host_name 
            from policy_r__ipobj R 
            inner join interface I on I.id=R.interface
            inner join policy_r PR on PR.id=R.rule  
            left join firewall FW on FW.id=I.firewall  
            left join cluster CL on CL.id=FW.cluster   
            left join interface__ipobj II on II.interface=R.interface  
            left join ipobj H on H.id=II.ipobj  
            where PR.firewall=${firewall} and PR.type=${type}
            ${rules ? ` and PR.id IN (${rules.join(', ')})` : ``}

            union select R.rule, R.position, I.id, I.name, I.type, R.position_order, I.labelName, 
            FW.id as firewall_id, FW.name as firewall_name, CL.id as cluster_id, CL.name as cluster_name, null as host_id, null as host_name 
            from policy_r__interface R 
            inner join interface I on I.id=R.interface
            inner join policy_r PR on PR.id=R.rule
            inner join firewall FW on FW.id=I.firewall  
            left join cluster CL on CL.id=FW.cluster   
            where PR.firewall=${firewall} and PR.type=${type}
            ${rules ? ` and PR.id IN (${rules.join(', ')})` : ``}

            union select R.rule, R.position, VPN.id, CRT.cn, "311" as type, R.position_order, '' as labelName, 
            FW.id as firewall_id, FW.name as firewall_name, CL.id as cluster_id, CL.name as cluster_name, null as host_id, null as host_name 
            from policy_r__openvpn R
            inner join openvpn VPN on VPN.id=R.openvpn
            inner join crt CRT ON CRT.id=VPN.crt
            inner join policy_r PR on PR.id=R.rule
            inner join firewall FW on FW.id=VPN.firewall  
            left join cluster CL on CL.id=FW.cluster  
            where PR.firewall=${firewall} and PR.type=${type}
            ${rules ? ` and PR.id IN (${rules.join(', ')})` : ``}

            union select R.rule, R.position, PRE.id, PRE.name, "401" as type, R.position_order, '' as labelName, 
            FW.id as firewall_id, FW.name as firewall_name, CL.id as cluster_id, CL.name as cluster_name, null as host_id, null as host_name 
            from policy_r__openvpn_prefix R 
            inner join openvpn_prefix PRE on PRE.id=R.prefix
            inner join policy_r PR on PR.id=R.rule 
            inner join openvpn VPN on VPN.id=PRE.openvpn
            inner join firewall FW on FW.id=VPN.firewall  
            left join cluster CL on CL.id=FW.cluster  
            where PR.firewall=${firewall} and PR.type=${type}
            ${rules ? ` and PR.id IN (${rules.join(', ')})` : ``}
            
            order by position_order`,
    ];
  }

  private static buildSQLsForCompiler(firewall: number, type: number, rules: number[]): string[] {
    return [
      // All ipobj under a position excluding hosts.
      `select R.rule,R.position,O.* from policy_r__ipobj R 
            inner join ipobj O on O.id=R.ipobj 
            inner join policy_r PR on PR.id=R.rule 
            where PR.firewall=${firewall} and PR.type=${type} and O.type<>8
            ${rules ? ` and PR.id IN (${rules.join(',')})` : ``}`,

      // All ipobj under host (type=8).
      `select R.rule,R.position,OIF.* from policy_r__ipobj R 
            inner join ipobj O on O.id=R.ipobj
            inner join interface__ipobj II on II.ipobj=O.id
            inner join interface I on I.id=II.interface
            inner join ipobj OIF on OIF.interface=I.id 
            inner join policy_r PR on PR.id=R.rule 
            where PR.firewall=${firewall} and PR.type=${type} and O.type=8
            ${rules ? ` and PR.id IN (${rules.join(',')})` : ``}`,

      // All ipobj under group excluding hosts (type=8)
      `select R.rule,R.position,O.* from policy_r__ipobj R 
            inner join ipobj__ipobjg G on G.ipobj_g=R.ipobj_g
            inner join ipobj O on O.id=G.ipobj
            inner join policy_r PR on PR.id=R.rule 
            where PR.firewall=${firewall} and PR.type=${type} and O.type<>8
            ${rules ? ` and PR.id IN (${rules.join(',')})` : ``}`,

      // All ipobj under host (type=8) included in IP objects groups
      `select R.rule,R.position,OIF.* from policy_r__ipobj R 
            inner join ipobj__ipobjg G on G.ipobj_g=R.ipobj_g
            inner join ipobj O on O.id=G.ipobj
            inner join interface__ipobj II on II.ipobj=O.id
            inner join interface I on I.id=II.interface
            inner join ipobj OIF on OIF.interface=I.id
            inner join policy_r PR on PR.id=R.rule 
            where PR.firewall=${firewall} and PR.type=${type} and O.type=8
            ${rules ? ` and PR.id IN (${rules.join(',')})` : ``}`,

      // All interfaces in positions I
      `select R.rule,R.position,I.* from policy_r__interface R 
            inner join interface I on I.id=R.interface 
            inner join policy_r PR on PR.id=R.rule 
            where PR.firewall=${firewall} and PR.type=${type}
            ${rules ? ` and PR.id IN (${rules.join(',')})` : ``}`,

      // All ipobj under interfaces in position O
      `select R.rule,R.position,O.* from policy_r__ipobj R 
            inner join interface I on I.id=R.interface
            inner join ipobj O on O.interface=I.id
            inner join policy_r PR on PR.id=R.rule 
            where PR.firewall=${firewall} and PR.type=${type}
            ${rules ? ` and PR.id IN (${rules.join(',')})` : ``}`,

      // All ipobj under OpenVPNs in type O positions
      `select R.rule,R.position,O.* from policy_r__openvpn R 
            inner join openvpn VPN on VPN.id=R.openvpn 
            inner join openvpn_opt OPT on OPT.openvpn=VPN.id
            inner join ipobj O on O.id=OPT.ipobj
            inner join policy_r PR on PR.id=R.rule 
            where PR.firewall=${firewall} and PR.type=${type} and OPT.name='ifconfig-push'
            ${rules ? ` and PR.id IN (${rules.join(',')})` : ``}`,

      // All ipobj under OpenVPNs in groups into type O positions
      `select R.rule,R.position,O.* from policy_r__ipobj R
            inner join openvpn__ipobj_g G on G.ipobj_g=R.ipobj_g
            inner join openvpn VPN on VPN.id=G.openvpn 
            inner join openvpn_opt OPT on OPT.openvpn=VPN.id
            inner join ipobj O on O.id=OPT.ipobj
            inner join policy_r PR on PR.id=R.rule 
            where PR.firewall=${firewall} and PR.type=${type} and OPT.name='ifconfig-push'
            ${rules ? ` and PR.id IN (${rules.join(',')})` : ``}`,

      // All ipobj under OpenVPN prefix in groups into type O positions
      `select R.rule,R.position,O.* from policy_r__ipobj R
            inner join openvpn_prefix__ipobj_g G on G.ipobj_g=R.ipobj_g
            inner join openvpn_prefix PRE on PRE.id=G.prefix
            inner join openvpn VPN on VPN.openvpn=PRE.openvpn
            inner join crt CRT on CRT.id=VPN.crt
            inner join openvpn_opt OPT on OPT.openvpn=VPN.id
            inner join ipobj O on O.id=OPT.ipobj
            inner join policy_r PR on PR.id=R.rule 
            where PR.firewall=${firewall} and PR.type=${type} 
            and CRT.type=1 and CRT.cn like CONCAT(PRE.name,'%') and OPT.name='ifconfig-push'
            ${rules ? ` and PR.id IN (${rules.join(',')})` : ``}`,

      // All ipobj under OpenVPN prefix into type O positions
      `select R.rule,R.position,O.* from policy_r__openvpn_prefix R 
            inner join openvpn_prefix PRE on PRE.id=R.prefix
            inner join openvpn VPN on VPN.openvpn=PRE.openvpn
            inner join crt CRT on CRT.id=VPN.crt
            inner join openvpn_opt OPT on OPT.openvpn=VPN.id
            inner join ipobj O on O.id=OPT.ipobj
            inner join policy_r PR on PR.id=R.rule 
            where PR.firewall=${firewall} and PR.type=${type} 
            and CRT.type=1 and CRT.cn like CONCAT(PRE.name,'%') and OPT.name='ifconfig-push'
            ${rules ? ` and PR.id IN (${rules.join(',')})` : ``}`,
    ];
  }

  private static mapPolicyData(
    dbCon: Query,
    rulePositionsMap: RulePosMap,
    sql: string,
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      dbCon.query(sql, async (error, data) => {
        if (error) return reject(error);

        try {
          for (let i = 0; i < data.length; i++) {
            const ipobjs: any = rulePositionsMap.get(`${data[i].rule}:${data[i].position}`);
            ipobjs?.push(data[i]);
          }
        } catch (error) {
          return reject(error);
        }

        resolve();
      });
    });
  }

  // Get all the policy data necessary for the compilation process.
  public static getPolicyData(
    dst: 'grid' | 'compiler',
    dbCon: Query,
    fwcloud: number,
    firewall: number,
    type: number,
    rules: number[],
    idgroup: number,
    ignoreGroupsData?: boolean,
  ) {
    return new Promise((resolve, reject) => {
      const sql = `SELECT P.*, G.name as group_name, G.groupstyle as group_style, 
                F.name as firewall_name, F.options as firewall_options,
                IF(P.mark>0, (select code from mark where id=P.mark), 0) as mark_code,
                IF(P.mark>0, (select name from mark where id=P.mark), 0) as mark_name
                FROM ${tableName} P
                LEFT JOIN policy_g G ON G.id=P.idgroup
                LEFT JOIN firewall F ON F.id=(IF((P.fw_apply_to is NULL),${firewall},P.fw_apply_to))
                WHERE P.firewall=${firewall} AND P.type=${type}
                ${rules ? ` AND P.id IN (${rules.join(',')})` : ''}
                ${idgroup ? ` AND P.idgroup=${idgroup}` : ''} 
                ORDER BY P.rule_order`;

      dbCon.query(sql, async (error, rulesData) => {
        if (error) return reject(error);
        if (rulesData.length === 0) return resolve(null);

        try {
          // Positions will be always the same for all rules into the same policy type.
          const positions: PositionNode[] = await PolicyPosition.getRulePositions(
            dbCon,
            fwcloud,
            rulesData[0].firewall,
            rulesData[0].id,
            rulesData[0].type,
          );

          // Init the map for access the position objects array for each rule and position.
          const rulePositionsMap: RulePosMap = new Map<string, []>();
          for (let i = 0; i < rulesData.length; i++) {
            if (rulesData[i].idgroup && ignoreGroupsData) continue;

            // Clone the positions array and generate new ipobjs arrays for each position.
            rulesData[i].positions = positions.map((a) => ({ ...a }));
            for (let j = 0; j < positions.length; j++) rulesData[i].positions[j].ipobjs = [];

            // Map each rule id and position with it's corresponding ipobjs array.
            // These ipobjs array will be filled with objects data in the Promise.all()
            // next to the outer for loop.
            for (let j = 0; j < positions.length; j++)
              rulePositionsMap.set(
                `${rulesData[i].id}:${positions[j].id}`,
                rulesData[i].positions[j].ipobjs,
              );
          }

          const sqls =
            dst === 'compiler'
              ? this.buildSQLsForCompiler(firewall, type, rules)
              : this.buildSQLsForGrid(firewall, type, rules);
          await Promise.all(sqls.map((sql) => this.mapPolicyData(dbCon, rulePositionsMap, sql)));

          resolve(rulesData);
        } catch (error) {
          reject(error);
        }
      });
    });
  }

  //Get policy_r by  id  and firewall
  public static getPolicy_r(dbCon, firewall, rule) {
    return new Promise((resolve, reject) => {
      const sql = `SELECT P.*, F.fwcloud, 
		  (select MAX(rule_order) from ${tableName} where firewall=P.firewall and type=P.type) as max_order,
			(select MIN(rule_order) from ${tableName} where firewall=P.firewall and type=P.type) as min_order
			FROM ${tableName} P INNER JOIN firewall F on F.id=P.firewall WHERE P.id=${rule} AND P.firewall=${firewall}`;

      dbCon.query(sql, (error, result) => {
        if (error) return reject(error);
        if (result.length === 0) return reject(fwcError.NOT_FOUND);
        resolve(result[0]);
      });
    });
  }

  //Get policy_r by  id
  public static getPolicy_r_id(id, callback) {
    db.get((error, connection) => {
      if (error) callback(error, null);

      const sql =
        'SELECT P.*, F.fwcloud ' +
        ' FROM ' +
        tableName +
        ' P INNER JOIN firewall F on F.id=P.firewall  WHERE P.id = ' +
        connection.escape(id);

      connection.query(sql, (error, row) => {
        if (error) {
          logger().debug(error);
          callback(error, null);
        } else callback(null, row);
      });
    });
  }

  //Get rule type for a rule
  public static getPolicyRuleType(dbCon, fwcloud, firewall, rule) {
    return new Promise((resolve, reject) => {
      const sql = `SELECT R.type FROM ${tableName} R
				inner join firewall F on F.id=R.firewall
				WHERE F.fwcloud=${fwcloud} and R.firewall=${firewall} AND R.id=${rule}`;

      dbCon.query(sql, async (error, result) => {
        if (error) return reject(error);
        resolve(result[0].type);
      });
    });
  }

  //Get rule type for a rule
  public static getPolicyRuleIPversion(dbCon, fwcloud, firewall, rule) {
    return new Promise((resolve, reject) => {
      const sql = `SELECT R.type FROM ${tableName} R
				inner join firewall F on F.id=R.firewall
				WHERE F.fwcloud=${fwcloud} and R.firewall=${firewall} AND R.id=${rule}`;

      dbCon.query(sql, async (error, result) => {
        if (error) return reject(error);
        if (result.length !== 1) return reject(fwcError.NOT_FOUND);

        const policy_type = result[0].type;
        if (policy_type >= 1 && policy_type <= 5) resolve(4);
        else if (policy_type >= 61 && policy_type <= 65) resolve(6);
        else reject(fwcError.other('Bad policy type'));
      });
    });
  }

  //Get last rule_order by firewall and policy type.
  public static getLastRuleOrder(dbCon, firewall, type) {
    return new Promise((resolve, reject) => {
      const sql = `SELECT rule_order FROM ${tableName} 
				WHERE firewall=${firewall} AND type=${type} ORDER BY rule_order desc limit 1`;

      dbCon.query(sql, async (error, result) => {
        if (error) return reject(error);
        resolve(result.length === 0 ? 1 : result[0].rule_order);
      });
    });
  }

  //Get policy_r  GROUP by  NEXT or Previous RULE
  public static getPolicy_r_DestGroup(idfirewall, offset, order, type, callback) {
    db.get((error, connection) => {
      let nextRuleStr;

      if (error) return callback(error, null);

      if (offset > 0) nextRuleStr = ' > ';
      else nextRuleStr = ' < ';

      const sql =
        'SELECT id, idgroup, rule_order ' +
        ' FROM ' +
        tableName +
        '  WHERE rule_order ' +
        nextRuleStr +
        connection.escape(order) +
        ' AND type= ' +
        connection.escape(type) +
        ' AND firewall=' +
        connection.escape(idfirewall) +
        ' LIMIT 1';
      connection.query(sql, (error, row) => {
        if (error) {
          logger().debug(error);
          callback(error, null);
        } else callback(null, row);
      });
    });
  }

  //Get routing by name and firewall and group
  public static getPolicy_rName(idfirewall, idgroup, name, callback) {
    db.get((error, connection) => {
      if (error) callback(error, null);
      const namesql = '%' + name + '%';
      let whereGroup = '';
      if (idgroup !== '') {
        whereGroup = ' AND group=' + connection.escape(idgroup);
      }
      const sql =
        'SELECT * FROM ' +
        tableName +
        ' WHERE name like  ' +
        connection.escape(namesql) +
        ' AND firewall=' +
        connection.escape(idfirewall) +
        whereGroup;
      logger().debug(sql);
      connection.query(sql, (error, row) => {
        if (error) callback(error, null);
        else callback(null, row);
      });
    });
  }

  public static insertDefaultPolicy(fwId, loInterfaceId, options): Promise<void> {
    return new Promise(async (resolve, reject) => {
      const policy_rData = {
        id: null,
        idgroup: null,
        firewall: fwId,
        rule_order: 1,
        action: 2,
        time_start: null,
        time_end: null,
        active: 1,
        options: 0,
        comment: '',
        type: 0,
        special: 0,
        style: null,
      };

      const policy_r__interfaceData = {
        rule: null,
        interface: loInterfaceId,
        position: 20,
        position_order: 1,
      };

      const policy_r__ipobjData = {
        rule: null,
        ipobj: -1,
        ipobj_g: 5,
        interface: -1,
        position: 3,
        position_order: 1,
      };

      try {
        /**************************************/
        /* Generate the default INPUT policy. */
        /**************************************/
        policy_rData.action = 1;

        if (options & FireWallOptMask.STATEFUL) {
          // Statefull firewall
          policy_rData.special = 1;
          policy_rData.comment = 'Stateful firewall rule.';
          policy_rData.type = 1; // INPUT IPv4
          await this.insertPolicy_r(policy_rData);
          policy_rData.type = 61; // INPUT IPv6
          await this.insertPolicy_r(policy_rData);
        }

        if (loInterfaceId) {
          // Allow all incoming traffic from self host.
          policy_rData.special = 0;
          policy_rData.rule_order = 2;
          policy_rData.comment = 'Allow all incoming traffic from self host.';
          policy_rData.type = 1; // INPUT IPv4
          policy_r__interfaceData.rule = await this.insertPolicy_r(policy_rData);
          policy_r__interfaceData.position = 20;
          await PolicyRuleToInterface.insertPolicy_r__interface(fwId, policy_r__interfaceData);
          policy_rData.type = 61; // INPUT IPv6
          policy_r__interfaceData.rule = await this.insertPolicy_r(policy_rData);
          policy_r__interfaceData.position = 51;
          await PolicyRuleToInterface.insertPolicy_r__interface(fwId, policy_r__interfaceData);

          // Allow useful ICMP traffic.
          policy_rData.rule_order = 3;
          policy_rData.comment = 'Allow useful ICMP.';
          policy_rData.type = 1; // INPUT IPv4
          policy_r__ipobjData.rule = await this.insertPolicy_r(policy_rData);
          policy_r__ipobjData.position = 3;
          await PolicyRuleToIPObj.insertPolicy_r__ipobj(policy_r__ipobjData);
          policy_rData.type = 61; // INPUT IPv6
          policy_r__ipobjData.rule = await this.insertPolicy_r(policy_rData);
          policy_r__ipobjData.position = 39;
          await PolicyRuleToIPObj.insertPolicy_r__ipobj(policy_r__ipobjData);
        }

        // Now create the catch all rule.
        policy_rData.action = 2;
        policy_rData.rule_order = 4;
        policy_rData.special = 2;
        policy_rData.comment = 'Catch-all rule.';
        policy_rData.type = 1; // INPUT IPv4
        await this.insertPolicy_r(policy_rData);
        policy_rData.type = 61; // INPUT IPv6
        await this.insertPolicy_r(policy_rData);
        /**************************************/

        /****************************************/
        /* Generate the default FORWARD policy. */
        /****************************************/
        if (options & FireWallOptMask.STATEFUL) {
          // Statefull firewall
          policy_rData.special = 1;
          policy_rData.rule_order = 1;
          policy_rData.action = 1;
          policy_rData.comment = 'Stateful firewall rule.';
          policy_rData.type = 3; // FORWARD IPv4
          await this.insertPolicy_r(policy_rData);
          policy_rData.type = 63; // FORWARD IPv6
          await this.insertPolicy_r(policy_rData);
        }

        policy_rData.special = 0;
        policy_rData.rule_order = 2;
        policy_rData.action = 2;
        policy_rData.special = 2;
        policy_rData.comment = 'Catch-all rule.';
        policy_rData.type = 3; // FORWARD IPv4
        await this.insertPolicy_r(policy_rData);
        policy_rData.type = 63; // FORWARD IPv6
        await this.insertPolicy_r(policy_rData);
        /****************************************/

        /***************************************/
        /* Generate the default OUTPUT policy. */
        /***************************************/
        policy_rData.action = 1; // For the OUTPUT chain by default allow all traffic.

        if (options & FireWallOptMask.STATEFUL) {
          // Statefull firewall
          policy_rData.special = 1;
          policy_rData.rule_order = 1;
          policy_rData.comment = 'Stateful firewall rule.';
          policy_rData.type = 2; // OUTPUT IPv4
          await this.insertPolicy_r(policy_rData);
          policy_rData.type = 62; // OUTPUT IPv6
          await this.insertPolicy_r(policy_rData);
        }

        policy_rData.special = 0;
        policy_rData.rule_order = 2;
        policy_rData.special = 2;
        policy_rData.options = 2; // Make the default output rule stateless.
        policy_rData.comment = 'Catch-all rule.';
        policy_rData.type = 2; // OUTPUT IPv4
        await this.insertPolicy_r(policy_rData);
        policy_rData.type = 62; // OUTPUT IPv6
        await this.insertPolicy_r(policy_rData);
        /***************************************/

        resolve();
      } catch (error) {
        return reject(error);
      }
    });
  }

  //Add new policy_r from user
  public static insertPolicy_r(policy_rData): Promise<number> {
    return new Promise((resolve, reject) => {
      db.get((error, connection) => {
        if (error) return reject(error);

        connection.query('INSERT INTO ' + tableName + ' SET ?', policy_rData, (error, result) => {
          if (error) return reject(error);
          resolve(result.insertId);
        });
      });
    });
  }

  //Clone policy and IPOBJ
  public static cloneFirewallPolicy(dbCon, idfirewall, idNewFirewall, dataI): Promise<void> {
    return new Promise((resolve, reject) => {
      this.clon_data = dataI;
      const sql = `select ${idNewFirewall} as newfirewall, P.*
			from policy_r P
			where P.firewall=${idfirewall}`;
      dbCon.query(sql, async (error, rows) => {
        if (error) return reject(error);

        //Bucle por policy clone process.
        try {
          await Promise.all(rows.map((data) => this.clonePolicy(data)));
          await PolicyGroup.clonePolicyGroups(idfirewall, idNewFirewall);
          resolve();
        } catch (error) {
          reject(error);
        }
      });
    });
  }

  public static clonePolicy(rowData): Promise<void> {
    return new Promise((resolve, reject) => {
      db.get(async (error, dbCon) => {
        if (error) return reject(error);

        //CREATE NEW POLICY
        const policy_rData = {
          id: null,
          idgroup: rowData.idgroup,
          firewall: rowData.newfirewall,
          rule_order: rowData.rule_order,
          action: rowData.action,
          time_start: rowData.time_start,
          time_end: rowData.time_end,
          active: rowData.active,
          options: rowData.options,
          comment: rowData.comment,
          type: rowData.type,
          style: rowData.style,
          fw_apply_to: rowData.fw_apply_to,
          negate: rowData.negate,
          mark: rowData.mark,
          special: rowData.special,
          run_before: rowData.run_before,
          run_after: rowData.run_after,
        };

        let newRule;
        try {
          newRule = await this.insertPolicy_r(policy_rData);
          await this.clonePolicyIpobj(dbCon, rowData.newfirewall, rowData.id, newRule);
          await this.clonePolicyInterface(dbCon, rowData.firewall, rowData.id, newRule);
          await PolicyRuleToOpenVPN.duplicatePolicy_r__openvpn(dbCon, rowData.id, newRule);
          await PolicyRuleToOpenVPNPrefix.duplicatePolicy_r__prefix(dbCon, rowData.id, newRule);
          resolve();
        } catch (error) {
          reject(error);
        }
      });
    });
  }

  public static clonePolicyIpobj(dbCon, newFirewall, oldRule, newRule): Promise<void> {
    return new Promise((resolve, reject) => {
      //SELECT ALL IPOBJ UNDER POSITIONS
      const sql = `select ${newFirewall} as newfirewall, ${newRule} as newrule, O.*
                from policy_r__ipobj O
                where O.rule=${oldRule} ORDER BY position_order`;
      dbCon.query(sql, async (error, rows) => {
        if (error) return reject(error);

        if (this.clon_data) {
          // clon_data is a global variable into this module.
          for (let i = 0; i < rows.length; i++) {
            for (const item of this.clon_data) {
              if (rows[i].ipobj === -1 && rows[i].interface !== -1) {
                // Replace interfaces IDs with interfaces IDs of the cloned firewall.
                if (rows[i].interface === item.id_org) {
                  rows[i].interface = item.id_clon;
                  break;
                }
              } else {
                // Replace ipobj IDs with ipobj IDs of the cloned firewall.
                let found = 0;
                for (const addr of item.addr) {
                  if (rows[i].ipobj === addr.id_org) {
                    rows[i].ipobj = addr.id_clon;
                    found = 1;
                    break;
                  }
                }
                if (found) break;
              }
            }
          }
        }

        try {
          //Bucle por IPOBJS
          await Promise.all(rows.map((data) => PolicyRuleToIPObj.clonePolicy_r__ipobj(data)));
          resolve();
        } catch (error) {
          return reject(error);
        }
      });
    });
  }

  public static clonePolicyInterface(dbCon, oldFirewall, oldRule, newRule): Promise<void> {
    return new Promise((resolve, reject) => {
      //SELECT ALL INTERFACES UNDER POSITIONS
      const sql = `select ${newRule} as newrule, I.id as newInterface, O.*
                from policy_r__interface O
                inner join interface I on I.id=O.interface
                where O.rule=${oldRule}	AND I.firewall=${oldFirewall} ORDER BY position_order`;
      dbCon.query(sql, async (error, rowsI) => {
        if (error) return reject(error);

        // Replace the interfaces IDs with interfaces IDs of the cloned firewall.
        if (this.clon_data) {
          // clon_data is a global variable into this module.
          for (let i = 0; i < rowsI.length; i++) {
            for (const item of this.clon_data) {
              if (rowsI[i].newInterface === item.id_org) {
                rowsI[i].newInterface = item.id_clon;
                break;
              }
            }
          }
        }

        //Bucle for INTERFACES
        try {
          await Promise.all(
            rowsI.map((data) => PolicyRuleToInterface.clonePolicy_r__interface(data)),
          );
          resolve();
        } catch (error) {
          reject(error);
        }
      });
    });
  }

  //Update policy_r from user
  public static updatePolicy_r(dbCon, policy_rData): Promise<void> {
    return new Promise((resolve, reject) => {
      let sql = 'UPDATE ' + tableName + ' SET ';
      if (typeof policy_rData.idgroup !== 'undefined')
        sql += 'idgroup=' + policy_rData.idgroup + ',';
      if (policy_rData.rule_order) sql += 'rule_order=' + policy_rData.rule_order + ',';
      if (policy_rData.action) sql += 'action=' + policy_rData.action + ',';
      if (policy_rData.time_start) sql += 'time_start=' + policy_rData.time_start + ',';
      if (policy_rData.time_end) sql += 'time_end=' + policy_rData.time_end + ',';
      if (typeof policy_rData.options !== 'undefined')
        sql += 'options=' + policy_rData.options + ',';
      if (policy_rData.active) sql += 'active=' + policy_rData.active + ',';
      if (policy_rData.comment !== undefined && policy_rData.comment !== null)
        sql += 'comment=' + dbCon.escape(policy_rData.comment) + ',';
      if (policy_rData.style) sql += 'style=' + dbCon.escape(policy_rData.style) + ',';
      if (typeof policy_rData.mark !== 'undefined') sql += 'mark=' + policy_rData.mark + ',';
      if (typeof policy_rData.fw_apply_to !== 'undefined')
        sql += 'fw_apply_to=' + policy_rData.fw_apply_to + ',';
      if (typeof policy_rData.run_before !== 'undefined')
        sql += 'run_before=' + dbCon.escape(policy_rData.run_before) + ',';
      if (typeof policy_rData.run_after !== 'undefined')
        sql += 'run_after=' + dbCon.escape(policy_rData.run_after) + ',';
      sql = sql.slice(0, -1) + ' WHERE id=' + policy_rData.id;

      dbCon.query(sql, async (error) => {
        if (error) return reject(error);
        resolve();
      });
    });
  }

  public static makeBeforeRuleOrderGap(firewall, type, rule): Promise<void> {
    return new Promise((resolve, reject) => {
      db.get((error, connection) => {
        if (error) return reject(error);

        let sql =
          'SELECT rule_order FROM ' +
          tableName +
          ' WHERE firewall=' +
          firewall +
          ' AND type=' +
          type +
          ' AND rule_order<(select rule_order from ' +
          tableName +
          ' where id=' +
          rule +
          ') ORDER BY rule_order DESC LIMIT 1';
        connection.query(sql, (error, result) => {
          if (error) return reject(error);

          let free_rule_order;
          let cond = '';
          if (result.length === 1) {
            free_rule_order = result[0].rule_order + 1;
            cond = '>' + result[0].rule_order;
          } else {
            free_rule_order = 1;
            cond = '>0';
          }

          sql =
            'UPDATE ' +
            tableName +
            ' SET rule_order=rule_order+1' +
            ' WHERE firewall=' +
            firewall +
            ' AND type=' +
            type +
            ' AND rule_order' +
            cond;
          connection.query(sql, async (error) => {
            if (error) return reject(error);
            resolve(free_rule_order);
          });
        });
      });
    });
  }

  public static makeAfterRuleOrderGap(firewall, type, rule) {
    return new Promise((resolve, reject) => {
      db.get((error, connection) => {
        if (error) return reject(error);

        let sql =
          'SELECT rule_order FROM ' +
          tableName +
          ' WHERE firewall=' +
          firewall +
          ' AND type=' +
          type +
          ' AND id=' +
          rule;
        connection.query(sql, (error, result) => {
          if (error) return reject(error);

          if (result.length === 1) {
            //const result_rule_order = result[0].rule_order;
            const free_rule_order = result[0].rule_order + 1;
            sql =
              'UPDATE ' +
              tableName +
              ' SET rule_order=rule_order+1' +
              ' WHERE firewall=' +
              firewall +
              ' AND type=' +
              type +
              ' AND rule_order>' +
              result[0].rule_order;
            connection.query(sql, async (error) => {
              if (error) return reject(error);
              resolve(free_rule_order);
            });
          } else return reject(fwcError.other('Rule not found'));
        });
      });
    });
  }

  public static reorderAfterRuleOrder(dbCon, firewall, type, rule_order): Promise<void> {
    return new Promise((resolve, reject) => {
      const sql =
        'UPDATE ' +
        tableName +
        ' SET rule_order=rule_order+1' +
        ' WHERE firewall=' +
        firewall +
        ' AND type=' +
        type +
        ' AND rule_order>=' +
        rule_order;
      dbCon.query(sql, async (error) => {
        if (error) return reject(error);
        resolve();
      });
    });
  }

  //Remove All policy_r from firewall
  public static async deletePolicy_r_Firewall(idfirewall): Promise<void> {
    return new Promise((resolve, reject) => {
      db.get((error, connection) => {
        if (error) return reject(error);

        const sql =
          'SELECT  I.*   FROM ' +
          tableName +
          ' I ' +
          ' WHERE (I.firewall=' +
          connection.escape(idfirewall) +
          ') ';
        connection.query(sql, async (error, rows) => {
          if (error) return reject(error);
          //Bucle por reglas
          Promise.all(rows.map((data) => this.deletePolicy_rPro(data)))
            .then(async () => {
              await PolicyGroup.deleteFirewallGroups(idfirewall);
            })
            .then(() => resolve())
            .catch((error) => reject(error));
        });
      });
    });
  }

  public static deletePolicy_rPro(data) {
    return new Promise((resolve, reject) => {
      this.deletePolicy_r(data.firewall, data.id)
        .then((resp) => {
          resolve(resp);
        })
        .catch((e) => {
          reject(e);
        });
    });
  }

  //Remove policy_r with id to remove
  public static deletePolicy_r(firewall, rule) {
    return new Promise((resolve, reject) => {
      db.get((error, dbCon) => {
        if (error) return reject(error);

        //DELETE FROM policy_r__ipobj
        PolicyRuleToIPObj.deletePolicy_r__All(rule, (error) => {
          if (error) return reject(error);
          //DELETE FROM policy_r__interface
          PolicyRuleToInterface.deletePolicy_r__All(rule, async (error) => {
            if (error) return reject(error);

            try {
              await PolicyRuleToOpenVPN.deleteFromRule(dbCon, rule);
              await PolicyRuleToOpenVPNPrefix.deleteFromRule(dbCon, rule);
            } catch (error) {
              return reject(error);
            }

            // DELETE FULE
            dbCon.query(
              `DELETE FROM ${tableName} WHERE id=${rule} AND firewall=${firewall}`,
              (error, result) => {
                if (error) return reject(error);

                if (result.affectedRows > 0) {
                  resolve({ result: true, msg: 'deleted' });
                } else resolve({ result: false, msg: 'notExist' });
              },
            );
          });
        });
      });
    });
  }

  public static cleanApplyTo(idfirewall, callback) {
    db.get((error, connection) => {
      if (error) callback(error);

      const sql =
        'UPDATE ' +
        tableName +
        ' SET fw_apply_to=null WHERE firewall=' +
        connection.escape(idfirewall);
      connection.query(sql, async (error) => {
        if (error) {
          callback(error, null);
        } else {
          callback(null, { result: true });
        }
      });
    });
  }

  //Update apply_to fields of a cloned cluster to point to the new cluster nodes.
  public static updateApplyToRules(clusterNew, fwNewMaster) {
    return new Promise((resolve, reject) => {
      db.get((error, connection) => {
        if (error) return reject(error);
        const sql =
          'select P.id,P.fw_apply_to,(select name from firewall where id=P.fw_apply_to) as name,' +
          clusterNew +
          ' as clusterNew FROM ' +
          tableName +
          ' P' +
          ' INNER JOIN firewall F on F.id=P.firewall' +
          ' WHERE P.fw_apply_to is not NULL AND P.firewall=' +
          connection.escape(fwNewMaster) +
          ' AND F.cluster=' +
          connection.escape(clusterNew);
        connection.query(sql, (error, rows) => {
          if (error) return reject(error);
          //Bucle for rules with fw_apply_to defined.
          Promise.all(rows.map((data) => this.repointApplyTo(data)))
            .then((data) => resolve(data))
            .catch((e) => reject(e));
        });
      });
    });
  }

  public static repointApplyTo(rowData) {
    return new Promise((resolve, reject) => {
      db.get((error, connection) => {
        if (error) return reject(error);

        let sql =
          'select id FROM firewall' +
          ' WHERE cluster=' +
          connection.escape(rowData.clusterNew) +
          ' AND name=' +
          connection.escape(rowData.name);
        connection.query(sql, (error, rows) => {
          if (error) return reject(error);

          if (rows.length === 1)
            sql =
              'UPDATE ' +
              tableName +
              ' set fw_apply_to=' +
              connection.escape(rows[0].id) +
              ' WHERE id=' +
              connection.escape(rowData.id);
          // We have not found the node in the new cluster.
          else
            sql =
              'UPDATE ' +
              tableName +
              ' set fw_apply_to=NULL WHERE id=' +
              connection.escape(rowData.id);

          connection.query(sql, async (error, rows1) => {
            if (error) return reject(error);
            resolve(rows1);
          });
        });
      });
    });
  }

  //Negate rule position.
  public static negateRulePosition(dbCon, firewall, rule, position): Promise<void> {
    return new Promise((resolve, reject) => {
      let sql = `select negate from ${tableName} where id=${rule} and firewall=${firewall}`;
      dbCon.query(sql, (error, result) => {
        if (error) return reject(error);
        if (result.length !== 1) return reject(fwcError.other('Firewall rule not found'));

        let negate;
        if (!result[0].negate) negate = `${position}`;
        else {
          const negate_position_list = result[0].negate.split(' ').map((val) => {
            return parseInt(val);
          });
          // If the position that we want negate is already in the list, don't add again to the list.
          for (const pos of negate_position_list) {
            if (pos === position) return resolve();
          }
          negate = `${result[0].negate} ${position}`;
        }

        sql = `update ${tableName} set negate=${dbCon.escape(negate)} where id=${rule} and firewall=${firewall}`;
        dbCon.query(sql, async (error) => {
          if (error) return reject(error);
          resolve();
        });
      });
    });
  }

  //Allow rule position.
  public static allowRulePosition(dbCon, firewall, rule, position): Promise<void> {
    return new Promise((resolve, reject) => {
      let sql = `select negate from ${tableName} where id=${rule} and firewall=${firewall}`;
      dbCon.query(sql, (error, result) => {
        if (error) return reject(error);
        if (result.length !== 1) return reject(fwcError.other('Firewall rule not found'));

        // Rule position negated list is empty.
        if (!result[0].negate) return resolve();

        const negate_position_list = result[0].negate.split(' ').map((val) => {
          return parseInt(val);
        });
        const new_negate_position_list = [];
        for (const pos of negate_position_list) {
          if (pos !== position) new_negate_position_list.push(pos);
        }
        const negate =
          new_negate_position_list.length === 0 ? null : new_negate_position_list.join(' ');

        sql = `update ${tableName} set negate=${dbCon.escape(negate)} where id=${rule} and firewall=${firewall}`;
        dbCon.query(sql, async (error) => {
          if (error) return reject(error);
          resolve();
        });
      });
    });
  }

  //Allow all positions of a rule that are empty.
  public static allowEmptyRulePositions(req: any): Promise<void> {
    return new Promise(async (resolve, reject) => {
      try {
        req.body.type = await this.getPolicyRuleType(
          req.dbCon,
          req.body.fwcloud,
          req.body.firewall,
          req.body.rule,
        );
        const data = await this.getPolicyData(
          'grid',
          req.dbCon,
          req.body.fwcloud,
          req.body.firewall,
          req.body.type,
          [req.body.rule],
          null,
        );
        for (const pos of data[0].positions) {
          if (pos.ipobjs.length === 0)
            await this.allowRulePosition(req.dbCon, req.body.firewall, req.body.rule, pos.id);
        }
      } catch (error) {
        return reject(error);
      }

      resolve();
    });
  }

  //Allow all positions of a rule that are empty.
  public static firewallWithMarkRules(dbCon, firewall) {
    return new Promise((resolve, reject) => {
      dbCon.query(
        `select id from ${tableName} where firewall=${firewall} and mark!=0`,
        (error, result) => {
          if (error) return reject(error);
          resolve(result.length > 0 ? true : false);
        },
      );
    });
  }

  //Move rules from one firewall to other.
  public static moveToOtherFirewall(dbCon, src_firewall, dst_firewall): Promise<void> {
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

  // Check that the catch-all special rule exists. If not, create it.
  public static checkCatchAllRules(dbCon: Query, firewall: number): Promise<void> {
    return new Promise(async (resolve, reject) => {
      const policy_rData = {
        id: null,
        idgroup: null,
        firewall: firewall,
        rule_order: null,
        action: null,
        time_start: null,
        time_end: null,
        active: 1,
        options: 0,
        comment: 'Catch-all rule.',
        type: null,
        special: SpecialPolicyRules.CATCHALL,
        style: null,
      };

      try {
        for (policy_rData.type of [1, 2, 3, 61, 62, 63]) {
          // INPUT, OUTPUT and FORWARD chains for IPv4 and IPv6
          if (policy_rData.type === 2 || policy_rData.type === 62)
            // OUTPUT chains for IPv4 and IPv6
            policy_rData.action = 1; // ACCEPT
          else policy_rData.action = 2; // DENY
          policy_rData.rule_order = await this.getLastRuleOrder(dbCon, firewall, policy_rData.type);
          const rule_id = await this.existsSpecialRule(
            dbCon,
            firewall,
            SpecialPolicyRules.CATCHALL,
            policy_rData.type,
          );

          if (!rule_id) {
            // If catch-all special rule don't exists create it.
            policy_rData.rule_order++;
            await this.insertPolicy_r(policy_rData);
          } else {
            // If catch-all rule exists, verify that is the last one.
            const rule_data: any = await this.getPolicy_r(dbCon, firewall, rule_id);
            if (rule_data.rule_order < policy_rData.rule_order) {
              // If it is not the last one, move to the last one position.
              await this.updatePolicy_r(dbCon, {
                id: rule_id,
                rule_order: policy_rData.rule_order + 1,
              });
            }
          }
        }
      } catch (error) {
        return reject(error);
      }
      resolve();
    });
  }

  // Returns true if firewall is not part of a cluster or if it is part of a cluster and it is the master node of the cluster.
  public static aloneFirewallOrMasterNode(dbCon: Query, firewall: number): Promise<boolean> {
    return new Promise((resolve, reject) => {
      dbCon.query(
        `select id from firewall where id=${firewall} and (cluster is null or fwmaster=1)`,
        async (error, result) => {
          if (error) return reject(error);

          // No result means that the firewall is part of a cluster and it is not the master node.
          resolve(result.length === 0 ? false : true);
        },
      );
    });
  }

  // Check if exists the catch all special rule by firewall and type.
  public static existsSpecialRule(
    dbCon: Query,
    firewall: number,
    specialRule: SpecialPolicyRules,
    type?: number,
  ): Promise<number> {
    return new Promise((resolve, reject) => {
      const sql = `select id from ${tableName} where firewall=${firewall} ${type ? `and type=${type}` : ''} and special=${specialRule}`;
      dbCon.query(sql, async (error, result) => {
        if (error) return reject(error);
        resolve(result.length > 0 ? result[0].id : 0);
      });
    });
  }

  public static createSpecialRule(
    dbCon: Query,
    firewall: number,
    specialRule: SpecialPolicyRules,
  ): Promise<void> {
    return new Promise(async (resolve, reject) => {
      const policy_rData = {
        id: null,
        idgroup: null,
        firewall: firewall,
        rule_order: 1,
        action: 1, // ACCEPT
        time_start: null,
        time_end: null,
        active: 1,
        options: 0,
        comment: '',
        type: 1,
        special: specialRule,
        style: null,
        run_before: null,
      };

      let policyType: number[] = [];

      try {
        switch (specialRule) {
          case SpecialPolicyRules.STATEFUL:
            policy_rData.comment = 'Stateful firewall rule.';
            policyType = [
              PolicyTypesMap.get('IPv4:INPUT'),
              PolicyTypesMap.get('IPv4:OUTPUT'),
              PolicyTypesMap.get('IPv4:FORWARD'),
              PolicyTypesMap.get('IPv6:INPUT'),
              PolicyTypesMap.get('IPv6:OUTPUT'),
              PolicyTypesMap.get('IPv6:FORWARD'),
            ];
            break;

          case SpecialPolicyRules.DOCKER:
            /* Do nothing, because the only solution for integrate Docker with FWCloud is disable the option
                    that allows Docker to create IPTables rules. */
            break;

          case SpecialPolicyRules.CROWDSEC:
            policy_rData.comment = 'CrowdSec firewall bouncer compatibility.';
            policy_rData.action = 2;
            policyType = [
              PolicyTypesMap.get('IPv4:INPUT'),
              PolicyTypesMap.get('IPv4:FORWARD'),
              PolicyTypesMap.get('IPv6:INPUT'),
              PolicyTypesMap.get('IPv6:FORWARD'),
            ];
            break;

          case SpecialPolicyRules.FAIL2BAN:
            policy_rData.comment = 'Fail2Ban compatibility.';
            policy_rData.run_before = 'systemctl restart fail2ban';
            policyType = [PolicyTypesMap.get('IPv4:INPUT')];
            break;
        }

        for (policy_rData.type of policyType) {
          await this.reorderAfterRuleOrder(dbCon, firewall, policy_rData.type, 1);
          await this.insertPolicy_r(policy_rData);
        }
      } catch (error) {
        return reject(error);
      }

      resolve();
    });
  }

  public static deleteSpecialRule(
    dbCon: Query,
    firewall: number,
    specialRule: SpecialPolicyRules,
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      dbCon.query(
        `delete from ${tableName} where firewall=${firewall} and special=${specialRule}`,
        async (error) => {
          if (error) return reject(error);
          resolve();
        },
      );
    });
  }

  public static checkSpecialRule(
    dbCon: Query,
    firewall: number,
    options: number,
    specialRule: SpecialPolicyRules,
  ): Promise<void> {
    return new Promise(async (resolve, reject) => {
      try {
        // Special rule is enabled in the options flags.
        if (options & SpecialRuleToFireWallOptMask.get(specialRule)) {
          // Special rule already exists, then nothing to do.
          if (await this.existsSpecialRule(dbCon, firewall, specialRule)) return resolve();

          // If special rule is enabled and it doesn't exists, then create it.
          await this.createSpecialRule(dbCon, firewall, specialRule);
        } else {
          // Special rule is not enabled, then make sure that it doesn't exists.
          await this.deleteSpecialRule(dbCon, firewall, specialRule);
        }
      } catch (error) {
        return reject(error);
      }
      resolve();
    });
  }

  public static checkSpecialRules(dbCon: Query, firewall: number, options: number): Promise<void> {
    return new Promise(async (resolve, reject) => {
      try {
        // If firewall is not an alone firewall or it is in a cluster but it is not the cluster's master node,
        // then nothing must be done.
        if (!(await this.aloneFirewallOrMasterNode(dbCon, firewall))) return resolve();

        // All the firewalls must have the catch all rules.
        await this.checkCatchAllRules(dbCon, firewall);

        // If this a stateful firewall verify that the stateful special rules exists.
        // Or remove them if this is not a stateful firewall.
        await this.checkSpecialRule(dbCon, firewall, options, SpecialPolicyRules.STATEFUL);

        // Compatibility rules with other software solutions.
        await this.checkSpecialRule(dbCon, firewall, options, SpecialPolicyRules.DOCKER);
        await this.checkSpecialRule(dbCon, firewall, options, SpecialPolicyRules.CROWDSEC);
        await this.checkSpecialRule(dbCon, firewall, options, SpecialPolicyRules.FAIL2BAN);
      } catch (error) {
        return reject(error);
      }

      resolve();
    });
  }
}
