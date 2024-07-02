/*
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

import * as yargs from 'yargs';
import { DatabaseService } from '../../database/database.service';
import { Command, Option } from '../command';
import { IPObj } from '../../models/ipobj/IPObj';

/**
 * Runs migration command.
 */
export class MigrationImportDataCommand extends Command {
  public name: string = 'migration:data';
  public description: string = 'Import default data';

  async handle(args: yargs.Arguments) {
    const forceFlag: boolean = (args.force ?? false) as boolean;
    const databaseService: DatabaseService =
      await this._app.getService<DatabaseService>(DatabaseService.name);
    const dataSource = databaseService.dataSource;

    // If at least a standard object already exists means data have been imported
    if (
      forceFlag ||
      !(await dataSource.manager
        .getRepository(IPObj)
        .findOne({ where: { id: 10000 } }))
    ) {
      await databaseService.feedDefaultData();
      this.output.success(`Default data imported.`);
    } else {
      this.output.warn(`Default data already imported.`);
    }
  }

  public getOptions(): Option[] {
    return [
      {
        name: 'force',
        alias: null,
        type: 'boolean',
        description: 'Force key generation even when they are already defined',
        required: false,
      },
    ];
  }
}
