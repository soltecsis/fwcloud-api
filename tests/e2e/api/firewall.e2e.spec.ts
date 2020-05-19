import { describeName, testSuite } from "../../mocha/global-setup";
import { Application } from "../../../src/Application";
import { User } from "../../../src/models/user/User";
import request = require("supertest");
import { createUser, generateSession, attachSession } from "../../utils/utils";
import { _URL } from "../../../src/fonaments/http/router/router.service";
import { FwCloud } from "../../../src/models/fwcloud/FwCloud";
import { getRepository } from "typeorm";
import StringHelper from "../../../src/utils/string.helper";
import { Firewall } from "../../../src/models/firewall/Firewall";
import { IPObj } from "../../../src/models/ipobj/IPObj";
import sinon from "sinon";
import sshTools = require("../../../src/utils/ssh");

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
        const ipObj: IPObj = await getRepository(IPObj).save(getRepository(IPObj).create({
            name: 'test',
            address: '0.0.0.0',
            ipObjTypeId: 0
        }));
        firewall = await getRepository(Firewall).save(getRepository(Firewall).create({
            name: StringHelper.randomize(10),
            fwCloudId: fwCloud.id,
            install_ipobj: ipObj.id
        }));

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
                .expect(201);
        });

        it('admin user should compile a firewall', async () => {
            return await request(app.express)
                .post(_URL().getURL('firewalls.compile', {
                    fwcloud: firewall.fwCloudId,
                    firewall: firewall.id
                }))
                .set('Cookie', [attachSession(adminUserSessionId)])
                .expect(201);
        });
    });

    describe('FirewallController@install', () => {
        let sshRunCommandStub: sinon.SinonStub;
        let sshUploadFileStub: sinon.SinonStub;
        before(async() => {
           sshRunCommandStub = sinon.stub(sshTools, 'runCommand').resolves('done');
           sshUploadFileStub = sinon.stub(sshTools, 'uploadFile').resolves('done');
        });

        after(async() => {
            sshRunCommandStub.restore();
            sshUploadFileStub.restore();
        });
        
        it('guest user should not compile a firewall', async () => {
            return await request(app.express)
                .post(_URL().getURL('firewalls.install', {
                    fwcloud: firewall.fwCloudId,
                    firewall: firewall.id
                }))
                .expect(401);
        });

        it('regular user should not install a firewall if it does not belong to the fwcloud', async () => {
            return await request(app.express)
                .post(_URL().getURL('firewalls.install', {
                    fwcloud: firewall.fwCloudId,
                    firewall: firewall.id
                }))
                .set('Cookie', [attachSession(loggedUserSessionId)])
                .expect(401);
        });

        it('regular user should install a firewall if it does belong to the fwcloud', async () => {
            loggedUser.fwClouds = [fwCloud];
            await getRepository(User).save(loggedUser);

            return await request(app.express)
                .post(_URL().getURL('firewalls.install', {
                    fwcloud: firewall.fwCloudId,
                    firewall: firewall.id
                }))
                .set('Cookie', [attachSession(loggedUserSessionId)])
                .expect(201);
        });

        it('admin user should install a firewall if user belongs to the fwcloud', async () => {
            adminUser.fwClouds = [fwCloud];
            await getRepository(User).save(adminUser);

            return await request(app.express)
                .post(_URL().getURL('firewalls.install', {
                    fwcloud: firewall.fwCloudId,
                    firewall: firewall.id
                }))
                .set('Cookie', [attachSession(adminUserSessionId)])
                .expect(201);
        });

        it.skip('should use custom credentials if they are provided', () => {

        });
    });

})