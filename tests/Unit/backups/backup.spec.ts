import { createTestDirectory } from "../../jest/partials/create-test-directory";
import { Backup } from "../../../src/backups/backup";
import { AbstractApplication } from "../../../src/fonaments/abstract-application";
import { runApplication } from "../../utils/utils"
import * as fs from "fs";
import * as path from "path";
import { DatabaseService } from "../../../src/database/database.service";

let app: AbstractApplication;

beforeAll(async() => {
    app = await runApplication();
})

describe('Backup tests', () => {
    const playground: string = createTestDirectory(__dirname);

    it('A new backup exists should return false', async () => {
        const backup: Backup = new Backup();
        expect(backup.exists()).toBeFalsy();
    });

    it('create() should create a backup directory', async () => {
        let backup: Backup = new Backup();
        await backup.create(playground);
        expect(backup.exists()).toBeTruthy();
        expect(backup.id).not.toBeNull();
        expect(fs.existsSync(backup.path)).toBeTruthy();
    });

    it('create() should create a dump file', async() => {
        let backup: Backup = new Backup();
        backup = await backup.create(playground);
        expect(fs.existsSync(path.join(backup.path, Backup.DUMP_FILENAME))).toBeTruthy() 
    });

    it('create() should copy data files if exists', async () => {
        //TODO
    });

    it('store() should import the database', async() => {
        const databaseService: DatabaseService = await app.getService(DatabaseService.name);
        let backup: Backup = new Backup();
        backup = await backup.create(playground);

        await emptyDatabase();

        backup = await backup.restore();

        expect(await databaseService.getQueryRunner().hasTable('ca')).toBe(true);
    });

    it('delete() should remove the backup', async() => {
        let backup: Backup = new Backup();
        backup = await backup.create(playground);

        backup = await backup.destroy();

        expect(fs.existsSync(backup.path)).toBeFalsy();
    })
});

async function emptyDatabase() {
    const databaseService: DatabaseService = await app.getService(DatabaseService.name);

    await databaseService.emptyDatabase();
}