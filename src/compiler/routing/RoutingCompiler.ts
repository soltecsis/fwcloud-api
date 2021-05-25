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

  public routeCompile(ruleData: any): Promise<string> {
    return;
  }

  public async compile(rulesData: any, eventEmitter?: EventEmitter): Promise<RoutingCompiled[]> {
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