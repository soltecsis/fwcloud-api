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

import { Table, Connection, QueryRunner } from "typeorm";
import { MigrationResetCommand } from "../../../../src/cli/commands/migration-reset-command";
import { Application } from "../../../../src/Application";
import { expect, testSuite, describeName } from "../../../mocha/global-setup";
import { DatabaseService } from "../../../../src/database/database.service";
import { runCLICommandIsolated } from "../../../utils/utils";

describe(describeName("MigrationResetCommand tests"), () => {
  let app: Application;

  before(async () => {
    app = testSuite.app;
  });

  after(async () => {
    await testSuite.resetDatabaseData();
  });

  it("should reset the database", async () => {
    let connection: Connection = (
      await app.getService<DatabaseService>(DatabaseService.name)
    ).connection;
    let queryRunner: QueryRunner = connection.createQueryRunner();

    expect(await queryRunner.getTable("ca")).to.be.instanceOf(Table);
    expect(await queryRunner.getTable("user__fwcloud")).to.be.instanceOf(Table);

    await runCLICommandIsolated(testSuite, async () => {
      return new MigrationResetCommand().safeHandle({
        $0: "migration:run",
        _: [],
      });
    });

    connection = (await app.getService<DatabaseService>(DatabaseService.name))
      .connection;
    queryRunner = connection.createQueryRunner();

    expect(await queryRunner.getTable("ca")).to.be.undefined;
    expect(await queryRunner.getTable("user__fwcloud")).to.be.undefined;

    await queryRunner.release();
  });
});
