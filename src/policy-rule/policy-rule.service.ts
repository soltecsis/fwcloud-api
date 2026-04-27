/*
  Copyright 2025 SOLTECSIS SOLUCIONES TECNOLOGICAS, SLU
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

import { NotFoundException } from './../fonaments/exceptions/not-found-exception';
import { Service } from '../fonaments/services/service';
import * as DatabaseQuery from '../database/Query';
import { EventEmitter } from 'typeorm/platform/PlatformTools';
import { PolicyScript } from '../compiler/policy/PolicyScript';
import db from '../database/database-manager';
import fs from 'fs';
import { RuleCompilationResult } from '../compiler/policy/PolicyCompilerTools';

export class PolicyRuleService extends Service {
  protected _dbCon: DatabaseQuery.default;

  public async build(): Promise<Service> {
    this._dbCon = db.getQuery();

    return this;
  }

  public async compile(
    fwcloudId: number,
    firewallId: number,
    channel?: EventEmitter,
  ): Promise<Array<RuleCompilationResult>> {
    const policyScript = this.getPolicyScript(fwcloudId, firewallId, channel);
    return await policyScript.dump();
  }

  public content(fwcloudId: number, firewallId: number): Promise<string> {
    const policyScript = this.getPolicyScript(fwcloudId, firewallId);
    const path: string = policyScript.getScriptPath();

    return new Promise<string>((resolve, reject) => {
      fs.readFile(path, (err, data) => {
        if (err) {
          return reject(err);
        }
        return resolve(data.toString());
      });
    });
  }

  protected getPolicyScript(
    fwcloudId: number,
    firewallId: number,
    channel?: EventEmitter,
  ): PolicyScript {
    return new PolicyScript(this._dbCon, fwcloudId, firewallId, channel);
  }
}
