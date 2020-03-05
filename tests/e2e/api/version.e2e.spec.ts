import { User } from "../../../src/models/user/User";
import { testSuite, describeName } from "../../mocha/global-setup";
import { Application } from "../../../src/Application";
import { RepositoryService } from "../../../src/database/repository.service";
import { generateSession, attachSession } from "../../utils/utils";
import request = require("supertest");

let app: Application;
let loggedUser: User;
let loggedUserSessionId: string;
let adminUser: User;
let adminUserSessionId: string;

beforeEach(async() => {
    app = testSuite.app;

    const repository: RepositoryService = await app.getService<RepositoryService>(RepositoryService.name);
    
    try {
        loggedUser = (await repository.for(User).find({
            where: {
                'email': 'loggedUser@fwcloud.test'
            }
        }))[0];
        loggedUserSessionId = generateSession(loggedUser);

        adminUser = (await repository.for(User).find({
            where: {
                'email': 'admin@fwcloud.test'
            }
        }))[0];
        adminUserSessionId = generateSession(adminUser);


    } catch (e) { console.error(e) }
});

describe(describeName('Version E2E tests'), () => {

    describe(describeName('VersionController@show'), () => {
        it('guest user should not see the version', async () => {
            return await request(app.express)
                .get('/api/version')
                .expect(401);
        });

        it('regular user should not see version', async () => {
            return await request(app.express)
                .get('/api/version')
                .set('Cookie', [attachSession(loggedUserSessionId)])
                .expect(401)
        });

        it('admin user should see the version', async () => {
            return await request(app.express)
                .get('/api/version')
                .set('Cookie', [attachSession(adminUserSessionId)])
                .expect(200)
                .expect(response => {
                    response.body.data = app.getVersion().toResponse()
                });
        });
    });
})