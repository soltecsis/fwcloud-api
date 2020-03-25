import { Moment } from "moment";
import { Responsable } from "../fonaments/contracts/responsable";
import { app } from "../fonaments/abstract-application";
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

export type SnapshotMetadata = {
    timestamp: number,
    name: string,
    comment: string,
    version: string,
    fwcloud_id: number
};

export class Snapshot implements Responsable {

    static METADATA_FILENAME = 'snapshot.json';
    static DATA_FILENAME = 'data.json';
    static DEPENDENCY_FILENAME = 'dep.json';
    static PKI_DIRECTORY = 'pki';

    protected _id: number;
    protected _date: Moment;
    protected _name: string;
    protected _comment: string;
    protected _fwcloud: FwCloud;
    protected _version: string;

    protected _path: string;
    protected _exists: boolean;

    protected _data: SnapshotData;

    protected constructor() {
        this._id = null;
        this._date = null;
        this._name = null;
        this._comment = null;
        this._fwcloud = null;
        this._path = null;
        this._exists = false;
        this._version = null;
        this._data = null;
    }

    get name(): string {
        return this._name;
    }

    get comment(): string {
        return this._comment;
    }

    get fwcloud(): FwCloud {
        return this._fwcloud;
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

    public static async create(snapshot_directory: string, fwcloud: FwCloud, name: string, comment: string = null): Promise<Snapshot> {
        const snapshot: Snapshot = new Snapshot;
        const progress: Progress<Snapshot> = snapshot.save(snapshot_directory, fwcloud, name, comment);

        return new Promise<Snapshot>((resolve, reject) => {
            progress.on('end', async (_) => {
                resolve(await Snapshot.load(progress.response.path))
            });
        });
    }

    public static progressCreate(snapshot_directory: string, fwcloud: FwCloud, name: string, comment: string = null): Progress<Snapshot> {
        const snapshot: Snapshot = new Snapshot;
        return snapshot.save(snapshot_directory, fwcloud, name, comment);
    }

    public async restore(): Promise<Snapshot> {
        const progress: Progress<Snapshot> = this.progressRestore();

        return new Promise<Snapshot>((resolve, reject) => {
            progress.on('end', (_) => {
                resolve(progress.response);
            });
        });
    }

    public progressRestore(): Progress<Snapshot> {
        const progress: Progress<Snapshot> = new Progress<Snapshot>(3);

        progress.start('Restoring snapshot');

        let p1: Promise<void> = this.removeDatabaseData();

        p1.then((_) => {
            progress.step('FwCloud removed');

            const p2: Promise<void> = this.restoreDatabaseData();
            p2.then((_) => {
                progress.end('FwCloud restored');
            })
        })

        progress.response = this;

        return progress;
    }

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
        this._fwcloud = await repository.for(FwCloud).findOne(snapshotMetadata.fwcloud_id);
        this._name = snapshotMetadata.name;
        this._comment = snapshotMetadata.comment;
        this._version = snapshotMetadata.version;
        this._exists = true;
        this._data = snapshotData;
        
        return this;
    }

    public async update(snapshotData: { name: string, comment: string }): Promise<Snapshot> {
        this._name = snapshotData.name;
        this._comment = snapshotData.comment;

        this.saveMetadataFile();

        return this;

    }

    public static async load(snapshotPath: string): Promise<Snapshot> {
        return new Snapshot().loadSnapshot(snapshotPath);
    }

    public async destroy(): Promise<Snapshot> {
        if (this._exists) {
            await FSHelper.remove(this._path);
            this._exists = false;
        }

        return this;
    }

    protected save(snapshot_directory: string, fwcloud: FwCloud, name: string, comment: string = null): Progress<Snapshot> {
        const progress = new Progress<Snapshot>(4);

        this._fwcloud = fwcloud;
        this._date = moment();
        this._id = this._date.valueOf();
        this._path = path.join(snapshot_directory, this._id.toString());
        this._name = name;
        this._comment = comment;
        this._version = app<Application>().version.version;
        
        progress.start('Creating snapshot');

        if (FSHelper.directoryExistsSync(this._path)) {
            throw new Error('Snapshot with id = ' + this._id + ' already exists');
        }

        FSHelper.mkdirSync(this._path);
        this.saveMetadataFile();

        const p1: Promise<void> = this.copyFwCloudPkiDirectory();

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

    protected async removeDatabaseData(): Promise<void> {
        const data: SnapshotData = await this.getFwCloudJSONData();

        return new BulkDatabaseOperations(data, 'delete').run();
    }

    protected async restoreDatabaseData(): Promise<void> {
        return new BulkDatabaseOperations(this._data, 'insert').run();
    }

    protected async getFwCloudJSONData(): Promise<SnapshotData> {
        const result = new SnapshotData();
        const exporterTarget: typeof EntityExporter = new Exporter().buildExporterFor(this.fwcloud.constructor.name);
        this._fwcloud = await (await app().getService<RepositoryService>(RepositoryService.name)).for(FwCloud).findOne(this._fwcloud.id);
        const exporter = new exporterTarget(result, this._fwcloud);
        await exporter.export();

        return result;
    }

    protected async saveDataFile(): Promise<void> {
        const data: SnapshotData = await this.getFwCloudJSONData();

        fs.writeFileSync(path.join(this._path, Snapshot.DATA_FILENAME), JSON.stringify(data, null, 2));
    }

    protected saveMetadataFile(): void {
        const metadata: SnapshotMetadata = {
            timestamp: this._date.valueOf(),
            name: this._name,
            comment: this._comment,
            version: this._version,
            fwcloud_id: this._fwcloud.id
        };

        fs.writeFileSync(path.join(this._path, Snapshot.METADATA_FILENAME), JSON.stringify(metadata, null, 2));
    }

    protected async copyFwCloudPkiDirectory(): Promise<void> {
        if (await FSHelper.directoryExists(this.fwcloud.getPkiDirectoryPath())) {
            await FSHelper.copyDirectory(this.fwcloud.getPkiDirectoryPath(), path.join(this._path, Snapshot.PKI_DIRECTORY));
        }
    }

    protected static async generateSnapshotDirectoryIfDoesNotExist() {
        if (!await FSHelper.directoryExists(app().config.get('snapshot').data_dir)) {
            FSHelper.mkdir(app().config.get('snapshot').data_dir);
        }
    }

    toResponse(): object {
        return {
            id: this._id,
            date: this._date,
            name: this._name,
            comment: this._comment
        }
    }
}