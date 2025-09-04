import { describe, it, beforeEach } from 'mocha';
import { expect } from 'chai';
import request from 'supertest';
import { Application } from '../../../src/Application';
import { FwCloudFactory, FwCloudProduct } from '../../utils/fwcloud-factory';
import { attachSession, createUser, generateSession } from '../../utils/utils';
import { User } from '../../../src/models/user/User';
import { EntityManager } from 'typeorm';
import db from '../../../src/database/database-manager';
import { FwCloud } from '../../../src/models/fwcloud/FwCloud';
import { testSuite } from '../../mocha/global-setup';
import { _URL } from '../../../src/fonaments/http/router/router.service';
import sinon from 'sinon';

describe('LockValidation Middleware', () => {
  let app: Application;
  let fwcProduct: FwCloudProduct;
  let adminUser: User;
  let regularUser: User;
  let session: string;
  let manager: EntityManager;

  beforeEach(async () => {
    await testSuite.resetDatabaseData();
    app = testSuite.app;
    manager = db.getSource().manager;
    fwcProduct = await new FwCloudFactory().make();
    adminUser = await createUser({ role: 1 });
    regularUser = await createUser({ role: 2 });
    adminUser.fwClouds = [fwcProduct.fwcloud];
    regularUser.fwClouds = [fwcProduct.fwcloud];
    await manager.getRepository(User).save([adminUser, regularUser]);
    session = generateSession(adminUser);
  });

  afterEach(() => {
    sinon.restore();
  });

  it('should bypass the middleware for GET requests', async () => {
    const res = await request(app.express)
      .get('/some-endpoint')
      .set('Cookie', `session=${session}`);
    expect(res.status).to.not.equal(403);
  });

  it('should bypass the middleware for specific POST requests', async () => {
    const res = await request(app.express).post('/user/login').set('Cookie', `session=${session}`);
    expect(res.status).to.not.equal(403);
  });

  it('should allow access if the fwcloud is not locked', async () => {
    sinon.stub(FwCloud, 'getFwcloudAccess').resolves({
      access: true,
      locked: false,
      mylock: false,
      locked_by: null,
      locked_at: '',
    });
    await request(app.express)
      .put(
        _URL().getURL('fwclouds.cas.update', {
          fwcloud: fwcProduct.fwcloud.id,
          ca: fwcProduct.ca.id,
        }),
      )
      .set('Cookie', [attachSession(session)])
      .send({
        comment: 'comment',
      })
      .then((response) => {
        expect(response.status).to.equal(200);
      });
  });

  it('should deny access if the fwcloud is locked by another user', async () => {
    sinon.stub(FwCloud, 'getFwcloudAccess').resolves({
      access: true,
      locked: true,
      mylock: false,
      locked_by: 1,
      locked_at: '',
    });
    await request(app.express)
      .put(
        _URL().getURL('fwclouds.cas.update', {
          fwcloud: fwcProduct.fwcloud.id,
          ca: fwcProduct.ca.id,
        }),
      )
      .set('Cookie', [attachSession(session)])
      .send({
        comment: 'comment',
      })
      .then((response) => {
        expect(response.status).to.equal(403);
      });
  });

  it('should allow access if the fwcloud is locked by the same user', async () => {
    sinon.stub(FwCloud, 'getFwcloudAccess').resolves({
      access: true,
      locked: true,
      mylock: true,
      locked_by: adminUser.id,
      locked_at: '',
    });
    await request(app.express)
      .put(
        _URL().getURL('fwclouds.cas.update', {
          fwcloud: fwcProduct.fwcloud.id,
          ca: fwcProduct.ca.id,
        }),
      )
      .set('Cookie', [attachSession(session)])
      .send({
        comment: 'comment',
      })
      .then((response) => {
        expect(response.status).to.equal(200);
      });
  });

  it('should lock the fwcloud if it is not locked', async () => {
    sinon.stub(FwCloud, 'updateFwcloudLock').resolves({ result: true });
    await request(app.express)
      .put(
        _URL().getURL('fwclouds.cas.update', {
          fwcloud: fwcProduct.fwcloud.id,
          ca: fwcProduct.ca.id,
        }),
      )
      .set('Cookie', [attachSession(session)])
      .send({
        comment: 'comment',
      })
      .then((response) => {
        expect(response.status).to.equal(200);
      });
  });

  it('should return an error if locking the fwcloud fails', async () => {
    sinon.stub(FwCloud, 'updateFwcloudLock').resolves({ result: false });
    await request(app.express)
      .put(
        _URL().getURL('fwclouds.cas.update', {
          fwcloud: fwcProduct.fwcloud.id,
          ca: fwcProduct.ca.id,
        }),
      )
      .set('Cookie', [attachSession(session)])
      .send({
        comment: 'comment',
      })
      .then((response) => {
        expect(response.status).to.equal(403);
      });
  });

  it('should allow access if regular user is allowed in fwcloud', async () => {
    session = generateSession(regularUser);
    await request(app.express)
      .put(
        _URL().getURL('fwclouds.cas.update', {
          fwcloud: fwcProduct.fwcloud.id,
          ca: fwcProduct.ca.id,
        }),
      )
      .set('Cookie', [attachSession(session)])
      .send({
        comment: 'comment',
      })
      .then((response) => {
        expect(response.status).to.equal(200);
      });
  });

  it('should return 401 status error if is guest user', async () => {
    await request(app.express)
      .put(
        _URL().getURL('fwclouds.cas.update', {
          fwcloud: fwcProduct.fwcloud.id,
          ca: fwcProduct.ca.id,
        }),
      )
      .send({
        comment: 'comment',
      })
      .then((response) => {
        expect(response.status).to.equal(401);
      });
  });

  it('should return 401 status error if user is not allowed in fwcloud', async () => {
    regularUser.fwClouds = [];
    await manager.getRepository(User).save(regularUser);
    session = generateSession(regularUser);
    await request(app.express)
      .put(
        _URL().getURL('fwclouds.cas.update', {
          fwcloud: fwcProduct.fwcloud.id,
          ca: fwcProduct.ca.id,
        }),
      )
      .set('Cookie', [attachSession(session)])
      .send({
        comment: 'comment',
      })
      .then((response) => {
        expect(response.status).to.equal(401);
      });
  });
});
