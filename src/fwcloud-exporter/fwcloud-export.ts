import { FwCloud } from "../models/fwcloud/FwCloud";
import * as uuid from "uuid";
import * as path from "path";
import * as fs from "fs";
import { FSHelper } from "../utils/fs-helper";
import { Snapshot } from "../snapshots/snapshot";
import archiver from 'archiver';
import { DatabaseImporter } from "./database-importer/database-importer";
import { getRepository } from "typeorm";

export class FwCloudExport {
    static FWCLOUD_DATA_DIRECTORY = 'fwcloud';
    static SNAPSHOTS_DIRECTORY = 'snapshots';

    protected _id: string;
    protected _path: string;
    protected _loaded: boolean;

    protected constructor(id: string, directory: string) {
        this._id = id;
        this._path = path.join(directory, id);
        this._loaded = false;
    }

    get id(): string {
        return this._id;
    }

    get path(): string {
        return this._path;
    }

    get loaded(): boolean {
        return this._loaded
    }

    public async save(fwCloud: FwCloud): Promise<void> {
        FSHelper.mkdirSync(this._path);

        const snapshot: Snapshot = await Snapshot.create(this._path, fwCloud);

        await FSHelper.copy(path.join(snapshot.path, Snapshot.DATA_FILENAME), path.join(this._path, FwCloudExport.FWCLOUD_DATA_DIRECTORY, Snapshot.DATA_FILENAME));
        await FSHelper.copy(path.join(snapshot.path, Snapshot.DATA_DIRECTORY), path.join(this._path, FwCloudExport.FWCLOUD_DATA_DIRECTORY, Snapshot.DATA_DIRECTORY));

        await this.copyFwCloudSnapshots(fwCloud);
    }

    public compress(): Promise<string> {

        return new Promise<string>((resolve, reject) => {
            const outputPath: string = this._path + '.fwcloud';

            const output = fs.createWriteStream(outputPath);
            const archive = archiver('zip', { zlib: { level: 9 } });

            output.on('close', async () => {
                return resolve(outputPath);
            });

            // good practice to catch warnings (ie stat failures and other non-blocking errors)
            archive.on('warning', (error: any) => {
                if (error.code === 'ENOENT') {
                    console.warn(error);
                } else {
                    return reject(error);
                }
            });

            // good practice to catch this error explicitly
            archive.on('error', (err) => {
                return reject(err);
            });

            // pipe archive data to the file
            archive.pipe(output);
            
            archive.directory(this._path, false);
            archive.finalize();
        });
    }

    public async import(): Promise<FwCloud> {
        const importer: DatabaseImporter = new DatabaseImporter();
        
        const fwCloud: FwCloud = await importer.import(path.join(this._path, FwCloudExport.FWCLOUD_DATA_DIRECTORY));

        await FSHelper.copyDirectoryIfExists(path.join(this._path, FwCloudExport.SNAPSHOTS_DIRECTORY), fwCloud.getSnapshotDirectoryPath());
        return fwCloud;
    }

    public static async load(exportPath: string): Promise<FwCloudExport> {
        const fwCloudExport: FwCloudExport = new FwCloudExport(path.basename(exportPath), path.dirname(exportPath));
        fwCloudExport._loaded = true;

        return fwCloudExport;
    }

    public static async create(directory: string, fwCloud: FwCloud): Promise<FwCloudExport> {
        const id: string = uuid.v1();
        const fwCloudExport: FwCloudExport = new FwCloudExport(id, directory);
        await fwCloudExport.save(fwCloud);
        return fwCloudExport;
    }

    protected async copyFwCloudSnapshots(fwCloud: FwCloud): Promise<void> {
        if(FSHelper.directoryExistsSync(fwCloud.getSnapshotDirectoryPath())) {
            const snapshotPaths: Array<string> =    await FSHelper.directories(fwCloud.getSnapshotDirectoryPath());

            for(let i = 0; i < snapshotPaths.length; i++) {
                const snapshotPath: string = snapshotPaths[i];
                const destination: string = path.join(this._path, FwCloudExport.SNAPSHOTS_DIRECTORY, path.basename(snapshotPath));

                await FSHelper.copy(snapshotPath, destination);
            }
        }
    }
}