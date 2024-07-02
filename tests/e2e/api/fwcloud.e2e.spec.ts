import { describeName, testSuite, expect } from "../../mocha/global-setup";

import request = require("supertest");
import { Application } from "../../../src/Application";
import { _URL } from "../../../src/fonaments/http/router/router.service";
import { User } from "../../../src/models/user/User";
import { createUser, generateSession, attachSession } from "../../utils/utils";
import StringHelper from "../../../src/utils/string.helper";
import { FwCloud } from "../../../src/models/fwcloud/FwCloud";

describe(describeName('FwCloud E2E Tests'), () => {
    let app: Application;
    let regularUser: User;
    let adminUser: User;
    
    let regularUserSessionId: string;
    let adminUserSessionId: string;

    beforeEach(async () => {
        app = testSuite.app;

        regularUser = await createUser({role: 0});
        regularUserSessionId = generateSession(regularUser);

        adminUser = await createUser({role: 1});
        adminUserSessionId = generateSession(adminUser);
    });

    describe("FwCloudController", () => {
        describe("FwCloudController@store()", () => {
            it('guest user should not reach the controller', async () => {
                return await request(app.express)
                        .post(_URL().getURL('fwclouds.store'))
                        .expect(401);
            });

            it('regular user should not create a fwcloud', async () => {
                return await request(app.express)
                    .post(_URL().getURL('fwclouds.store'))
                    .set('Cookie', [attachSession(regularUserSessionId)])
                    .send({
                        name: StringHelper.randomize(10)
                    })
                    .expect(401);
            });

            it('admin user should create a fwcloud', async () => {
                return await request(app.express)
                    .post(_URL().getURL('fwclouds.store'))
                    .set('Cookie', [attachSession(adminUserSessionId)])
                    .send({
                        name: StringHelper.randomize(10)
                    })
                    .expect(201);
            });

            it('should create a fwcloud', async () => {
                const count: number = (await FwCloud.findAndCount())[1];

                return await request(app.express)
                    .post(_URL().getURL('fwclouds.store'))
                    .set('Cookie', [attachSession(adminUserSessionId)])
                    .send({
                        name: StringHelper.randomize(10),
                    })
                    .expect(201)
                    .then(async (_) => {
                        expect((await FwCloud.findAndCount())[1]).to.be.eq(count + 1);
                    });
            });

            it('should return the created fwcloud', async () => {
                const name: string = StringHelper.randomize(10);
                const comment: string = StringHelper.randomize(10);
                return await request(app.express)
                    .post(_URL().getURL('fwclouds.store'))
                    .set('Cookie', [attachSession(adminUserSessionId)])
                    .send({
                        name: name,
                        comment: comment
                    })
                    .expect(201)
                    .then(async (response) => {
                        const persistedFwCloud: FwCloud = await FwCloud.findOne({where: {id: response.body.data.id}});
                        
                        expect(response.body.data).to.be.deep.eq(persistedFwCloud.toJSON());
                    });
            });
        });

        describe("FwCloudController@update", () => {
            let fwCloud: FwCloud;

            beforeEach(async () => {
                fwCloud = FwCloud.create({name: StringHelper.randomize(10)});
                await fwCloud.save();
            });

            it('guest user should not update a fwcloud', async () => {
                return await request(app.express)
                    .put(_URL().getURL('fwclouds.update', {fwcloud: fwCloud.id}))
                    .expect(401);
            });

            it('regular user should not update a fwcloud', async () => {
                return await request(app.express)
                    .put(_URL().getURL('fwclouds.update', {fwcloud: fwCloud.id}))
                    .set('Cookie', [attachSession(regularUserSessionId)])
                    .send({
                        name: StringHelper.randomize(10),
                        comment: StringHelper.randomize(10)
                    })
                    .expect(401);
            });

            it('admin user should create a fwcloud', async () => {
                return await request(app.express)
                    .put(_URL().getURL('fwclouds.update', {fwcloud: fwCloud.id}))
                    .set('Cookie', [attachSession(adminUserSessionId)])
                    .send({
                        name: StringHelper.randomize(10),
                        comment: StringHelper.randomize(10)
                    })
                    .expect(200);
            });

            it('should update the fwcloud', async () => {
                const name: string = StringHelper.randomize(10);
                const comment: string = StringHelper.randomize(10);
                return await request(app.express)
                    .put(_URL().getURL('fwclouds.update', {fwcloud: fwCloud.id}))
                    .set('Cookie', [attachSession(adminUserSessionId)])
                    .send({
                        name: name,
                        comment: comment
                    })
                    .expect(200)
                    .then(async (response) => {
                        const persistedFwCloud: FwCloud = await FwCloud.findOne({ where: { id: fwCloud.id }});
                        expect(persistedFwCloud.name).to.be.eq(name);
                        expect(persistedFwCloud.comment).to.be.eq(comment);
                    });
            });

            it('should return the updated fwcloud', async () => {
                return await request(app.express)
                    .put(_URL().getURL('fwclouds.update', {fwcloud: fwCloud.id}))
                    .set('Cookie', [attachSession(adminUserSessionId)])
                    .send({
                        name: StringHelper.randomize(10),
                        image: StringHelper.randomize(10),
                        comment: StringHelper.randomize(10)
                    })
                    .expect(200)
                    .then(async (response) => {
                        const persistedFwCloud: FwCloud = await FwCloud.findOne({ where: { id: fwCloud.id }});
                        const persistedFwCloudObj: any = persistedFwCloud.toJSON()
                        
                        expect(response.body.data.name).to.be.deep.eq(persistedFwCloudObj.name);
                    });
            });
        })
    
        describe('FwCloudController@colors()', () => {
            let fwCloud: FwCloud;
            
            beforeEach(async () => {
                fwCloud = FwCloud.create({name: StringHelper.randomize(10)});
                await fwCloud.save();
            });

            it('guest user should not reach the fwcloud colors', async () => {
                return await request(app.express)
                        .get(_URL().getURL('fwclouds.colors', {fwcloud: fwCloud.id}))
                        .expect(401);
            });

            it('users who does not belong to the fwcloud should not reach the fwcloud colors', async () => {
                return await request(app.express)
                        .get(_URL().getURL('fwclouds.colors', {fwcloud: fwCloud.id}))
                        .set('Cookie', [attachSession(regularUserSessionId)])
                        .expect(401);
            });

            it('user which belongs to the fwcloud should get the fwcloud colors', async () => {
                regularUser.fwClouds = [fwCloud];
                await regularUser.save();

                return await request(app.express)
                        .get(_URL().getURL('fwclouds.colors', {fwcloud: fwCloud.id}))
                        .set('Cookie', [attachSession(regularUserSessionId)])
                        .expect(200); 
            });

            it('admin user should get the fwcloud colors', async () => {
                return await request(app.express)
                        .get(_URL().getURL('fwclouds.colors', {fwcloud: fwCloud.id}))
                        .set('Cookie', [attachSession(adminUserSessionId)])
                        .expect(200); 
            });
        });
    });
});