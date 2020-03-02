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
import * as semver from "semver";
import { VersionTagIsNotValidException } from "../../version/exceptions/version-tag-is-not-valid.exception";
import moment = require("moment");
import * as path from "path";
import { Version } from "../../version/version";
import { Application } from "../../Application";


/**
 * Runs migration command.
 */
export class TagVersionCommand implements yargs.CommandModule {

    command = "version:tag";
    describe = "Create a new version";

    builder(args: yargs.Argv) {
        return args
            .option("t", {
                alias: "tag",
                describe: "Version tag.",
                demand: true
            });            
    }

    async handler(args: yargs.Arguments) {
        try {
            const app: Application = await Application.run();

            if (!semver.valid(args.t as string)) {
                throw new VersionTagIsNotValidException(args.t as string);
            }

            const version: Version = new Version(args.t as string, moment());

            await version.saveVersionFile(path.join(app.path, Application.VERSION_FILENAME));

            process.exit(0);

        } catch (err) {
            console.log("Error during tag creation:");
            console.error(err);
            process.exit(1);
        }
    }
}