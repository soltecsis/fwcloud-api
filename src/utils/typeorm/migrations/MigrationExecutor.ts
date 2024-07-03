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

import { MigrationExecutor, DataSource } from 'typeorm';

export class FwCloudMigrationExecutor extends MigrationExecutor {
  async undoAllMigrations(connection: DataSource): Promise<void> {
    const queryRunner =
      this.queryRunner || this.connection.createQueryRunner('master');

    try {
      // create migrations table if its not created yet
      await this.createMigrationsTableIfNotExist(queryRunner);

      // get all migrations that are executed and saved in the database
      const executedMigrations = await this.loadExecutedMigrations(queryRunner);

      if (executedMigrations.length <= 0) {
        this.connection.logger.logSchemaBuild(
          `No migrations was found in the database. Nothing to reset!`,
        );
        return;
      }

      for (let i: number = 0; i < executedMigrations.length; i++) {
        await this.undoLastMigration();
      }
    } catch (e) {
      console.error(e);
    }
  }
}
