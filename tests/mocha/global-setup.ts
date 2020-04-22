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

import * as chai from "chai";
import ChaiAsPromised from "chai-as-promised";
import { Application } from "../../src/Application";
import { DatabaseService } from "../../src/database/database.service";
import * as fse from "fs-extra";
import * as path from "path";
import StringHelper from "../../src/utils/string.helper";

chai.should();
chai.use(ChaiAsPromised);

export const expect = chai.expect;

export const playgroundPath: string = path.join(process.cwd(), 'tests', 'playground');

class TestSuite {
    public app: Application;

    public async runApplication(): Promise<Application> {
        if (this.app) {
            await this.app.close();
        }

        this.app = await Application.run();
        return this.app;
    }

    public async closeApplication(): Promise<void> {
        if (this.app) {
            await this.app.close();
            this.app = null;
        }
    }
}

export const testSuite: TestSuite = new TestSuite();

export const describeName = (comment?: string): string => {
    return comment ? _getCallerFile() + ' - ' + comment : _getCallerFile();
};

function _getCallerFile(): string {
    try {
        const e = new Error();
        const regex = /\((.*):(\d+):(\d+)\)$/
        const match = regex.exec(e.stack.split("\n")[3]);
        const relative_path: string = StringHelper.after(path.join(process.cwd(), "dist" , "/"), match[1]);
        return relative_path;
    } catch (err) { }
    
    return "undefined";
}


before(async () => {
    await testSuite.runApplication();

    const dbService: DatabaseService = await testSuite.app.getService<DatabaseService>(DatabaseService.name);
    await dbService.emptyDatabase();
    await dbService.runMigrations();
    await dbService.feedDefaultData();
    await testSuite.app.close();
    testSuite.app = null;
});

beforeEach(async () => {
    fse.removeSync(playgroundPath);
    fse.mkdirSync(playgroundPath);
    await testSuite.runApplication();
    fse.mkdirSync(testSuite.app.config.get('session').files_path);
})

afterEach(async () => {
    if (testSuite.app) {
        let _app = testSuite.app;
        const dbService: DatabaseService = await _app.getService<DatabaseService>(DatabaseService.name);

        if (!dbService.connection.isConnected) {
            await dbService.connection.connect();
        }
        
        await dbService.runMigrations();

        await dbService.removeData();
        
        await dbService.feedDefaultData();
        
        await testSuite.closeApplication();
        fse.removeSync(playgroundPath);
    }
})