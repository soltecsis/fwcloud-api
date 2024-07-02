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
import { DataSource } from 'typeorm';
import { DatabaseService } from '../../database/database.service';
import { Command } from '../command';

/**
 * Runs migration command.
 */
export class MigrationRunCommand extends Command {
  public name: string = 'migration:run';
  public description: string = 'Run all migrations';

  async handle(args: yargs.Arguments) {
    const databaseService: DatabaseService =
      await this._app.getService<DatabaseService>(DatabaseService.name);
    const dataSource: DataSource = await databaseService.getDataSource({
      name: 'cli',
    });

    await databaseService.runMigrations(dataSource);
    this.output.success(`Pending migrations applied.`);
  }
}
