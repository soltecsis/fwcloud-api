import { Moment } from "moment";
import { Responsable } from "../fonaments/contracts/responsable";
import { app, AbstractApplication } from "../fonaments/abstract-application";
import { FSHelper } from "../utils/fs-helper";
import moment from "moment";
import * as path from "path";
import * as fs from "fs";
import { FwCloud } from "../models/fwcloud/FwCloud";
import { RepositoryService } from "../database/repository.service";
import { Application } from "../Application";
import { SnapshotData } from "./snapshot-data";
import { EntityExporter } from "./exporters/entity-exporter";
import { Exporter } from "./exporter";
import { Progress } from "../fonaments/http/progress/progress";
import { BulkDatabaseOperations } from "./bulk-database-operations";
import { DatabaseService } from "../database/database.service";
import { SnapshotNotCompatibleException } from "./exceptions/snapshot-not-compatible.exception";
import { Firewall } from "../models/firewall/Firewall";
import { FirewallRepository } from "../models/firewall/firewall.repository";
import { SnapshotRepair } from "./repair";

export type SnapshotMetadata = {
    timestamp: number,
    name: string,
    comment: string,
    version: string,
    fwcloud_id: number,
    schema: string
};

export class Snapshot implements Responsable {

    static METADATA_FILENAME = 'snapshot.json';
    static DATA_FILENAME = 'data.json';
    static DEPENDENCY_FILENAME = 'dep.json';
    static PKI_DIRECTORY = path.join('_data', 'pki');
    static POLICY_DIRECTORY = path.join('_data', 'policy');

    protected _id: number;
    protected _date: Moment;
    protected _name: string;
    protected _comment: string;
    protected _fwCloud: FwCloud;
    protected _version: string;

    protected _schema: string;

    protected _path: string;
    protected _exists: boolean;

    protected _data: SnapshotData;

    protected _compatible: boolean;

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
        this._schema = null;
        this._compatible = null;
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

    get data(): SnapshotData {
        return this._data;
    }

    get schema(): string {
        return this._schema;
    }

    /**
     * Create a backup using promises
     * 
     * @param snapshot_directory Path without the fwcloud.id directory
     * @param fwCloud 
     * @param name
     * @param comment 
     */
    public static async create(snapshot_directory: string, fwCloud: FwCloud, name: string = null, comment: string = null): Promise<Snapshot> {
        const snapshot: Snapshot = new Snapshot;
        const progress: Progress<Snapshot> = await snapshot.save(snapshot_directory, fwCloud, name, comment);

        return new Promise<Snapshot>((resolve, reject) => {
            progress.on('end', async (_) => {
                resolve(await Snapshot.load(progress.response.path));
            });
        });
    }

    /**
     * Create a backup using progress
     * 
     * @param snapshot_directory Path without the fwcloud.id directory
     * @param fwCloud 
     * @param name 
     * @param comment 
     */
    public static async progressCreate(snapshot_directory: string, fwCloud: FwCloud, name: string = null, comment: string = null): Promise<Progress<Snapshot>> {
        const snapshot: Snapshot = new Snapshot;
        return await snapshot.save(snapshot_directory, fwCloud, name, comment);
    }

    /**
     * Restore using promises
     */
    public async restore(): Promise<Snapshot> {
        const progress: Progress<Snapshot> = this.progressRestore();

        return new Promise<Snapshot>((resolve, reject) => {
            progress.on('end', (_) => {
                resolve(progress.response);
            });
        });
    }

    /**
     * Restore using progress
     */
    public progressRestore(): Progress<Snapshot> {
        const progress: Progress<Snapshot> = new Progress<Snapshot>(3);

        progress.start('Restoring snapshot');

        if (!this._compatible) {
            throw new SnapshotNotCompatibleException(this);
        }

        let p1: Promise<void> = this.removeDatabaseData();

        p1.then((_) => {
            progress.step('FwCloud removed');

            const p2: Promise<void> = this.restoreDatabaseData();
            p2.then((_) => {
                let p3: Promise<void> = this.resetCompiledStatus();
                let p4: Promise<void> = this.repair();

                Promise.all([p3, p4]).then((_) => {
                    progress.end('FwCloud snapshot restored');
                });
            })
        })

        progress.response = this;

        return progress;
    }

    /**
     * Load an snapshot using the path provided
     * 
     * @param snapshotPath The path must contain the fwcloud.id directory
     */
    protected async loadSnapshot(snapshotPath: string): Promise<Snapshot> {
        const metadataPath: string = path.join(snapshotPath, Snapshot.METADATA_FILENAME);
        const dataPath: string = path.join(snapshotPath, Snapshot.DATA_FILENAME);

        const repository: RepositoryService = await app().getService<RepositoryService>(RepositoryService.name)

        const snapshotMetadata: SnapshotMetadata = JSON.parse(fs.readFileSync(metadataPath).toString());
        const dataContent: string = fs.readFileSync(dataPath).toString();

        const snapshotData: SnapshotData = JSON.parse(dataContent);

        this._id = parseInt(path.basename(snapshotPath));
        this._date = moment(snapshotMetadata.timestamp);
        this._path = snapshotPath;
        this._fwCloud = await repository.for(FwCloud).findOne(snapshotMetadata.fwcloud_id);
        this._name = snapshotMetadata.name;
        this._comment = snapshotMetadata.comment;
        this._version = snapshotMetadata.version;
        this._exists = true;
        this._data = snapshotData;
        this._schema = snapshotMetadata.schema
        this._compatible = await this.checkisSchemaCompatible(this._schema);

        return this;
    }

    /**
     * Update the snapshot metadata
     * 
     * @param snapshotData 
     */
    public async update(snapshotData: { name: string, comment: string }): Promise<Snapshot> {
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
    protected async save(snapshot_directory: string, fwCloud: FwCloud, name: string = null, comment: string = null): Promise<Progress<Snapshot>> {
        const databaseService: DatabaseService = await app().getService<DatabaseService>(DatabaseService.name);
        const progress = new Progress<Snapshot>(4);

        this._fwCloud = fwCloud;
        this._date = moment();
        this._id = this._date.valueOf();
        this._path = path.join(snapshot_directory, fwCloud.id.toString(), this._id.toString());
        this._name = name ? name : this._date.utc().format();
        this._comment = comment;
        this._version = app<Application>().version.tag;
        this._schema = await databaseService.getDatabaseSchemaVersion();
        this._compatible = true;

        progress.start('Creating snapshot');

        if (FSHelper.directoryExistsSync(this._path)) {
            throw new Error('Snapshot with id = ' + this._id + ' already exists');
        }

        FSHelper.mkdirSync(this._path);
        this.saveMetadataFile();

        const p1: Promise<void> = this.copyFwCloudDataDirectories();

        p1.then(_ => {
            progress.step('FwCloud data directories exported');
        });

        const p2: Promise<void> = this.saveDataFile();

        p2.then(_ => {
            progress.step('FwCloud database exported');
        });

        Promise.all([p1, p2]).then((_) => {
            progress.response = this;
            progress.end('Snapshot created', null, this);
        });

        progress.response = this;

        return progress;
    }

    /**
     * Removes all data related with the fwcloud from the database
     */
    protected async removeDatabaseData(): Promise<void> {
        const data: SnapshotData = await this.getFwCloudJSONData();

        return new BulkDatabaseOperations(data, 'delete').run();
    }

    /**
     * Restore all snapshot data into the database
     */
    protected async restoreDatabaseData(): Promise<void> {
        return new BulkDatabaseOperations(this._data, 'insert').run();
    }

    /**
     * Get all fwcloud data related from the database
     */
    protected async getFwCloudJSONData(): Promise<SnapshotData> {
        const result = new SnapshotData();
        const exporterTarget: typeof EntityExporter = new Exporter().buildExporterFor(this.fwCloud.constructor.name);
        this._fwCloud = await (await app().getService<RepositoryService>(RepositoryService.name)).for(FwCloud).findOne(this._fwCloud.id);
        const exporter = new exporterTarget(result, this._fwCloud);
        await exporter.export();

        return result;
    }

    /**
     * Persist all fwcloud related data from database into the data file
     */
    protected async saveDataFile(): Promise<void> {
        const data: SnapshotData = await this.getFwCloudJSONData();

        fs.writeFileSync(path.join(this._path, Snapshot.DATA_FILENAME), JSON.stringify(data, null, 2));
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
            schema: this._schema,
            fwcloud_id: this._fwCloud.id,

        };

        fs.writeFileSync(path.join(this._path, Snapshot.METADATA_FILENAME), JSON.stringify(metadata, null, 2));
    }

    /**
     * Copy all FwCloud DATA directory into the snapshot
     */
    protected async copyFwCloudDataDirectories(): Promise<void> {
        await FSHelper.copyDirectoryIfExists(this.fwCloud.getPkiDirectoryPath(), path.join(this._path, Snapshot.PKI_DIRECTORY));
        await FSHelper.copyDirectoryIfExists(this.fwCloud.getPolicyDirectoryPath(), path.join(this._path, Snapshot.POLICY_DIRECTORY));
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
        if (!await FSHelper.directoryExists(app().config.get('snapshot').data_dir)) {
            FSHelper.mkdir(app().config.get('snapshot').data_dir);
        }
    }

    /**
     * Checks if the given schemaVersion is the same as the schemaVersion generated by the databaseService
     * @param schema 
     */
    protected async checkisSchemaCompatible(schema: string) {
        const databaseService = await app().getService<DatabaseService>(DatabaseService.name);
        const currentSchemaVersion: string = await databaseService.getDatabaseSchemaVersion();

        return currentSchemaVersion === schema;
    }

    /**
     * Resets the firewalls compilation & installation status
     */
    protected async resetCompiledStatus(): Promise<void> {
        return new Promise<void>(async (resolve, reject) => {
            const repository: RepositoryService = await app().getService<RepositoryService>(RepositoryService.name)
            const fwcloud: FwCloud = await repository.for(FwCloud).findOneOrFail(this.fwCloud.id, { relations: ['clusters', 'firewalls'] });

            await (<FirewallRepository>repository.for(Firewall)).markAsUncompiled(fwcloud.firewalls);

            return resolve();
        });
    }

    /**
     * Repairs the fwc_tree table
     */
    protected async repair(): Promise<void> {
        if(app().config.get('env') !== 'test') {
            return SnapshotRepair.repair(this.fwCloud);
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
            schema: this._schema,
            compatible: this._compatible,
        }
    }
}