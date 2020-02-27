import { Backup } from "../../../src/backups/backup";
import { AbstractApplication } from "../../../src/fonaments/abstract-application";
import * as fs from "fs";
import * as path from "path";
import { DatabaseService } from "../../../src/database/database.service";
import { expect, testSuite, describeName } from "../../mocha/global-setup";
import { BackupService } from "../../../src/backups/backup.service";

let app: AbstractApplication;
let service: BackupService;

beforeEach(async() => {
    app = testSuite.app;
    service = await app.getService<BackupService>(BackupService.name);
})

describe(describeName('Backup tests'), () => {
    it('A new backup exists should return false', async () => {
        const backup: Backup = new Backup();
        expect(backup.exists()).to.be.false;
    });

    it('create() should create a backup directory', async () => {
        let backup: Backup = new Backup();
        await backup.create(service.config.data_dir);
        expect(backup.exists()).to.be.true;
        expect(backup.id).not.to.be.null;
        expect(fs.existsSync(backup.path)).to.be.true;
    });

    it('create() should create a dump file', async() => {
        let backup: Backup = new Backup();
        backup = await backup.create(service.config.data_dir);
        expect(fs.existsSync(path.join(backup.path, Backup.DUMP_FILENAME))).to.be.true;
    });

    it('create() should copy data files if exists', async () => {
        //TODO
    });

    it('store() should import the database', async() => {
        const databaseService: DatabaseService = await app.getService<DatabaseService>(DatabaseService.name);
        let backup: Backup = new Backup();
        backup = await backup.create(service.config.data_dir);

        await databaseService.emptyDatabase();

        backup = await backup.restore();

        expect(await databaseService.connection.createQueryRunner().hasTable('ca')).to.be.true;

        await databaseService.emptyDatabase();
    });

    it('delete() should remove the backup', async() => {
        let backup: Backup = new Backup();
        backup = await backup.create(service.config.data_dir);

        backup = await backup.destroy();

        expect(fs.existsSync(backup.path)).to.be.false;
    });

    it('load() an absolute path should transform the path to relative', async() => {
        let backup: Backup = new Backup();
        backup = await backup.create(path.join(process.cwd(), service.config.data_dir));

        expect(backup.path.startsWith(service.config.data_dir)).to.be.true;
    });
});