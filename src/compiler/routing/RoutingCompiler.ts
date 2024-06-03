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

import { EventEmitter } from 'events';
import { RouteData } from '../../models/routing/routing-table/routing-table.service';
import { RouteItemForCompiler, RoutingRuleItemForCompiler } from '../../models/routing/shared';
import { ProgressNoticePayload } from '../../sockets/messages/socket-message';
import { RoutingRulesData } from '../../models/routing/routing-rule/routing-rule.service';
import ip from 'ip';

export type RoutingCompiled = {
  id: number;
  active: boolean;
  comment: string;
  cs: string;
}

export class RoutingCompiler {
  public ruleCompile(ruleData: RoutingRulesData<RoutingRuleItemForCompiler>): string {
    const items = this.breakDownItems(ruleData.items,'from ');
    let cs = '';

    for (let i=0; i<items.length; i++)
      cs += `$IP rule add ${items[i]} table ${ruleData.routingTable.number}\n`;
    
    // Apply routing rule only to the selected firewall.
    if (ruleData.firewallApplyTo && ruleData.firewallApplyTo.name)
      cs = `if [ "$HOSTNAME" = "${ruleData.firewallApplyTo.name}" ]; then\n${cs}fi\n`;

    return cs;
  }


  public routeCompile(routeData: RouteData<RouteItemForCompiler>): string {
    const items = this.breakDownItems(routeData.items,'');
    const gw = routeData.gateway.address;
    const dev = (routeData.interface && routeData.interface.name) ? ` dev ${routeData.interface.name} ` : ' ';
    let cs = '';

    if (items.length == 0)
      items.push('default');
       
    for (let i=0; i<items.length; i++)
      cs += `$IP route add ${items[i]} via ${gw}${dev}table ${routeData.routingTable.number}\n`;

    // Apply route only to the selected firewall.
    if (routeData.firewallApplyTo && routeData.firewallApplyTo.name)
      cs = `if [ "$HOSTNAME" = "${routeData.firewallApplyTo.name}" ]; then\n${cs}fi\n`;
  
    return cs;
  }


  public compile(type: 'Route' | 'Rule', data: RouteData<RouteItemForCompiler>[] | RoutingRulesData<RoutingRuleItemForCompiler>[], eventEmitter?: EventEmitter): RoutingCompiled[] {
    const result: RoutingCompiled[] = [];

    if (!data) return result;

    for (let i=0; i<data.length; i++) {
        if (eventEmitter) eventEmitter.emit('message', new ProgressNoticePayload(`${type} ${i+1} (ID: ${data[i].id})${!(data[i].active) ? ' [DISABLED]' : ''}`));

        result.push({
          id: data[i].id,
          active: data[i].active,
          comment: data[i].comment,
          cs: (data[i].active || data.length===1) ? (type=='Route' ? this.routeCompile(data[i] as RouteData<RouteItemForCompiler>) : this.ruleCompile(data[i] as RoutingRulesData<RoutingRuleItemForCompiler>)) : ''
        });
    }

    return result;
  }

  
  private breakDownItems(items: RouteItemForCompiler[] | RoutingRuleItemForCompiler[], dir: string): string[] {
    const result: string[] = [];

    for (let i=0; i<items.length; i++) {
      switch(items[i].type) {
        case 5: // ADDRESS
          result.push(`${dir}${items[i].address}`);
          break;

        case 7: // NETWORK
          if (items[i].netmask[0] === '/')
            result.push(`${dir}${items[i].address}${items[i].netmask}`);
          else {
            const net = ip.subnet(items[i].address, items[i].netmask);
            result.push(`${dir}${items[i].address}/${net.subnetMaskLength}`);
          }
          break;

        case 6: // ADDRESS RANGE
          const firstLong = ip.toLong(items[i].range_start);
          const lastLong = ip.toLong(items[i].range_end);
          for(let current=firstLong; current<=lastLong; current++)
            result.push(`${dir}${ip.fromLong(current)}`);
          break;

        case 30: // IPTABLES MARKS
          result.push(`fwmark ${(items[i] as RoutingRuleItemForCompiler).mark_code}`);
          break;
      }
    }

    return result;
  }
}