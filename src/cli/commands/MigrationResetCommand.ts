/*
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

import * as process from "process";
import * as yargs from "yargs";
import { Connection, ConnectionOptionsReader, createConnection, MigrationExecutor, QueryRunner, getConnectionManager } from "typeorm";
import * as config from "../../config/config"


/**
 * Runs migration command.
 */
export class MigrationResetCommand implements yargs.CommandModule {

    command = "migration:reset";
    describe = "Reset all migrations";

    builder(args: yargs.Argv) {
        return args;
    }

    async handler(args: yargs.Arguments) {
        let connection: Connection | undefined = undefined;
        let configDB = config.get('db');

        try {
            const options = { transaction: "all" as "all" | "none" | "each" };

            let connection: Connection = await createConnection({
                name: 'migrator',
                type: 'mysql',
                host: configDB.host,
                port: configDB.port,
                database: configDB.name,
                username: configDB.user,
                password: configDB.pass,
                subscribers: [],
                synchronize: false,
                migrationsRun: false,
                dropSchema: false,
                logging: ["query", "error", "schema"],
                migrations: configDB.migrations,
                cli: {
                    migrationsDir: configDB.migration_directory
                }
            });

            const migrationExecutor = new MigrationExecutor(connection, connection.createQueryRunner());
            const executedMigrations = await migrationExecutor.getExecutedMigrations();

            if (executedMigrations.length === 0) {
                connection.logger.logSchemaBuild(`No migrations was found in the database. Nothing to reset!`);
            }

            for (let i: number = 0; i < executedMigrations.length; i++) {
                await connection.undoLastMigration(options);
            }

            await connection.close();

        } catch (err) {
            if (connection) await (connection as Connection).close();

            console.log("Error during migration reset:");
            console.error(err);
            process.exit(err);
        }
    }

}