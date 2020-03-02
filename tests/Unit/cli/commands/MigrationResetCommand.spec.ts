import { Table, Connection, QueryRunner } from "typeorm";
import { MigrationResetCommand } from "../../../../src/cli/commands/MigrationResetCommand"
import { Application } from "../../../../src/Application";
import { expect, testSuite } from "../../../mocha/global-setup";
import { DatabaseService } from "../../../../src/database/database.service";

describe('MigrationResetCommand', () => {
    let app: Application;
    let queryRunner: QueryRunner

    beforeEach(async () => {
        app = testSuite.app;
        const connection: Connection = (await app.getService<DatabaseService>(DatabaseService.name)).connection;
        queryRunner = connection.createQueryRunner();
    });

    it('reset should reset the database', async() => {
        expect(await queryRunner.getTable('ca')).to.be.instanceOf(Table);
        expect(await queryRunner.getTable('user__fwcloud')).to.be.instanceOf(Table);

        const command = await new MigrationResetCommand().handler({
            $0: "migration:run",
            _: []
        });
        
        expect(await queryRunner.getTable('ca')).to.be.undefined;
        expect(await queryRunner.getTable('user__fwcloud')).to.be.undefined;
    });
});