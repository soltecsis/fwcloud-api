import { FwCloud } from '../models/fwcloud/FwCloud';
import * as uuid from 'uuid';
import * as path from 'path';
import { FSHelper } from '../utils/fs-helper';
import { Snapshot } from '../snapshots/snapshot';
import { DatabaseImporter } from './database-importer/database-importer';
import moment from 'moment';
import { User } from '../models/user/User';
import { Responsable } from '../fonaments/contracts/responsable';
import { SnapshotNotCompatibleException } from '../snapshots/exceptions/snapshot-not-compatible.exception';
import { Zip } from '../utils/zip';
import { EventEmitter } from 'typeorm/platform/PlatformTools';

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
      user_id: this._user.id,
    };
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
    return this._loaded;
  }

  get timestamp(): number {
    return this._timestamp;
  }

  /**
   * Generates a fwcloud export directory
   *
   * @param fwCloud
   * @param user
   */
  public async save(fwCloud: FwCloud, user: User): Promise<void> {
    this._timestamp = moment().valueOf();
    this._fwCloud = fwCloud;
    this._user = user;

    FSHelper.mkdirSync(this._path);

    const snapshot: Snapshot = await Snapshot.create(this._path, this._fwCloud);
    await FSHelper.copy(snapshot.path, path.join(this._path, FwCloudExport.FWCLOUD_DATA_DIRECTORY));
    await FSHelper.remove(path.dirname(snapshot.path));
    await this.copyFwCloudSnapshots(this._fwCloud);
  }

  /**
   * Generates a compressed version of the export directory in the same path but fwcloud extension
   */
  public compress(): Promise<void> {
    return Zip.zip(this._path, this.exportPath);
  }

  /**
   * Imports a fwcloud
   */
  public async import(eventEmitter: EventEmitter = new EventEmitter()): Promise<FwCloud> {
    const importer: DatabaseImporter = new DatabaseImporter(eventEmitter);

    const snapshot: Snapshot = await Snapshot.load(
      path.join(this._path, FwCloudExport.FWCLOUD_DATA_DIRECTORY),
    );

    if (!snapshot.compatible) {
      throw new SnapshotNotCompatibleException(snapshot);
    }

    const fwCloud: FwCloud = await importer.import(snapshot);

    await FSHelper.copyDirectoryIfExists(
      path.join(this._path, FwCloudExport.SNAPSHOTS_DIRECTORY),
      fwCloud.getSnapshotDirectoryPath(),
    );
    return fwCloud;
  }

  public static async load(exportPath: string): Promise<FwCloudExport> {
    return new Promise((resolve) => {
      const fwCloudExport: FwCloudExport = new FwCloudExport(
        path.basename(exportPath),
        path.dirname(exportPath),
      );
      fwCloudExport._loaded = true;
      resolve(fwCloudExport);
    });
  }

  public static loadCompressed(compressedFilePath: string): Promise<FwCloudExport> {
    return new Promise<FwCloudExport>((resolve, reject) => {
      const destinationPath: string = path.join(
        path.dirname(compressedFilePath),
        path.basename(compressedFilePath.replace('.fwcloud', '')),
      );

      Zip.unzip(compressedFilePath, destinationPath)
        .then(async () => {
          return resolve(await FwCloudExport.load(destinationPath));
        })
        .catch((err) => {
          reject(err);
        });
    });
  }

  public static async create(
    directory: string,
    fwCloud: FwCloud,
    user: User,
  ): Promise<FwCloudExport> {
    const id: string = uuid.v1();
    const fwCloudExport: FwCloudExport = new FwCloudExport(id, directory);
    await fwCloudExport.save(fwCloud, user);
    return fwCloudExport;
  }

  protected async copyFwCloudSnapshots(fwCloud: FwCloud): Promise<void> {
    if (FSHelper.directoryExistsSync(fwCloud.getSnapshotDirectoryPath())) {
      const snapshotPaths: Array<string> = await FSHelper.directories(
        fwCloud.getSnapshotDirectoryPath(),
      );

      for (let i = 0; i < snapshotPaths.length; i++) {
        const snapshotPath: string = snapshotPaths[i];
        const destination: string = path.join(
          this._path,
          FwCloudExport.SNAPSHOTS_DIRECTORY,
          path.basename(snapshotPath),
        );

        await FSHelper.copy(snapshotPath, destination);
      }
    }
  }
}
