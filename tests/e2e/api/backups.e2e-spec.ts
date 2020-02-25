import { runApplication, randomString, generateSession, attachSession, sleep } from "../../utils/utils";
import { AbstractApplication } from "../../../src/fonaments/abstract-application";
import request = require("supertest");
import { User } from "../../../src/models/user/User";
import { getRepository } from "typeorm";
import { Backup } from "../../../src/backups/backup";
import { BackupService } from "../../../src/backups/backup.service";
import { DatabaseService } from "../../../src/database/database.service";
import e = require("express");

let app: AbstractApplication;

let loggedUser: User;
let loggedUserSessionId: string;
let adminUser: User;
let adminUserSessionId: string;

beforeAll(async () => {
    app = await runApplication();
    try {
        loggedUser = getRepository(User).create({
            username: 'loggedUser',
            email: 'loggedUser@fwcloud.test',
            password: randomString(10),
            customer: 1,
            role: 0,
            enabled: 1,
        });

        loggedUser = await getRepository(User).save(loggedUser);
        loggedUserSessionId = generateSession(loggedUser);

        adminUser = getRepository(User).create({
            username: 'admin',
            email: 'admin@fwcloud.test',
            password: randomString(10),
            customer: 1,
            role: 1,
            enabled: 1,
        });

        adminUser = await getRepository(User).save(adminUser);
        adminUserSessionId = generateSession(adminUser);
    } catch (e) { console.error(e)}
});

afterEach(async () => {
    const dbs: DatabaseService = await app.getService(DatabaseService.name);
    await dbs.removeData();
    await dbs.feedDefaultData();
});

describe('BackupController@index', () => {

    /*it('index should not be recheable if the user is not logged in', async() => {
        await supertest(app.express)
        .get('/backups')
        .expect(401);
    });*/

    it('index should not be recheable if the user is logged in but is not admin', async() => {
        await request(app.express)
        .get('/backups')
        .set('Cookie', [attachSession(loggedUserSessionId)])
        .expect(401)
    });

    it('index should return a backup list if the user is admin', async () => {
        console.error('Running index');
        const backupService: BackupService = await app.getService(BackupService.name);

        const backup1: Backup = await backupService.create();
        await sleep(1000);
        const backup2: Backup = await backupService.create();

        console.error('Created index');

        await request(app.express)
            .get('/backups')
            .set('Cookie', [attachSession(adminUserSessionId)])
            .expect(200)
            .expect(response => {
                response.body = [backup1.toResponse(), backup2.toResponse()]
            });
    });
});

describe('BackupController@show', () => {

    it('anonymous user should not see a backup', async () => {
        console.error('Running show')
        const backupService: BackupService = await app.getService(BackupService.name);
        const backup: Backup = await backupService.create();

        console.error('Created show');

        await request(app.express)
        .get(`/backups/${backup.id}`)
        .expect(401)
    });
});