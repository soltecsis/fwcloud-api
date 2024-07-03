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

import { describeName, testSuite, expect } from '../../mocha/global-setup';
import { AbstractApplication } from '../../../src/fonaments/abstract-application';
import { DatabaseService } from '../../../src/database/database.service';
import { DataSource, Migration } from 'typeorm';

let app: AbstractApplication;
let databaseService: DatabaseService;

describe(describeName('Database Service tests'), () => {
  beforeEach(async () => {
    app = testSuite.app;
    databaseService = await app.getService<DatabaseService>(
      DatabaseService.name,
    );
  });

  describe('getAppliedMigrations()', async () => {
    let dataSource: DataSource;

    beforeEach(async () => {
      dataSource = databaseService.dataSource;
    });

    it('should return all migrations', async () => {
      const migrations = (
        await dataSource.query('SELECT * from migrations ORDER BY id DESC')
      ).map((row: any) => {
        return {
          id: row.id,
          timestamp: parseInt(row.timestamp),
          name: row.name,
        };
      });

      const executedMigrations = (
        await databaseService.getExecutedMigrations()
      ).map((migration: Migration) => {
        return {
          id: migration.id,
          timestamp: migration.timestamp,
          name: migration.name,
        };
      });

      expect(executedMigrations).to.be.deep.eq(migrations);
    });
  });

  describe('rollbackMigrations()', () => {
    it('should rollback multiple migrations', async () => {
      const migrations: Migration[] =
        await databaseService.getExecutedMigrations();

      await databaseService.rollbackMigrations(3);

      expect(
        (await databaseService.getExecutedMigrations()).length,
      ).to.be.deep.eq(migrations.length - 3);

      await databaseService.runMigrations();
    });
  });
});
