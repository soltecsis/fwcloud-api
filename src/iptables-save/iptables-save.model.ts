/*!
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

import { Service } from "../fonaments/services/service";
import { Request } from "express";
import { HttpException } from "../fonaments/exceptions/http/http-exception";
import { PolicyRule } from '../models/policy/PolicyRule';
import { Interface } from '../models/interface/Interface';
import { Tree } from '../models/tree/Tree';
import { PolicyRuleToInterface } from '../models/policy/PolicyRuleToInterface';
import { IPObj } from '../models/ipobj/IPObj';
import { PolicyRuleToIPObj } from "../models/policy/PolicyRuleToIPObj";

const Joi = require('joi');
const sharedSch = require('../middleware/joi_schemas/shared');


export const NetFilterTables = new Set<string>([
  'nat',
  'raw',
  'mangle',
  'filter'
]);

export const StdChains = new Set<string>([
  'INPUT',
  'OUTPUT',
  'FORWARD',
  'PREROUTING',
  'POSTROUTING'
]);

/*
mysql> select * from policy_type;
+----+------+--------------+------------+-------------+
| id | type | name         | type_order | show_action |
+----+------+--------------+------------+-------------+
|  1 | I    | Input        |          1 |           1 |
|  2 | O    | Output       |          2 |           1 |
|  3 | F    | Forward      |          3 |           1 |
|  4 | S    | SNAT         |          4 |           0 |
|  5 | D    | DNAT         |          5 |           0 |
|  6 | R    | Routing      |          6 |           1 |
| 61 | I6   | Input IPv6   |          1 |           1 |
| 62 | O6   | Output IPv6  |          2 |           1 |
| 63 | F6   | Forward IPv6 |          3 |           1 |
| 64 | S6   | SNAT IPv6    |          4 |           0 |
| 65 | D6   | DNAT IPv6    |          5 |           0 |
+----+------+--------------+------------+-------------+
*/
export const PolicyTypeMap = new Map<string, number>([
  ['filter:INPUT', 1],
  ['filter:OUTPUT', 2],
  ['filter:FORWARD', 3],
  ['nat:POSTROUTING', 4], // SNAT
  ['nat:PREROUTING', 5], // DNAT
]);

/*
mysql> select * from policy_position;
+----+------------------------+-------------+----------------+---------+---------------+
| id | name                   | policy_type | position_order | content | single_object |
+----+------------------------+-------------+----------------+---------+---------------+
|  1 | Source                 |           1 |              2 | O       |             0 |
|  2 | Destination            |           1 |              3 | O       |             0 |
|  3 | Service                |           1 |              4 | O       |             0 |
|  4 | Source                 |           2 |              2 | O       |             0 |
|  5 | Destination            |           2 |              3 | O       |             0 |
|  6 | Service                |           2 |              4 | O       |             0 |
|  7 | Source                 |           3 |              3 | O       |             0 |
|  8 | Destination            |           3 |              4 | O       |             0 |
|  9 | Service                |           3 |              5 | O       |             0 |
| 11 | Source                 |           4 |              2 | O       |             0 |
| 12 | Destination            |           4 |              3 | O       |             0 |
...

mysql> select * from policy_type;
+----+------+--------------+------------+-------------+
| id | type | name         | type_order | show_action |
+----+------+--------------+------------+-------------+
|  1 | I    | Input        |          1 |           1 |
|  2 | O    | Output       |          2 |           1 |
|  3 | F    | Forward      |          3 |           1 |
|  4 | S    | SNAT         |          4 |           0 |
|  5 | D    | DNAT         |          5 |           0 |
|  6 | R    | Routing      |          6 |           1 |
| 61 | I6   | Input IPv6   |          1 |           1 |
| 62 | O6   | Output IPv6  |          2 |           1 |
| 63 | F6   | Forward IPv6 |          3 |           1 |
| 64 | S6   | SNAT IPv6    |          4 |           0 |
| 65 | D6   | DNAT IPv6    |          5 |           0 |
+----+------+--------------+------------+-------------+
*/
export const PositionMap = new Map<string, number>([
  ['filter:INPUT:-i', 20],
  ['filter:INPUT:-s', 1],
  ['filter:INPUT:-d', 2],

  ['filter:OUTPUT:-o', 21],
  ['filter:OUTPUT:-s', 4],
  ['filter:OUTPUT:-d', 5],

  ['filter:FORWARD:-i', 22],
  ['filter:FORWARD:-o', 25],
  ['filter:FORWARD:-s', 7],
  ['filter:FORWARD:-d', 8],

  ['nat:POSTROUTING:-o', 24], // SNAT
  ['nat:POSTROUTING:-s', 11],
  ['nat:POSTROUTING:-d', 12],

  ['nat:PREROUTING:-i', 36], // DNAT
  ['nat:PREROUTING:-s', 30],
  ['nat:PREROUTING:-d', 31],
]);

export class IptablesSaveToFWCloud extends Service {
  protected req: Request;
  protected p: number;
  protected data: string[];
  protected items: string[];
  protected table: string;
  protected chain: string;
  protected ruleId: any;
  protected ruleOrder: number;
  protected ruleTarget: string;
  protected customChainsMap: Map<string, number[]>;

  protected generateCustomChainsMap(): Promise<void> {
    let chain: string = this.items[0].substr(1);

    // Ignore standard chains names.
    if (StdChains.has(chain)) return;

    // Search all the lines that have data for this custom chain.
    let value: number[] = [];
    let items: string[];
    for(let p=this.p+1; p< this.data.length; p++) {
      items = this.data[p].trim().split(/\s+/);
      if (items[0] === 'COMMIT') break;
      if (items[0] === '-A' && items[1] === chain) value.push(p);
    }

    this.customChainsMap.set(this.items[0].substr(1),value);

    return;
  }

  protected async generateRule(): Promise<boolean> {
    let policy_rData = {
      id: null,
      firewall: this.req.body.firewall,
      rule_order: ++this.ruleOrder,
      action: 1,
      active: 1,
      options: 0,
      comment: `${new Date().toISOString().replace(/T/, ' ').replace(/\..+/, '')} - iptables-save import`,
      type: 0,
    };

    this.items.shift();
    this.chain = this.items[0];

    // Ignore iptables rules for custom chains because they have already been processed.
    if (this.customChainsMap.has(this.chain)) return false;

    // If don't find type map, ignore this rule.
    if (!(policy_rData.type = PolicyTypeMap.get(`${this.table}:${this.chain}`))) return false;

    this.items.shift();

    try {
      await PolicyRule.reorderAfterRuleOrder(this.req.dbCon, this.req.body.firewall, policy_rData.type, policy_rData.rule_order);
      this.ruleId = await PolicyRule.insertPolicy_r(policy_rData);
    } catch(err) { throw new HttpException(`Error creating policy rule: ${JSON.stringify(err)}`,500); }
  
    return true;
  }

  protected async fillRulePositions(line: number): Promise<void> {
    let lineItems = this.data[line].trim().split(/\s+/); 
    lineItems.shift(); // -A
    lineItems.shift(); // Chain name

    this.ruleTarget = '';

    while(lineItems.length > 0)
      await this.eatRuleData(line,lineItems);

    let lines: number[] = this.customChainsMap.get(this.ruleTarget);
    if (lines) {
      for(let l of lines) {
        await this.fillRulePositions(l);
      }
    }

    return;
  }

  private async eatRuleData(line: number, lineItems: string[]): Promise<void> {
    const item = lineItems[0];
    lineItems.shift();

    switch(item) {
      case '-s':
      case '-d':
        await this.eatAddr(item,lineItems[0]);
        lineItems.shift();
        break;

      case '-o':
      case '-i':
        await this.eatInterface(item,lineItems[0]);
        lineItems.shift();
        break;

      case '-p':
        lineItems.shift();
        break;

      case '-m':
        lineItems.shift();
        lineItems.shift();
        lineItems.shift();
        break;
    
      case '-j':
        if (lineItems[0] === 'SNAT' || lineItems[0] === 'DNAT') {
          lineItems.shift();
          lineItems.shift();
        }
        this.ruleTarget = lineItems[0];
        lineItems.shift();
        break;
  
      default:
        throw new HttpException(`Bad iptables-save data (line: ${line+1})`,400);
    }

    return;
  }

  private async eatInterface(dir: string, _interface: string): Promise<void> {
    // IMPORTAT: Validate data before process it.
    await Joi.validate(_interface, sharedSch.name);

    const interfaces = await Interface.getInterfaces(this.req.dbCon, this.req.body.fwcloud, this.req.body.firewall);
    let interfaceId: any = 0;

    // Search if the interface exits.
    for(let i=0; i<interfaces.length; i++) {
      if (interfaces[i].name === _interface) {
        interfaceId = interfaces[i].id;
        break;
      }
    }

    // If not found create it.
    if (!interfaceId) {
      let interfaceData = {
        id: null,
        firewall: this.req.body.firewall,
        name: _interface,
        type: 10,
        interface_type: 10,
        comment: `${new Date().toISOString().replace(/T/, ' ').replace(/\..+/, '')} - iptables-save import`
      };
      
      try {
        interfaceData.id = interfaceId = await Interface.insertInterface(this.req.dbCon, interfaceData);
        const fwcTreeNode: any = await Tree.getNodeUnderFirewall(this.req.dbCon,this.req.body.fwcloud,this.req.body.fwcloud,'FDI');
        await Tree.insertFwc_TreeOBJ(this.req, fwcTreeNode.id, 99999, 'IFF', interfaceData);
      } catch(err) { throw new HttpException(`Error creating firewall interface: ${JSON.stringify(err)}`,500); }
    }

    // Add the interface to the rule position.
    const rulePosition = PositionMap.get(`${this.table}:${this.chain}:${dir}`);
    if (!rulePosition)
      throw new HttpException(`Rule position not found for: ${this.table}:${this.chain}:${dir}`,500);

    let policy_r__interfaceData = {
      rule: this.ruleId,
      interface: interfaceId,
      position: rulePosition
    };

    try {
      await PolicyRuleToInterface.insertPolicy_r__interface(this.req.body.firewall, policy_r__interfaceData);
    } catch(err) { throw new HttpException(`Error inserting interface in policy rule: ${JSON.stringify(err)}`,500); }
  }


  private async eatAddr(dir: string, addr: string): Promise<void> {
    // IMPORTAT: Validate data before process it.
    await Joi.validate(addr, Joi.string().ip({ version: [`ipv${this.req.body.ip_version}`], cidr: 'required' }));

    const fullMask = this.req.body.ip_version === 4 ? '32' : '128';
    const addrData = addr.split('/');
    const ip: string = addrData[0];
    const mask: string = addrData[1];

    let addrId = await IPObj.searchAddrWithMask(this.req.dbCon,this.req.body.fwcloud,ip,mask);
    
    // If not found create it.
    if (!addrId) {
      let ipobjData = {
        id: null,
        fwcloud: this.req.body.fwcloud,
        name: mask === fullMask ? ip :addr,
        type: mask === fullMask ? 5 : 7, // 5: ADDRESS, 7: NETWORK
        address: ip,
        netmask: `/${mask}`,
        ip_version: this.req.body.ip_version,
        comment: `${new Date().toISOString().replace(/T/, ' ').replace(/\..+/, '')} - iptables-save import`
      };
  
      try {
        ipobjData.id = addrId = await IPObj.insertIpobj(this.req.dbCon, ipobjData);
        const fwcTreeNode: any = mask === fullMask ? await Tree.getNodeByNameAndType(this.req.body.fwcloud,'Addresses','OIA') : await Tree.getNodeByNameAndType(this.req.body.fwcloud,'Networks','OIN');
        await Tree.insertFwc_TreeOBJ(this.req, fwcTreeNode.id, 99999, mask===fullMask ? 'OIA' : 'OIN' , ipobjData);
      } catch(err) { throw new HttpException(`Error creating IP object: ${JSON.stringify(err)}`,500); }
    }

    // Add the addr object to the rule position.
    const rulePosition = PositionMap.get(`${this.table}:${this.chain}:${dir}`);
    if (!rulePosition)
      throw new HttpException(`Rule position not found for: ${this.table}:${this.chain}:${dir}`,500);

    let policy_r__ipobjData = {
      rule: this.ruleId,
      ipobj: addrId,
      ipobj_g: -1,
      interface: -1,
      position: rulePosition,
      position_order: 1
    };

    try {
      await PolicyRuleToIPObj.insertPolicy_r__ipobj(policy_r__ipobjData);
    } catch(err) { throw new HttpException(`Error inserting IP object in policy rule: ${JSON.stringify(err)}`,500); }
  }
}
