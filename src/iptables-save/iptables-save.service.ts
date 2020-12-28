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
import { Request } from "express";
import { HttpException } from "../fonaments/exceptions/http/http-exception";
import { IptablesSaveToFWCloud, NetFilterTables } from './iptables-save.model';
import { Firewall } from '../models/firewall/Firewall';


export class IptablesSaveService extends IptablesSaveToFWCloud {
  public async import(request: Request): Promise<void> {
    this.req = request;
    this.data = request.body.data;
    this.table = null;

    const fwOptions: any = await Firewall.getFirewallOptions(this.req.body.fwcloud,this.req.body.firewall);
    this.statefulFirewall = parseInt(fwOptions) & 0x1 ? true : false;

    for(this.line=0; this.line < this.data.length; this.line++) {
      // Get items of current string.
      this.items = this.data[this.line].trim().split(/\s+/);

      // Ignore comments or empty lines.
      if (this.items.length === 0 || this.items[0] === '#') continue;

      // Iptables table with which we are working now.
      if (!this.table) {
        if (!NetFilterTables.has(this.items[0].substr(1)))
          throw new HttpException(`Bad iptables-save data (line: ${this.line+1})`,400);
        this.table = this.items[0].substr(1);
        this.ruleOrder = 1;
        this.customChainsMap = new Map();
        continue;
      }

      // End of iptables table.
      if (this.items[0] === 'COMMIT') {
        this.table = null;
        continue;
      }

      // By the moment ignore MANGLE and RAW iptables tables.
      if (this.table === 'mangle' || this.table === 'raw') continue;

      try {
        if (this.data[this.line].charAt(0) === ':')
          await this.generateCustomChainsMap();
        else if (this.items[0] === '-A') { // Generate rule.
          if (await this.generateRule()) 
            await this.fillRulePositions(this.line);
        }
      } catch(err) { throw new HttpException(`ERROR in iptables-save import: ${err.message} (line: ${this.line+1})`,400); }
    }

    return;
  }

  public async export(request: Request): Promise<void> {
    return;
  }
}