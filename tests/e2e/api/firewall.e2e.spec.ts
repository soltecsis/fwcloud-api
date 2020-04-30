import { describeName, testSuite } from "../../mocha/global-setup";
import { Application } from "../../../src/Application";
import { User } from "../../../src/models/user/User";
import request = require("supertest");
import { createUser, generateSession, attachSession, waitChannelIsClosed } from "../../utils/utils";
import { _URL } from "../../../src/fonaments/http/router/router.service";
import { FwCloud } from "../../../src/models/fwcloud/FwCloud";
import { getRepository } from "typeorm";
import StringHelper from "../../../src/utils/string.helper";
import { Firewall } from "../../../src/models/firewall/Firewall";

describe(describeName('Firewall E2E Tests'), () => {
    let app: Application;
    let loggedUser: User;
    let loggedUserSessionId: string;
    
    let adminUser: User;
    let adminUserSessionId: string;

    let fwCloud: FwCloud;
    let firewall: Firewall;

    beforeEach(async () => {
        app = testSuite.app;

        loggedUser = await createUser({ role: 0 });
        loggedUserSessionId = generateSession(loggedUser);

        adminUser = await createUser({ role: 1 });
        adminUserSessionId = generateSession(adminUser);

        fwCloud = await getRepository(FwCloud).save(getRepository(FwCloud).create({name: StringHelper.randomize(10)}));
        firewall = await getRepository(Firewall).save(getRepository(Firewall).create({name: StringHelper.randomize(10), fwCloudId: fwCloud.id}))

    });

    describe('FirewallController@compile', () => {
        it('guest user should not compile a firewall', async () => {
            return await request(app.express)
                .post(_URL().getURL('firewalls.compile', {
                    fwcloud: firewall.fwCloudId,
                    firewall: firewall.id
                }))
                .expect(401);
        });

        it('regular user should not compile a firewall if it does not belong to the fwcloud', async () => {
            return await request(app.express)
                .post(_URL().getURL('firewalls.compile', {
                    fwcloud: firewall.fwCloudId,
                    firewall: firewall.id
                }))
                .set('Cookie', [attachSession(loggedUserSessionId)])
                .expect(401);
        });

        it('regular user should compile a firewall if it does belong to the fwcloud', async () => {
            loggedUser.fwClouds = [fwCloud];
            await getRepository(User).save(loggedUser);

            return await request(app.express)
                .post(_URL().getURL('firewalls.compile', {
                    fwcloud: firewall.fwCloudId,
                    firewall: firewall.id
                }))
                .set('Cookie', [attachSession(loggedUserSessionId)])
                .expect(201)
                .then(async response => {
                    await waitChannelIsClosed(response.body.channel_id);
                });
        });

        it('admin user should compile a firewall', async () => {
            return await request(app.express)
                .post(_URL().getURL('firewalls.compile', {
                    fwcloud: firewall.fwCloudId,
                    firewall: firewall.id
                }))
                .set('Cookie', [attachSession(adminUserSessionId)])
                .expect(201)
                .then(async response => {
                    await waitChannelIsClosed(response.body.channel_id);
                });
        });
    });

})