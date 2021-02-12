/*!
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

import { MigrationCreateCommand } from "../../../../src/cli/commands/migration-create.command"
import * as path from 'path';
import * as fs from 'fs';
import { expect, describeName, testSuite, playgroundPath } from "../../../mocha/global-setup";
import { FSHelper } from "../../../../src/utils/fs-helper";
import { runCLICommandIsolated } from "../../../utils/utils";

describe(describeName('MigrationCreateCommand tests'), () => {
    const version: string = 'x.y.z';
    const migrationDirectory = path.join(playgroundPath, '.tmp');

    beforeEach(() => {
        try {
            fs.mkdirSync(path.join(process.cwd(), migrationDirectory), {recursive: true});
        } catch(e) {}
    });

    afterEach(async() => {
        const tmpDir: string = path.join(process.cwd(), migrationDirectory);

        await FSHelper.rmDirectory(tmpDir);
    });
    
    it.skip('should create a migration file in the version migration directory', async() => {
        await runCLICommandIsolated(testSuite, async () => {
            return new MigrationCreateCommand().safeHandle({
            $0: "migration:create",
            n: 'migration_test',
            name: 'migration_test',
            t: version,
            tag: version,
            d: migrationDirectory,
            directory: migrationDirectory,
            _: []
        })});

        const files = fs.readdirSync(path.join(process.cwd(), migrationDirectory, version));

        files.filter((item: string) => {
            new RegExp('\w{13}-migration_test', 'g').test(item);
        });

        expect(files.length).to.be.equal(1);
    });
});