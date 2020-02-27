import { Service } from "../../fonaments/services/service";
import { CronJob, CronCommand } from "cron";
import { Moment } from "moment";

export class CronService extends Service {
    protected _jobs: Array<CronJob> = [];

    public async build(): Promise<CronService> {
        this._jobs = [];
        return this;
    }
    

    public addJob(cronTime: string | Date | Moment, onTick: CronCommand, onComplete?: CronCommand, start?: boolean, timeZone?: string, context?: any, runOnInit?: boolean, utcOffset?: string | number, unrefTimeout?: boolean) {
        return new CronJob(cronTime, onTick, onComplete, start, timeZone, context, runOnInit, utcOffset, unrefTimeout);
    }
}