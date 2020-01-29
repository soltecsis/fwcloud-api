import { MigrationExecutor } from "typeorm";

export class FwCloudMigrationExecutor extends MigrationExecutor {
    
    async undoAllMigrations(): Promise <void> {
        const queryRunner = this.queryRunner || this.connection.createQueryRunner("master");

        // create migrations table if its not created yet
        await this.createMigrationsTableIfNotExist(queryRunner);

        // get all migrations that are executed and saved in the database
        const executedMigrations = await this.loadExecutedMigrations(queryRunner);

        if (executedMigrations.length <= 0) {
            this.connection.logger.logSchemaBuild(`No migrations was found in the database. Nothing to reset!`);
            return;
        }

        for (let i: number = 0; i < executedMigrations.length; i++) {
            await this.undoLastMigration();
        }
    }
}