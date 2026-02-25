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
import { IPSec } from './IPSec';
import db from '../../../database/database-manager';
import { InstallerGenerator } from '../../../ipsec-installer/installer-generator';

export type IPSecConfig = {
  history: {
    data_dir: string;
    archive_schedule: string;
    archive_days: number;
    retention_schedule: string;
    retention_days: number;
  };
};

export class IPSecService extends Service {
  protected _config: IPSecConfig;

  public async build(): Promise<IPSecService> {
    return this;
  }

  public async generateInstaller(name: string, ipsec: IPSec, outputPath: string): Promise<string> {
    let configData: string;

    try {
      const ipsecId: number = ipsec.id;
      configData = ((await IPSec.dumpCfg(db.getQuery(), ipsecId)) as any).cfg;
    } catch (e) {
      throw new Error(
        'Unable to generate the ipsec configuration during installer generation: ' +
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
