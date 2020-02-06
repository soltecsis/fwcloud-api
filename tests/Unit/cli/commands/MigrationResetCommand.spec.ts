import { QueryRunner, Table } from "typeorm";
import { MigrationResetCommand } from "../../../../src/cli/commands/MigrationResetCommand"

import { runApplication, getDatabaseConnection } from "../../../utils/utils";
import { Application } from "../../../../src/Application";

describe('MigrationResetCommand', () => {
    let app: Application;
    let queryRunner: QueryRunner

    beforeEach(async () => {
        app = await runApplication();
        queryRunner = (await getDatabaseConnection()).createQueryRunner();
    });

    it.only('reset should reset the database', async() => {
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