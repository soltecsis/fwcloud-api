/*!
    Copyright 2019 SOLTECSIS SOLUCIONES TECNOLOGICAS, SLU
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

import { Service } from '../fonaments/services/service';
import { Snapshot } from './snapshot';
import * as fs from 'fs';
import * as path from 'path';
import { NotFoundException } from '../fonaments/exceptions/not-found-exception';
import { FwCloud } from '../models/fwcloud/FwCloud';
import { Progress } from '../fonaments/http/progress/progress';
import { FSHelper } from '../utils/fs-helper';
import { EventEmitter } from 'typeorm/platform/PlatformTools';

export type SnapshotConfig = {
  data_dir: string;
};

export class SnapshotService extends Service {
  protected _config: SnapshotConfig;

  public async build(): Promise<SnapshotService> {
    this._config = this._app.config.get('snapshot');

    if (!fs.existsSync(this._config.data_dir)) {
      fs.mkdirSync(this._config.data_dir);
    }

    return this;
  }

  get config(): SnapshotConfig {
    return this._config;
  }

  public async getAll(fwcloud: FwCloud): Promise<Array<Snapshot>> {
    const snapshots: Array<Snapshot> = [];
    const snapshotsDirectory: string = path.join(this.config.data_dir, fwcloud.id.toString());

    if (!FSHelper.directoryExistsSync(snapshotsDirectory)) {
      return snapshots;
    }

    const entires: Array<string> = fs.readdirSync(snapshotsDirectory);
    for (const entry of entires.reverse()) {
      const snapshotPath: string = path.join(snapshotsDirectory, entry);

      if (fs.statSync(snapshotPath).isDirectory()) {
        try {
          snapshots.push(await Snapshot.load(snapshotPath));
          // eslint-disable-next-line no-empty
        } catch (e) {
          // Ignore
        }
      }
    }

    return snapshots;
  }

  public async findOne(fwcloud: FwCloud, id: number): Promise<Snapshot> {
    const snapshots: Array<Snapshot> = await this.getAll(fwcloud);

    const results = snapshots.filter((snapshot: Snapshot) => {
      return snapshot.id === id;
    });

    return results.length > 0 ? results[0] : null;
  }

  public async findOneOrFail(fwcloud: FwCloud, id: number): Promise<Snapshot> {
    const snapshot: Snapshot = await this.findOne(fwcloud, id);

    if (!snapshot) {
      throw new NotFoundException();
    }

    return snapshot;
  }

  public async store(
    name: string,
    comment: string,
    fwcloud: FwCloud,
    eventEmitter: EventEmitter = new EventEmitter(),
  ): Promise<Snapshot> {
    return Snapshot.create(this.config.data_dir, fwcloud, name, comment, eventEmitter);
  }

  public async update(
    snapshot: Snapshot,
    newData: { name: string; comment: string },
  ): Promise<Snapshot> {
    return await snapshot.update(newData);
  }

  public restore(
    snapshot: Snapshot,
    eventEmitter: EventEmitter = new EventEmitter(),
  ): Promise<FwCloud> {
    return snapshot.restore(eventEmitter);
  }

  public async destroy(snapshot: Snapshot): Promise<Snapshot> {
    return await snapshot.destroy();
  }
}
