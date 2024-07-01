import { Service } from '../fonaments/services/service';
import { FSHelper } from '../utils/fs-helper';
import { FwCloudExport } from './fwcloud-export';
import { FwCloud } from '../models/fwcloud/FwCloud';
import { User } from '../models/user/User';
import { EventEmitter } from 'typeorm/platform/PlatformTools';
import { Progress } from '../fonaments/http/progress/progress';
import { ProgressPayload } from '../sockets/messages/socket-message';

export type ExporterConfig = {
  data_dir: string;
  upload_dir: string;
};

export class FwCloudExportService extends Service {
  get config(): ExporterConfig {
    return this._app.config.get('exporter');
  }

  public async build(): Promise<Service> {
    if (!FSHelper.directoryExistsSync(this.config.data_dir)) {
      FSHelper.mkdirSync(this.config.data_dir);
    }

    if (!FSHelper.directoryExistsSync(this.config.upload_dir)) {
      FSHelper.mkdirSync(this.config.upload_dir);
    }

    return this;
  }

  public async create(
    fwCloud: FwCloud,
    user: User,
    ttl: number = 0,
    eventEmitter: EventEmitter = new EventEmitter(),
  ): Promise<FwCloudExport> {
    let heartbeatInerval: NodeJS.Timeout;

    try {
      heartbeatInerval = setInterval(() => {
        eventEmitter.emit(
          'message',
          new ProgressPayload('heartbeat', null, null),
        );
      }, 20000);

      const fwCloudExport: FwCloudExport = await FwCloudExport.create(
        this.config.data_dir,
        fwCloud,
        user,
      );
      await fwCloudExport.compress();
      FSHelper.rmDirectorySync(fwCloudExport.path);

      if (heartbeatInerval) {
        clearInterval(heartbeatInerval);
      }

      if (ttl > 0) {
        setTimeout(() => {
          if (FSHelper.fileExistsSync(fwCloudExport.exportPath)) {
            FSHelper.remove(fwCloudExport.exportPath);
          }
        }, ttl);
      }
      return fwCloudExport;
    } catch (e) {
      if (heartbeatInerval) {
        clearInterval(heartbeatInerval);
      }
    }
  }

  public async import(
    filePath: string,
    user: User,
    eventEmitter: EventEmitter = new EventEmitter(),
  ): Promise<FwCloud> {
    const fwCloudExport: FwCloudExport =
      await FwCloudExport.loadCompressed(filePath);

    const fwCloud: FwCloud = await fwCloudExport.import(eventEmitter);

    user = await User.findOne({
      where: { id: user.id },
      relations: ['fwClouds'],
    });
    user.fwClouds.push(fwCloud);
    await user.save();

    return fwCloud;
  }
}
