import { describeName, testSuite, expect } from "../../mocha/global-setup";
import { Application } from "../../../src/Application";
import { User } from "../../../src/models/user/User";
import { createUser, generateSession, attachSession, sleep } from "../../utils/utils";
import request = require("supertest");
import { _URL } from "../../../src/fonaments/http/router/router.service";
import { RepositoryService } from "../../../src/database/repository.service";
import { Repository } from "typeorm";

let app: Application;
let adminUser: User;
let adminUserSessionId: string;

describe(describeName('ConfirmationTokenMiddleware E2E test'), () => {
    beforeEach(async () => {
        app = testSuite.app;
        adminUser = await createUser({ role: 1 });
        adminUserSessionId = generateSession(adminUser);
    });

    it('should return a confirmation token if the confirmation token setting is set to true', async () => {
        app.config.set('confirmation_token', true);

        await request(app.express)
            .post(_URL().getURL('backups.store'))
            .send({
                comment: 'test comment'
            })
            .set('Cookie', [attachSession(adminUserSessionId)])
            .expect(403);
    });

    it('should not check confirmation token if the confirmation token setting is set to false', async () => {
        app.config.set('confirmation_token', false);

        await request(app.express)
            .post(_URL().getURL('backups.store'))
            .send({
                comment: 'test comment'
            })
            .set('Cookie', [attachSession(adminUserSessionId)])
            .expect(201);
        
        //Wait until backup is created
        await sleep(5000);
    });

    it('should validates a request if the confirmation_token is attached to the request', async () => {
        app.config.set('confirmation_token', true);

        await request(app.express)
            .post(_URL().getURL('backups.store'))
            .send({
                comment: 'test comment'
            })
            .set('x-fwc-confirm-token', adminUser.confirmation_token)
            .set('Cookie', [attachSession(adminUserSessionId)])
            .expect(201);
    });

    it('should return a new confirmation_token if a confirmation_token is not attached to the request', async () => {
        app.config.set('confirmation_token', true);

        await request(app.express)
            .post(_URL().getURL('backups.store'))
            .send({
                comment: 'test comment'
            })
            .set('Cookie', [attachSession(adminUserSessionId)])
            .expect(403)
            .then(response => {
                expect(response.body).to.haveOwnProperty('fwc_confirm_token');
            });
    });

    it('should generate a new confirmation token if the user does not have confirmation token', async () => {
        app.config.set('confirmation_token', true);
        const userRepository: Repository<User> = (await app.getService<RepositoryService>(RepositoryService.name)).for(User);
        adminUser.confirmation_token = null;
        await userRepository.save(adminUser);

        await request(app.express)
            .post(_URL().getURL('backups.store'))
            .send({
                comment: 'test comment'
            })
            .set('Cookie', [attachSession(adminUserSessionId)])
            .expect(403)
            .then(async (response) => {
                expect(response.body).to.haveOwnProperty('fwc_confirm_token');
                adminUser = await userRepository.findOne(adminUser.id);
                expect(response.body.fwc_confirm_token).to.be.deep.eq(adminUser.confirmation_token);
            });
    })
});
