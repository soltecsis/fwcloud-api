import { EntityManager } from 'typeorm';
import { Application } from '../../../src/Application';
import { FwCloud } from '../../../src/models/fwcloud/FwCloud';
import { User } from '../../../src/models/user/User';
import request = require('supertest');
import StringHelper from '../../../src/utils/string.helper';
import { describeName, expect, testSuite } from '../../mocha/global-setup';
import { attachSession, createUser, generateSession } from '../../utils/utils';
import { _URL } from '../../../src/fonaments/http/router/router.service';
import { Ca } from '../../../src/models/vpn/pki/Ca';
import { Crt } from '../../../src/models/vpn/pki/Crt';
import { CrtService } from '../../../src/crt/crt.service';
import db from '../../../src/database/database-manager';

describe(describeName('Crt E2E Test'), () => {
  let app: Application;

  let loggedUser: User;
  let loggedUserSessionId: string;

  let adminUser: User;
  let adminUserSessionId: string;

  let fwCloud: FwCloud;
  let ca: Ca;
  let crt: Crt;
  let service: CrtService;
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
    crt = await manager.getRepository(Crt).save(
      manager.getRepository(Crt).create({
        caId: ca.id,
        cn: 'crtTtest',
        days: 1000,
        type: 1,
        comment: 'testComment',
      }),
    );

    loggedUser.fwClouds = [fwCloud];
    adminUser.fwClouds = [fwCloud];
    await manager.getRepository(User).save([loggedUser, adminUser]);

    service = await app.getService<CrtService>(CrtService.name);
  });

  describe('CrtController@update', () => {
    it('guest user should not update a comment of crt', async () => {
      return await request(app.express)
        .put(
          _URL().getURL('fwclouds.cas.crts.update', {
            fwcloud: fwCloud.id,
            ca: ca.id,
            crt: crt.id,
          }),
        )
        .expect(401);
    });
    it('regular user should not update a comment of crt if it does not belong to the fwcloud', async () => {
      loggedUser.fwClouds = [];
      await manager.getRepository(User).save(loggedUser);

      return await request(app.express)
        .put(
          _URL().getURL('fwclouds.cas.crts.update', {
            fwcloud: fwCloud.id,
            ca: ca.id,
            crt: crt.id,
          }),
        )
        .set('Cookie', [attachSession(loggedUserSessionId)])
        .expect(401);
    });
    it('regular user should update a comment of crt if it does belong to the fwcloud', async () => {
      return await request(app.express)
        .put(
          _URL().getURL('fwclouds.cas.crts.update', {
            fwcloud: fwCloud.id,
            ca: ca.id,
            crt: crt.id,
          }),
        )
        .set('Cookie', [attachSession(loggedUserSessionId)])
        .expect(200);
    });
    it('admin user should update a comment of crt', async () => {
      return await request(app.express)
        .put(
          _URL().getURL('fwclouds.cas.crts.update', {
            fwcloud: fwCloud.id,
            ca: ca.id,
            crt: crt.id,
          }),
        )
        .set('Cookie', [attachSession(adminUserSessionId)])
        .expect(200);
    });
    it('should update the comment of the crt', async () => {
      const comment: string = StringHelper.randomize(10);
      return await request(app.express)
        .put(
          _URL().getURL('fwclouds.cas.crts.update', {
            fwcloud: fwCloud.id,
            ca: ca.id,
            crt: crt.id,
          }),
        )
        .set('Cookie', [attachSession(adminUserSessionId)])
        .send({
          comment: comment,
        })
        .expect(200)
        .then(async (response) => {
          const crtWithNewComment: Crt = await Crt.findOne({
            where: { id: crt.id },
          });
          expect(crtWithNewComment.comment).to.be.equal(comment);
        });
    });
    it('should return the updated crt', async () => {
      const comment = StringHelper.randomize(10);
      return await request(app.express)
        .put(
          _URL().getURL('fwclouds.cas.crts.update', {
            fwcloud: fwCloud.id,
            ca: ca.id,
            crt: crt.id,
          }),
        )
        .set('Cookie', [attachSession(adminUserSessionId)])
        .send({
          comment: comment,
        })
        .expect(200)
        .then(async (response) => {
          const crtWithNewComment = await Crt.findOne({
            where: { id: crt.id },
          });
          expect(response.body.data.comment).to.be.equal(crtWithNewComment.comment);
        });
    });
  });
});
