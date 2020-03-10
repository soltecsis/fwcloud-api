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

export type SnapshotMetadata = {
    timestamp: number,
    name: string,
    comment: string,
    version: string,
    fwcloud_id: number
};

export class Snapshot implements Responsable {

    static METADATA_FILENAME = 'snapshot.json';

    protected _id: number;
    protected _date: Moment;
    protected _name: string;
    protected _comment: string;
    protected _fwcloud: FwCloud;
    protected _version: string;
    
    protected _path: string;
    protected _exists: boolean;

    protected constructor() {
        this._id = null;
        this._date = null;
        this._name = null;
        this._comment = null;
        this._fwcloud = null;
        this._path = null;
        this._exists = false;
        this._version = null;
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

    public static async create(snapshot_directory: string, fwcloud: FwCloud, name: string, comment: string = null): Promise<Snapshot> {
        const snapshot: Snapshot = new Snapshot;
        
        const result: Snapshot = await snapshot.save(snapshot_directory, fwcloud, name, comment);

        return await Snapshot.load(result.path);
    }

    protected async loadSnapshot(snapshotPath: string): Promise<Snapshot> {
        const metadataPath: string = path.join(snapshotPath, Snapshot.METADATA_FILENAME);
        const repository: RepositoryService = await app().getService<RepositoryService>(RepositoryService.name)
        const snapshotMetadata: SnapshotMetadata = JSON.parse(fs.readFileSync(metadataPath).toString());

        this._id = parseInt(path.basename(snapshotPath));
        this._date = moment(snapshotMetadata.timestamp);
        this._path = snapshotPath;
        this._fwcloud = await repository.for(FwCloud).findOne(snapshotMetadata.fwcloud_id);
        this._name = snapshotMetadata.name;
        this._comment = snapshotMetadata.comment;
        this._version = snapshotMetadata.version;
        this._exists = true;

        return this;
    }

    public async update(snapshotData: {name: string, comment: string}): Promise<Snapshot> {
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

    protected async save(snapshot_directory: string, fwcloud: FwCloud, name: string, comment: string = null): Promise<Snapshot> {
        this._fwcloud = fwcloud;
        this._date = moment();
        this._id = this._date.valueOf();
        this._path = path.join(snapshot_directory, this._id.toString());
        this._name = name;
        this._comment = comment;
        this._version = app<Application>().getVersion().version;

        if(await FSHelper.directoryExists(this._path)) {
            throw new Error('Snapshot with id = ' + this._id + ' already exists');
        }

        await FSHelper.mkdir(this._path);

        this.saveMetadataFile();
        
        return this;
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