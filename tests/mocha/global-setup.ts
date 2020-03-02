import * as chai from "chai";
import ChaiAsPromised from "chai-as-promised";
import { Application } from "../../src/Application";
import { DatabaseService } from "../../src/database/database.service";
import * as fse from "fs-extra";
import * as path from "path";
import StringHelper from "../../src/utils/StringHelper";

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
    let _app = await Application.run();

    const dbService: DatabaseService = await _app.getService<DatabaseService>(DatabaseService.name);
    await dbService.resetMigrations();
    await dbService.runMigrations();
    await dbService.feedDefaultData();
    await _app.close();
});

beforeEach(async () => {
    testSuite.app = await Application.run();
    fse.removeSync(playgroundPath);
    fse.mkdirSync(playgroundPath);
    fse.mkdirSync(testSuite.app.config.get('session').files_path);
})

afterEach(async () => {
    if (testSuite.app) {
        let _app = testSuite.app;
        const dbService: DatabaseService = await _app.getService<DatabaseService>(DatabaseService.name);

        if (!await dbService.isDatabaseEmpty()) {
            await dbService.removeData();
        } else {
            await dbService.runMigrations();
        }

        await dbService.feedDefaultData();
        await _app.close();
        fse.removeSync(playgroundPath);
    }
})