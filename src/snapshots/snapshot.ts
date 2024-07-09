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

import { Moment } from 'moment';
import { Responsable } from '../fonaments/contracts/responsable';
import { app } from '../fonaments/abstract-application';
import { FSHelper } from '../utils/fs-helper';
import moment from 'moment';
import * as path from 'path';
import * as fs from 'fs-extra';
import { FwCloud } from '../models/fwcloud/FwCloud';
import { Application } from '../Application';
import { DatabaseExporter } from '../fwcloud-exporter/database-exporter/database-exporter';
import { Progress } from '../fonaments/http/progress/progress';
import { BulkDatabaseDelete } from './bulk-database-delete';
import { SnapshotNotCompatibleException } from './exceptions/snapshot-not-compatible.exception';
import { Firewall } from '../models/firewall/Firewall';
import { FirewallRepository } from '../models/firewall/firewall.repository';
import { Task } from '../fonaments/http/progress/task';
import * as semver from 'semver';
import { ExporterResult } from '../fwcloud-exporter/database-exporter/exporter-result';
import { DatabaseImporter } from '../fwcloud-exporter/database-importer/database-importer';
import { SnapshotService } from './snapshot.service';
import { BackupService } from '../backups/backup.service';
import { EventEmitter } from 'typeorm/platform/PlatformTools';
import { Migration } from 'typeorm';
import { DatabaseService } from '../database/database.service';
import * as crypto from 'crypto';
import db from '../database/database-manager';

export type SnapshotMetadata = {
  timestamp: number;
  name: string;
  comment: string;
  version: string;
  migrations: string[];
  hash: string;
};

export const snapshotDigestContent: string = 'FWCloud';

export class Snapshot implements Responsable {
  static METADATA_FILENAME = 'snapshot.json';
  static DATA_FILENAME = 'data.json';
  static DEPENDENCY_FILENAME = 'dep.json';

  static DATA_DIRECTORY = '_data';
  static PKI_DIRECTORY = path.join(Snapshot.DATA_DIRECTORY, 'pki');
  static POLICY_DIRECTORY = path.join(Snapshot.DATA_DIRECTORY, 'policy');

  protected _id: number;
  protected _date: Moment;
  protected _name: string;
  protected _comment: string;
  protected _fwCloud: FwCloud;
  protected _version: string;
  protected _hash: string;

  protected _compatible: boolean;

  protected _migrations: string[];

  protected _path: string;
  protected _exists: boolean;

  protected _data: ExporterResult;

  protected _restoredFwCloud: FwCloud;
  protected _firewallRepository: FirewallRepository;

  protected constructor() {
    this._id = null;
    this._date = null;
    this._name = null;
    this._comment = null;
    this._fwCloud = null;
    this._path = null;
    this._exists = false;
    this._version = null;
    this._data = null;
    this._compatible = false;
    this._hash = null;
    this._firewallRepository = new FirewallRepository(db.getSource().manager);
  }

  get name(): string {
    return this._name;
  }

  get comment(): string {
    return this._comment;
  }

  get fwCloud(): FwCloud {
    return this._fwCloud;
  }

  get id(): number {
    return this._id;
  }

  get version(): string {
    return this._version;
  }

  get date(): Moment {
    return this._date;
  }

  get path(): string {
    return this._path;
  }

  get exists(): boolean {
    return this._exists;
  }

  get data(): ExporterResult {
    return this._data;
  }

  get compatible(): boolean {
    return this._compatible;
  }

  get migrations(): string[] {
    return this._migrations;
  }

  public isHashCompatible(): boolean {
    //Backwards compatibility. Snapshot might not have hash defined
    if (this._hash === undefined) {
      return false;
    }

    const digestedHash: string = crypto
      .createHmac('sha256', app().config.get('crypt.secret'))
      .update(snapshotDigestContent)
      .digest('hex');

    return digestedHash === this._hash;
  }

  /**
   * Create a backup using promises
   *
   * @param snapshot_directory Path without the fwcloud.id directory
   * @param fwCloud
   * @param name
   * @param comment
   */
  public static async create(
    snapshot_directory: string,
    fwCloud: FwCloud,
    name: string = null,
    comment: string = null,
    eventEmitter = new EventEmitter(),
  ): Promise<Snapshot> {
    const snapshot: Snapshot = new Snapshot();
    await snapshot.save(snapshot_directory, fwCloud, name, comment, eventEmitter);

    return Snapshot.load(snapshot.path);
  }

  /**
   * Restore using progress
   */
  public async restore(eventEmitter: EventEmitter = new EventEmitter()): Promise<FwCloud> {
    const progress: Progress = new Progress(eventEmitter);

    if (!this.compatible) {
      throw new SnapshotNotCompatibleException(this);
    }

    await progress.procedure(
      'Restoring snapshot',
      (task: Task) => {
        task.addTask(async () => {
          const backupService: BackupService = await app().getService<BackupService>(
            BackupService.name,
          );
          return backupService.create('Before snapshot (' + this.id + ') restore');
        }, 'Backup created');
        task.addTask(async () => {
          this._restoredFwCloud = await this.restoreDatabaseData(eventEmitter);
        }, 'FWCloud restored from snapshot');
        task.parallel((task: Task) => {
          task.addTask(() => {
            return this.resetCompiledStatus();
          }, 'Firewalls compilation flags reset');
          task.addTask(() => {
            return this.migrateSnapshots(this.fwCloud, this._restoredFwCloud);
          }, 'Snapshots migrated');
        });
        task.addTask(() => {
          return this._fwCloud.remove();
        }, 'Deprecated FWCloud removed');
      },
      'FWCloud snapshot restored',
    );

    return this._restoredFwCloud;
  }

  /**
   * Load an snapshot using the path provided
   *
   * @param snapshotPath The path must contain the fwcloud.id directory
   */
  protected async loadSnapshot(snapshotPath: string): Promise<Snapshot> {
    const databaseService = await app().getService<DatabaseService>(DatabaseService.name);
    const executedMigrations: Migration[] = await databaseService.getExecutedMigrations();

    const metadataPath: string = path.join(snapshotPath, Snapshot.METADATA_FILENAME);
    const dataPath: string = path.join(snapshotPath, Snapshot.DATA_FILENAME);
    const fwCloudId: number = parseInt(path.dirname(snapshotPath).split(path.sep).pop());

    const snapshotMetadata: SnapshotMetadata = JSON.parse(fs.readFileSync(metadataPath).toString());
    const dataContent: string = fs.readFileSync(dataPath).toString();

    this._id = parseInt(path.basename(snapshotPath));
    this._date = moment(snapshotMetadata.timestamp);
    this._path = snapshotPath;
    this._fwCloud = fwCloudId ? await FwCloud.findOne({ where: { id: fwCloudId } }) : null;
    this._name = snapshotMetadata.name;
    this._comment = snapshotMetadata.comment;
    this._version = snapshotMetadata.version;
    this._migrations = snapshotMetadata.migrations ?? [];
    this._exists = true;
    this._compatible = this.checkCompatibility(
      this._migrations,
      executedMigrations.map((migration) => migration.name),
    );
    this._data = new ExporterResult(JSON.parse(dataContent));
    this._hash = snapshotMetadata.hash ?? undefined;

    return this;
  }

  protected checkCompatibility(
    snapshotMigrations: string[],
    executedMigrations: string[],
  ): boolean {
    return snapshotMigrations.length === executedMigrations.length;
  }

  /**
   * Update the snapshot metadata
   *
   * @param snapshotData
   */
  public async update(snapshotData: { name: string; comment: string }): Promise<Snapshot> {
    this._name = snapshotData.name;
    this._comment = snapshotData.comment;

    this.saveMetadataFile();

    return this;
  }

  /**
   * Statically load an snapshot
   *
   * @param snapshotPath
   */
  public static async load(snapshotPath: string): Promise<Snapshot> {
    return new Snapshot().loadSnapshot(snapshotPath);
  }

  /**
   * Removes an snapshot from the filesystem
   */
  public async destroy(): Promise<Snapshot> {
    if (this._exists) {
      await FSHelper.rmDirectory(this._path);
      this._exists = false;
    }

    return this;
  }

  /**
   * Saves the instance into the filesystem
   *
   * @param snapshot_directory Path without the fwcloud.id directory
   * @param fwCloud
   * @param name
   * @param comment
   */
  protected async save(
    snapshot_directory: string,
    fwCloud: FwCloud,
    name: string = null,
    comment: string = null,
    eventEmitter: EventEmitter = new EventEmitter(),
  ): Promise<Snapshot> {
    const progress = new Progress(eventEmitter);
    const databaseService: DatabaseService = await app().getService<DatabaseService>(
      DatabaseService.name,
    );
    const executedMigrations: Migration[] = await databaseService.getExecutedMigrations();

    this._fwCloud = fwCloud;
    this._date = moment();
    this._id = this._date.valueOf();
    this._path = path.join(snapshot_directory, fwCloud.id.toString(), this._id.toString());
    this._name = name ? name : this._date.utc().format();
    this._comment = comment;
    this._version = app<Application>().version.tag;
    this._migrations = executedMigrations.map((migration: Migration) => {
      return migration.name;
    });
    this._hash = crypto
      .createHmac('sha256', app().config.get('crypt.secret'))
      .update(snapshotDigestContent)
      .digest('hex');

    if (FSHelper.directoryExistsSync(this._path)) {
      throw new Error('Snapshot with id = ' + this._id + ' already exists');
    }

    FSHelper.mkdirSync(this._path);
    this.saveMetadataFile();

    await progress.procedure(
      'Creating snapshot',
      (task: Task) => {
        task.parallel((task: Task) => {
          task.addTask(() => {
            return this.copyFwCloudDataDirectories();
          }, 'FWCloud data directories exported');
          task.addTask(() => {
            return this.saveDataFile();
          }, 'FWCloud database exported');
        });
      },
      'Snapshot created',
    );

    this._exists = true;
    this._compatible = this.checkCompatibility(
      this._migrations,
      executedMigrations.map((migration: Migration) => {
        return migration.name;
      }),
    );

    return this;
  }

  /**
   * Restore all snapshot data into the database
   */
  protected async restoreDatabaseData(
    eventEmitter: EventEmitter = new EventEmitter(),
  ): Promise<FwCloud> {
    const importer: DatabaseImporter = new DatabaseImporter(eventEmitter);

    const fwCloud: FwCloud = await importer.import(this);

    const oldFwCloud: FwCloud = await FwCloud.findOne({
      where: { id: this.fwCloud.id },
      relations: ['users'],
    });

    fwCloud.users = oldFwCloud.users;
    await FwCloud.save([fwCloud]);

    return fwCloud;
  }

  /**
   * Get all fwcloud data related from the database
   */
  protected async exportFwCloudDatabaseData(): Promise<ExporterResult> {
    return await new DatabaseExporter().export(this.fwCloud.id);
  }

  /**
   * Persist all fwcloud related data from database into the data file
   */
  protected async saveDataFile(): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      this.exportFwCloudDatabaseData()
        .then((data: ExporterResult) => {
          fs.writeFileSync(
            path.join(this._path, Snapshot.DATA_FILENAME),
            JSON.stringify(data.getAll(), null, 2),
          );
          return resolve();
        })
        .catch((e) => {
          return reject(e);
        });
    });
  }

  /**
   * Persist the metadatafile into the filesystem
   */
  protected saveMetadataFile(): void {
    const metadata: SnapshotMetadata = {
      timestamp: this._date.valueOf(),
      name: this._name,
      comment: this._comment,
      version: this._version,
      migrations: this._migrations,
      hash: this._hash,
    };

    fs.writeFileSync(
      path.join(this._path, Snapshot.METADATA_FILENAME),
      JSON.stringify(metadata, null, 2),
    );
  }

  /**
   * Copy all FwCloud DATA directory into the snapshot
   */
  protected async copyFwCloudDataDirectories(): Promise<void> {
    await FSHelper.mkdirSync(path.join(this._path, Snapshot.DATA_DIRECTORY));
    await FSHelper.copyDirectoryIfExists(
      this.fwCloud.getPkiDirectoryPath(),
      path.join(this._path, Snapshot.PKI_DIRECTORY),
    );
    await FSHelper.copyDirectoryIfExists(
      this.fwCloud.getPolicyDirectoryPath(),
      path.join(this._path, Snapshot.POLICY_DIRECTORY),
    );
  }

  /**
   * Removes all DATA fwcloud directory
   */
  protected async removeFwCloudDataDirectories(): Promise<void> {
    await FSHelper.rmDirectory(this.fwCloud.getPkiDirectoryPath());
    await FSHelper.rmDirectory(this.fwCloud.getPolicyDirectoryPath());
  }

  /**
   * Creates the snapshot/fwcloud.id directory if it does not exists (is the first snapshot for the given fwcloud)
   */
  protected static async generateSnapshotDirectoryIfDoesNotExist() {
    if (!(await FSHelper.directoryExists(app().config.get('snapshot').data_dir))) {
      FSHelper.mkdir(app().config.get('snapshot').data_dir);
    }
  }

  /**
   * Resets the firewalls compilation & installation status
   */
  protected async resetCompiledStatus(): Promise<void> {
    return new Promise<void>(async (resolve, reject) => {
      const fwcloud: FwCloud = await FwCloud.findOneOrFail({
        where: { id: this._restoredFwCloud.id },
        relations: ['clusters', 'firewalls'],
      });

      await this._firewallRepository.markAsUncompiled(fwcloud.firewalls);

      return resolve();
    });
  }

  protected async migrateSnapshots(oldFwCloud: FwCloud, newFwCloud: FwCloud): Promise<void> {
    const snapshotDirectory: string = (
      await app().getService<SnapshotService>(SnapshotService.name)
    ).config.data_dir;

    if (fs.existsSync(oldFwCloud.getSnapshotDirectoryPath())) {
      return fs.moveSync(
        path.join(snapshotDirectory, oldFwCloud.id.toString()),
        path.join(snapshotDirectory, newFwCloud.id.toString()),
      );
    }
  }

  toResponse(): object {
    return {
      id: this._id,
      name: this._name,
      comment: this._comment,
      fwcloud_id: this._fwCloud.id,
      date: this._date,
      version: this._version,
      compatible: this.compatible,
    };
  }
}
