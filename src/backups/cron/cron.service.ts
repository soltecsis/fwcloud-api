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

import { Service } from '../../fonaments/services/service';
import { CronJob, CronCommand } from 'cron';

export class CronService extends Service {
  protected _jobs: Array<CronJob> = [];

  public async build(): Promise<CronService> {
    return new Promise((resolve) => {
      this._jobs = [];
      resolve(this);
    });
  }

  public addJob(cronTime: string, onTick: CronCommand<any, false>) {
    const job = new CronJob(cronTime, onTick);
    this._jobs.push(job);
    return job;
  }
}
