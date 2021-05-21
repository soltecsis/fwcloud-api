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

export type RoutingCompiled = {
  id: number;
  active: number;
  comment: string;
  cs: string;
}

interface RouteData extends Route {
  ipobjs: any[];
}

interface IPObjData extends IPObj {
  relatedId: number;
}

type IpobjsArrayMap = Map<number, any[]>;
type AvailableDestinations = 'grid' | 'compiler';

export class RoutingCompiler {
  private _dst: AvailableDestinations;
  private _fwcloud: number;
  private _firewall: number;
  private _routingTable: number;
  private _routeRepository: RouteRepository;
  private _ipobjsArrayMap: IpobjsArrayMap;

  constructor (dst: AvailableDestinations, fwcloud: number, firewall: number, routingTable: number) {
    this._dst = dst;
    this._fwcloud = fwcloud;
    this._firewall = firewall;
    this._routingTable = routingTable;

    this._routeRepository = getCustomRepository(RouteRepository);
    this._ipobjsArrayMap = new Map<number, []>();
  }

  public async getRoutingTableData(): Promise<RouteData[]> {
    const rules: RouteData[] = await this._routeRepository.getRoutingTableRoutes(this._fwcloud, this._firewall, this._routingTable) as RouteData[];
     
    // Init the map for access the objects array for each route.
    for (let i=0; i<rules.length; i++) {
      rules[i].ipobjs = [];

      // Map each rule id and position with it's corresponding ipobjs array.
      // These ipobjs array will be filled with objects data in the Promise.all()
      // next to the outer for loop.
      this._ipobjsArrayMap.set(rules[i].id, rules[i].ipobjs);
    }

    const sqls = (this._dst === 'compiler') ? this.buildSQLsForCompiler() : this.buildSQLsForGrid();
    await Promise.all(sqls.map(sql => this.mapPolicyData(sql)));
    
    return rules;
  }

  private buildSQLsForCompiler(): SelectQueryBuilder<IPObj>[] {
    return [
      IPObj.getIpobjsUnderRoutingTableRoutes(this._fwcloud, this._firewall, this._routingTable),
    ];
  }

  private buildSQLsForGrid(): SelectQueryBuilder<IPObj>[] {
    return [];
  }

  private async mapPolicyData(sql: SelectQueryBuilder<IPObj>): Promise<void> {
    console.log(sql.getQueryAndParameters());
    const data: IPObjData[] = await sql.getMany() as IPObjData[];

    for (let i=0; i<data.length; i++) {
        const ipobjs: any = this._ipobjsArrayMap.get(data[i].relatedId);
        ipobjs?.push(data[i]);
    }

    return;
  }

  public getRouteData(dst: 'grid' | 'compiler', dbCon: any, fwcloud: number, firewall: number, rule: number): Promise<RouteData[]> {
    return;
  }

  public ruleCompile(ruleData: any): Promise<string> {
    return;
  }

  public routeCompile(ruleData: any): Promise<string> {
    return;
  }

  public async compile(eventEmitter?: EventEmitter): Promise<RoutingCompiled[]> {
    //const tsStart = Date.now();
    const rulesData: any = await this.getRoutingTableData();
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