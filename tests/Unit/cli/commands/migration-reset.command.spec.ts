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

import { Table, QueryRunner, DataSource } from 'typeorm';
import { MigrationResetCommand } from '../../../../src/cli/commands/migration-reset-command';
import { Application } from '../../../../src/Application';
import { expect, testSuite, describeName } from '../../../mocha/global-setup';
import { DatabaseService } from '../../../../src/database/database.service';
import { runCLICommandIsolated } from '../../../utils/utils';

describe(describeName('MigrationResetCommand tests'), () => {
  let app: Application;

  before(() => {
    app = testSuite.app;
  });

  after(async () => {
    await testSuite.resetDatabaseData();
  });

  it('should reset the database', async () => {
    const dataSource: DataSource = (await app.getService<DatabaseService>(DatabaseService.name))
      .dataSource;
    let queryRunner: QueryRunner = dataSource.createQueryRunner();

    expect(await queryRunner.getTable('ca')).to.be.instanceOf(Table);
    expect(await queryRunner.getTable('user__fwcloud')).to.be.instanceOf(Table);

    await runCLICommandIsolated(testSuite, async () => {
      return new MigrationResetCommand().safeHandle({
        $0: 'migration:run',
        _: [],
      });
    });
    if (!dataSource.isInitialized) {
      await dataSource.initialize();
    }
    queryRunner = dataSource.createQueryRunner();

    expect(await queryRunner.getTable('ca')).to.be.undefined;
    expect(await queryRunner.getTable('user__fwcloud')).to.be.undefined;

    await queryRunner.release();
  });
});
