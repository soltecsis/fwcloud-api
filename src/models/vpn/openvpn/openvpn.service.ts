import { Service } from "../../../fonaments/services/service";
import { OpenVPN } from "./OpenVPN";
import db from "../../../database/database-manager";
import { InstallerGenerator } from "../../../openvpn-installer/installer-generator";
import { getMetadataArgsStorage, getRepository, SelectQueryBuilder } from "typeorm";
import { Firewall } from "../../firewall/Firewall";
import { CronService } from "../../../backups/cron/cron.service";
import { CronJob } from "cron";
import { logger } from "../../../fonaments/abstract-application";
import { OpenVPNStatusHistory } from "./status/openvpn-status-history";
import * as fs from "fs-extra";
import { ColumnMetadataArgs } from "typeorm/metadata-args/ColumnMetadataArgs";
import path from "path";
import { Zip } from "../../../utils/zip";

type OpenVPNConfig {
    history: {
        data_dir: string,
        archive_schedule: string,
        archive_days: number,
        retention_schedule: string,
        retention_days: number
    }
}

export class OpenVPNService extends Service {

    protected _config: OpenVPNConfig;
    protected _cronService: CronService;

    protected _scheduledHistoryArchiveJob: CronJob;
    protected _scheduledRetentionJob: CronJob;


    public async build(): Promise<OpenVPNService> {
        this._config = this._app.config.get('openvpn');
        this._cronService = await this._app.getService<CronService>(CronService.name);

        let archiveDirectory: string = this._config.history.data_dir;

        if (!fs.existsSync(archiveDirectory)) {
            fs.mkdirpSync(archiveDirectory);
        }

        return this;
    }

    public startScheduledTasks(): void {
        this._scheduledHistoryArchiveJob = this._cronService.addJob(this._config.history.archive_schedule, async () => {
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
            const firewall: Firewall = await getRepository(Firewall).findOne(openVPN.firewallId, { relations: ['fwCloud']});
            const fwCloudId: number = firewall.fwCloudId;
            
            configData = (await OpenVPN.dumpCfg(db.getQuery(), fwCloudId, openVPNId) as any).cfg;
            
        } catch (e) {
            throw new Error('Unable to generate the openvpn configuration during installer generation: ' + JSON.stringify(e));
        }

        const installerGenerator: InstallerGenerator = new InstallerGenerator("lib/nsis", name, configData, outputPath)
        return installerGenerator.generate();
    }

    /**
     * Archives history registers into a zipped file after an expiration time
     * 
     * @returns 
     */
    public async archiveHistory(): Promise<number> {
        function getExpiredStatusHistoryQuery(expirationInSeconds: number): SelectQueryBuilder<OpenVPNStatusHistory> {
            return getRepository(OpenVPNStatusHistory).createQueryBuilder('history')
                .where('history.timestampInSeconds <= :timestamp', {timestamp: (Date.now() - expirationInSeconds * 1000) / 1000});
        }

        return new Promise<number>(async (resolve, reject) => {
            const expirationInSeconds: number = this._config.history.archive_days * 24 * 60;

            // If there isn't any row expired, then do nothing
            if ((await getExpiredStatusHistoryQuery(expirationInSeconds).limit(1).getCount()) === 0) {
                return resolve(0);
            }


            let count: number = 0;
            const date: Date = new Date();
            const fileName:string = `openvpn_status_history-${date.getFullYear()}${("0" + (date.getMonth() + 1)).slice(-2)}${("0" + date.getDate()).slice(-2)}.sql`;

            // If there is already a zipped file, then unzip it in order to write down new registers there
            if (await fs.pathExists(`${path.join(this._config.history.data_dir, fileName)}.zip`)) {
                await Zip.unzip(`${path.join(this._config.history.data_dir, fileName)}.zip`, this._config.history.data_dir);
                await fs.remove(`${path.join(this._config.history.data_dir, fileName)}.zip`);
            }

            // Could exists millions of registers. In order to avoid an high memory consumption
            // we are going to process rows in batches of 2000 (that means create multiple INSERT INTO in the file).
            // Notice mysql might limit the size of the queries thus is recommended create multiple "INSERT INTO" instead
            // of just one really big INSERT INTO.
            while(true) {
                const history: OpenVPNStatusHistory[] = await getExpiredStatusHistoryQuery(expirationInSeconds)
                    .limit(2000)
                    .getMany();

                if (history.length <= 0) {
                    //When all expired registers have been processed, then zip the sql file
                    // and remove it
                    await Zip.zip(path.join(this._config.history.data_dir, fileName));
                    await fs.remove(path.join(this._config.history.data_dir, fileName));

                    return resolve(count);
                }

                count = count + history.length;

                const table: string = getMetadataArgsStorage().tables.filter(item => item.target === OpenVPNStatusHistory)[0].name ?? OpenVPNStatusHistory.name;
                const columns: ColumnMetadataArgs[] = getMetadataArgsStorage().columns.filter(item => item.target === OpenVPNStatusHistory);
                const insertColumnDef: string = columns.map(item => `\`${item.options.name ?? item.propertyName}\``).join(',');
                const content: string = `INSERT INTO \`${table}\` (${insertColumnDef}) VALUES \n ${history.map(item => `(${columns.map(column => item[column.propertyName] ? `'${item[column.propertyName]}'` : 'NULL').join(',')})`).join(',')};\n`;

                const promise: Promise<void> = new Promise<void>((resolve, reject) => {
                    fs.writeFile(path.join(this._config.history.data_dir, fileName), content, {flag: 'a'} ,async (err) => {
                        if (err) {
                            return reject(err);
                        }

                        try {
                            await getRepository(OpenVPNStatusHistory).delete(history.map(item => item.id));
                            return resolve();
                        } catch(err) {
                            return reject(err);
                        }
                    });
                })

                await promise.catch(err => reject(err));
            }
        });
    }

    /**
     * Remove archived history registers which are expired
     * 
     * @returns 
     */
    public async removeExpiredFiles(): Promise<number> {
        return new Promise<number>((resolve, reject) => {
            fs.readdir(this._config.history.data_dir, (err, files: string[]) => {
                if (err) {
                    return reject(err);
                }

                const filesToRemove: string[] = files.filter(fileName => {
                    const dateString: string = fileName.split("-")[1] ?? null;

                    if (dateString) {
                        const date: Date = new Date();
                        date.setFullYear(
                            parseInt(dateString.substring(0, 4)),
                            parseInt(dateString.substring(4, 6)) - 1,
                            parseInt(dateString.substring(6, 8))
                        );

                        const limit: Date = new Date();
                        limit.setDate(limit.getDate() - this._config.history.retention_days);

                        return date < limit;
                    }

                    return false;
                });

                filesToRemove.forEach(fileName => {
                    fs.unlink(path.join(this._config.history.data_dir, fileName));
                });

                return resolve(filesToRemove.length);

            })
        });
    }
}