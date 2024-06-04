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
import * as Path from "path";
import * as originalCommand from "typeorm/commands/MigrationCreateCommand";
import { Application } from "../Application";
import { DatabaseService } from "../../database/database.service";
import { Command, Option } from "../command";

/**
 * Runs migration command.
 */
export class MigrationCreateCommand extends Command {
  public name: string = "migration:create";
  public description: string = "Create a new migration";

  async handle(args: yargs.Arguments) {
    const databaseService: DatabaseService =
      await this._app.getService<DatabaseService>(DatabaseService.name);
    const version = args.tag ? (args.tag as string) : this._app.version.tag;

    const directory: string = (args.directory as string)
      ? args.directory
      : databaseService.config.migration_directory;

    if (!directory) {
      throw new Error("Migration directory not found: " + directory);
    }

    const path = Path.join(directory, version);

    args.d = path;
    args.dir = path;

    await new originalCommand.MigrationCreateCommand().handler(args);

    this.output.success("Migration file created");
  }

  public getOptions(): Option[] {
    return [
      {
        name: "name",
        alias: "n",
        description: "Migration name",
        required: true,
      },
      {
        name: "tag",
        alias: "t",
        description: "Schema version which migration belongs to",
        required: true,
      },
      {
        name: "directory",
        alias: "d",
        description: "Custom migration directory",
        required: false,
      },
    ];
  }
}
