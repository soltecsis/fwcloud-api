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

import { Service } from "../fonaments/services/service";
import { DatabaseService } from "../database/database.service";
import * as fs from "fs";
import * as path from "path";
import { Backup } from "./backup";
import moment, { Moment } from "moment";
import { BackupNotFoundException } from "./exceptions/backup-not-found-exception";
import { CronTime, CronJob } from "cron";
import { CronService } from "./cron/cron.service";
import * as fse from "fs-extra";
import { NotFoundException } from "../fonaments/exceptions/not-found-exception";
import { Progress } from "../fonaments/http/progress/progress";
import { EventEmitter } from "typeorm/platform/PlatformTools";

const logger = require('log4js').getLogger("app");

export interface BackupUpdateableConfig {
    schedule: string,
    max_copies: number,
    max_days: number
};

export class BackupService extends Service {

    protected _config: any;
    protected _db: DatabaseService;
    protected _cronService: CronService;

    protected _runningJob: CronJob;
    protected _schedule: string;
    protected _task: any;

    public get config(): any {
        return this._config;
    }

    public async build(): Promise<BackupService> {
        this._config = this.loadCustomizedConfig(this._app.config.get('backup'));
        this._db = await this._app.getService<DatabaseService>(DatabaseService.name);
        this._cronService = await this._app.getService<CronService>(CronService.name);
        let backupDirectory: string = this._config.data_dir;

        if (!fs.existsSync(backupDirectory)) {
            fs.mkdirSync(backupDirectory);
        }

        this._schedule = this._config.schedule;
        this._task = async () => {
            try {
                logger.info("Starting BACKUP job.");
                const backup = new Backup();
                backup.setComment('Cron backup');
                await backup.create(this._config.data_dir);
                logger.info(`BACKUP job completed: ${backup.id}`);
            } catch (error) { logger.error("BACKUP job ERROR: ", error.message) }
        }

        this._runningJob = this._cronService.addJob(this._schedule, this._task);
        this._runningJob.start();

        return this;
    }

    /**
     * Returns all backups
     */
    public async getAll(): Promise<Array<Backup>> {
        var dirs = [];

        const entires: Array<string> = fs.readdirSync(this.getBackupDirectory());
        for (let entry of entires) {
            let backupPath: string = path.join(this.getBackupDirectory(), entry);

            if (fs.statSync(backupPath).isDirectory()) {
                try {
                    dirs.push(await new Backup().load(backupPath));
                } catch(e) {}
            }
        }

        return dirs;
    }

    /**
     * Find and existing backup
     * 
     * @param id Backup id
     */
    public async findOne(id: number): Promise<Backup> {
        const backups: Array<Backup> = await this.getAll();
        const matches: Array<Backup> = backups.filter((backup: Backup) => {
            return backup.id === id;
        });

        return matches.length > 0 ? matches[0] : null;
    }

    public async findOneOrFail(id: number): Promise<Backup> {
        const backup: Backup = await this.findOne(id);

        if (backup) {
            return backup;
        }

        throw new NotFoundException();
    }

    /**
     * Creates a new backup
     */
    public create(comment?: string, eventEmitter: EventEmitter = new EventEmitter()): Promise<Backup> {
        const backup: Backup = new Backup();
        backup.setComment(comment ? comment : null);
        
        return backup.create(this._config.data_dir, eventEmitter);
    }

    /**
     * 
     * @param backup Restores an existing backup
     */
    public restore(backup: Backup): Promise<Backup> {
        if (backup.exists()) {
            return backup.restore();
        }

        throw new BackupNotFoundException(backup.path);
    }

    public async destroy(backup: Backup): Promise<Backup> {
        return await backup.destroy();
    }

    /**
     * Applies the retention policy
     */
    public async applyRetentionPolicy(): Promise<Array<Backup>> {
        let deletedBackups: Array<Backup> = [];
        const backups: Array<Backup> = await this.getAll();

        if (this.shouldApplyRetentionPolicyByBackupCount()) {
            deletedBackups = deletedBackups.concat(await this.applyRetentionPolicyByBackupCount());
        }

        if (this.shouldApplyRetentionpolicyByExpirationDate()) {
            deletedBackups = deletedBackups.concat(await this.applyRetentionPolicyByExpirationDate());
        }

        return deletedBackups;
    }

    /**
     * Returns whether retention policy by backup counts should be applied
     */
    protected shouldApplyRetentionPolicyByBackupCount(): boolean {
        return this._config.max_copies !== 0;
    }

    /**
     * Returns whether retention policy by expiration date should be applied
     */
    protected shouldApplyRetentionpolicyByExpirationDate(): boolean {
        return this._config.max_days !== 0;
    }

    /**
     * Applies the retention policy by backup count
     */
    protected async applyRetentionPolicyByBackupCount(): Promise<Array<Backup>> {
        const deletedBackups: Array<Backup> = [];

        const sortedBackups = (await this.getAll()).sort((a: Backup, b: Backup) => {
            return a.id > b.id ? 1 : -1;
        });

        while (sortedBackups.length > this._config.max_copies) {
            let deletedBackup = sortedBackups.shift();
            deletedBackups.push(await deletedBackup.destroy());
        }

        return deletedBackups;
    }

    /**
     * Applies retention policy by expiration date
     */
    protected async applyRetentionPolicyByExpirationDate(): Promise<Array<Backup>> {
        const backups: Array<Backup> = await this.getAll();
        const deletedBackups: Array<Backup> = [];
        const expirationTimestamp: Moment = moment().subtract(this._config.max_days, 'days');

        for (let i = 0; i < backups.length; i++) {
            if (backups[i].date.isBefore(expirationTimestamp)) {
                deletedBackups.push(await backups[i].destroy());
            }
        }

        return deletedBackups;
    }

    public getCustomizedConfig(): BackupUpdateableConfig {
        return {
            max_copies: this._config.max_copies,
            max_days: this._config.max_days,
            schedule: this._config.schedule
        };
    }

    public async updateConfig(custom_config: BackupUpdateableConfig): Promise<BackupUpdateableConfig> {
        custom_config = await this.writeCustomizedConfig(custom_config);
        this._config = await this.loadCustomizedConfig(this._config);
        
        const cronTime: CronTime = new CronTime(this._config.schedule);
        this._runningJob.setTime(cronTime);
        this._runningJob.start();
        logger.info(`New backup cron task schedule: ${custom_config.schedule}`);

        return custom_config;
    }

    /**
     * Returns the backup full path
     */
    protected getBackupDirectory() {
        return path.join(this._app.path, this._config.data_dir);
    }

    protected loadCustomizedConfig(base_config: any): any {
        let config: any = base_config;
                
        const backupConfigFile: string = path.join(base_config.data_dir, base_config.config_file);

        if (fs.existsSync(backupConfigFile)) {
            const backupConfig = JSON.parse(fs.readFileSync(backupConfigFile, 'utf8'));
            config = Object.assign(config, backupConfig);
        }

        return config;
    }

    protected async writeCustomizedConfig(custom_config: BackupUpdateableConfig): Promise<BackupUpdateableConfig> {
        return new Promise(async (resolve, reject) => {
            try {
                if (!fs.existsSync(this._config.data_dir))
                    await fse.mkdirp(this._config.data_dir);

                const backupConfigFile = path.join(this._config.data_dir, this._config.config_file);
                fs.writeFileSync(backupConfigFile, JSON.stringify(custom_config), 'utf8');
                resolve(custom_config);
            } catch (error) { reject(error) }
        });
    }
}