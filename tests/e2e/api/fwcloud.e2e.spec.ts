import { describeName, testSuite } from "../../mocha/global-setup";

import request = require("supertest");
import { Application } from "../../../src/Application";
import { _URL } from "../../../src/fonaments/http/router/router.service";
import { User } from "../../../src/models/user/User";
import { createUser, generateSession, attachSession } from "../../utils/utils";
import StringHelper from "../../../src/utils/string.helper";

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
        });
    });
});