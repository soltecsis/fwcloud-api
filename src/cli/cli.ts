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

import yargs = require('yargs');
import { MigrationResetCommand } from './commands/migration-reset-command';
import { MigrationRunCommand } from './commands/migration-run.command';
import { MigrationCreateCommand } from './commands/migration-create.command';
import { MigrationRollbackCommand } from './commands/migration-rollback.command';
import { MigrationImportDataCommand } from './commands/migration-import-data.command';
import { RouteListCommand } from './commands/route-list.command';
import { KeysGenerateCommand } from './commands/keys-generate.command';
import { Argument, Command, Option } from './command';
import { BackupCreateCommand } from './commands/backup-create.command';
import { BackupRestoreCommand } from './commands/backup-restore.command';
import { StandardServicesAddCommand } from './commands/standard-services-add.command';

const commands: (typeof Command)[] = [
  MigrationResetCommand,
  MigrationRollbackCommand,
  MigrationRunCommand,
  MigrationCreateCommand,
  MigrationImportDataCommand,
  RouteListCommand,
  KeysGenerateCommand,
  BackupCreateCommand,
  BackupRestoreCommand,
  StandardServicesAddCommand,
];

class CLI {
  public load() {
    let cli: yargs.Argv = yargs.usage('Usage: $0 <command> [options]');

    cli = this.parseCommands(cli, commands);

    cli
      .recommendCommands()
      .demandCommand(1)
      .strict()
      .help()
      .alias('h', 'help')
      .alias('v', 'version').argv;

    return cli;
  }

  protected parseCommands(
    cli: yargs.Argv,
    commands: (typeof Command)[],
  ): yargs.Argv {
    commands.forEach((commmand: typeof Command) => {
      // @ts-ignore: command is not abstract
      const instance: Command = new commmand();
      const name: string = instance.name;
      const description: string = instance.description;
      const options: Option[] = instance.getOptions();
      const args: Argument[] = instance.getArguments();

      cli.command(
        this.generateName(name, args),
        description,
        (yargs: yargs.Argv) => {
          options.forEach((option: Option) => {
            yargs.option(option.name, {
              alias: option.alias ?? undefined,
              type: option.type ?? undefined,
              describe: option.description,
              demandOption: option.required ?? false,
              default: option.default ?? undefined,
            });
          });

          args.forEach((arg: Argument) => {
            yargs.positional(arg.name, {
              describe: arg.description,
            });
          });

          return yargs;
        },
        async (yargs) => {
          const returnCode: number = await instance.safeHandle(yargs);

          process.exit(returnCode);
        },
      );
    });

    return cli;
  }

  protected generateName(name: string, args: Argument[]): string {
    let result: string = name;

    for (let i = 0; i < args.length; i++) {
      if (args[i].required) {
        result = `${result} <${args[i].name}>`;
      } else {
        result = `${result} [${args[i].name}]`;
      }
    }

    return result;
  }
}

const cli = new CLI();
cli.load();
