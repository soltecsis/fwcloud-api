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

import { Service } from "../../fonaments/services/service";
import { CronJob, CronCommand } from "cron";
import { Moment } from "moment";

export class CronService extends Service {
    protected _jobs: Array<CronJob> = [];

    public async build(): Promise<CronService> {
        this._jobs = [];
        return this;
    }

    public async close(): Promise<void> {
        for(let i = 0; i < this._jobs.length; i++) {
            this._jobs[i].stop();
        }
    }
    

    public addJob(cronTime: string | Date | Moment, onTick: CronCommand, onComplete?: CronCommand, start?: boolean, timeZone?: string, context?: any, runOnInit?: boolean, utcOffset?: string | number, unrefTimeout?: boolean) {
        const job: CronJob = new CronJob(cronTime, onTick, onComplete, start, timeZone, context, runOnInit, utcOffset, unrefTimeout);
        this._jobs.push(job);
        return job;
    }
}