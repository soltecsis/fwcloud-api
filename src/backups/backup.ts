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

import * as path from "path";
import * as fs from "fs";
import * as fse from "fs-extra"
import { app } from "../fonaments/abstract-application";
import { DatabaseService, DatabaseConfig } from "../database/database.service";
import moment, { Moment } from "moment";

import mysqldump, { DumpReturn } from "mysqldump";
import { BackupNotFoundException } from "./exceptions/backup-not-found-exception";
import { Responsable } from "../fonaments/contracts/responsable";
import { RestoreBackupException } from "./exceptions/restore-backup-exception";
import StringHelper from "../utils/string.helper";
import { FSHelper } from "../utils/fs-helper";
import { Application } from "../Application";
import { Progress } from "../fonaments/http/progress/progress";
import { FwCloud } from "../models/fwcloud/FwCloud";
import { RepositoryService } from "../database/repository.service";
import { Repository } from "typeorm";
import { FirewallRepository } from "../models/firewall/firewall.repository";
import { Firewall } from "../models/firewall/Firewall";
import { PolicyCompilation } from "../models/policy/PolicyCompilation";
import { Task } from "../fonaments/http/progress/task";
import { PathHelper } from "../utils/path-helpers";
import { EventEmitter } from "typeorm/platform/PlatformTools";
const mysql_import = require('mysql-import');

export interface BackupMetadata {
    name: string,
    timestamp: number;
    version: string;
    comment: string;
    schema: string;
}
export class Backup implements Responsable {
    static DUMP_FILENAME: string = 'db.sql';
    static METADATA_FILENAME: string = 'backup.json';
    static DATA_DIRNAME: string = 'DATA';

    protected _id: number;
    protected _name: string;
    protected _date: Moment;
    protected _exists: boolean;
    protected _backupPath: string;
    protected _dumpFilename: string;
    protected _comment: string;
    protected _version: string;
    protected _schema: string;

    constructor() {
        this._id = null;
        this._name = null;
        this._date = null;
        this._exists = false;
        this._backupPath = null;
        this._dumpFilename = null;
        this._comment = null;
        this._version = null;
        this._schema = null;
    }

    toResponse(): Object {
        return {
            id: this._id,
            version: this._version,
            schema: this._schema ? this._schema : null,
            name: this._name,
            date: this._date.utc(),
            comment: this._comment
        }
    }

    get version(): string {
        return this._version;
    }

    get schema(): string {
        return this._schema;
    }

    /**
     * Returns the backup date
     */
    get date(): Moment {
        return this._date;
    }

    get timestamp(): number {
        return this._date.valueOf();
    }

    get name(): string {
        return this._name;
    }

    /**
     * Returns the backup id (formated date)
     */
    get id(): number {
        return this._id;
    }

    /**
     * Returns the backup path
     */
    get path(): string {
        return this._backupPath;
    }

    get comment(): string {
        return this._comment;
    }

    public setComment(comment: string) {
        this._comment = comment;
    }

    /**
     * Returns the whether the backup
     */
    public exists(): boolean {
        return this._exists;
    }

    /**
     * Loads a backup from a filesystem path
     * 
     * @param backupPath Backup path
     */
    async load(backupPath: string): Promise<Backup> {
        const dbConfig: DatabaseConfig = (await app().getService<DatabaseService>(DatabaseService.name)).config;

        if (fs.statSync(backupPath).isDirectory() && fs.statSync) {
            const metadata: BackupMetadata = this.loadMetadataFromDirectory(backupPath);
            this._date = moment(metadata.timestamp);
            this._id = metadata.timestamp;
            this._name = metadata.name;
            this._comment = metadata.comment;
            this._exists = true;
            this._version = metadata.version;
            this._schema = metadata.schema;
            this._backupPath = path.isAbsolute(backupPath) ? StringHelper.after(path.join(app().path, "/"), backupPath) : backupPath;
            this._dumpFilename = Backup.DUMP_FILENAME
            return this;
        }

        throw new BackupNotFoundException(backupPath);
    }

    protected loadMetadataFromDirectory(directory: string): BackupMetadata {
        const metadataPath: string = path.join(directory, Backup.METADATA_FILENAME);

        if (fs.statSync(metadataPath).isFile()) {
            return <BackupMetadata>JSON.parse(fs.readFileSync(metadataPath).toString());
        }

        throw new BackupNotFoundException(metadataPath);
    }

    /**
     * Creates a backup into the path
     * 
     * @param backupDirectory Backup path
     */
    public async create(backupDirectory: string, eventEmitter = new EventEmitter()): Promise<Backup> {
        const progress = new Progress(eventEmitter);
        this._date = moment();
        this._id = moment().valueOf();
        this._version = app<Application>().version.tag;
        this._schema = app<Application>().version.schema;
        this._name = this._date.format('YYYY-MM-DD HH:mm:ss');
        this._backupPath = path.join(backupDirectory, this.timestamp.toString());

        this.createDirectorySync();
        this.exportMetadataFileSync();

        await progress.procedure('Creating backup', (task: Task) => {
            task.parallel((task: Task) => {
                task.addTask(() => { return this.exportDatabase(); }, 'Database exported');
                task.addTask(() => { return this.exportDataDirectories(); }, 'Data directories exported');
            });
        }, 'Backup created');

        return await this.load(this._backupPath);
    }

    /**
     * Restores an existing backup
     */
    async restore(eventEmitter: EventEmitter = new EventEmitter()): Promise<Backup> {
        const progress = new Progress(eventEmitter);

        if (this._exists) {
            await progress.procedure('Restoring backup', (task: Task) => {
                task.parallel((task: Task) => {
                    task.addTask(() => { return this.importDatabase(); }, 'Database restored');
                    task.addTask(() => { return this.importDataDirectories(); }, 'Data directories restored');
                })
            }, 'Backup restored');

            return this;
        }

        throw new BackupNotFoundException(this._backupPath);
    }

    /**
     * Destroys an existing backup
     */
    async destroy(): Promise<Backup> {
        if (this._exists) {
            fse.removeSync(this._backupPath);
            this._exists = false;
        }

        return this;
    }

    /**
     * Creates the backup directory
     */
    protected createDirectorySync(): void {
        if (fs.existsSync(this._backupPath)) {
            fse.removeSync(this._backupPath);
        }

        fs.mkdirSync(this._backupPath);
    }

    protected exportMetadataFileSync(): void {
        const metadata: BackupMetadata = {
            name: this._name,
            timestamp: this._date.valueOf(),
            version: app<Application>().version.tag,
            schema: app<Application>().version.schema,
            comment: this._comment
        };

        fs.writeFileSync(path.join(this._backupPath, Backup.METADATA_FILENAME), JSON.stringify(metadata, null, 2))
    }

    /**
     * Exports the database into a file
     */
    protected async exportDatabase(): Promise<DumpReturn> {
        const databaseService: DatabaseService = await app().getService<DatabaseService>(DatabaseService.name);
        const dbConfig: DatabaseConfig = databaseService.config;

        return mysqldump({
            connection: {
                host: dbConfig.host,
                port: dbConfig.port,
                user: dbConfig.user,
                password: dbConfig.pass,
                database: dbConfig.name,
            },
            dump: {
                data: {
                    maxRowsPerInsertStatement: 50
                }
            },
            dumpToFile: path.join(this._backupPath, Backup.DUMP_FILENAME),
        });
    }

    /**
     * Imports the database from a file
     */
    protected async importDatabase() {
        return new Promise(async (resolve, reject) => {
            const databaseService: DatabaseService = await app().getService<DatabaseService>(DatabaseService.name);
            const dbConfig: DatabaseConfig = databaseService.config;

            await databaseService.emptyDatabase();

            if (! await databaseService.isDatabaseEmpty()) {
                reject(new RestoreBackupException('Database can not be wiped'));
            }

            // Full database restore.
            const mydb_importer = mysql_import.config({
                host: dbConfig.host,
                user: dbConfig.user,
                port: dbConfig.port,
                password: dbConfig.pass,
                database: dbConfig.name,
                onerror: (err: Error) => {
                    reject(err);
                }
            });

            try {
                await mydb_importer.import(path.join(this._backupPath, Backup.DUMP_FILENAME));

                //Change compilation status from firewalls
                const firewallRepository: FirewallRepository = (await app().getService<RepositoryService>(RepositoryService.name)).for(Firewall);
                const firewalls: Array<Firewall> = await firewallRepository.find();
                await firewallRepository.markAsUncompiled(firewalls);

                //Remove all compiled rules
                const policyCompilationRepository: Repository<PolicyCompilation> = (await app().getService<RepositoryService>(RepositoryService.name)).for(PolicyCompilation);
                const policyCompilations: Array<PolicyCompilation> = await policyCompilationRepository.find();
                await policyCompilationRepository.remove(policyCompilations);

                //TODO: Make all VPNs pending of install.
                resolve();
            } catch (e) {
                reject(e);
            }
        });
    }

    /**
     * Copy DATA directories from the backup
     */
    protected async exportDataDirectories(): Promise<void> {
        const config = app().config;

        let item_list: Array<string> = ['pki', 'policy', 'snapshot'];

        for (let item of item_list) {
            const dst_dir = path.join(this._backupPath, Backup.DATA_DIRNAME, item);
            if (await FSHelper.directoryExists(config.get(item).data_dir)) {
                await fse.mkdirp(dst_dir);
                await fse.copy(config.get(item).data_dir, dst_dir);
            }
        }
    }

    /**
     * Copy DATA directories into the backup
     */
    protected async importDataDirectories(): Promise<void> {
        const config = app().config;

        let item_list: Array<string> = ['pki', 'policy', 'snapshot'];


        for (let item of item_list) {
            const src_dir: string = path.join(this._backupPath, Backup.DATA_DIRNAME, item);
            const dst_dir: string = config.get(item).data_dir;

            fse.removeSync(dst_dir);

            if (await FSHelper.directoryExists(src_dir)) {
                await fse.mkdirp(dst_dir);
                await fse.copy(src_dir, dst_dir);
            }
        }
    }
}