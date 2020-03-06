import { describeName, testSuite, expect } from "../../mocha/global-setup";
import { Snapshot } from "../../../src/snapshots/snapshot";
import request = require("supertest");
import { Application } from "../../../src/Application";
import { _URL } from "../../../src/fonaments/http/router/router.service";
import { User } from "../../../src/models/user/User";
import { RepositoryService } from "../../../src/database/repository.service";
import { generateSession, attachSession } from "../../utils/utils";
import { FwCloud } from "../../../src/models/fwcloud/FwCloud";

let app: Application;
let loggedUser: User;
let loggedUserSessionId: string;
let adminUser: User;
let adminUserSessionId: string;

describe.only(describeName('Snapshot E2E tests'), () => {

    beforeEach(async () => {
        app = testSuite.app;

        const repository: RepositoryService = await app.getService<RepositoryService>(RepositoryService.name);

        const fwcloud = repository.for(FwCloud).create({
            name: 'fwcloud_test'
        });

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

    describe(describeName('SnapshotController@index'), () => {

        it('guest user should not see the snapshot list', async () => {
            const s1: Snapshot = await Snapshot.create('test1');
            const s2: Snapshot = await Snapshot.create('test2');

            await request(app.express)
                .get(_URL().getURL('snapshots.index'))
                .expect(401);
        });

        it('regular user should not see the snapshot list if user does not belongs to the snapshot cloud', async () => {
            const s1: Snapshot = await Snapshot.create('test1');
            const s2: Snapshot = await Snapshot.create('test2');

            await request(app.express)
                .get(_URL().getURL('snapshots.index'))
                .set('Cookie', [attachSession(loggedUserSessionId)])
                .expect(401);
        });

        it('admin user should see the snapshot list', async () => {
            const s1: Snapshot = await Snapshot.create('test1');
            const s2: Snapshot = await Snapshot.create('test2');

            await request(app.express)
                .get(_URL().getURL('snapshots.index'))
                .set('Cookie', [attachSession(adminUserSessionId)])
                .expect(200)
                .expect((response) => {
                    expect(response.body.data).to.be.deep.equal(
                        JSON.parse(JSON.stringify([s1.toResponse(), s2.toResponse()]))
                    )
                })
        });
    });
});