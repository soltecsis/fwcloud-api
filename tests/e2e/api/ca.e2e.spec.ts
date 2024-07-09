import { Application } from '../../../src/Application';
import { CaService } from '../../../src/ca/ca.service';
import { FwCloud } from '../../../src/models/fwcloud/FwCloud';
import { User } from '../../../src/models/user/User';
import request = require('supertest');
import StringHelper from '../../../src/utils/string.helper';
import { describeName, expect, testSuite } from '../../mocha/global-setup';
import { attachSession, createUser, generateSession } from '../../utils/utils';
import { _URL } from '../../../src/fonaments/http/router/router.service';
import { Ca } from '../../../src/models/vpn/pki/Ca';
import db from '../../../src/database/database-manager';
import { EntityManager } from 'typeorm';

describe(describeName('Ca E2E Test'), () => {
  let app: Application;

  let loggedUser: User;
  let loggedUserSessionId: string;

  let adminUser: User;
  let adminUserSessionId: string;

  let fwCloud: FwCloud;
  let ca: Ca;
  let manager: EntityManager;

  beforeEach(async () => {
    app = testSuite.app;
    manager = db.getSource().manager;

    loggedUser = await createUser({ role: 0 });
    loggedUserSessionId = generateSession(loggedUser);

    adminUser = await createUser({ role: 1 });
    adminUserSessionId = generateSession(adminUser);

    fwCloud = await manager
      .getRepository(FwCloud)
      .save(manager.getRepository(FwCloud).create({ name: StringHelper.randomize(10) }));
    ca = await manager.getRepository(Ca).save(
      manager.getRepository(Ca).create({
        fwCloudId: fwCloud.id,
        cn: StringHelper.randomize(10),
        days: 1000,
        comment: 'testComment',
      }),
    );
    await app.getService<CaService>(CaService.name);
  });

  describe('CaController@update', () => {
    it('guest user should not update a comment of ca', async () => {
      return await request(app.express)
        .put(
          _URL().getURL('fwclouds.cas.update', {
            fwcloud: fwCloud.id,
            ca: ca.id,
          }),
        )
        .expect(401);
    });
    it('regular user should not update a comment of ca if it does not belong to the fwcloud', async () => {
      return await request(app.express)
        .put(
          _URL().getURL('fwclouds.cas.update', {
            fwcloud: fwCloud.id,
            ca: ca.id,
          }),
        )
        .set('Cookie', [attachSession(loggedUserSessionId)])
        .expect(401);
    });
    it('regular user should update a comment of ca if it does belong to the fwcloud', async () => {
      loggedUser.fwClouds = [fwCloud];
      await manager.getRepository(User).save(loggedUser);

      return await request(app.express)
        .put(
          _URL().getURL('fwclouds.cas.update', {
            fwcloud: fwCloud.id,
            ca: ca.id,
          }),
        )
        .set('Cookie', [attachSession(loggedUserSessionId)])
        .expect(200);
    });
    it('admin user should update a comment of ca', async () => {
      return await request(app.express)
        .put(
          _URL().getURL('fwclouds.cas.update', {
            fwcloud: fwCloud.id,
            ca: ca.id,
          }),
        )
        .set('Cookie', [attachSession(adminUserSessionId)])
        .expect(200);
    });
    it('should update the comment of the ca', async () => {
      const comment: string = StringHelper.randomize(10);
      return await request(app.express)
        .put(
          _URL().getURL('fwclouds.cas.update', {
            fwcloud: fwCloud.id,
            ca: ca.id,
          }),
        )
        .set('Cookie', [attachSession(adminUserSessionId)])
        .send({
          comment: comment,
        })
        .expect(200)
        .then(async () => {
          const caWithNewComment: Ca = await Ca.findOne({
            where: { id: ca.id },
          });
          expect(caWithNewComment.comment).to.be.equal(comment);
        });
    });
    it('should return the updated ca', async () => {
      const comment = StringHelper.randomize(10);
      return await request(app.express)
        .put(
          _URL().getURL('fwclouds.cas.update', {
            fwcloud: fwCloud.id,
            ca: ca.id,
          }),
        )
        .set('Cookie', [attachSession(adminUserSessionId)])
        .send({
          comment: comment,
        })
        .expect(200)
        .then(async (response) => {
          const caWithNewComment = await Ca.findOne({ where: { id: ca.id } });
          expect(response.body.data.comment).to.be.equal(caWithNewComment.comment);
        });
    });
  });
});
