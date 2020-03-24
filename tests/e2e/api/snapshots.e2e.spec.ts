import { describeName, testSuite, expect } from "../../mocha/global-setup";
import { Snapshot } from "../../../src/snapshots/snapshot";
import request = require("supertest");
import { Application } from "../../../src/Application";
import { _URL } from "../../../src/fonaments/http/router/router.service";
import { User } from "../../../src/models/user/User";
import { RepositoryService } from "../../../src/database/repository.service";
import { generateSession, attachSession } from "../../utils/utils";
import { FwCloud } from "../../../src/models/fwcloud/FwCloud";
import { SnapshotService } from "../../../src/snapshots/snapshot.service";

let app: Application;
let loggedUser: User;
let loggedUserSessionId: string;
let adminUser: User;
let adminUserSessionId: string;
let repository: RepositoryService;

let fwCloud: FwCloud;
let snapshotService: SnapshotService;

describe(describeName('Snapshot E2E tests'), () => {

    beforeEach(async () => {
        app = testSuite.app;
        snapshotService = await app.getService<SnapshotService>(SnapshotService.name);
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
            const s1: Snapshot = await Snapshot.create(snapshotService.config.data_dir, fwCloud, 'test', null)
            const s2: Snapshot = await Snapshot.create(snapshotService.config.data_dir, fwCloud, 'test2', null)

            await request(app.express)
                .get(_URL().getURL('snapshots.index'))
                .expect(401);
        });

        it('regular user should see the snapshot which cloud is assigned to the user', async () => {
            let fwCloud2: FwCloud = repository.for(FwCloud).create({
                name: 'fwcloud_test'
            });
            fwCloud2 = await repository.for(FwCloud).save(fwCloud2);

            const s1: Snapshot = await Snapshot.create(snapshotService.config.data_dir, fwCloud, 'test', null)
            const s2: Snapshot = await Snapshot.create(snapshotService.config.data_dir, fwCloud, 'test2', null)

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
            const s1: Snapshot = await Snapshot.create(snapshotService.config.data_dir, fwCloud, 'test1', null);
            const s2: Snapshot = await Snapshot.create(snapshotService.config.data_dir, fwCloud, 'test2', null);

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
            s1 = await Snapshot.create(snapshotService.config.data_dir, fwCloud, 'test1', null)
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
        });
    });

    describe(describeName('SnapshotController@store'), () => {
        it('guest user should no create a new snapshot', async() => {
            await request(app.express)
                .post(_URL().getURL('snapshots.store'))
                .expect(401);
        });

        it('regular user should no create a new snapshot if the user does not belong to fwcloud', async() => {
            await request(app.express)
                .post(_URL().getURL('snapshots.store'))
                .send({
                    name: 'name_test',
                    comment: 'comment_test',
                    fwcloud_id: fwCloud.id
                })
                .set('Cookie', attachSession(loggedUserSessionId))
                .set('x-fwc-confirm-token', loggedUser.confirmation_token)
                .expect(401);
        });

        it('regular user should create a new snapshot if the user belongs to the fwcloud', async() => {
            loggedUser.fwclouds = [fwCloud];
            repository.for(User).save(loggedUser);

            await request(app.express)
                .post(_URL().getURL('snapshots.store'))
                .send({
                    name: 'name_test',
                    comment: 'comment_test',
                    fwcloud_id: fwCloud.id
                })
                .set('Cookie', attachSession(loggedUserSessionId))
                .set('x-fwc-confirm-token', loggedUser.confirmation_token)
                .expect(201)
                .expect(async (response) => {
                    expect(response.body.data).to.haveOwnProperty('id');

                    const snapshotService =  await app.getService<SnapshotService>(SnapshotService.name);
                    
                    expect(snapshotService.findOne(response.body.data.id)).not.to.be.null;
                })
        });

        it('admin user should create a new snapshot', async() => {
            await request(app.express)
                .post(_URL().getURL('snapshots.store'))
                .send({
                    name: 'name_test',
                    comment: 'comment_test',
                    fwcloud_id: fwCloud.id
                })
                .set('Cookie', attachSession(adminUserSessionId))
                .set('x-fwc-confirm-token', adminUser.confirmation_token)
                .expect(201)
                .expect(async (response) => {
                    expect(response.body.data).to.haveOwnProperty('id');

                    const snapshotService =  await app.getService<SnapshotService>(SnapshotService.name);
                    
                    expect(snapshotService.findOne(response.body.data.id)).not.to.be.null;
                })
        });
    });

    describe(describeName('SnapshotController@update'), () => {
        let  s1: Snapshot;

        beforeEach(async() => {
            s1 = await Snapshot.create(snapshotService.config.data_dir, fwCloud, 'test1', null)
        });

        it('guest user should not update an snapshot', async() => {

            await request(app.express)
                .put(_URL().getURL('snapshots.update', {snapshot: s1.id}))
                .expect(401)
        });

        it('regular user should not update an snapshot if the user does not belong to the fwcloud', async() => {
            await request(app.express)
                .put(_URL().getURL('snapshots.update', {snapshot: s1.id}))
                .send({
                    name: 'name_test',
                    comment: 'comment_test',
                    fwcloud_id: fwCloud.id
                })
                .set('Cookie', attachSession(loggedUserSessionId))
                .set('x-fwc-confirm-token', loggedUser.confirmation_token)
                .expect(401)
        });

        it('regular user should update an snapshot if the user belongs to the fwcloud', async() => {
            loggedUser.fwclouds = [fwCloud];
            repository.for(User).save(loggedUser);

            await request(app.express)
                .put(_URL().getURL('snapshots.update', {snapshot: s1.id}))
                .send({
                    name: 'name_test',
                    comment: 'comment_test',
                    fwcloud_id: fwCloud.id
                })
                .set('Cookie', attachSession(loggedUserSessionId))
                .set('x-fwc-confirm-token', loggedUser.confirmation_token)
                .expect(200)
                .expect((response) => {
                    expect(response.body.data.id).to.be.deep.equal(s1.id);
                    expect(response.body.data.name).to.be.deep.equal('name_test');
                    expect(response.body.data.comment).to.be.deep.equal('comment_test');
                });
        });

        it('admin user should update an snapshot', async() => {
            await request(app.express)
                .put(_URL().getURL('snapshots.update', {snapshot: s1.id}))
                .send({
                    name: 'name_test',
                    comment: 'comment_test',
                    fwcloud_id: fwCloud.id
                })
                .set('Cookie', attachSession(adminUserSessionId))
                .set('x-fwc-confirm-token', adminUser.confirmation_token)
                .expect(200)
                .expect((response) => {
                    expect(response.body.data.id).to.be.deep.equal(s1.id);
                    expect(response.body.data.name).to.be.deep.equal('name_test');
                    expect(response.body.data.comment).to.be.deep.equal('comment_test');
                });
        });
    });

    describe(describeName('SnapshotController@restore'), () => {
        let  s1: Snapshot;

        beforeEach(async() => {
            s1 = await Snapshot.create(snapshotService.config.data_dir, fwCloud, 'test1', null)
        });

        it('guest user should not restore an snapshot', async() => {

            await request(app.express)
                .put(_URL().getURL('snapshots.restore', {snapshot: s1.id}))
                .expect(401)
        });

        it('regular user should not restore an snapshot if the user does not belong to the fwcloud', async() => {
            await request(app.express)
                .put(_URL().getURL('snapshots.restore', {snapshot: s1.id}))
                .set('Cookie', attachSession(loggedUserSessionId))
                .set('x-fwc-confirm-token', loggedUser.confirmation_token)
                .expect(401)
        });

        it('regular user should restore an snapshot if the user belongs to the fwcloud', async() => {
            loggedUser.fwclouds = [fwCloud];
            repository.for(User).save(loggedUser);

            await request(app.express)
                .put(_URL().getURL('snapshots.restore', {snapshot: s1.id}))
                .set('Cookie', attachSession(loggedUserSessionId))
                .set('x-fwc-confirm-token', loggedUser.confirmation_token)
                .expect(200)
                .expect((response) => {
                    expect(response.body.data.id).to.be.deep.equal(s1.id);
                });
        });

        it('admin user should restore an snapshot', async() => {
            await request(app.express)
                .put(_URL().getURL('snapshots.restore', {snapshot: s1.id}))
                .set('Cookie', attachSession(adminUserSessionId))
                .set('x-fwc-confirm-token', adminUser.confirmation_token)
                .expect(200)
                .expect((response) => {
                    expect(response.body.data.id).to.be.deep.equal(s1.id);
                });
        });
    });

    describe(describeName('SnapshotController@destroy'), () => {
        let  s1: Snapshot;

        beforeEach(async() => {
            s1 = await Snapshot.create(snapshotService.config.data_dir, fwCloud, 'test1', 'comment1')
        });

        it('guest user should not destroy an snapshot', async() => {

            await request(app.express)
                .delete(_URL().getURL('snapshots.destroy', {snapshot: s1.id}))
                .expect(401)
        });

        it('regular user should not destroy an snapshot if the user does not belong to the fwcloud', async() => {
            await request(app.express)
                .delete(_URL().getURL('snapshots.destroy', {snapshot: s1.id}))
                .set('Cookie', attachSession(loggedUserSessionId))
                .set('x-fwc-confirm-token', loggedUser.confirmation_token)
                .expect(401)
        });

        it('regular user should destroy an snapshot if the user belongs to the fwcloud', async() => {
            loggedUser.fwclouds = [fwCloud];
            repository.for(User).save(loggedUser);

            await request(app.express)
                .delete(_URL().getURL('snapshots.destroy', {snapshot: s1.id}))
                .set('Cookie', attachSession(loggedUserSessionId))
                .set('x-fwc-confirm-token', loggedUser.confirmation_token)
                .expect(204);
        });

        it('admin user should update an snapshot', async() => {
            await request(app.express)
                .delete(_URL().getURL('snapshots.destroy', {snapshot: s1.id}))
                .set('Cookie', attachSession(adminUserSessionId))
                .set('x-fwc-confirm-token', adminUser.confirmation_token)
                .expect(204);
        });
    });
});