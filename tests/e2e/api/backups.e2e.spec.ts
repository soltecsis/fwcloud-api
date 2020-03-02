import { randomString, generateSession, attachSession, sleep } from "../../utils/utils";
import '../../mocha/global-setup';
import { expect, describeName } from "../../mocha/global-setup";
import request = require("supertest");
import { User } from "../../../src/models/user/User";
import { getRepository } from "typeorm";
import { Backup } from "../../../src/backups/backup";
import { BackupService } from "../../../src/backups/backup.service";
import { Application } from "../../../src/Application";
import moment from "moment";
import { testSuite } from "../../mocha/global-setup";
import { RepositoryService } from "../../../src/database/repository.service";

let app: Application;
let backupService: BackupService;
let loggedUser: User;
let loggedUserSessionId: string;
let adminUser: User;
let adminUserSessionId: string;

beforeEach(async () => {
    app = testSuite.app;
    backupService = await app.getService<BackupService>(BackupService.name);
    const repository: RepositoryService = await app.getService<RepositoryService>(RepositoryService.name);
    
    try {
        loggedUser = repository.for(User).create({
            username: 'loggedUser',
            email: 'loggedUser@fwcloud.test',
            password: randomString(10),
            customer: 1,
            role: 0,
            enabled: 1,
            confirmation_token: randomString(10)
        });

        loggedUser = await repository.for(User).save(loggedUser);
        loggedUserSessionId = generateSession(loggedUser);

        adminUser = repository.for(User).create({
            username: 'admin',
            email: 'admin@fwcloud.test',
            password: randomString(10),
            customer: 1,
            role: 1,
            enabled: 1,
            confirmation_token: randomString(10)
        });

        adminUser = await repository.for(User).save(adminUser);
        adminUserSessionId = generateSession(adminUser);
    } catch (e) { console.error(e) }
});


describe(describeName('BackupController@index'), () => {

    it('guest user should not see the backup index', async () => {
        return await request(app.express)
            .get('/backups')
            .expect(401);
    });

    it('regular user should not see backup index', async () => {
        return await request(app.express)
            .get('/backups')
            .set('Cookie', [attachSession(loggedUserSessionId)])
            .expect(401)
    });
    
    it('admin user should see backup index', async () => {
        const backupService: BackupService = await app.getService<BackupService>(BackupService.name);

        const backup1: Backup = await backupService.create();
        await sleep(1000);
        const backup2: Backup = await backupService.create();

        return await request(app.express)
            .get('/backups')
            .set('Cookie', [attachSession(adminUserSessionId)])
            .expect(200)
            .expect(response => {
                response.body = [backup1.toResponse(), backup2.toResponse()]
            });
    });
});

describe(describeName('BackupController@show'), () => {

    it('guest user should not see a backup', async () => {
        const backupService: BackupService = await app.getService<BackupService>(BackupService.name);
        const backup: Backup = await backupService.create();

        await request(app.express)
        .get(`/backups/${backup.id}`)
        .expect(401)
    });

    it('regular user should not see a backup', async () => {
        const backupService: BackupService = await app.getService<BackupService>(BackupService.name);
        const backup: Backup = await backupService.create();

        await request(app.express)
            .get(`/backups/${backup.id}`)
            .set('Cookie', [attachSession(loggedUserSessionId)])
            .expect(401)
    });

    it('admin user should see a backup', async () => {
        const backupService: BackupService = await app.getService<BackupService>(BackupService.name);
        const backup: Backup = await backupService.create();

        await request(app.express)
            .get(`/backups/${backup.id}`)
            .set('Cookie', [attachSession(adminUserSessionId)])
            .expect(200)
            .expect(response => {
                response.body.data = backup.toResponse()
            });
    });

    it('404 exception should be thrown if a backup does not exist', async () => {
        await request(app.express)
            .get(`/backups/${moment().add(2, 'd').valueOf().toString()}`)
            .set('Cookie', [attachSession(adminUserSessionId)])
            .expect(404);
    });
});

describe(describeName('BackupController@create'), async () => {
    it('guest user should not create a backup', async () => {
        await request(app.express)
        .post(`/backups`)
        .expect(401)
    });

    it('regular user should not create a backup', async () => {
        await request(app.express)
            .post(`/backups`)
            .set('x-fwc-confirm-token', loggedUser.confirmation_token)
            .set('Cookie', [attachSession(loggedUserSessionId)])
            .expect(401)
    });

    it('admin user should create a backup', async () => {
        const existingBackups: Array<Backup> = await (await (app.getService<BackupService>(BackupService.name))).getAll();
        await request(app.express)
            .post(`/backups`)
            .send({
                comment: 'test comment'
            })
            .set('x-fwc-confirm-token', adminUser.confirmation_token)
            .set('Cookie', [attachSession(adminUserSessionId)])
            .expect(201)
            .expect(response => {
                expect(response.body.data.comment).to.be.deep.equal('test comment')
            })

        expect((await (await (app.getService<BackupService>(BackupService.name))).getAll()).length).equal(existingBackups.length + 1);
    });
});

describe(describeName('BackupConfigController@show'), async () => {
    it('guest user should not see backup config', async () => {
        await request(app.express)
            .get(`/backups/config`)
            .expect(401)
    });

    it('regular user should not see backup config', async () => {
        await request(app.express)
            .get(`/backups/config`)
            .set('Cookie', [attachSession(loggedUserSessionId)])
            .expect(401)
    });

    it('admin user should see backup config', async () => {
        await request(app.express)
            .get(`/backups/config`)
            .set('Cookie', [attachSession(adminUserSessionId)])
            .expect(200)
            .expect(response => {
                expect(response.body.data).to.be.deep.equal(backupService.config);
            });
    });
});

describe(describeName('BackupConfigController@update'), async () => {
    it('guest user should not update backup config', async () => {
        await request(app.express)
            .put(`/backups/config`)
            .expect(401)
    });

    it('regular user should not update backup config', async () => {
        await request(app.express)
            .put(`/backups/config`)
            .set('Cookie', [attachSession(loggedUserSessionId)])
            .set('x-fwc-confirm-token', loggedUser.confirmation_token)
            .expect(401)
    });

    it.skip('admin user should update backup config', async () => {
        await request(app.express)
            .put(`/backups/config`)
            .set('Cookie', [attachSession(adminUserSessionId)])
            .set('x-fwc-confirm-token', adminUser.confirmation_token)
            .send({
                "default_max_copies": 100
            })
            .expect(201)
            .expect(response => {
                expect(response.body.data).to.be.deep.equal(backupService.config);
                expect(response.body.data.default_max_copies).to.be.deep.equal(100);
            });
    });
});

