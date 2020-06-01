import { FwCloud } from "../models/fwcloud/FwCloud";
import * as uuid from "uuid";
import * as path from "path";
import * as fs from "fs";
import { FSHelper } from "../utils/fs-helper";
import { Snapshot } from "../snapshots/snapshot";
import archiver from 'archiver';
import yauzl from 'yauzl';
import { DatabaseImporter } from "./database-importer/database-importer";
import moment from "moment";
import { User } from "../models/user/User";
import { Responsable } from "../fonaments/contracts/responsable";

export class FwCloudExport implements Responsable {
    static FWCLOUD_DATA_DIRECTORY = 'fwcloud';
    static SNAPSHOTS_DIRECTORY = 'snapshots';

    protected _id: string;
    protected _path: string;
    protected _loaded: boolean;
    protected _timestamp: number;
    protected _fwCloud: FwCloud;
    protected _user: User;

    protected constructor(id: string, directory: string) {
        this._id = id;
        this._path = path.join(directory, id);
        this._loaded = false;
    }

    toResponse(): object {
        return {
            id: this._id,
            timestamp: this._timestamp,
            fwcloud_id: this._fwCloud.id,
            user_id: this._user.id
        }
    }

    get id(): string {
        return this._id;
    }

    get path(): string {
        return this._path;
    }

    get exportPath(): string {
        return `${this._path}.fwcloud`;
    }

    get loaded(): boolean {
        return this._loaded
    }

    get timestamp(): number {
        return this._timestamp;
    }

    public async save(fwCloud: FwCloud, user: User): Promise<void> {
        this._timestamp = moment().valueOf();
        this._fwCloud = fwCloud;
        this._user = user;

        FSHelper.mkdirSync(this._path);

        const snapshot: Snapshot = await Snapshot.create(this._path, this._fwCloud);

        await FSHelper.copy(path.join(snapshot.path, Snapshot.DATA_FILENAME), path.join(this._path, FwCloudExport.FWCLOUD_DATA_DIRECTORY, Snapshot.DATA_FILENAME));
        await FSHelper.copy(path.join(snapshot.path, Snapshot.DATA_DIRECTORY), path.join(this._path, FwCloudExport.FWCLOUD_DATA_DIRECTORY, Snapshot.DATA_DIRECTORY));
        await FSHelper.remove(path.dirname(snapshot.path));
        await this.copyFwCloudSnapshots(this._fwCloud);
    }

    public compress(): Promise<string> {

        return new Promise<string>((resolve, reject) => {
            const output = fs.createWriteStream(this.exportPath);
            const archive = archiver('zip', { zlib: { level: 9 } });

            output.on('close', async () => {
                return resolve(this.exportPath);
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

    public static loadCompressed(compressedFilePath: string): Promise<FwCloudExport> {
        return new Promise<FwCloudExport>((resolve, reject) => {
            const destinationPath: string = path.join(path.dirname(compressedFilePath), path.basename(compressedFilePath.replace('.fwcloud', '')));
            yauzl.open(compressedFilePath, { lazyEntries: true }, function (err, zipfile) {
                if (err) throw err;
                zipfile.on("entry", function (entry) {
                    if (/\/$/.test(entry.fileName)) {
                        // Entry is a directory as file names end with '/'.
                        FSHelper.mkdirSync(path.join(destinationPath, entry.fileName));
                        zipfile.readEntry();
                    } else {
                        // file entry
                        zipfile.openReadStream(entry, function (err, readStream) {
                            if (err) throw err;
                            readStream.on("end", function () {
                                zipfile.readEntry();
                            });
                            const ws: fs.WriteStream = fs.createWriteStream(path.join(destinationPath, entry.fileName));
                            readStream.pipe(ws);
                        });
                    }
                });

                zipfile.on('end', async () => {
                    return resolve(await FwCloudExport.load(destinationPath))
                });
                
                zipfile.readEntry();
            });

            return null;
        });
    }

    public static async create(directory: string, fwCloud: FwCloud, user: User): Promise<FwCloudExport> {
        const id: string = uuid.v1();
        const fwCloudExport: FwCloudExport = new FwCloudExport(id, directory);
        await fwCloudExport.save(fwCloud, user);
        return fwCloudExport;
    }

    protected async copyFwCloudSnapshots(fwCloud: FwCloud): Promise<void> {
        if (FSHelper.directoryExistsSync(fwCloud.getSnapshotDirectoryPath())) {
            const snapshotPaths: Array<string> = await FSHelper.directories(fwCloud.getSnapshotDirectoryPath());

            for (let i = 0; i < snapshotPaths.length; i++) {
                const snapshotPath: string = snapshotPaths[i];
                const destination: string = path.join(this._path, FwCloudExport.SNAPSHOTS_DIRECTORY, path.basename(snapshotPath));

                await FSHelper.copy(snapshotPath, destination);
            }
        }
    }
}