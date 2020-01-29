import { createConnection, Connection, QueryRunner, Table } from "typeorm";
import { MigrationResetCommand } from "../../../../src/cli/commands/MigrationResetCommand"

import * as config from "../../../../src/config/config";
import yargs = require("yargs");
import { runMigrations, getDatabaseConnection, resetMigrations } from "../../../utils/utils";

describe('MigrationResetCommand', () => {
    let connection: Connection = null;
    let queryRunner: QueryRunner = null;
    const configDB = config.get('db');

    beforeEach(async () => {
        connection = await getDatabaseConnection();
        queryRunner = connection.createQueryRunner();
        await resetMigrations(connection);
        await runMigrations(connection);
    });

    afterEach(async () => {
        await connection.close();
    })

    it('reset should reset the database', async() => {
        expect(await queryRunner.getTable('ca')).toBeInstanceOf(Table);
        expect(await queryRunner.getTable('user__fwcloud')).toBeInstanceOf(Table);

        const command = await new MigrationResetCommand().handler({
            $0: "migration:run",
            _: []
        });
        
        expect(await queryRunner.getTable('ca')).toBeUndefined();
        expect(await queryRunner.getTable('user__fwcloud')).toBeUndefined();
    });
});