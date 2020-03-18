import { User } from "../../../src/models/user/User";
import { testSuite, describeName } from "../../mocha/global-setup";
import { Application } from "../../../src/Application";
import { RepositoryService } from "../../../src/database/repository.service";
import { generateSession, attachSession } from "../../utils/utils";
import request = require("supertest");
import { _URL } from "../../../src/fonaments/http/router/router.service";

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

describe(describeName('Socket E2E tests'), () => {

    describe.only(describeName('SocketController@attach'), () => {
        it('guest user should not attach a socket', async () => {
            return await request(app.express)
                .post(_URL().getURL('sockets.attach'))
                .expect(401);
        });

        it('regular user should attach a socket', async () => {
            return await request(app.express)
                .post(_URL().getURL('sockets.attach'))
                .send({
                    socket_id: 'test'
                })
                .set('Cookie', [attachSession(loggedUserSessionId)])
                .set('x-fwc-confirm-token', loggedUser.confirmation_token)
                .expect(201)
        });

        it('admin user should see the version', async () => {
            return await request(app.express)
                .post(_URL().getURL('sockets.attach'))
                .send({
                    socket_id: 'test'
                })
                .set('Cookie', [attachSession(adminUserSessionId)])
                .set('x-fwc-confirm-token', adminUser.confirmation_token)
                .expect(201)
        });

        it('invalid socket_id should throw an exception', async () => {
            return await request(app.express)
                .post(_URL().getURL('sockets.attach'))
                .send({
                    socket_id: '0'
                })
                .set('Cookie', [attachSession(adminUserSessionId)])
                .set('x-fwc-confirm-token', adminUser.confirmation_token)
                .expect(422)
        });
    });
})