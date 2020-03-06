import { Moment } from "moment";
import { Responsable } from "../fonaments/contracts/responsable";
import { app } from "../fonaments/abstract-application";
import { FSHelper } from "../utils/fs-helper";
import moment from "moment";
import * as path from "path";
import * as fs from "fs";
import { timingSafeEqual } from "crypto";
import { FwCloud } from "../models/fwcloud/FwCloud";
import { RepositoryService } from "../database/repository.service";

export type SnapshotData = {
    name: string,
    fwcloud_id: number,
    date: number,
    comment: string,
    data: object
};


export class Snapshot implements Responsable {
    protected _id: number;
    name: string;
    comment: string;
    protected _date: Moment;
    protected _fwcloud: FwCloud;
    
    protected _path: string;
    protected _snapshotDirectory: string;

    protected _exists: boolean;
    protected _data: SnapshotData;

    protected constructor() {
        this._id = null;
        this.name = null;
        this.comment = null;
        this._fwcloud = null;
        this._date = null;
        this._path = null;
        this._path = null;
        this._exists = false;
    }

    get id(): number {
        return this._id;
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

    public static async create(fwcloud: FwCloud, name: string, comment: string = null): Promise<Snapshot> {
        const snapshot: Snapshot = new Snapshot;
        snapshot.name = name;
        snapshot.comment = comment;

        await this.generateSnapshotDirectoryIfDoesNotExist();
        

        const result: Snapshot = await snapshot.save(fwcloud);

        return await Snapshot.load(result.path);
    }

    protected async loadSnapshot(snapshotPath: string): Promise<Snapshot> {
        const repository: RepositoryService = await app().getService<RepositoryService>(RepositoryService.name)
        const snapshotData: SnapshotData = JSON.parse(fs.readFileSync(snapshotPath).toString());

        this._id = parseInt(path.basename(snapshotPath));
        this.name = snapshotData.name;
        this._date = moment(snapshotData.date);
        this.comment = snapshotData.comment;
        this._path = snapshotPath;
        this._fwcloud = await repository.for(FwCloud).findOne(snapshotData.fwcloud_id);
        this._exists = true;

        return this;
    }

    public static async load(snapshotPath: string): Promise<Snapshot> {
        return new Snapshot().loadSnapshot(snapshotPath);
    }

    public async remove(): Promise<Snapshot> {
        if (this._exists) {
            await FSHelper.remove(this._path);
            this._exists = false;
        }
        
        return this;
    }

    protected async save(fwcloud: FwCloud): Promise<Snapshot> {
        this._date = moment();
        this._fwcloud = fwcloud;
        this._id = this._date.valueOf();
        this._path = path.join(app().config.get('snapshot').data_dir, this._id.toString() + '.json');
        this._data = {
            name: this.name,
            comment: this.comment,
            date: this._date.valueOf(),
            fwcloud_id: this._fwcloud.id,
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
            name: this.name,
            date: this._date === null? null : this._date.utc(),
            comment: this.comment
        }
    }
    

}