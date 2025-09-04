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

import Model from '../../Model';
import {
  PrimaryGeneratedColumn,
  Column,
  Entity,
  JoinTable,
  JoinColumn,
  ManyToMany,
  OneToMany,
  ManyToOne,
} from 'typeorm';
import { WireGuard } from './WireGuard';
import { Tree } from '../../tree/Tree';
import { IPObjGroup } from '../../ipobj/IPObjGroup';
import { Firewall } from '../../firewall/Firewall';
import { RoutingRule } from '../../routing/routing-rule/routing-rule.model';
import { Route } from '../../routing/route/route.model';
import db from '../../../database/database-manager';
import { RouteToWireGuardPrefix } from '../../routing/route/route-to-wireguard-prefix.model';
import { RoutingRuleToWireGuardPrefix } from '../../routing/routing-rule/routing-rule-to-wireguard-prefix.model';
import { PolicyRuleToWireGuardPrefix } from '../../policy/PolicyRuleToWireguardPrefix';
import fwcError from '../../../utils/error_table';
import Query from '../../../database/Query';
import { Request } from 'express';

const tableName: string = 'wireguard_prefix';

@Entity(tableName)
export class WireGuardPrefix extends Model {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'wireguard' })
  wireGuardId: number;

  @Column()
  name: string;

  @ManyToMany((type) => IPObjGroup, (ipObjGroup) => ipObjGroup.wireGuardPrefixes)
  @JoinTable({
    name: 'wireguard_prefix__ipobj_g',
    joinColumn: {
      name: 'prefix',
    },
    inverseJoinColumn: {
      name: 'ipobj_g',
    },
  })
  ipObjGroups: Array<IPObjGroup>;

  @ManyToOne((type) => WireGuard, (model) => model.wireGuardPrefixes)
  @JoinColumn({
    name: 'wireguard',
  })
  wireGuard: WireGuard;

  @OneToMany(
    (type) => PolicyRuleToWireGuardPrefix,
    (policyRuleToWireGuardPrefix) => policyRuleToWireGuardPrefix.wireGuardPrefix,
  )
  policyRuleToWireGuardPrefixes: Array<PolicyRuleToWireGuardPrefix>;

  @OneToMany(() => RoutingRuleToWireGuardPrefix, (model) => model.wireGuardPrefix)
  routingRuleToWireGuardPrefixes: RoutingRuleToWireGuardPrefix[];

  @OneToMany(() => RouteToWireGuardPrefix, (model) => model.wireGuardPrefix)
  routeToWireGuardPrefixes: RouteToWireGuardPrefix[];

  public getTableName(): string {
    return tableName;
  }

  // Validate new prefix container.
  public static existsPrefix(dbCon: Query, wireGuard: number, name: string) {
    return new Promise((resolve, reject) => {
      dbCon.query(
        `SELECT id FROM ${tableName} WHERE wireguard=${wireGuard} AND name=${dbCon.escape(name)}`,
        (error, result) => {
          if (error) return reject(error);
          resolve(result.length > 0);
        },
      );
    });
  }

  // Add new prefix container.
  public static createPrefix(req: Request) {
    return new Promise((resolve, reject) => {
      const prefixData = {
        id: null,
        name: req.body.name,
        wireguard: req.body.wireguard,
      };
      req.dbCon.query(
        `INSERT INTO ${tableName} (id, name, wireguard) VALUES (?, ?, ?)`,
        [prefixData.id, prefixData.name, prefixData.wireguard],
        (error, result) => {
          if (error) return reject(error);
          resolve(result.insertId);
        },
      );
    });
  }

  // Modify a CRT Prefix container.
  public static modifyPrefix(req: Request): Promise<void> {
    return new Promise((resolve, reject) => {
      req.dbCon.query(
        `UPDATE ${tableName} SET name=${req.dbCon.escape(req.body.name)} WHERE id=${req.body.prefix}`,
        (error) => {
          if (error) return reject(error);
          resolve();
        },
      );
    });
  }

  // Delete CRT Prefix container.
  public static deletePrefix(dbCon: Query, prefix: number): Promise<void> {
    return new Promise((resolve, reject) => {
      dbCon.query(`DELETE from ${tableName} WHERE id=${prefix}`, (error) => {
        if (error) return reject(error);
        resolve();
      });
    });
  }

  // Remove all prefixes under the indicated firewall.
  public static deletePrefixAll(dbCon: Query, fwcloud: number, firewall: number) {
    return new Promise((resolve, reject) => {
      const sql = `delete PRE from ${tableName} as PRE
                inner join wireguard VPN on VPN.id=PRE.wireguard
                inner join firewall FW on FW.id=VPN.firewall
                where FW.id=${firewall} and FW.fwcloud=${fwcloud}`;
      dbCon.query(sql, (error, result) => {
        if (error) return reject(error);
        resolve(result);
      });
    });
  }

  // Get all prefixes for the indicated wireGuard server.
  public static getPrefixes(dbCon: Query, wireGuard: number) {
    return new Promise((resolve, reject) => {
      dbCon.query(
        `SELECT id,name FROM ${tableName} WHERE wireguard=${wireGuard}`,
        (error, result) => {
          if (error) return reject(error);
          resolve(result);
        },
      );
    });
  }

  // Get all prefixes for the indicated CA.
  public static getWireGuardClientsUnderPrefix(
    dbCon: Query,
    wireGuard: number,
    prefix_name: string,
  ): Promise<unknown[]> {
    return new Promise((resolve, reject) => {
      const sql = `select WG.id from wireguard WG 
                inner join crt CRT on CRT.id=WG.crt
                where wireguard=${wireGuard} and CRT.cn LIKE '${prefix_name}%'`;
      dbCon.query(sql, (error, result) => {
        if (error) return reject(error);
        resolve(result);
      });
    });
  }

  // Get all prefixes that match the indicated WireGuard client.
  public static getWireGuardClientPrefixes(
    dbCon: any,
    wireGuard: number,
  ): Promise<{ id: number; name: string }[]> {
    return new Promise((resolve, reject) => {
      // First get all the WireGuard prefixes of the WireGuard server.
      const sql = `select P.id,P.name,CRT.cn from ${tableName} P
                inner join wireguard V1 on V1.id=P.wireguard    
                inner join wireguard V2 on V2.wireguard=V1.id
                inner join crt CRT on CRT.id=V2.crt    
                where V2.id=${wireGuard}`;
      dbCon.query(sql, (error: any, result: any) => {
        if (error) return reject(error);

        const matches: { id: number; name: string }[] = [];
        for (let i = 0; i < result.length; i++) {
          const pattern = new RegExp('^' + result[i].name, 'i');

          if (pattern.test(result[i].cn)) {
            matches.push({ id: result[i].id, name: result[i].name });
          }
        }

        resolve(matches);
      });
    });
  }

  // Activate the compile/install flags of all the firewalls that use prefixes that contains the WireGuard.
  public static updateWireGuardClientPrefixesFWStatus(
    dbCon: any,
    fwcloud: number,
    wireGuard: number,
  ): Promise<void> {
    return new Promise(async (resolve, reject) => {
      try {
        const prefixMatch = await WireGuardPrefix.getWireGuardClientPrefixes(dbCon, wireGuard);
        for (let i = 0; i < prefixMatch.length; i++) {
          const search: any = await WireGuardPrefix.searchPrefixUsage(
            dbCon,
            fwcloud,
            prefixMatch[i].id,
            true,
          );
          const PrefixInRule: any = search.restrictions.PrefixInRule;
          const PrefixInGroupIpRule: any = search.restrictions.PrefixInGroupInRule;

          for (let j = 0; j < PrefixInRule.length; j++)
            await Firewall.updateFirewallStatus(fwcloud, PrefixInRule[j].firewall_id, '|3');

          for (let j = 0; j < PrefixInGroupIpRule.length; j++)
            await Firewall.updateFirewallStatus(fwcloud, PrefixInGroupIpRule[j].firewall_id, '|3');
        }
      } catch (error) {
        return reject(error);
      }

      resolve();
    });
  }

  // Get information about a prefix used in an WireGuard server configuration.
  public static getPrefixWireGuardInfo(dbCon: Query, fwcloud: number, prefix: number) {
    return new Promise((resolve, reject) => {
      const sql = `select P.*, FW.id as firewall_id, FW.name as firewall_name, CRT.cn, CA.cn as ca_cn, FW.cluster as cluster_id,
                IF(FW.cluster is null,null,(select name from cluster where id=FW.cluster)) as cluster_name
                from wireguard_prefix P
                inner join wireguard WG on WG.id=P.wireguard
                inner join crt CRT on CRT.id=WG.crt
                inner join ca CA on CA.id=CRT.ca
                inner join firewall FW on FW.id=WG.firewall 
                where FW.fwcloud=? and P.id=?`;
      dbCon.query(sql, [fwcloud, prefix], async (error, result) => {
        if (error) return reject(error);
        if (result.length === 0) return reject(fwcError.NOT_FOUND);
        result[0].type = 402;
        result[0].wireguard_clients = [];
        try {
          const wireguard_clients: any = await this.getWireGuardClientsUnderPrefix(
            dbCon,
            result[0].wireguard,
            result[0].name,
          );
          for (const wireguard_client of wireguard_clients)
            result[0].wireguard_clients.push(
              (await WireGuard.getWireGuardInfo(dbCon, fwcloud, wireguard_client.id, 1))[0],
            );
        } catch (error) {
          return reject(error);
        }

        resolve(result);
      });
    });
  }

  // Fill prefix node with matching entries.
  public static fillPrefixNodeWireGuard(
    dbCon: Query,
    fwcloud: number,
    wireGuard_ser: number,
    prefix_name: string,
    prefix_id: number,
    parent: number,
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      // Move all affected nodes into the new prefix container node.
      const prefix = dbCon.escape(prefix_name).slice(1, -1);
      let sql = `SELECT WG.id,SUBSTRING(cn,${prefix.length + 1},255) as sufix FROM crt CRT
                INNER JOIN wireguard WG on WG.crt=CRT.id
                WHERE WG.wireguard=${wireGuard_ser} AND CRT.type=1 AND CRT.cn LIKE '${prefix}%'`;
      dbCon.query(sql, async (error, result) => {
        if (error) return reject(error);

        try {
          // Create the prefix and WireGuard client configuration nodes.
          const node_id = await Tree.newNode(
            dbCon,
            fwcloud,
            prefix_name,
            parent,
            'PRW',
            prefix_id,
            402,
          );
          for (const row of result)
            await Tree.newNode(dbCon, fwcloud, row.sufix, node_id, 'WGC', row.id, 321);
        } catch (error) {
          return reject(error);
        }

        if (result.length === 0) return resolve();

        // Remove from WireGuard server node the nodes that match de prefix.
        sql = `DELETE FROM fwc_tree WHERE id_parent=${parent} AND obj_type=321 AND name LIKE '${prefix}%'`;
        dbCon.query(sql, (error) => {
          if (error) return reject(error);
          resolve();
        });
      });
    });
  }

  // Apply WireGuard server prefixes to tree node.
  public static applyWireGuardPrefixes(
    dbCon: Query,
    fwcloud: number,
    wireGuard_srv: number,
  ): Promise<void> {
    return new Promise(async (resolve, reject) => {
      try {
        const node = await Tree.getNodeInfo(dbCon, fwcloud, 'WGS', wireGuard_srv);
        const node_id = node[0].id;
        // Remove all nodes under the WireGuard server configuration node.
        await Tree.deleteNodesUnderMe(dbCon, fwcloud, node_id);

        // Create all WireGuard client config nodes.
        const wireGuard_cli_list: any = await WireGuard.getWireGuardClientsInfo(
          dbCon,
          wireGuard_srv,
        );
        for (const wireGuard_cli of wireGuard_cli_list) {
          await Tree.newNode(
            dbCon,
            fwcloud,
            wireGuard_cli.cn,
            node_id,
            'WGC',
            wireGuard_cli.id,
            321,
          );
        }

        // Create the nodes for all the prefixes.
        const prefix_list: any = await this.getPrefixes(dbCon, wireGuard_srv);
        for (const prefix of prefix_list)
          await this.fillPrefixNodeWireGuard(
            dbCon,
            fwcloud,
            wireGuard_srv,
            prefix.name,
            prefix.id,
            node_id,
          );

        resolve();
      } catch (error) {
        return reject(error);
      }
    });
  }

  public static addPrefixToGroup(dbCon: any, prefix: number, ipobj_g: number) {
    return new Promise((resolve, reject) => {
      dbCon.query(
        `INSERT INTO wireguard_prefix__ipobj_g values(${prefix},${ipobj_g})`,
        (error: any, result: any) => {
          if (error) return reject(error);
          resolve(result.insertId);
        },
      );
    });
  }

  public static removePrefixFromGroup(req: Request) {
    return new Promise((resolve, reject) => {
      const sql = `DELETE FROM wireguard_prefix__ipobj_g WHERE prefix=${req.body.ipobj} AND ipobj_g=${req.body.ipobj_g}`;
      req.dbCon.query(sql, (error, result) => {
        if (error) return reject(error);
        resolve(result.insertId);
      });
    });
  }

  public static searchPrefixInRule(dbCon: Query, fwcloud: number, prefix: number) {
    return new Promise((resolve, reject) => {
      const sql = `select O.*, FW.id as firewall_id, FW.name as firewall_name,
                O.prefix obj_id, PRE.name obj_name,
                R.id as rule_id, R.type rule_type, (select id from ipobj_type where id=402) as obj_type_id,
                PT.name rule_type_name, O.position as rule_position_id, P.name rule_position_name,
                FW.cluster as cluster_id, IF(FW.cluster is null,null,(select name from cluster where id=FW.cluster)) as cluster_name
                from policy_r__wireguard_prefix O
                inner join policy_r R on R.id=O.rule
                inner join firewall FW on FW.id=R.firewall
                inner join policy_position P on P.id=O.position
                inner join policy_type PT on PT.id=R.type
                inner join wireguard_prefix PRE on PRE.id=O.prefix
                where FW.fwcloud=${fwcloud} and O.prefix=${prefix}`;
      dbCon.query(sql, (error, rows) => {
        if (error) return reject(error);
        resolve(rows);
      });
    });
  }

  public static searchPrefixInGroup(dbCon: Query, fwcloud: number, prefix: number) {
    return new Promise((resolve, reject) => {
      const sql = `select P.*, P.ipobj_g as group_id, G.name as group_name, G.type as group_type,
                (select id from ipobj_type where id=402) as obj_type_id, PRE.name obj_name
                from wireguard_prefix__ipobj_g P
                inner join wireguard_prefix PRE on PRE.id=P.prefix
                inner join ipobj_g G on G.id=P.ipobj_g
                where G.fwcloud=${fwcloud} and P.prefix=${prefix}`;
      dbCon.query(sql, (error, rows) => {
        if (error) return reject(error);
        resolve(rows);
      });
    });
  }

  public static searchPrefixUsage(
    dbCon: any,
    fwcloud: number,
    prefix: number,
    extendedSearch?: boolean,
  ) {
    return new Promise(async (resolve, reject) => {
      try {
        const search: any = {};
        search.result = false;
        search.restrictions = {};

        /* Verify that the WireGuard server prefix is not used in any
                    - Rule (table policy_r__wireGuard_prefix)
                    - IPBOJ group.
                */
        search.restrictions.PrefixInRule = await this.searchPrefixInRule(dbCon, fwcloud, prefix);
        search.restrictions.PrefixInGroup = await this.searchPrefixInGroup(dbCon, fwcloud, prefix);

        search.restrictions.PrefixInRoute = await this.searchPrefixInRoute(fwcloud, prefix);
        search.restrictions.PrefixInGroupInRoute = await this.searchPrefixInGroupInRoute(
          fwcloud,
          prefix,
        );
        search.restrictions.PrefixInRoutingRule = await this.searchPrefixInRoutingRule(
          fwcloud,
          prefix,
        );
        search.restrictions.PrefixInGroupInRoutingRule =
          await this.searchPrefixInGroupInRoutingRule(fwcloud, prefix);

        if (extendedSearch) {
          // Include the rules that use the groups in which the WireGuard prefix is being used.
          search.restrictions.PrefixInGroupInRule = [];
          for (let i = 0; i < search.restrictions.PrefixInGroup.length; i++) {
            const data: any = await IPObjGroup.searchGroupUsage(
              search.restrictions.PrefixInGroup[i].group_id,
              fwcloud,
            );
            search.restrictions.PrefixInGroupInRule.push(...data.restrictions.GroupInRule);
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

  public static async searchPrefixInRoute(fwcloud: number, prefix: number): Promise<any> {
    return await db
      .getSource()
      .manager.getRepository(Route)
      .createQueryBuilder('route')
      .addSelect('firewall.id', 'firewall_id')
      .addSelect('firewall.name', 'firewall_name')
      .addSelect('cluster.id', 'cluster_id')
      .addSelect('cluster.name', 'cluster_name')
      .innerJoin('route.routeToWireGuardPrefixes', 'routeToWireGuardPrefixes')
      .innerJoin('routeToWireGuardPrefixes.wireGuardPrefix', 'prefix', 'prefix.id = :prefix', {
        prefix: prefix,
      })
      .innerJoinAndSelect('route.routingTable', 'table')
      .innerJoin('table.firewall', 'firewall')
      .leftJoin('firewall.cluster', 'cluster')
      .where(`firewall.fwCloudId = :fwcloud`, { fwcloud: fwcloud })
      .getRawMany();
  }

  public static async searchPrefixInRoutingRule(fwcloud: number, prefix: number): Promise<any> {
    return await db
      .getSource()
      .manager.getRepository(RoutingRule)
      .createQueryBuilder('routing_rule')
      .addSelect('firewall.id', 'firewall_id')
      .addSelect('firewall.name', 'firewall_name')
      .addSelect('cluster.id', 'cluster_id')
      .addSelect('cluster.name', 'cluster_name')
      .innerJoin('routing_rule.routingRuleToWireGuardPrefixes', 'routingRuleToWireGuardPrefixes')
      .innerJoin(
        'routingRuleToWireGuardPrefixes.wireGuardPrefix',
        'prefix',
        'prefix.id = :prefix',
        {
          prefix: prefix,
        },
      )
      .innerJoin('routing_rule.routingTable', 'table')
      .innerJoin('table.firewall', 'firewall')
      .leftJoin('firewall.cluster', 'cluster')
      .where(`firewall.fwCloudId = :fwcloud`, { fwcloud: fwcloud })
      .getRawMany();
  }

  public static async searchPrefixInGroupInRoute(fwcloud: number, prefix: number): Promise<any> {
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
      .innerJoin('ipObjGroup.wireGuardPrefixes', 'prefix', 'prefix.id = :prefix', {
        prefix: prefix,
      })
      .innerJoin('table.firewall', 'firewall')
      .leftJoin('firewall.cluster', 'cluster')
      .where(`firewall.fwCloudId = :fwcloud`, { fwcloud: fwcloud })
      .getRawMany();
  }

  public static async searchPrefixInGroupInRoutingRule(
    fwcloud: number,
    prefix: number,
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
      .innerJoin('ipObjGroup.wireGuardPrefixes', 'prefix', 'prefix.id = :prefix', {
        prefix: prefix,
      })
      .innerJoin('routing_rule.routingTable', 'table')
      .innerJoin('table.firewall', 'firewall')
      .leftJoin('firewall.cluster', 'cluster')
      .where(`firewall.fwCloudId = :fwcloud`, { fwcloud: fwcloud })
      .getRawMany();
  }

  public static searchPrefixUsageOutOfThisFirewall(req: Request) {
    return new Promise((resolve, reject) => {
      // First get all firewalls prefixes for WireGuard configurations.
      const sql = `select P.id from ${tableName} P
                inner join wireguard VPN on VPN.id=P.wireguard
                where VPN.firewall=${req.body.firewall}`;

      req.dbCon.query(sql, async (error, result) => {
        if (error) return reject(error);

        const answer: any = {};
        answer.restrictions = {};
        answer.restrictions.PrefixInRule = [];
        answer.restrictions.PrefixInRoute = [];
        answer.restrictions.PrefixInRoutingRule = [];
        answer.restrictions.PrefixInGroup = [];

        try {
          for (const prefix of result) {
            const data: any = await this.searchPrefixUsage(req.dbCon, req.body.fwcloud, prefix.id);
            if (data.result) {
              answer.restrictions.PrefixInRule = answer.restrictions.PrefixInRule.concat(
                data.restrictions.PrefixInRule,
              );
              answer.restrictions.PrefixInRoute = answer.restrictions.PrefixInRoute.concat(
                data.restrictions.PrefixInRoute,
              );
              answer.restrictions.PrefixInRoutingRule =
                answer.restrictions.PrefixInRoutingRule.concat(
                  data.restrictions.PrefixInRoutingRule,
                );
              answer.restrictions.PrefixInGroup = answer.restrictions.PrefixInGroup.concat(
                data.restrictions.PrefixInGroup,
              );
            }
          }

          // Remove items of this firewall.
          answer.restrictions.PrefixInRule = answer.restrictions.PrefixInRule.filter(
            (item: any) => item.firewall_id != req.body.firewall,
          );
          answer.restrictions.PrefixInRoute = answer.restrictions.PrefixInRoute.filter(
            (item: any) => item.firewall_id != req.body.firewall,
          );
          answer.restrictions.PrefixInRoutingRule = answer.restrictions.PrefixInRoutingRule.filter(
            (item: any) => item.firewall_id != req.body.firewall,
          );
        } catch (error) {
          reject(error);
        }

        resolve(answer);
      });
    });
  }
}
