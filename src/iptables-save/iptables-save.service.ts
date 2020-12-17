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

import { logger } from "../fonaments/abstract-application";
import { Service } from "../fonaments/services/service";
import { Request } from "express";
import { HttpException } from "../fonaments/exceptions/http/http-exception";
import { PolicyRule } from '../models/policy/PolicyRule';

const ipTables = {
  NULL: '',
  NAT: '*nat',
  RAW: '*raw',
  MANGLE: '*mangle',
  FILTER: '*filter'
}

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
const typeMap = new Map([
  [`${ipTables.FILTER}-INPUT`, 1],
  [`${ipTables.FILTER}-OUTPUT`, 2],
  [`${ipTables.FILTER}-FORWARD`, 3],
  [`${ipTables.NAT}-PREROUTING`, 4],
  [`${ipTables.NAT}-POSTROUTING`, 5],
]);

export class IptablesSaveService extends Service {
  private req: Request;
  private p: number;
  private data: string[];
  private items: string[];
  private table: string;
  private chain: string;
  private rule_order: number;

  public async import(request: Request): Promise<void> {
    this.req = request;
    this.data = request.body.data;
    this.table = ipTables.NULL;

    for(this.p=0; this.p < this.data.length; this.p++) {
      // Get items of current string.
      this.items = this.data[this.p].trim().split(/\s+/);

      // Ignore comments or empty lines.
      if (this.items.length === 0 || this.items[0] === '#') continue;

      // Iptables table with which we are working now.
      if (this.table === ipTables.NULL) {
        if (this.items[0]!=ipTables.NAT && this.items[0]!=ipTables.RAW && this.items[0]!=ipTables.MANGLE && this.items[0]!=ipTables.FILTER)
          throw new HttpException(`Bad iptables-save data (line: ${this.p+1})`,400);
        this.table = this.items[0];
        this.rule_order = 1;
        continue;
      }

      // End of iptables table.
      if (this.items[0] === 'COMMIT') {
        this.table = ipTables.NULL;
        continue;
      }

      // By the moment ignore MANGLE and RAW iptables tables.
      if (this.table === ipTables.MANGLE || this.table === ipTables.RAW) continue;

      await this.generateCustomChainsMap();

      // Generate rule.
      if (this.items[0] === '-A') {
        await this.generateRule();
        await this.fillPositions();
      }
    }

    return;
  }

  private async generateCustomChainsMap(): Promise<void> {
    return;
  }

  private async generateRule(): Promise<void> {
    let policy_rData = {
      id: null,
      firewall: this.req.body.firewall,
      rule_order: ++this.rule_order,
      action: 1,
      active: 1,
      options: 0,
      comment: this.data[this.p],
      type: 0,
    };

    this.items.shift();
    this.chain = this.items[0];

    if (! (policy_rData.type = typeMap.get(`${this.table}-${this.chain}`))) return;

    this.items.shift();

    try {
      await PolicyRule.reorderAfterRuleOrder(this.req.dbCon, this.req.body.firewall, policy_rData.type, policy_rData.rule_order);
      await PolicyRule.insertPolicy_r(policy_rData);
    } catch(error) {
      throw new HttpException(`Error creating policy rule: ${JSON.stringify(error)}`,500);
    }
  
    return;
  }

  private async fillPositions(): Promise<void> {
    switch(this.items[0]) {
      case '-s':
      case '-d':
          break;

      case '-o':
      case '-i':
        break;
  
      case '-j':
        break;
  
      default:
        throw new HttpException(`Bad iptables-save data (line: ${this.p+1})`,400);
      }

  }

  public async export(request: Request): Promise<void> {
    return;
  }
}