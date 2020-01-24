#!/usr/bin/env node
import * as yargs from "yargs";
import { MigrationResetCommand } from "./commands/MigrationResetCommand";
import { InstallCommand } from "./commands/InstallCommand";

yargs
    .usage("Usage: $0 <command> [options]")
    .command(new MigrationResetCommand())
    .command(new InstallCommand())
    .recommendCommands()
    .demandCommand(1)
    .strict()
    .alias("v", "version")
    .help("h")
    .alias("h", "help")
    .argv;