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

import { generateSession, attachSession, createUser } from "../../utils/utils";
import '../../mocha/global-setup';
import { expect, describeName } from "../../mocha/global-setup";
import request = require("supertest");
import { User } from "../../../src/models/user/User";
import { Backup } from "../../../src/backups/backup";
import { BackupService } from "../../../src/backups/backup.service";
import { Application } from "../../../src/Application";
import moment from "moment";
import { testSuite } from "../../mocha/global-setup";
import { _URL } from "../../../src/fonaments/http/router/router.service";

let app: Application;
let backupService: BackupService;
let loggedUser: User;
let loggedUserSessionId: string;
let adminUser: User;
let adminUserSessionId: string;


describe(describeName('Backup E2E tests'), () => {
    
    beforeEach(async () => {
        app = testSuite.app;
        backupService = await app.getService<BackupService>(BackupService.name);
        
        loggedUser = await createUser({role: 0});
        loggedUserSessionId = generateSession(loggedUser);

        adminUser = await createUser({role: 1});
        adminUserSessionId = generateSession(adminUser);

    });

    describe('BackupController', () => {

        describe('BackupController@index', () => {

            it('guest user should not see the backup index', async () => {
                return await request(app.express)
                    .get(_URL().getURL('backups.index'))
                    .expect(401);
            });

            it('regular user should not see backup index', async () => {
                return await request(app.express)
                    .get(_URL().getURL('backups.index'))
                    .set('Cookie', [attachSession(loggedUserSessionId)])
                    .expect(401)
            });

            it('admin user should see backup index', async () => {
                const backupService: BackupService = await app.getService<BackupService>(BackupService.name);

                const backup1: Backup = await new Backup().create(backupService.config.data_dir);
                const backup2: Backup = await new Backup().create(backupService.config.data_dir);

                return await request(app.express)
                    .get(_URL().getURL('backups.index'))
                    .set('Cookie', [attachSession(adminUserSessionId)])
                    .expect(200)
                    .then(response => {
                        expect(response.body.data).to.be.deep.equal(
                            JSON.parse(JSON.stringify([backup1.toResponse(), backup2.toResponse()]))
                        )
                    });
            });
        });

        describe('BackupController@show', () => {

            it('guest user should not see a backup', async () => {
                const backupService: BackupService = await app.getService<BackupService>(BackupService.name);
                const backup: Backup = await new Backup().create(backupService.config.data_dir);

                await request(app.express)
                    .get(_URL().getURL('backups.show', {backup: backup.id}))
                    .expect(401)
            });

            it('regular user should not see a backup', async () => {
                const backupService: BackupService = await app.getService<BackupService>(BackupService.name);
                const backup: Backup = await new Backup().create(backupService.config.data_dir);

                await request(app.express)
                    .get(_URL().getURL('backups.show', {backup: backup.id}))
                    .set('Cookie', [attachSession(loggedUserSessionId)])
                    .expect(401)
            });

            it('admin user should see a backup', async () => {
                const backupService: BackupService = await app.getService<BackupService>(BackupService.name);
                const backup: Backup = await new Backup().create(backupService.config.data_dir);

                await request(app.express)
                    .get(_URL().getURL('backups.show', {backup: backup.id}))
                    .set('Cookie', [attachSession(adminUserSessionId)])
                    .expect(200)
                    .then(response => {
                        response.body.data = backup.toResponse()
                    });
            });

            it('404 exception should be thrown if a backup does not exist', async () => {
                await request(app.express)
                    .get(_URL().getURL('backups.show', {backup: moment().add(2, 'd').valueOf().toString()}))
                    .set('Cookie', [attachSession(adminUserSessionId)])
                    .expect(404);
            });
        });

        describe('BackupController@store', async () => {

            it('guest user should not create a backup', async () => {
                await request(app.express)
                    .post(_URL().getURL('backups.store'))
                    .expect(401)
            });

            it('regular user should not create a backup', async () => {
                await request(app.express)
                    .post(_URL().getURL('backups.store'))
                    .set('Cookie', [attachSession(loggedUserSessionId)])
                    .expect(401)
            });

            it('admin user should create a backup', async () => {
                const existingBackups: Array<Backup> = await (await (app.getService<BackupService>(BackupService.name))).getAll();
                await request(app.express)
                    .post(_URL().getURL('backups.store'))
                    .send({
                        comment: 'test comment'
                    })
                    .set('Cookie', [attachSession(adminUserSessionId)])
                    .expect(201)
                    .then(async response => {
                        expect(response.body.data.comment).to.be.deep.equal('test comment');
                    })

                expect((await (await (app.getService<BackupService>(BackupService.name))).getAll()).length).equal(existingBackups.length + 1);
            });
        });

        describe.skip('BackupController@restore', async() => {
        });

        describe('BackupController@destroy', async () => {
            let backup: Backup;

            beforeEach(async() => {
                backup = await new Backup().create(backupService.config.data_dir);
            });

            it('guest user should not destroy a backup', async () => {
                await request(app.express)
                    .delete(_URL().getURL('backups.destroy', {backup: backup.id}))
                    .expect(401)
            });

            it('regular user should not destroy a backup', async () => {
                await request(app.express)
                    .delete(_URL().getURL('backups.destroy', {backup: backup.id}))
                    .set('Cookie', [attachSession(loggedUserSessionId)])
                    .expect(401)
            });

            it('admin user should destroy a backup', async () => {
                
                await request(app.express)
                    .delete(_URL().getURL('backups.destroy', {backup: backup.id}))
                    .set('Cookie', [attachSession(adminUserSessionId)])
                    .expect(200);
            });

            it('404 should be returned if the backup does not exist', async() => {
                await request(app.express)
                    .delete(_URL().getURL('backups.destroy', {backup: 0}))
                    .set('Cookie', [attachSession(adminUserSessionId)])
                    .expect(404);
            })
        });
        
    })

    describe('BackupConfigController', () => {

        describe('BackupConfigController@show', async () => {

            it('guest user should not see backup config', async () => {
                await request(app.express)
                    .get(_URL().getURL('backups.config.show'))
                    .expect(401)
            });

            it('regular user should not see backup config', async () => {
                await request(app.express)
                    .get(_URL().getURL('backups.config.show'))
                    .set('Cookie', [attachSession(loggedUserSessionId)])
                    .expect(401)
            });

            it('admin user should see backup config', async () => {
                await request(app.express)
                    .get(_URL().getURL('backups.config.show'))
                    .set('Cookie', [attachSession(adminUserSessionId)])
                    .expect(200)
                    .then(response => {
                        expect(response.body.data).to.be.deep.equal({
                            max_days: backupService.config.max_days,
                            max_copies: backupService.config.max_copies,
                            schedule: backupService.config.schedule
                        });
                    });
            });
        });

        describe('BackupConfigController@update', async () => {

            it('guest user should not update backup config', async () => {
                await request(app.express)
                    .put(_URL().getURL('backups.config.update'))
                    .expect(401)
            });

            it('regular user should not update backup config', async () => {
                await request(app.express)
                    .put(_URL().getURL('backups.config.update'))
                    .set('Cookie', [attachSession(loggedUserSessionId)])
                    .expect(401)
            });

            it('admin user should update backup config', async () => {
                await request(app.express)
                    .put(_URL().getURL('backups.config.update'))
                    .set('Cookie', [attachSession(adminUserSessionId)])
                    .send({
                        "schedule": backupService.config.schedule,
                        "max_days": 10,
                        "max_copies": 100
                    })
                    .expect(201)
                    .then(response => {
                        expect(response.body.data).to.be.deep.equal(backupService.config);
                        expect(response.body.data.max_copies).to.be.deep.equal(100);
                    });

                expect(backupService.config.data_dir).not.to.be.undefined;
                expect(backupService.config.config_file).not.to.be.undefined;
            });
        });
    });

});

