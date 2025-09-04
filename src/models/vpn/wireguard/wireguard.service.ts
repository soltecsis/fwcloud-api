/*!
    Copyright 2022 SOLTECSIS SOLUCIONES TECNOLOGICAS, SLU
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

import { Service } from '../../../fonaments/services/service';
import { WireGuard } from './WireGuard';
import db from '../../../database/database-manager';
import { InstallerGenerator } from '../../../wireguard-installer/installer-generator';

export type WireGuardConfig = {
  history: {
    data_dir: string;
    archive_schedule: string;
    archive_days: number;
    retention_schedule: string;
    retention_days: number;
  };
};

export class WireGuardService extends Service {
  protected _config: WireGuardConfig;

  public async build(): Promise<WireGuardService> {
    return this;
  }

  public async generateInstaller(
    name: string,
    wireGuard: WireGuard,
    outputPath: string,
  ): Promise<string> {
    let configData: string;

    try {
      const wireGuardId: number = wireGuard.id;
      configData = ((await WireGuard.dumpCfg(db.getQuery(), wireGuardId)) as any).cfg;
    } catch (e) {
      throw new Error(
        'Unable to generate the wireGuard configuration during installer generation: ' +
          JSON.stringify(e),
      );
    }

    const installerGenerator: InstallerGenerator = new InstallerGenerator(
      'lib/nsis',
      name,
      configData,
      outputPath,
    );
    return installerGenerator.generate();
  }
}
