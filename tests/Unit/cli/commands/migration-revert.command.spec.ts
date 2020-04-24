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

import { AbstractApplication } from "../../../../src/fonaments/abstract-application";
import { testSuite, expect, describeName } from "../../../mocha/global-setup";
import { DatabaseService } from "../../../../src/database/database.service";
import { QueryRunner, Connection } from "typeorm";
import { MigrationRevertCommand } from "../../../../src/cli/commands/migration-revert.command";
import { runCLICommandIsolated } from "../../../utils/utils";

describe(describeName('MigrationRevertCommand tests'), () => {

    after(async() => {
        await testSuite.resetDatabaseData();
    });

    it('should revert a migration', async() => {
        let app: AbstractApplication = testSuite.app;
        let databaseService: DatabaseService = await app.getService<DatabaseService>(DatabaseService.name);

        //First, we need to remove default data.
        await databaseService.emptyDatabase();
        await databaseService.runMigrations();

        let queryRunner: QueryRunner = databaseService.connection.createQueryRunner();
        
        const migration = await queryRunner.query('SELECT count(*) FROM migrations');
        await queryRunner.release();

        await runCLICommandIsolated(testSuite, async () => {
            return new MigrationRevertCommand().handler({
                $0: "migration:revert",
            _: []
        })});
        
        queryRunner  = databaseService.connection.createQueryRunner();
        const afterMigration = await queryRunner.query('SELECT count(*) FROM migrations');
        await queryRunner.release();
        
        expect(parseInt(afterMigration[0]['count(*)'])).to.be.deep.eq(migration[0]['count(*)'] - 1);
    });
});