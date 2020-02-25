import { AbstractApplication } from "../../../src/fonaments/abstract-application";
import { runApplication } from "../../utils/utils";
import { Backup } from "../../../src/backups/backup";
import { createTestDirectory } from "../../jest/partials/create-test-directory";
import { BackupService } from "../../../src/backups/backup.service";
import * as path from "path";
import moment from "moment";

let app: AbstractApplication;

describe('BackupService tests', async() => {
    const playground: string = createTestDirectory(__dirname);
    let service: BackupService;
    
    beforeAll(async() => {
        app = await runApplication();
        service = await app.getService(BackupService.name);
        service['_config'].data_dir = playground;
    });

    it('getAll should return all existing backups', async () => {
        const b1: Backup = new Backup();
        const b2: Backup = new Backup();

        await b1.create(path.join(process.cwd(), playground));
        await new Promise(resolve => setTimeout(resolve, 1000));
        await b2.create(path.join(process.cwd(), playground));

        expect(await service.getAll()).toEqual([b1, b2]);
    });

    it('getAll should return an empty array if any backup is persisted', async() => {
        //expect(await service.getAll()).toHaveLength(0);
    });

    it('findOne should return a backup if exists', async() => {
        const b1: Backup = new Backup();
        await b1.create(path.join(process.cwd(), playground));

        expect(await service.findOne(b1.id)).toEqual(b1);
    });

    it('findOne should return null if backup does not exist', async() => {
        expect(await service.findOne('test')).toBeNull();
    });

    it('create should create a backup', async() => {
        const backup: Backup = await service.create();

        expect(backup.exists()).toBeTruthy;
    });

    it('delete should remove a backup', async ()=> {
        let backup: Backup = new Backup();
        await backup.create(path.join(process.cwd(), playground));

        backup = await service.delete(backup);

        expect(backup.exists()).toBeFalsy();
    });

    it('backup should be removed if retention policy by backup counts is enabled', async () => {
        
        const b1: Backup = new Backup();
        const b2: Backup = new Backup();

        await b1.create(path.join(process.cwd(), playground));
        await new Promise(resolve => setTimeout(resolve, 1000));
        await b2.create(path.join(process.cwd(), playground));

        service['_config'].default_max_copies = 1;
        service['_config'].default_max_days = 0;

        const expectedRemoved: number = (await service.getAll()).length - service['_config'].default_max_copies;

        expect(await service.applyRetentionPolicy()).toHaveLength(expectedRemoved)
    });

    it('backup should be removed if retention policy by expiration date is enabled', async () => {
        const b1: Backup = new Backup();
        const b2: Backup = new Backup();

        service['_config'].default_max_copies = 0;
        service['_config'].default_max_days = 1;

        let spy = jest.spyOn(Date, 'now').mockImplementation(() => new Date(Date.UTC(2017, 1, 14)).valueOf());
        await b1.create(path.join(process.cwd(), playground));
        spy = jest.spyOn(Date, 'now').mockImplementation(() => new Date(Date.UTC(2017, 1, 15)).valueOf());
        await b2.create(path.join(process.cwd(), playground));

        spy.mockRestore();


        expect(await service.applyRetentionPolicy()).toHaveLength(2)
    });
})