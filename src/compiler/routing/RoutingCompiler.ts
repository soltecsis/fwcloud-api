/*
    Copyright 2021 SOLTECSIS SOLUCIONES TECNOLOGICAS, SLU
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

import { EventEmitter } from 'events';
import { ProgressNoticePayload } from '../../sockets/messages/socket-message';
import { getCustomRepository, SelectQueryBuilder } from "typeorm";
import { RouteRepository } from '../../models/routing/route/route.repository';
import { Route } from '../../models/routing/route/route.model';
import { IPObj } from '../../models/ipobj/IPObj';

export type RoutingRuleData = {
  id: number;
  routing_table: number;
  active: number;
  comment: string;
  ips: string[];
  marks: number[];
}

interface RouteData extends Route {
  ipobjs: any[];
}

export type RoutingCompiled = {
  id: number;
  active: number;
  comment: string;
  cs: string;
}

type IpobjsArrayMap = Map<number, any[]>;

export class RoutingCompiler {
  private routeRepository: RouteRepository;
  private ipobjsArrayMap: IpobjsArrayMap;

  constructor () {
    this.routeRepository = getCustomRepository(RouteRepository);
    this.ipobjsArrayMap = new Map<number, []>();
  }

  public async getRoutingTableData(dst: 'grid' | 'compiler', fwcloud: number, firewall: number, routingTable: number): Promise<RouteData[]> {
    const rules: RouteData[] = await this.routeRepository.getRoutingTableRoutes(fwcloud, firewall, routingTable) as RouteData[];
     
    // Init the map for access the objects array for each route.
    for (let i=0; i<rules.length; i++) {
      rules[i].ipobjs = [];

      // Map each rule id and position with it's corresponding ipobjs array.
      // These ipobjs array will be filled with objects data in the Promise.all()
      // next to the outer for loop.
      this.ipobjsArrayMap.set(rules[i].id, rules[i].ipobjs);
    }

    const sqls = (dst === 'compiler') ? 
                    this.buildSQLsForCompiler(firewall, type, rule) :
                    this.buildSQLsForGrid(firewall, type, rule);
    await Promise.all(sqls.map(sql => this.mapPolicyData(dbCon,ipobjsArrayMap,sql)));
    
    return rules;
  }

  private buildSQLsForCompiler(firewall: number, type: number, rule: number): SelectQueryBuilder<IPObj>[] {
    return [];
  }

  private buildSQLsForGrid(firewall: number, type: number, rule: number): SelectQueryBuilder<IPObj>[] {
    return [];
  }

  private async mapPolicyData(sql: SelectQueryBuilder<IPObj>): Promise<void> {
    const data = await sql.getMany();
    for (let i=0; i<data.length; i++) {
        //const ipobjs: any = this.ipobjsArrayMap.get(data[i].route_id);
        //ipobjs?.push(data[i]);
    }

    return;
  }

  public static getRouteData(dst: 'grid' | 'compiler', dbCon: any, fwcloud: number, firewall: number, rule: number): Promise<RouteData[]> {
    return;
  }

  public static ruleCompile(ruleData: any): Promise<string> {
    return;
  }

  public static routeCompile(ruleData: any): Promise<string> {
    return;
  }

  public async compile(fwcloud: number, firewall: number, routingTable: number, eventEmitter?: EventEmitter): Promise<RoutingCompiled[]> {
    //const tsStart = Date.now();
    const rulesData: any = await this.getRoutingTableData('compiler', fwcloud, firewall, routingTable);
    //IPTablesCompiler.totalGetDataTime += Date.now() - tsStart;
    
    let result: RoutingCompiled[] = [];

    if (!rulesData) return result;

    for (let i=0; i<rulesData.length; i++) {
        if (eventEmitter) eventEmitter.emit('message', new ProgressNoticePayload(`Rule ${i+1} (ID: ${rulesData[i].id})${!(rulesData[i].active) ? ' [DISABLED]' : ''}`));

        result.push({
            id: rulesData[i].id,
            active: rulesData[i].active,
            comment: rulesData[i].comment,
            cs: (rulesData[i].active || rulesData.length===1) ? await this.routeCompile(rulesData[i]) : ''
        });
    }

    return result;
  }
}