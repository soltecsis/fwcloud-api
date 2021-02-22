/*!
    Copyright 2021 SOLTECSIS SOLUCIONES TECNOLOGICAS, SLU
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
import { app, logger } from "../fonaments/abstract-application";
import { DatabaseService, DatabaseConfig } from "../database/database.service";
import moment, { Moment } from "moment";

import { BackupNotFoundException } from "./exceptions/backup-not-found-exception";
import { Responsable } from "../fonaments/contracts/responsable";
import { RestoreBackupException } from "./exceptions/restore-backup-exception";
import StringHelper from "../utils/string.helper";
import { FSHelper } from "../utils/fs-helper";
import { Application } from "../Application";
import { Progress } from "../fonaments/http/progress/progress";
import { getCustomRepository, Migration } from "typeorm";
import { FirewallRepository } from "../models/firewall/firewall.repository";
import { Task } from "../fonaments/http/progress/task";
import { EventEmitter } from "typeorm/platform/PlatformTools";

import * as child_process from "child_process";
import { OpenVPNRepository } from "../models/vpn/openvpn/openvpn-repository";

export interface BackupMetadata {
    name: string,
    timestamp: number;
    version: string;
    comment: string;
    imported: boolean;
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
    protected _imported: boolean;

  constructor() {
        this._id = null;
        this._name = null;
        this._date = null;
        this._exists = false;
        this._backupPath = null;
        this._dumpFilename = null;
        this._comment = null;
        this._version = null;
        this._imported = false;
    }

    toResponse(): Object {
        return {
            id: this._id,
            version: this._version,
            name: this._name,
            date: this._date.utc(),
            comment: this._comment,
            imported: this._imported
        }
    }

    get version(): string {
        return this._version;
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

    get imported(): boolean {
        return this._imported;
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
        if (fs.statSync(backupPath).isDirectory() && fs.statSync) {
            const metadata: BackupMetadata = this.loadMetadataFromDirectory(backupPath);
            this._date = moment(metadata.timestamp);
            this._id = metadata.timestamp;
            this._name = metadata.name;
            this._comment = metadata.comment;
            this._exists = true;
            this._version = metadata.version;
            this._imported = metadata.imported ?? false;
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
        // If it is not possible to run the mysqldump command, then it is not possible to run the backup procedure.
        if (! await this.existsCmd('mysqldump')) {
            const err = new Error('Command mysqldump not found or it is not possible to execute it');
            logger().error(err.message);
            throw err;
        }

        const progress = new Progress(eventEmitter);
        this._date = moment();
        this._id = moment().valueOf();
        this._version = app<Application>().version.tag;
        this._name = this._date.format('YYYY-MM-DD HH:mm:ss');
        this._backupPath = path.join(backupDirectory, this.timestamp.toString());
            
        this.createDirectorySync();
        this.exportMetadataFileSync();

        try {
            await progress.procedure('Creating backup', (task: Task) => {
                task.parallel((task: Task) => {
                    task.addTask(() => { return this.exportDatabase(); }, 'Database backup');
                    task.addTask(() => { return this.exportDataDirectories(); }, 'Data directories backup');
                });
            }, 'Backup created');
        } catch(err) {
            // If the backup task has fault for some reason, (for example, mysqldump command not found)
            // then destroy it for avoid having an incomplete backup.
            this._exists = true;
            await this.destroy();

            throw(err);
        }

        return await this.load(this._backupPath);
    }

    /**
     * Restores an existing backup
     */
    async restore(eventEmitter: EventEmitter = new EventEmitter()): Promise<Backup> {
        // If it is not possible to run the mysql command, then it is not possible to run the restore procedure.
        if (! await this.existsCmd('mysql')) {
            const err = new Error('Command mysql not found or it is not possible to execute it');
            logger().error(err.message);
            throw err;
        }

        const progress = new Progress(eventEmitter);

        if (this._exists) {
            await progress.procedure('Restoring backup', (task: Task) => {
                task.sequence((task: Task) => {
                    task.parallel((task: Task) => {
                        task.addTask(() => { return this.importDatabase(); }, 'Database restore');
                        task.addTask(() => { return this.importDataDirectories(); }, 'Data directories restore');
                    });
                    task.addTask(async (_) => { return this.runMigrations(); }, 'Database migration');
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
            comment: this._comment,
            imported: false,
        };

        fs.writeFileSync(path.join(this._backupPath, Backup.METADATA_FILENAME), JSON.stringify(metadata, null, 2))
    }

    /**
     * Exports the database into a file
     */
    protected async exportDatabase(): Promise<void> {
        const databaseService: DatabaseService = await app().getService<DatabaseService>(DatabaseService.name);

        return new Promise((resolve, reject) => { 
            //console.time("mysqldump");
            child_process.exec(this.buildCmd('mysqldump',databaseService),(error,stdout,stderr) => {
                //console.timeEnd("mysqldump");
                if (error) return reject(error);
                resolve();     
            });
        });
    }

    /**
     * Imports the database from a file
     */
    protected async importDatabase():Promise<void> {
        return new Promise(async (resolve, reject) => {
            try { 
                const databaseService: DatabaseService = await app().getService<DatabaseService>(DatabaseService.name);
        
                await databaseService.emptyDatabase();
                if (! await databaseService.isDatabaseEmpty())
                    return reject(new RestoreBackupException('Database can not be wiped'));
    
                //console.time("db import");
                child_process.execSync(this.buildCmd('mysql',databaseService));
                //console.timeEnd("db import");

                //Change compilation status from firewalls
                await getCustomRepository(FirewallRepository).markAllAsUncompiled();

                //Make all VPNs pending of install.
                await getCustomRepository(OpenVPNRepository).markAllAsUninstalled();

                resolve();
            } catch (e) {
                reject(e);
            }
        });
    }

    protected async runMigrations(): Promise<Migration[]> {
        const databaseService: DatabaseService = await app().getService<DatabaseService>(DatabaseService.name);
        return await databaseService.runMigrations();
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

    /**
     * Builds mysqldump/mysql command
     */
    protected  buildCmd(cmd: 'mysqldump' | 'mysql', databaseService: DatabaseService): string {
        const dbConfig: DatabaseConfig = databaseService.config;
        const dumpFile = path.join(this._backupPath, Backup.DUMP_FILENAME);

        const shellescape = require('shell-escape');
        const dbPassEscaped = shellescape([dbConfig.pass]).substring(0,128);

        const dir = cmd==='mysqldump' ? '>' : '<';

        // Detect if in configuration we are using MySQL communications by means of Unix socket file or TCP communications.

        // If we are connecting to a localhost database MySQL/MariaDB engine, if we don't specify the host
        // and port options in the command line, the mysqldump/mysql commands will use the Unix socket instead
        // of the TCP connection, improving performance and consequently response time.
        if (dbConfig.host !== 'localhost')
            cmd += ` -h "${dbConfig.host}" -P ${dbConfig.port}`
        cmd += ` -u ${dbConfig.user} -p"${dbPassEscaped}" ${dbConfig.name} ${dir} "${dumpFile}"`;

        return cmd;
    }

    /**
     * Check that the mysqldump/mysql command exists
     */
    protected existsCmd(cmd: 'mysqldump' | 'mysql'): Promise<boolean> {
        return new Promise((resolve) => {
            child_process.exec(`${cmd} --version`,(error,stdout,stderr) => {
                resolve(error ? false : true)
            });
        });
    }
}