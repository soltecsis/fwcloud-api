import { describeName, testSuite, expect } from "../../mocha/global-setup";
import request = require("supertest");
import { _URL } from "../../../src/fonaments/http/router/router.service";
import { FwCloud } from "../../../src/models/fwcloud/FwCloud";
import StringHelper from "../../../src/utils/string.helper";
import { getRepository } from "typeorm";
import { User } from "../../../src/models/user/User";
import { createUser, generateSession, attachSession, sleep } from "../../utils/utils";
import { Application } from "../../../src/Application";
import { FwCloudExport } from "../../../src/fwcloud-exporter/fwcloud-export";
import { FwCloudExportService } from "../../../src/fwcloud-exporter/fwcloud-export.service";

describe(describeName('FwCloudExport E2E Tests'), () => {
    let app: Application;
    let fwCloud: FwCloud;
    let fwCloudExportService: FwCloudExportService;
    let adminUser: User;
    let adminUserSessionId: string;
    let regularUser: User;
    let regularUserSessionId: string;

    before(async () => {
        app = testSuite.app;

        fwCloud = await getRepository(FwCloud).save(getRepository(FwCloud).create({
            name: StringHelper.randomize(10)
        }));

        fwCloudExportService = await app.getService<FwCloudExportService>(FwCloudExportService.name);
    });

    beforeEach(async() => {
        regularUser = await createUser({role: 0});
        regularUserSessionId = generateSession(regularUser);

        adminUser = await createUser({role: 1});
        adminUserSessionId = generateSession(adminUser);
    });

    describe('FwCloudExportController',() => {
        describe('FwCloudExportController@create',() => {
            
            it('guest user should not create a fwcloud export file', async () => {
                return await request(app.express)
                    .post(_URL().getURL('fwclouds.exports.store', { fwcloud: fwCloud.id }))
                    .expect(401);
            });

            it('regular user which does not belong to the fwcloud can not create a fwcloud export file', async () => {
                return await request(app.express)
                    .post(_URL().getURL('fwclouds.exports.store', { fwcloud: fwCloud.id }))
                    .set('Cookie', [attachSession(regularUserSessionId)])
                    .expect(401)
            });

            it('regular user which belongs to the fwcloud can create a fwcloud export file', async () => {
                regularUser.fwClouds = [fwCloud];
                await getRepository(User).save(regularUser);

                return await request(app.express)
                    .post(_URL().getURL('fwclouds.exports.store', { fwcloud: fwCloud.id }))
                    .set('Cookie', [attachSession(regularUserSessionId)])
                    .expect('Content-Type', /application/)
                    .expect(201)
            });

            it('admin user can create a fwcloud export file', async () => {
                return await request(app.express)
                    .post(_URL().getURL('fwclouds.exports.store', { fwcloud: fwCloud.id }))
                    .set('Cookie', [attachSession(adminUserSessionId)])
                    .expect('Content-Type', /application/)
                    .expect(201)
            });
        });

        describe('FwCloudExportController@import', () => {
            let fwCloudExport: FwCloudExport;

            beforeEach(async () => {
                fwCloudExport = await fwCloudExportService.create(fwCloud, regularUser)
            });

            it('guest user should not import a fwcloud export file', async () => {
                return await request(app.express)
                    .post(_URL().getURL('fwclouds.exports.import'))
                    .expect(401);
            });

            it('regular user should not import a fwcloud export file', async () => {
                return await request(app.express)
                    .post(_URL().getURL('fwclouds.exports.import'))
                    .attach('file', fwCloudExport.exportPath)
                    .set('Cookie', [attachSession(regularUserSessionId)])
                    .expect(401)
            });

            it('admin user should import a fwcloud export file', async () => {
                const fwCloudCount: number = (await getRepository(FwCloud).find()).length;

                return await request(app.express)
                    .post(_URL().getURL('fwclouds.exports.import'))
                    .attach('file', fwCloudExport.exportPath)
                    .set('Cookie', [attachSession(adminUserSessionId)])
                    .expect(201)
                    .then(async response => {
                        expect((await getRepository(FwCloud).find()).length).to.be.deep.eq(fwCloudCount + 1);
                    });
            });

            it('should return 422 if a file is not provided', async () => {
                return await request(app.express)
                    .post(_URL().getURL('fwclouds.exports.import'))
                    .set('Cookie', [attachSession(adminUserSessionId)])
                    .expect(422);
            })
        });
    });
});