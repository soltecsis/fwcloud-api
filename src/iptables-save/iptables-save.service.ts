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

const ipTables = {
  NULL: '',
  NAT: '*nat',
  RAW: '*raw',
  MANGLE: '*mangle',
  FILTER: '*filter'
}

export class IptablesSaveService extends Service {
  private str: string;
  private i: number;
  private items: string[];
  private table: string;

  public async import(fwcloud: number, firewall: number, data: string): Promise<void> {
    this.table = ipTables.NULL;

    for(this.str of data) {
      this.i = 0;
      this.ignoreWhites();      
      if (this.cc() === '#' || this.cc() === '\0') continue;

      this.items = this.str.split(' ');

      // Iptables table with which we are working now.
      if (this.table === ipTables.NULL) {
        if (this.items[0]!=ipTables.NAT && this.items[0]!=ipTables.RAW && this.items[0]!=ipTables.MANGLE && this.items[0]!=ipTables.FILTER)
          throw new HttpException('Bad iptables-save data',400);
        this.table = this.items[0];
      }

      // End of iptables table.
      if (this.items[0] === 'COMMIT')
        this.table = ipTables.NULL;

      // By the moment ignore MANGLE and RAW iptables tables.
      if (this.table === ipTables.MANGLE || this.table === ipTables.RAW) continue;
    }


    return;
  }

  public async export(request: Request): Promise<void> {
    return;
  }

  private ignoreWhites() {
    for (let c=this.cc(); c===' ' || c==='\t' || c==='\r' || c==='\r'; c=this.cc()) 
      this.i++;
  }

  // Current character
  private cc() {
    return this.str.charAt(this.i);
  }
}