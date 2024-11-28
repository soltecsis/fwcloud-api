import { NotFoundException } from './../fonaments/exceptions/not-found-exception';
import { Service } from '../fonaments/services/service';
import * as DatabaseQuery from '../database/Query';
import { EventEmitter } from 'typeorm/platform/PlatformTools';
import { PolicyScript } from '../compiler/policy/PolicyScript';
import db from '../database/database-manager';
import fs from 'fs';

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
  ): Promise<void> {
    const policyScript = this.getPolicyScript(fwcloudId, firewallId, channel);
    await policyScript.dump();
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
