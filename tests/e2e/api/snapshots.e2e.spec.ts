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
let repository: RepositoryService;

let fwCloud: FwCloud;

describe(describeName('Snapshot E2E tests'), () => {

    beforeEach(async () => {
        app = testSuite.app;

        repository = await app.getService<RepositoryService>(RepositoryService.name);

        fwCloud = repository.for(FwCloud).create({
            name: 'fwcloud_test'
        });

        fwCloud = await repository.for(FwCloud).save(fwCloud);

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
            const s1: Snapshot = await Snapshot.create(fwCloud, 'test1');
            const s2: Snapshot = await Snapshot.create(fwCloud, 'test2');

            await request(app.express)
                .get(_URL().getURL('snapshots.index'))
                .expect(401);
        });

        it('regular user should see the snapshot which cloud is assigned to the user', async () => {
            let fwCloud2: FwCloud = repository.for(FwCloud).create({
                name: 'fwcloud_test'
            });
            fwCloud2 = await repository.for(FwCloud).save(fwCloud2);

            const s1: Snapshot = await Snapshot.create(fwCloud, 'test1');
            const s2: Snapshot = await Snapshot.create(fwCloud2, 'test2');

            loggedUser.fwclouds = [fwCloud2];
            repository.for(User).save(loggedUser);

            await request(app.express)
                .get(_URL().getURL('snapshots.index'))
                .set('Cookie', [attachSession(loggedUserSessionId)])
                .expect(200)
                .expect(response => {
                    expect(response.body.data).to.be.deep.eq(
                        JSON.parse(JSON.stringify([s2.toResponse()]))
                    )
                });
        });

        it('admin user should see the snapshot list', async () => {
            const s1: Snapshot = await Snapshot.create(fwCloud, 'test1');
            const s2: Snapshot = await Snapshot.create(fwCloud, 'test2');

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

    describe(describeName('SnapshotController@show'), () => {
        let  s1: Snapshot;

        beforeEach(async() => {
            s1 = await Snapshot.create(fwCloud, 'test1');
        });


        it('guest user should not see a snapshot', async () => {
            await request(app.express)
                .get(_URL().getURL('snapshots.show', {snapshot: s1.id}))
                .expect(401);
        });

        it('regular user should not see a snapshot if regular user does not belong to the fwcloud', async() => {
            await request(app.express)
                .get(_URL().getURL('snapshots.show', {snapshot: s1.id}))
                .set('Cookie', [attachSession(loggedUserSessionId)])
                .expect(404);
        });

        it('regular user should see a snapshot if regular user belongs to the fwcloud', async() => {
            loggedUser.fwclouds = [fwCloud];
            repository.for(User).save(loggedUser);

            await request(app.express)
                .get(_URL().getURL('snapshots.show', {snapshot: s1.id}))
                .set('Cookie', [attachSession(loggedUserSessionId)])
                .expect(200)
                .expect(response => {
                    expect(response.body.data).to.be.deep.equal(
                        JSON.parse(JSON.stringify(s1.toResponse()))
                    )
                });
        });

        it('admin user should see a snapshot', async() => {
            await request(app.express)
                .get(_URL().getURL('snapshots.show', {snapshot: s1.id}))
                .set('Cookie', [attachSession(adminUserSessionId)])
                .expect(200)
                .expect(response => {
                    expect(response.body.data).to.be.deep.equal(
                        JSON.parse(JSON.stringify(s1.toResponse()))
                    )
                });
        });

        it('404 should be thrown if the snapshot does not exists', async () => {
            await request(app.express)
                .get(_URL().getURL('snapshots.show', {snapshot: 1}))
                .set('Cookie', [attachSession(adminUserSessionId)])
                .expect(404);
        })
    });
});