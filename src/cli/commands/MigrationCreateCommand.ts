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
import { Connection, ConnectionOptionsReader, createConnection, MigrationExecutor, QueryRunner } from "typeorm";
import * as config from '../../config/config';
import * as version from '../../version.json';
import * as Path from 'path';
import {CommandUtils} from "typeorm/commands/CommandUtils";
import * as originalCommand from 'typeorm/commands/MigrationCreateCommand';


/**
 * Runs migration command.
 */
export class MigrationCreateCommand implements yargs.CommandModule {

    command = "migration:create";
    describe = "Create a new migration";

    builder(args: yargs.Argv) {
        return args
            .option("n", {
                alias: "name",
                describe: "Name of the migration class.",
                demand: true
            })
            .option("d", {
                alias: "dir",
                describe: "Directory where migration should be created."
            })
            .option('t', {
                alias: 'tag',
                describe: 'Version which migration belongs to.',
                default: version.tag
            });            
    }

    async handler(args: yargs.Arguments) {
        let connection: Connection | undefined = undefined;
        let configDB = config.get('db');

        try {
            let directory: string = args.dir ? args.dir.toString() : null;

            // if directory is not set then try to open tsconfig and find default path there
            if (!directory) {
                try {
                    const connectionOptionsReader = new ConnectionOptionsReader({
                        root: process.cwd(),
                        configName: args.config as any
                    });
                    const connectionOptions = await connectionOptionsReader.get(args.connection as any);
                    directory = configDB.migration_directory;
                } catch (err) { }
            }

            if (!directory) {
                throw new Error('Migration directory not found');
            }


            const path = Path.join(directory, args.tag as string);

            args.d = path;
            args.dir = path;

            new originalCommand.MigrationCreateCommand().handler(args);

        } catch (err) {
            console.log("Error during migration creation:");
            console.error(err);
            process.exit(1);
        }
    }
}