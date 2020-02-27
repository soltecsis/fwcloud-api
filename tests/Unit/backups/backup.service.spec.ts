import { AbstractApplication } from "../../../src/fonaments/abstract-application";
import { Backup } from "../../../src/backups/backup";
import { BackupService } from "../../../src/backups/backup.service";
import { testSuite, expect, describeName } from "../../mocha/global-setup";

let app: AbstractApplication;

describe(describeName('BackupService tests'), async() => {
    let service: BackupService;
    
    beforeEach(async() => {
        app = testSuite.app;
        service = await app.getService<BackupService>(BackupService.name);
    });

    it('getAll should return all existing backups', async () => {
        const b1: Backup = new Backup();
        const b2: Backup = new Backup();

        await b1.create(service.config.data_dir);
        await new Promise(resolve => setTimeout(resolve, 1000));
        await b2.create(service.config.data_dir);

        expect(await service.getAll()).to.be.deep.equal([b1, b2]);
    });

    it.skip('getAll should return an empty array if any backup is persisted', async() => {
        expect(await service.getAll()).to.have.length(0);
    });

    it('findOne should return a backup if exists', async() => {
        const b1: Backup = new Backup();
        await b1.create(service.config.data_dir);

        expect(await service.findOne(b1.id)).to.be.deep.equal(b1);
    });

    it('findOne should return null if backup does not exist', async() => {
        expect(await service.findOne(0)).to.be.null;
    });

    it('create should create a backup', async() => {
        const backup: Backup = await service.create();

        expect(backup.exists()).to.be.true;
    });

    it('delete should remove a backup', async ()=> {
        let backup: Backup = new Backup();
        await backup.create(service.config.data_dir);

        backup = await service.delete(backup);

        expect(backup.exists()).to.be.false;
    });

    it('backup should be removed if retention policy by backup counts is enabled', async () => {
        
        const b1: Backup = new Backup();
        const b2: Backup = new Backup();

        await b1.create(service.config.data_dir);
        await new Promise(resolve => setTimeout(resolve, 1000));
        await b2.create(service.config.data_dir);

        service['_config'].default_max_copies = 1;
        service['_config'].default_max_days = 0;

        const expectedRemoved: number = (await service.getAll()).length - service['_config'].default_max_copies;

        expect(await service.applyRetentionPolicy()).to.have.length(expectedRemoved)
    });

    it.skip('backup should be removed if retention policy by expiration date is enabled', async () => {
        /*const b1: Backup = new Backup();
        const b2: Backup = new Backup();

        service['_config'].default_max_copies = 0;
        service['_config'].default_max_days = 1;

        let spy = jest.spyOn(Date, 'now').mockImplementation(() => new Date(Date.UTC(2017, 1, 14)).valueOf());
        await b1.create(path.join(process.cwd(), playground));
        spy = jest.spyOn(Date, 'now').mockImplementation(() => new Date(Date.UTC(2017, 1, 15)).valueOf());
        await b2.create(path.join(process.cwd(), playground));

        spy.mockRestore();


        expect(await service.applyRetentionPolicy()).toHaveLength(2)*/
    });

    it('update config should update the custom config parameters', async () => {
        let config = service.config;

        config.default_max_days = 100;

        await service.updateConfig(config);

        expect(service.config.default_max_days).to.be.deep.equal(100);

    })
})