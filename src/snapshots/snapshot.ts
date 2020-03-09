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

export type SnapshotData = {
    name: string,
    version: string,
    comment: string,
    fwcloud_id: number,
    date: number,
    data: object
};


export class Snapshot implements Responsable {
    protected _id: number;
    protected _fwcloud: FwCloud;
    
    protected _path: string;
    protected _snapshotDirectory: string;

    protected _exists: boolean;
    protected _data: SnapshotData;

    protected constructor() {
        this._id = null;
        this._fwcloud = null;
        this._path = null;
        this._path = null;
        this._exists = false;
    }

    get fwcloud(): FwCloud {
        return this._fwcloud;
    }

    get id(): number {
        return this._id;
    }

    get version(): string {
        return this._data.version;
    }

    get date(): Moment {
        return moment(this._data.date);
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

    public static async create(fwcloud: FwCloud, name: string, comment: string = null): Promise<Snapshot> {
        const snapshot: Snapshot = new Snapshot;
        
        await this.generateSnapshotDirectoryIfDoesNotExist();
        

        const result: Snapshot = await snapshot.save(fwcloud, name, comment);

        return await Snapshot.load(result.path);
    }

    protected async loadSnapshot(snapshotPath: string): Promise<Snapshot> {
        const repository: RepositoryService = await app().getService<RepositoryService>(RepositoryService.name)
        const snapshotData: SnapshotData = JSON.parse(fs.readFileSync(snapshotPath).toString());

        this._id = parseInt(path.basename(snapshotPath));
        this._data = snapshotData;
        this._path = snapshotPath;
        this._fwcloud = await repository.for(FwCloud).findOne(snapshotData.fwcloud_id);
        this._exists = true;

        return this;
    }

    public async update(snapshotData: {name: string, comment: string}): Promise<Snapshot> {
        this._data.name = snapshotData.name;
        this._data.comment = snapshotData.comment;

        fs.writeFileSync(this._path, JSON.stringify(this._data, null, 2));

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

    protected async save(fwcloud: FwCloud, name: string, comment: string = null): Promise<Snapshot> {
        this._fwcloud = fwcloud;
        this._id = moment().valueOf();
        this._path = path.join(app().config.get('snapshot').data_dir, this._id.toString() + '.json');
        this._data = {
            name: name,
            comment: comment,
            fwcloud_id: this._fwcloud.id,
            version: app<Application>().getVersion().version,
            date: this._id,
            data: {}
        }

        fs.writeFileSync(this._path, JSON.stringify(this._data, null, 2));
        
        return this;
    }

    protected static async generateSnapshotDirectoryIfDoesNotExist() {
        if (!await FSHelper.directoryExists(app().config.get('snapshot').data_dir)) {
            FSHelper.mkdir(app().config.get('snapshot').data_dir);
        }
    }
    
    toResponse(): object {
        return {
            id: this._id,
            name: this._data.name,
            date: this._data && this._data.date === null? null : moment(this._data.date).utc(),
            comment: this._data.comment
        }
    }
    

}