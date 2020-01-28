import { createConnection, Connection, QueryRunner, Table } from "typeorm";
import { MigrationResetCommand } from "../../../../src/cli/commands/MigrationResetCommand"

import * as config from "../../../../src/config/config";
import yargs = require("yargs");

describe('', () => {
    let connection: Connection = null;
    let queryRunner: QueryRunner = null;
    const configDB = config.get('db');

    beforeEach(async () => {
        connection = await createConnection({
            type: 'mysql',
            host: configDB.host,
            port: configDB.port,
            database: configDB.name,
            username: configDB.user,
            password: configDB.pass,
            migrations: configDB.migrations
        });

        await connection.runMigrations({transaction: "all"});
        
        queryRunner = connection.createQueryRunner();
    });

    afterEach(async () => {
        await connection.close();
    })

    it('reset should reset the database', async() => {
        await expect(await queryRunner.getTable('ca')).toBeInstanceOf(Table);
        await expect(await queryRunner.getTable('user__fwcloud')).toBeInstanceOf(Table);

        const command = await new MigrationResetCommand().handler({
            $0: "migration:run",
            _: []
        });
        
        await expect(await queryRunner.getTable('ca')).toBeUndefined();
        await expect(await queryRunner.getTable('user__fwcloud')).toBeUndefined();
    });
});