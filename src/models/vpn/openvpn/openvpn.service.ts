/*!
    Copyright 2022 SOLTECSIS SOLUCIONES TECNOLOGICAS, SLU
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

import { ProgressInfoPayload, ProgressPayload, ProgressNoticePayload } from './../../../sockets/messages/socket-message';
import { Service } from "../../../fonaments/services/service";
import { OpenVPN } from "./OpenVPN";
import db from "../../../database/database-manager";
import { InstallerGenerator } from "../../../openvpn-installer/installer-generator";
import { getMetadataArgsStorage, SelectQueryBuilder } from "typeorm";
import { Firewall } from "../../firewall/Firewall";
import { CronService } from "../../../backups/cron/cron.service";
import { CronJob } from "cron";
import { logger } from "../../../fonaments/abstract-application";
import { OpenVPNStatusHistory } from "./status/openvpn-status-history";
import * as fs from "fs-extra";
import { ColumnMetadataArgs } from "typeorm/metadata-args/ColumnMetadataArgs";
import path from "path";
import { Zip } from "../../../utils/zip";
import ObjectHelpers from "../../../utils/object-helpers";
import { Mutex, tryAcquire, E_ALREADY_LOCKED } from 'async-mutex';
import { EventEmitter } from 'events';

export type OpenVPNConfig = {
    history: {
        data_dir: string,
        archive_schedule: string,
        archive_days: number,
        retention_schedule: string,
        retention_days: number
    }
}

export type OpenVPNUpdateableConfig = {
    history: {
        archive_days: number;
        retention_days: number;
    }
}

export class OpenVPNService extends Service {

    protected _config: OpenVPNConfig;
    protected _cronService: CronService;

    protected _scheduledHistoryArchiveJob: CronJob;
    protected _scheduledRetentionJob: CronJob;

    protected _archiveMutex = new Mutex()


    public async build(): Promise<OpenVPNService> {
        this._config = this.loadCustomizedConfig(this._app.config.get('openvpn'));
        this._cronService = await this._app.getService<CronService>(CronService.name);

        const archiveDirectory: string = this._config.history.data_dir;

        if (!fs.existsSync(archiveDirectory)) {
            fs.mkdirpSync(archiveDirectory);
        }

        return this;
    }

    public startScheduledTasks(): void {
        this._scheduledHistoryArchiveJob = this._cronService.addJob(this._config.history.archive_schedule, async () => {

            await this._archiveMutex.waitForUnlock();

            try {
                logger().info("Starting OpenVPNHistory archive job.");
                const removedItemsCount: number = await this.archiveHistory();
                logger().info(`OpenVPNHistory archive job completed: ${removedItemsCount} rows archived.`);
            } catch (error) { logger().error("OpenVPNHistory archive job ERROR: ", error.message) }
        });
        this._scheduledHistoryArchiveJob.start();

        this._scheduledRetentionJob = this._cronService.addJob(this._config.history.retention_schedule, async () => {
            try {
                logger().info("Starting OpenVPNHistory retention job.");
                const removedItemsCount: number = await this.removeExpiredFiles();
                logger().info(`OpenVPNHistory archive job completed: ${removedItemsCount} files removed.`);
            } catch (error) { logger().error("OpenVPNHistory retention job ERROR: ", error.message) }
        });
        this._scheduledRetentionJob.start();
    }

    public async generateInstaller(name: string, openVPN: OpenVPN, outputPath: string): Promise<string> {
        let configData: string;

        try {
            const openVPNId: number = openVPN.id;
            const firewall: Firewall = await db.getSource().manager.getRepository(Firewall).findOne({
                where: {id: openVPN.firewallId},
                relations: ['fwCloud']
            });
            const fwCloudId: number = firewall.fwCloudId;
            
            configData = (await OpenVPN.dumpCfg(db.getQuery(), fwCloudId, openVPNId) as any).cfg;
            
        } catch (e) {
            throw new Error('Unable to generate the openvpn configuration during installer generation: ' + JSON.stringify(e));
        }

        const installerGenerator: InstallerGenerator = new InstallerGenerator("lib/nsis", name, configData, outputPath)
        return installerGenerator.generate();
    }

    public getCustomizedConfig(): OpenVPNUpdateableConfig {
        this._config = this.loadCustomizedConfig(this._app.config.get('openvpn'));
        
        return {
            history: {
                archive_days: this._config.history.archive_days, 
                retention_days: this._config.history.retention_days
            }
        };
    }

    /**
     * Archives history registers into a zipped file after an expiration time
     * 
     * @returns 
     */
    public async archiveHistory(eventEmitter: EventEmitter = new EventEmitter): Promise<number> {
        function getExpiredStatusHistoryQuery(expirationInSeconds: number): SelectQueryBuilder<OpenVPNStatusHistory> {
            return db.getSource().manager.getRepository(OpenVPNStatusHistory).createQueryBuilder('history')
                .where('history.timestampInSeconds <= :timestamp', {timestamp: (Date.now() - expirationInSeconds * 1000) / 1000});
        }
    
        try {
            return await tryAcquire(this._archiveMutex).runExclusive(() => {
                return new Promise<number>((resolve, reject) => { 
                    try {
                        this._config = this.loadCustomizedConfig(this._app.config.get('openvpn'));
    
                        eventEmitter.emit('message', new ProgressInfoPayload('Starting OpenVPN history archiver'));
                        eventEmitter.emit('message', new ProgressNoticePayload('Checking expired history'));
    
                        const expirationInSeconds: number = this._config.history.archive_days * 24 * 60 * 60;
    
                        // If there isn't any row expired, then do nothing
                        getExpiredStatusHistoryQuery(expirationInSeconds).limit(1).getCount().then((count: number) => {
                            if (count === 0) {
                                eventEmitter.emit('message', new ProgressNoticePayload('Nothing to archive'));
                                eventEmitter.emit('message', new ProgressPayload('end', false, ''));
                                return resolve(0);
                            }
                        });
    
                        let count: number = 0;
                        const date: Date = new Date();
                        const yearDir: string = (date.getFullYear()).toString();
                        const monthSubDir: string = (("0" + (date.getMonth() + 1)).slice(-2));
                        const fileName: string = `openvpn_status_history-${date.getFullYear()}${("0" + (date.getMonth() + 1)).slice(-2)}${("0" + date.getDate()).slice(-2)}.sql`;
    
                        // If there is already a zipped file, then unzip it in order to write down new registers there
                        fs.pathExists(`${path.join(this._config.history.data_dir, yearDir, monthSubDir, fileName)}.zip`).then(async (exists: boolean) => {
                            if (exists) {
                                eventEmitter.emit('message', new ProgressNoticePayload('Decompressing existing zip file'));
                                await Zip.unzip(`${path.join(this._config.history.data_dir, yearDir, monthSubDir, fileName)}.zip`, path.join(this._config.history.data_dir, yearDir, monthSubDir));
                                await fs.remove(`${path.join(this._config.history.data_dir, yearDir, monthSubDir, fileName)}.zip`);
                            } else {
                                fs.mkdirpSync(path.join(this._config.history.data_dir, yearDir, monthSubDir));
                            }
                        });
    
                        // Could exist millions of registers. In order to avoid high memory consumption,
                        // process rows in batches of 2000 (create multiple INSERT INTO statements in the file).
                        // MySQL might limit the size of queries, thus it's recommended to create multiple "INSERT INTO" instead
                        // of one big INSERT INTO.
                        const expirationDate: Date = new Date(Date.now() - (expirationInSeconds * 1000));
                        eventEmitter.emit(
                            'message', 
                            new ProgressNoticePayload(`Archiving registers older than ${(expirationDate.getFullYear()).toString()}-${("0" + (expirationDate.getMonth() + 1)).slice(-2)}-${expirationDate.getDate()}`)
                        );
    
                        getExpiredStatusHistoryQuery(expirationInSeconds).getCount().then(async (totalExpiredHistoryRows: number) => {
                            eventEmitter.emit('message', new ProgressNoticePayload(`Registers to be archived: ${totalExpiredHistoryRows}`));
                            // eslint-disable-next-line no-constant-condition
                            while (true) {
                                const history: OpenVPNStatusHistory[] = await getExpiredStatusHistoryQuery(expirationInSeconds)
                                    .limit(2000)
                                    .getMany();
                                if (history.length <= 0) {
                                    eventEmitter.emit('message', new ProgressNoticePayload('Compressing archive file'));
                                    // When all expired registers have been processed, then zip the sql file
                                    // and remove it
                                    await Zip.zip(path.join(this._config.history.data_dir, yearDir, monthSubDir, fileName));
                                    await fs.remove(path.join(this._config.history.data_dir, yearDir, monthSubDir, fileName));
    
                                    eventEmitter.emit('message', new ProgressPayload('end', false, ''));
                                    
                                    return resolve(count);
                                }
    
                                count = count + history.length;
    
                                eventEmitter.emit('message', new ProgressNoticePayload(`Progress: ${count} of ${totalExpiredHistoryRows} registers`));
    
                                const table: string = getMetadataArgsStorage().tables.filter(item => item.target === OpenVPNStatusHistory)[0].name ?? OpenVPNStatusHistory.name;
                                const columns: ColumnMetadataArgs[] = getMetadataArgsStorage().columns.filter(item => item.target === OpenVPNStatusHistory);
                                const insertColumnDef: string = columns.map(item => `\`${item.options.name ?? item.propertyName}\``).join(',');
                                const content: string = `INSERT INTO \`${table}\` (${insertColumnDef}) VALUES \n ${history.map(item => `(${columns.map(column => item[column.propertyName] ? `'${item[column.propertyName]}'` : 'NULL').join(',')})`).join(',')};\n`;
    
                                const promise: Promise<void> = new Promise<void>((resolve, reject) => {
                                    fs.writeFile(path.join(this._config.history.data_dir, yearDir, monthSubDir, fileName), content, {flag: 'a'}, async (err) => {
                                        if (err) {
                                            return reject(err);
                                        }
                                        try {
                                            await db.getSource().manager.getRepository(OpenVPNStatusHistory).delete(history.map(item => item.id));
                                            return resolve();
                                        } catch (err) {
                                            return reject(err);
                                        }
                                    });
                                });
                                await promise.catch(err => reject(err));
                            }  
                        });
                    } catch (err) {
                        return reject(err);
                    }
                });
            });
        } catch (err) {
            if (err === E_ALREADY_LOCKED) {
                eventEmitter.emit('message', new ProgressPayload('error', false, 'There is another OpenVPN history archiver running'));
                throw new Error('There is another OpenVPN history archiver running');
            }
            throw err;
        }
    }
    

    /**
     * Remove archived history registers which are expired
     * 
     * @returns 
     */ 
    public async removeExpiredFiles(): Promise<number> {
        return new Promise<number>((resolve, reject) => {
            try {
                //Create an array with all files their paths
                const allFiles:{file:string, path:string}[] = []
                fs.readdirSync(this._config.history.data_dir).filter(dirent  => {
                    if(fs.existsSync(path.join(this._config.history.data_dir, dirent))){
                        fs.readdirSync(path.join(this._config.history.data_dir, dirent)).filter(subDirent => {
                            if(fs.existsSync(path.join(this._config.history.data_dir, dirent, subDirent))){
                                fs.readdirSync(path.join(this._config.history.data_dir, dirent, subDirent)).map(file => {
                                    allFiles.push({file: file, path: path.join(this._config.history.data_dir, dirent, subDirent)})
                                })
                            }
                        })
                    }  
                })
                const filesToRemove = allFiles.filter((fileName) => {
                    //Filter only fileNames openvpn_status_history-xxxxxx.sql.zip.
                    //Ignore otherwise
                    return new RegExp(/openvpn_status_history-[0-9]{8}\.sql\.zip/).test(fileName.file);
                }).filter((fileName) => {
                    //Filter only fileName which date is before limit date time for expiration
                    const date: Date = this.getDateFromArchiveFilename(fileName);
                    const limit: Date = new Date();
                    limit.setDate(limit.getDate() - this._config.history.retention_days);
                    return date < limit;
                });
                filesToRemove.forEach(fileName => fs.unlinkSync(path.join(fileName.path, fileName.file)));

                return resolve(filesToRemove.length);
            }catch(err) {
                return reject(err)
            } 
        });
    }

    /**
     * Updates cutomizable parameters and reloads the config
     * 
     * @param custom_config 
     * @returns 
     */
    public async updateArchiveConfig(custom_config: OpenVPNUpdateableConfig): Promise<OpenVPNUpdateableConfig> {
        custom_config = await this.writeCustomizedConfig(custom_config);
        this._config = this.loadCustomizedConfig(this._config);
        
        return custom_config;
    }

    /**
     * Load custom config and merge it over the base configuration
     * 
     * @param base_config 
     * @returns 
     */
    protected loadCustomizedConfig(base_config: OpenVPNConfig): OpenVPNConfig {
        let config: OpenVPNConfig = base_config;
                
        const openvpnConfigFile: string = path.join(base_config.history.data_dir, 'config.json');

        if (fs.existsSync(openvpnConfigFile)) {
            const backupConfig = JSON.parse(fs.readFileSync(openvpnConfigFile, 'utf8'));
            config = ObjectHelpers.deepMerge<OpenVPNConfig>(config, backupConfig);
        }

        return config;
    }

    /**
     * Write custom params into the custom configuration file
     * @param custom_config 
     * @returns 
     */
    protected writeCustomizedConfig(custom_config: OpenVPNUpdateableConfig): Promise<OpenVPNUpdateableConfig> {
        return new Promise((resolve, reject) => {
            if (!fs.existsSync(this._config.history.data_dir)) {
                fs.mkdirp(this._config.history.data_dir)
                    .then(() => {
                        const openvpnConfigFile = path.join(this._config.history.data_dir, 'config.json');
                        return fs.writeFile(openvpnConfigFile, JSON.stringify(custom_config), 'utf8');
                    })
                    .then(() => resolve(custom_config))
                    .catch(error => reject(error));
            } else {
                const openvpnConfigFile = path.join(this._config.history.data_dir, 'config.json');
                fs.writeFile(openvpnConfigFile, JSON.stringify(custom_config), 'utf8')
                    .then(() => resolve(custom_config))
                    .catch(error => reject(error));
            }
        });
    }
    

    /**
     * Returns a Date instance when the archive file was created.
     * 
     * Warning! filename must follow openvpn_status_history-xxxxxxxx.sql.zip convention
     * 
     * @param filename 
     * @returns 
     */
    protected getDateFromArchiveFilename(filename: {path:string, file:string}): Date {
        
        const { birthtime } = fs.lstatSync(path.join(filename.path, filename.file))

        return birthtime;
    }
}