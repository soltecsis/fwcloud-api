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

export class IptablesSaveService extends Service {
  private req: Request;
  private p: number;
  private data: string[];
  private items: string[];
  private table: string;

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
          throw new HttpException('Bad iptables-save data',400);
        this.table = this.items[0];
        continue;
      }

      // End of iptables table.
      if (this.items[0] === 'COMMIT') {
        this.table = ipTables.NULL;
        continue;
      }

      // By the moment ignore MANGLE and RAW iptables tables.
      if (this.table === ipTables.MANGLE || this.table === ipTables.RAW) continue;

      // Generate rule.
      if (this.items[0] === '-A')
        this.generateRule();
    }

    return;
  }

  private async generateRule(): Promise<void> {
    var policy_rData = {
      id: null,
      firewall: this.req.body.firewall,
      rule_order: 1,
      action: 1,
      active: 1,
      options: 0,
      comment: '',
      type: 0,
    };
  
    try {
      await PolicyRule.reorderAfterRuleOrder(this.req.dbCon, this.req.body.firewall, policy_rData.type, policy_rData.rule_order);
      await PolicyRule.insertPolicy_r(policy_rData);
    } catch(error) {
      throw new HttpException(`Error creating policy rule: ${JSON.stringify(error)}`,500);
    }
  
    return;
  }

  public async export(request: Request): Promise<void> {
    return;
  }
}