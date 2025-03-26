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

import {
  ProgressInfoPayload,
  ProgressPayload,
  ProgressNoticePayload,
} from '../../../sockets/messages/socket-message';
import { Service } from '../../../fonaments/services/service';
import { WireGuard } from './WireGuard';
import db from '../../../database/database-manager';
import { InstallerGenerator } from '../../../wireguard-installer/installer-generator';
import { getMetadataArgsStorage, SelectQueryBuilder } from 'typeorm';
import { CronService } from '../../../backups/cron/cron.service';
import { CronJob } from 'cron';
import { logger } from '../../../fonaments/abstract-application';
import { WireGuardStatusHistory } from './status/wireguard-status-history';
import * as fs from 'fs-extra';
import { ColumnMetadataArgs } from 'typeorm/metadata-args/ColumnMetadataArgs';
import path from 'path';
import { Zip } from '../../../utils/zip';
import ObjectHelpers from '../../../utils/object-helpers';
import { Mutex, tryAcquire, E_ALREADY_LOCKED } from 'async-mutex';
import { EventEmitter } from 'events';
import { Firewall } from '../../firewall/Firewall';

export type WireGuardConfig = {
  history: {
    data_dir: string;
    archive_schedule: string;
    archive_days: number;
    retention_schedule: string;
    retention_days: number;
  };
};

export type WireGuardUpdateableConfig = {
  history: {
    archive_days: number;
    retention_days: number;
  };
};

export class WireGuardService extends Service {
  protected _config: WireGuardConfig;
  protected _cronService: CronService;

  protected _scheduledHistoryArchiveJob: CronJob;
  protected _scheduledRetentionJob: CronJob;

  protected _archiveMutex = new Mutex();

  public async build(): Promise<WireGuardService> {
    // this._config = this.loadCustomizedConfig(this._app.config.get('wireGuard'));
    // this._cronService = await this._app.getService<CronService>(CronService.name);

    // const archiveDirectory: string = this._config.history.data_dir;

    // if (!fs.existsSync(archiveDirectory)) {
    //   fs.mkdirpSync(archiveDirectory);
    // }

    return this;
  }

  public startScheduledTasks(): void {
    this._scheduledHistoryArchiveJob = this._cronService.addJob(
      this._config.history.archive_schedule,
      async () => {
        await this._archiveMutex.waitForUnlock();

        try {
          logger().info('Starting WireGuardHistory archive job.');
          const removedItemsCount: number = await this.archiveHistory();
          logger().info(
            `WireGuardHistory archive job completed: ${removedItemsCount} rows archived.`,
          );
        } catch (error) {
          logger().error('WireGuardHistory archive job ERROR: ', error.message);
        }
      },
    );
    this._scheduledHistoryArchiveJob.start();

    this._scheduledRetentionJob = this._cronService.addJob(
      this._config.history.retention_schedule,
      async () => {
        try {
          logger().info('Starting WireGuardHistory retention job.');
          const removedItemsCount: number = await this.removeExpiredFiles();
          logger().info(
            `WireGuardHistory archive job completed: ${removedItemsCount} files removed.`,
          );
        } catch (error) {
          logger().error('WireGuardHistory retention job ERROR: ', error.message);
        }
      },
    );
    this._scheduledRetentionJob.start();
  }

  public async generateInstaller(
    name: string,
    wireGuard: WireGuard,
    outputPath: string,
  ): Promise<string> {
    let configData: string;

    try {
      const wireGuardId: number = wireGuard.id;
      const firewall: Firewall = await db
        .getSource()
        .manager.getRepository(Firewall)
        .findOne({
          where: { id: wireGuard.firewallId },
          relations: ['fwCloud'],
        });
      const fwCloudId: number = firewall.fwCloudId;

      configData = ((await WireGuard.dumpCfg(db.getQuery(), wireGuardId)) as any).cfg;
    } catch (e) {
      throw new Error(
        'Unable to generate the wireGuard configuration during installer generation: ' +
          JSON.stringify(e),
      );
    }

    const installerGenerator: InstallerGenerator = new InstallerGenerator(
      'lib/nsis',
      name,
      configData,
      outputPath,
    );
    return installerGenerator.generate();
  }

  public getCustomizedConfig(): WireGuardUpdateableConfig {
    this._config = this.loadCustomizedConfig(this._app.config.get('wireGuard'));

    return {
      history: {
        archive_days: this._config.history.archive_days,
        retention_days: this._config.history.retention_days,
      },
    };
  }

  /**
   * Archives history registers into a zipped file after an expiration time
   *
   * @returns
   */
  public async archiveHistory(eventEmitter: EventEmitter = new EventEmitter()): Promise<number> {
    function getExpiredStatusHistoryQuery(
      expirationInSeconds: number,
    ): SelectQueryBuilder<WireGuardStatusHistory> {
      return db
        .getSource()
        .manager.getRepository(WireGuardStatusHistory)
        .createQueryBuilder('history')
        .where('history.timestampInSeconds <= :timestamp', {
          timestamp: (Date.now() - expirationInSeconds * 1000) / 1000,
        });
    }
    try {
      return await tryAcquire(this._archiveMutex).runExclusive(() => {
        return new Promise<number>(async (resolve, reject) => {
          this._config = this.loadCustomizedConfig(this._app.config.get('wireGuard'));

          eventEmitter.emit(
            'message',
            new ProgressInfoPayload('Starting WireGuard history archiver'),
          );
          eventEmitter.emit('message', new ProgressNoticePayload('Checking expired history'));

          const expirationInSeconds: number = this._config.history.archive_days * 24 * 60 * 60;
          // If there isn't any row expired, then do nothing
          if ((await getExpiredStatusHistoryQuery(expirationInSeconds).limit(1).getCount()) === 0) {
            eventEmitter.emit('message', new ProgressNoticePayload('Nothing to archive'));
            eventEmitter.emit('message', new ProgressPayload('end', false, ''));

            return resolve(0);
          }

          let count: number = 0;
          const date: Date = new Date();
          const yearDir: string = date.getFullYear().toString();
          const monthSubDir: string = ('0' + (date.getMonth() + 1)).slice(-2);
          const fileName: string = `wireGuard_status_history-${date.getFullYear()}${('0' + (date.getMonth() + 1)).slice(-2)}${('0' + date.getDate()).slice(-2)}.sql`;

          // If there is already a zipped file, then unzip it in order to write down new registers there
          if (
            await fs.pathExists(
              `${path.join(this._config.history.data_dir, yearDir, monthSubDir, fileName)}.zip`,
            )
          ) {
            eventEmitter.emit(
              'message',
              new ProgressNoticePayload('Decompressing existing zip file'),
            );

            await Zip.unzip(
              `${path.join(this._config.history.data_dir, yearDir, monthSubDir, fileName)}.zip`,
              path.join(this._config.history.data_dir, yearDir, monthSubDir),
            );
            await fs.remove(
              `${path.join(this._config.history.data_dir, yearDir, monthSubDir, fileName)}.zip`,
            );
          } else {
            fs.mkdirpSync(path.join(this._config.history.data_dir, yearDir, monthSubDir));
          }
          // Could exists millions of registers. In order to avoid an high memory consumption
          // we are going to process rows in batches of 2000 (that means create multiple INSERT INTO in the file).
          // Notice mysql might limit the size of the queries thus is recommended create multiple "INSERT INTO" instead
          // of just one really big INSERT INTO.

          const expirationDate: Date = new Date(Date.now() - expirationInSeconds * 1000);
          eventEmitter.emit(
            'message',
            new ProgressNoticePayload(
              `Archiving registers older than ${expirationDate.getFullYear().toString()}-${('0' + (expirationDate.getMonth() + 1)).slice(-2)}-${expirationDate.getDate()}`,
            ),
          );

          const totalExpiredHistoryRows =
            await getExpiredStatusHistoryQuery(expirationInSeconds).getCount();

          eventEmitter.emit(
            'message',
            new ProgressNoticePayload(`Registers to be archived: ${totalExpiredHistoryRows}`),
          );

          while (true) {
            const history: WireGuardStatusHistory[] = await getExpiredStatusHistoryQuery(
              expirationInSeconds,
            )
              .limit(2000)
              .getMany();
            if (history.length <= 0) {
              eventEmitter.emit('message', new ProgressNoticePayload('Compressing archive file'));
              //When all expired registers have been processed, then zip the sql file
              // and remove it
              await Zip.zip(
                path.join(this._config.history.data_dir, yearDir, monthSubDir, fileName),
              );
              await fs.remove(
                path.join(this._config.history.data_dir, yearDir, monthSubDir, fileName),
              );

              eventEmitter.emit('message', new ProgressPayload('end', false, ''));

              return resolve(count);
            }

            count = count + history.length;

            eventEmitter.emit(
              'message',
              new ProgressNoticePayload(
                `Progress: ${count} of ${totalExpiredHistoryRows} registers`,
              ),
            );

            const table: string =
              getMetadataArgsStorage().tables.filter(
                (item) => item.target === WireGuardStatusHistory,
              )[0].name ?? WireGuardStatusHistory.name;
            const columns: ColumnMetadataArgs[] = getMetadataArgsStorage().columns.filter(
              (item) => item.target === WireGuardStatusHistory,
            );
            const insertColumnDef: string = columns
              .map((item) => `\`${item.options.name ?? item.propertyName}\``)
              .join(',');
            const content: string = `INSERT INTO \`${table}\` (${insertColumnDef}) VALUES \n ${history.map((item) => `(${columns.map((column) => (item[column.propertyName] ? `'${item[column.propertyName]}'` : 'NULL')).join(',')})`).join(',')};\n`;

            const promise: Promise<void> = new Promise<void>((resolve, reject) => {
              fs.writeFile(
                path.join(this._config.history.data_dir, yearDir, monthSubDir, fileName),
                content,
                { flag: 'a' },
                async (err: any) => {
                  if (err) {
                    return reject(err);
                  }
                  try {
                    await db
                      .getSource()
                      .manager.getRepository(WireGuardStatusHistory)
                      .delete(history.map((item) => item.id));
                    return resolve();
                  } catch (err) {
                    return reject(err);
                  }
                },
              );
            });
            await promise.catch((err) => reject(err));
          }
        });
      });
    } catch (err) {
      if (err === E_ALREADY_LOCKED) {
        eventEmitter.emit(
          'message',
          new ProgressPayload(
            'error',
            false,
            'There is another WireGuard history archiver running',
          ),
        );
        throw new Error('There is another WireGuard history archiver runnning');
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
    return new Promise<number>(async (resolve, reject) => {
      try {
        //Create an array with all files their paths
        const allFiles: { file: string; path: string }[] = [];
        fs.readdirSync(this._config.history.data_dir).filter((dirent: string) => {
          if (fs.existsSync(path.join(this._config.history.data_dir, dirent))) {
            fs.readdirSync(path.join(this._config.history.data_dir, dirent)).filter(
              (subDirent: string) => {
                if (fs.existsSync(path.join(this._config.history.data_dir, dirent, subDirent))) {
                  fs.readdirSync(path.join(this._config.history.data_dir, dirent, subDirent)).map(
                    (file: any) => {
                      allFiles.push({
                        file: file,
                        path: path.join(this._config.history.data_dir, dirent, subDirent),
                      });
                    },
                  );
                }
              },
            );
          }
        });
        const filesToRemove = allFiles
          .filter((fileName) => {
            //Filter only fileNames wireGuard_status_history-xxxxxx.sql.zip.
            //Ignore otherwise
            return new RegExp(/wireGuard_status_history-[0-9]{8}\.sql\.zip/).test(fileName.file);
          })
          .filter((fileName) => {
            //Filter only fileName which date is before limit date time for expiration
            const date: Date = this.getDateFromArchiveFilename(fileName);
            const limit: Date = new Date();
            limit.setDate(limit.getDate() - this._config.history.retention_days);
            return date < limit;
          });
        filesToRemove.forEach((fileName) => fs.unlinkSync(path.join(fileName.path, fileName.file)));

        return resolve(filesToRemove.length);
      } catch (err) {
        return reject(err);
      }
    });
  }

  /**
   * Updates cutomizable parameters and reloads the config
   *
   * @param custom_config
   * @returns
   */
  public async updateArchiveConfig(
    custom_config: WireGuardUpdateableConfig,
  ): Promise<WireGuardUpdateableConfig> {
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
  protected loadCustomizedConfig(base_config: WireGuardConfig): WireGuardConfig {
    let config: WireGuardConfig = base_config;

    const wireGuardConfigFile: string = path.join(base_config.history.data_dir, 'config.json');

    if (fs.existsSync(wireGuardConfigFile)) {
      const backupConfig = JSON.parse(fs.readFileSync(wireGuardConfigFile, 'utf8'));
      config = ObjectHelpers.deepMerge<WireGuardConfig>(config, backupConfig);
    }

    return config;
  }

  /**
   * Write custom params into the custom configuration file
   * @param custom_config
   * @returns
   */
  protected async writeCustomizedConfig(
    custom_config: WireGuardUpdateableConfig,
  ): Promise<WireGuardUpdateableConfig> {
    return new Promise(async (resolve, reject) => {
      try {
        if (!fs.existsSync(this._config.history.data_dir)) {
          await fs.mkdirp(this._config.history.data_dir);
        }

        const wireGuardConfigFile = path.join(this._config.history.data_dir, 'config.json');
        await fs.writeFile(wireGuardConfigFile, JSON.stringify(custom_config), 'utf8');
        return resolve(custom_config);
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Returns a Date instance when the archive file was created.
   *
   * Warning! filename must follow wireGuard_status_history-xxxxxxxx.sql.zip convention
   *
   * @param filename
   * @returns
   */
  protected getDateFromArchiveFilename(filename: { path: string; file: string }): Date {
    const { birthtime } = fs.lstatSync(path.join(filename.path, filename.file));

    return birthtime;
  }
}
