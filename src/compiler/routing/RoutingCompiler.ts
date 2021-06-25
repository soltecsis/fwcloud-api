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

export type RoutingCompiled = {
  id: number;
  active: number;
  comment: string;
  cs: string;
}

export class RoutingCompiler {
  public ruleCompile(ruleData: any): Promise<string> {
    return;
  }

  public routeCompile(routeData: any): Promise<string> {
    return;
  }

  public async compile(type: 'Route' | 'Rule', data: any, eventEmitter?: EventEmitter): Promise<RoutingCompiled[]> {
    let result: RoutingCompiled[] = [];

    if (!data) return result;

    for (let i=0; i<data.length; i++) {
        if (eventEmitter) eventEmitter.emit('message', new ProgressNoticePayload(`${type} ${i+1} (ID: ${data[i].id})${!(data[i].active) ? ' [DISABLED]' : ''}`));

        result.push({
          id: data[i].id,
          active: data[i].active,
          comment: data[i].comment,
          cs: (data[i].active || data.length===1) ? (type=='Route' ? await this.routeCompile(data[i]) : await this.ruleCompile(data[i])) : ''
        });
    }

    return result;
  }
}