/*!
    Copyright 2019 SOLTECSIS SOLUCIONES TECNOLOGICAS, SLU
    https://soltecsis.com
    info@soltecsis.com


    This file is part of FWCloud (https://fwcloud.net).

    FWCloud is free software: you can redistribute it and/or modify
    it under the terms of the GNU Affero General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    FWCloud is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU General Public License for more details.

    You should have received a copy of the GNU General Public License
    along with FWCloud.  If not, see <https://www.gnu.org/licenses/>.
*/

import { describeName, testSuite, expect } from '../../mocha/global-setup';
import { Snapshot, SnapshotMetadata } from '../../../src/snapshots/snapshot';
import request = require('supertest');
import { Application } from '../../../src/Application';
import { _URL } from '../../../src/fonaments/http/router/router.service';
import { User } from '../../../src/models/user/User';
import { generateSession, attachSession, createUser } from '../../utils/utils';
import { FwCloud } from '../../../src/models/fwcloud/FwCloud';
import { SnapshotService } from '../../../src/snapshots/snapshot.service';
import * as fs from 'fs';
import * as path from 'path';
import Sinon from 'sinon';
import sinon from 'sinon';
import { ExporterResult } from '../../../src/fwcloud-exporter/database-exporter/exporter-result';
import { EntityManager } from 'typeorm';
import StringHelper from '../../../src/utils/string.helper';
import db from '../../../src/database/database-manager';

let app: Application;
let loggedUser: User;
let loggedUserSessionId: string;
let adminUser: User;
let adminUserSessionId: string;

let fwCloud: FwCloud;
let snapshotService: SnapshotService;

let manager: EntityManager;

describe(describeName('Snapshot E2E tests'), () => {
  let stubExportDatabase: Sinon.SinonStub;

  beforeEach(async () => {
    app = testSuite.app;
    manager = db.getSource().manager;

    snapshotService = await app.getService<SnapshotService>(SnapshotService.name);

    fwCloud = await manager.getRepository(FwCloud).save(
      manager.getRepository(FwCloud).create({
        name: StringHelper.randomize(10),
      }),
    );

    loggedUser = await createUser({ role: 0 });
    loggedUserSessionId = generateSession(loggedUser);

    adminUser = await createUser({ role: 1 });
    adminUserSessionId = generateSession(adminUser);

    stubExportDatabase = sinon
      .stub(Snapshot.prototype, <any>'exportFwCloudDatabaseData')
      .callsFake(() => {
        return new Promise<ExporterResult>((resolve) => {
          return resolve(new ExporterResult({}));
        });
      });
  });

  afterEach(async () => {
    stubExportDatabase.restore();
  });

  describe('SnapshotController', () => {
    describe('SnapshotController@index', () => {
      it('guest user should not see the snapshot list', async () => {
        await Snapshot.create(snapshotService.config.data_dir, fwCloud, 'test', null);
        await Snapshot.create(snapshotService.config.data_dir, fwCloud, 'test2', null);

        await request(app.express)
          .get(_URL().getURL('snapshots.index', { fwcloud: fwCloud.id }))
          .expect(401);
      });

      it('regular user should not see any snapshot if the snapshot belongs to other fwclouds', async () => {
        await Snapshot.create(snapshotService.config.data_dir, fwCloud, 'test', null);
        await Snapshot.create(snapshotService.config.data_dir, fwCloud, 'test2', null);

        await request(app.express)
          .get(_URL().getURL('snapshots.index', { fwcloud: fwCloud.id }))
          .set('Cookie', [attachSession(loggedUserSessionId)])
          .expect(200)
          .then((response) => {
            expect(response.body.data).to.be.deep.eq(JSON.parse(JSON.stringify([])));
          });
      });

      it('regular user should see the snapshot which cloud is assigned to the user', async () => {
        let fwCloud2: FwCloud = manager.getRepository(FwCloud).create({
          name: 'fwcloud_test',
        });
        fwCloud2 = await manager.getRepository(FwCloud).save(fwCloud2);

        await Snapshot.create(snapshotService.config.data_dir, fwCloud, 'test', null);
        const s2: Snapshot = await Snapshot.create(
          snapshotService.config.data_dir,
          fwCloud2,
          'test2',
          null,
        );

        loggedUser.fwClouds = [fwCloud2];
        await manager.getRepository(User).save(loggedUser);

        await request(app.express)
          .get(_URL().getURL('snapshots.index', { fwcloud: fwCloud2.id }))
          .set('Cookie', [attachSession(loggedUserSessionId)])
          .expect(200)
          .then((response) => {
            expect(response.body.data).to.be.deep.eq(JSON.parse(JSON.stringify([s2.toResponse()])));
          });
      });

      it('admin user should see the snapshot list', async () => {
        const s1: Snapshot = await Snapshot.create(
          snapshotService.config.data_dir,
          fwCloud,
          'test1',
          null,
        );
        const s2: Snapshot = await Snapshot.create(
          snapshotService.config.data_dir,
          fwCloud,
          'test2',
          null,
        );

        await request(app.express)
          .get(_URL().getURL('snapshots.index', { fwcloud: fwCloud.id }))
          .set('Cookie', [attachSession(adminUserSessionId)])
          .expect(200)
          .then((response) => {
            expect(response.body.data).to.be.deep.equal(
              JSON.parse(JSON.stringify([s2.toResponse(), s1.toResponse()])),
            );
          });
      });
    });

    describe('SnapshotController@show', () => {
      let s1: Snapshot;

      beforeEach(async () => {
        s1 = await Snapshot.create(snapshotService.config.data_dir, fwCloud, 'test1', null);
      });

      it('guest user should not see a snapshot', async () => {
        await request(app.express)
          .get(
            _URL().getURL('snapshots.show', {
              fwcloud: fwCloud.id,
              snapshot: s1.id,
            }),
          )
          .expect(401);
      });

      it('regular user should not see a snapshot if regular user does not belong to the fwcloud', async () => {
        await request(app.express)
          .get(
            _URL().getURL('snapshots.show', {
              fwcloud: fwCloud.id,
              snapshot: s1.id,
            }),
          )
          .set('Cookie', [attachSession(loggedUserSessionId)])
          .expect(404);
      });

      it('regular user should see a snapshot if regular user belongs to the fwcloud', async () => {
        loggedUser.fwClouds = [fwCloud];
        await manager.getRepository(User).save(loggedUser);

        _URL().getURL('snapshots.show', {
          fwcloud: fwCloud.id,
          snapshot: s1.id,
        });

        await request(app.express)
          .get(
            _URL().getURL('snapshots.show', {
              fwcloud: fwCloud.id,
              snapshot: s1.id,
            }),
          )
          .set('Cookie', [attachSession(loggedUserSessionId)])
          .expect(200)
          .then((response) => {
            expect(response.body.data).to.be.deep.equal(
              JSON.parse(JSON.stringify(s1.toResponse())),
            );
          });
      });

      it('admin user should see a snapshot', async () => {
        await request(app.express)
          .get(
            _URL().getURL('snapshots.show', {
              fwcloud: fwCloud.id,
              snapshot: s1.id,
            }),
          )
          .set('Cookie', [attachSession(adminUserSessionId)])
          .expect(200)
          .then((response) => {
            expect(response.body.data).to.be.deep.equal(
              JSON.parse(JSON.stringify(s1.toResponse())),
            );
          });
      });

      it('404 should be thrown if the snapshot does not exists', async () => {
        await s1.destroy();

        await request(app.express)
          .get(
            _URL().getURL('snapshots.show', {
              fwcloud: fwCloud.id,
              snapshot: s1.id,
            }),
          )
          .set('Cookie', [attachSession(adminUserSessionId)])
          .expect(404);
      });
    });

    describe('SnapshotController@store', () => {
      it('guest user should no create a new snapshot', async () => {
        await request(app.express)
          .post(_URL().getURL('snapshots.store', { fwcloud: fwCloud.id }))
          .expect(401);
      });

      it('regular user should not create a new snapshot if the user does not belong to fwcloud', async () => {
        await request(app.express)
          .post(_URL().getURL('snapshots.store', { fwcloud: fwCloud.id }))
          .send({
            name: 'name_test',
            comment: 'comment_test',
          })
          .set('Cookie', attachSession(loggedUserSessionId))
          .expect(401);
      });

      it('regular user should create a new snapshot if the user belongs to the fwcloud', async () => {
        loggedUser.fwClouds = [fwCloud];
        await manager.getRepository(User).save(loggedUser);

        await request(app.express)
          .post(_URL().getURL('snapshots.store', { fwcloud: fwCloud.id }))
          .send({
            name: 'name_test',
            comment: 'comment_test',
          })
          .set('Cookie', attachSession(loggedUserSessionId))
          .expect(201)
          .then(async (response) => {
            expect(response.body.data).to.haveOwnProperty('id');
            expect(response.body.data.comment).to.be.deep.eq('comment_test');
            expect(response.body.data.name).to.be.deep.eq('name_test');
          });
      });

      it('admin user should create a new snapshot', async () => {
        await request(app.express)
          .post(_URL().getURL('snapshots.store', { fwcloud: fwCloud.id }))
          .send({
            name: 'name_test',
            comment: 'comment_test',
          })
          .set('Cookie', attachSession(adminUserSessionId))
          .expect(201)
          .then(async (response) => {
            expect(response.body.data).to.haveOwnProperty('id');
            expect(response.body.data).not.to.be.null;
          });
      });

      it('channel_id should be valid as input', async () => {
        await request(app.express)
          .post(_URL().getURL('snapshots.store', { fwcloud: fwCloud.id }))
          .send({
            name: 'name_test',
            comment: 'comment_test',
            channel_id: StringHelper.randomize(10),
          })
          .set('Cookie', attachSession(adminUserSessionId))
          .expect(201);
      });
    });

    describe('SnapshotController@update', () => {
      let s1: Snapshot;

      beforeEach(async () => {
        s1 = await Snapshot.create(snapshotService.config.data_dir, fwCloud, 'test1', null);
      });

      it('guest user should not update an snapshot', async () => {
        await request(app.express)
          .put(
            _URL().getURL('snapshots.update', {
              fwcloud: fwCloud.id,
              snapshot: s1.id,
            }),
          )
          .expect(401);
      });

      it('regular user should not update an snapshot if the user does not belong to the fwcloud', async () => {
        await request(app.express)
          .put(
            _URL().getURL('snapshots.update', {
              fwcloud: fwCloud.id,
              snapshot: s1.id,
            }),
          )
          .send({
            name: 'name_test',
            comment: 'comment_test',
          })
          .set('Cookie', attachSession(loggedUserSessionId))
          .expect(401);
      });

      it('regular user should update an snapshot if the user belongs to the fwcloud', async () => {
        loggedUser.fwClouds = [fwCloud];
        await manager.getRepository(User).save(loggedUser);

        await request(app.express)
          .put(
            _URL().getURL('snapshots.update', {
              fwcloud: fwCloud.id,
              snapshot: s1.id,
            }),
          )
          .send({
            name: 'name_test',
            comment: 'comment_test',
          })
          .set('Cookie', attachSession(loggedUserSessionId))
          .expect(200)
          .then((response) => {
            expect(response.body.data.id).to.be.deep.equal(s1.id);
            expect(response.body.data.name).to.be.deep.equal('name_test');
            expect(response.body.data.comment).to.be.deep.equal('comment_test');
          });
      });

      it('admin user should update an snapshot', async () => {
        await request(app.express)
          .put(
            _URL().getURL('snapshots.update', {
              fwcloud: fwCloud.id,
              snapshot: s1.id,
            }),
          )
          .send({
            name: 'name_test',
            comment: 'comment_test',
          })
          .set('Cookie', attachSession(adminUserSessionId))
          .expect(200)
          .then((response) => {
            expect(response.body.data.id).to.be.deep.equal(s1.id);
            expect(response.body.data.name).to.be.deep.equal('name_test');
            expect(response.body.data.comment).to.be.deep.equal('comment_test');
          });
      });
    });

    describe('SnapshotController@restore', () => {
      let s1: Snapshot;

      beforeEach(async () => {
        stubExportDatabase.restore();
        s1 = await Snapshot.create(snapshotService.config.data_dir, fwCloud, 'test1', null);
      });

      it('guest user should not restore an snapshot', async () => {
        await request(app.express)
          .post(
            _URL().getURL('snapshots.restore', {
              fwcloud: fwCloud.id,
              snapshot: s1.id,
            }),
          )
          .expect(401);
      });

      it('regular user should not restore an snapshot if the user does not belong to the fwcloud', async () => {
        await request(app.express)
          .post(
            _URL().getURL('snapshots.restore', {
              fwcloud: fwCloud.id,
              snapshot: s1.id,
            }),
          )
          .set('Cookie', attachSession(loggedUserSessionId))
          .expect(401);
      });

      it('regular user should restore an snapshot if the user belongs to the fwcloud', async () => {
        loggedUser.fwClouds = [fwCloud];
        await manager.getRepository(User).save(loggedUser);
        await request(app.express)
          .post(
            _URL().getURL('snapshots.restore', {
              fwcloud: fwCloud.id,
              snapshot: s1.id,
            }),
          )
          .set('Cookie', attachSession(loggedUserSessionId))
          .expect(200)
          .then(async (response) => {
            expect(response.body.data.id).to.be.an('number');
            expect(response.body.data.name).to.be.deep.eq(fwCloud.name);
          });
      });

      it('admin user should restore an snapshot', async () => {
        await request(app.express)
          .post(
            _URL().getURL('snapshots.restore', {
              fwcloud: fwCloud.id,
              snapshot: s1.id,
            }),
          )
          .set('Cookie', attachSession(adminUserSessionId))
          .expect(200)
          .then(async (response) => {
            expect(response.body.data.id).to.be.an('number');
            expect(response.body.data.name).to.be.deep.eq(fwCloud.name);
          });
      });

      it('restore should throw an exception if the snapshot is not compatible', async () => {
        const stub = sinon.stub(Snapshot.prototype, 'compatible').get(() => {
          return false;
        });

        const metadata: SnapshotMetadata = JSON.parse(
          fs.readFileSync(path.join(s1.path, Snapshot.METADATA_FILENAME)).toString(),
        );
        fs.writeFileSync(
          path.join(s1.path, Snapshot.METADATA_FILENAME),
          JSON.stringify(metadata, null, 2),
        );

        await request(app.express)
          .post(
            _URL().getURL('snapshots.restore', {
              fwcloud: fwCloud.id,
              snapshot: s1.id,
            }),
          )
          .set('Cookie', attachSession(adminUserSessionId))
          .expect(400);

        stub.restore();
      });

      it('channel_id should be valid as input', async () => {
        await request(app.express)
          .post(
            _URL().getURL('snapshots.restore', {
              fwcloud: fwCloud.id,
              snapshot: s1.id,
            }),
          )
          .send({
            channel_id: StringHelper.randomize(10),
          })
          .set('Cookie', attachSession(adminUserSessionId))
          .expect(200);
      });
    });

    describe('SnapshotController@destroy', () => {
      let s1: Snapshot;

      beforeEach(async () => {
        s1 = await Snapshot.create(snapshotService.config.data_dir, fwCloud, 'test1', 'comment1');
      });

      it('guest user should not destroy an snapshot', async () => {
        await request(app.express)
          .delete(
            _URL().getURL('snapshots.destroy', {
              fwcloud: fwCloud.id,
              snapshot: s1.id,
            }),
          )
          .expect(401);
      });

      it('regular user should not destroy an snapshot if the user does not belong to the fwcloud', async () => {
        await request(app.express)
          .delete(
            _URL().getURL('snapshots.destroy', {
              fwcloud: fwCloud.id,
              snapshot: s1.id,
            }),
          )
          .set('Cookie', attachSession(loggedUserSessionId))
          .expect(401);
      });

      it('regular user should destroy an snapshot if the user belongs to the fwcloud', async () => {
        loggedUser.fwClouds = [fwCloud];
        await manager.getRepository(User).save(loggedUser);

        await request(app.express)
          .delete(
            _URL().getURL('snapshots.destroy', {
              fwcloud: fwCloud.id,
              snapshot: s1.id,
            }),
          )
          .set('Cookie', attachSession(loggedUserSessionId))
          .expect(200);
      });

      it('admin user should destroy an snapshot', async () => {
        await request(app.express)
          .delete(
            _URL().getURL('snapshots.destroy', {
              fwcloud: fwCloud.id,
              snapshot: s1.id,
            }),
          )
          .set('Cookie', attachSession(adminUserSessionId))
          .expect(200);
      });
    });
  });
});
