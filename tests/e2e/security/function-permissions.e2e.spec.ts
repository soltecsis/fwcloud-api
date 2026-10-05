import request = require('supertest');
import bcrypt = require('bcryptjs');
import { randomBytes } from 'crypto';
import { User } from '../../../src/models/user/User';
import { FwCloud } from '../../../src/models/fwcloud/FwCloud';
import { PgpHelper } from '../../../src/utils/pgp';
import { describeName, expect, testSuite } from '../../mocha/global-setup';
import { useProductionAuthentication } from '../../utils/production-auth-harness';
import {
  SecurityAccount,
  SecuritySession,
  assignClouds,
  securityAccount,
  securityLogin,
} from '../../utils/security-fixtures';

describe(describeName('Security: administrator and manager function permissions'), () => {
  useProductionAuthentication();
  let manager: SecurityAccount;
  let otherManager: SecurityAccount;
  let admin: SecurityAccount;
  let session: SecuritySession;
  let cloud: FwCloud;
  let otherCloud: FwCloud;

  beforeEach(async () => {
    await testSuite.resetDatabaseData();
    manager = await securityAccount(2);
    otherManager = await securityAccount(2);
    admin = await securityAccount(1);
    cloud = await FwCloud.create({ name: 'assigned cloud', locked: false }).save();
    otherCloud = await FwCloud.create({ name: 'foreign cloud', locked: false }).save();
    await assignClouds(manager, [cloud]);
    await assignClouds(otherManager, [otherCloud]);
    session = await securityLogin(manager);
    testSuite.app.config.set('confirmation_token', true);
  });

  async function expectAdminDenial(response: request.Response) {
    expect(response.status).to.eq(400);
    expect(response.body.fwcErr).to.eq(1008);
  }

  it('allows administrators but denies managers access to user management', async () => {
    const adminSession = await securityLogin(admin);
    await request(testSuite.app.express)
      .put('/user/get')
      .set('Cookie', adminSession.cookie)
      .send({ customer: 1, user: otherManager.user.id })
      .expect(200);
    await expectAdminDenial(
      await request(testSuite.app.express)
        .put('/user/get')
        .set('Cookie', session.cookie)
        .send({ customer: 1, user: otherManager.user.id }),
    );
  });

  it('does not let a manager promote another account', async () => {
    await expectAdminDenial(
      await request(testSuite.app.express)
        .put('/user')
        .set('Cookie', session.cookie)
        .set('x-fwc-confirm-token', manager.user.confirmation_token)
        .send({
          customer: 1,
          user: otherManager.user.id,
          username: otherManager.user.username,
          enabled: 1,
          role: 1,
          allowed_from: '',
        }),
    );
    expect((await User.findOneByOrFail({ id: otherManager.user.id })).role).to.eq(2);
  });

  it('rejects user creation after valid encrypted input has reached the role check', async () => {
    const count = await User.count();
    const encrypted = await new PgpHelper({ public: session.publicKey, private: '' }).encrypt(
      manager.password,
    );
    await expectAdminDenial(
      await request(testSuite.app.express)
        .post('/user')
        .set('Cookie', session.cookie)
        .set('x-fwc-confirm-token', manager.user.confirmation_token)
        .send({
          customer: 1,
          name: 'Synthetic denied account',
          username: 'deniedaccount',
          password: encrypted,
          enabled: 1,
          role: 1,
          allowed_from: '',
        }),
    );
    expect(await User.count()).to.eq(count);
  });

  it('denies a manager customer-management access', async () => {
    await expectAdminDenial(
      await request(testSuite.app.express)
        .put('/customer/get')
        .set('Cookie', session.cookie)
        .send({ customer: 1 }),
    );
  });

  it('does not let a manager delete another account', async () => {
    await expectAdminDenial(
      await request(testSuite.app.express)
        .put('/user/del')
        .set('Cookie', session.cookie)
        .set('x-fwc-confirm-token', manager.user.confirmation_token)
        .send({ customer: 1, user: otherManager.user.id }),
    );
    expect(await User.countBy({ id: otherManager.user.id })).to.eq(1);
  });

  for (const action of ['grant', 'revoke']) {
    it(`does not let a manager ${action} cloud membership`, async () => {
      const target = action === 'grant' ? manager : otherManager;
      const response = request(testSuite.app.express);
      const call =
        action === 'grant' ? response.post('/user/fwcloud') : response.put('/user/fwcloud/del');
      await expectAdminDenial(
        await call
          .set('Cookie', session.cookie)
          .set('x-fwc-confirm-token', manager.user.confirmation_token)
          .send({ user: target.user.id, fwcloud: otherCloud.id }),
      );
      const persisted = await User.findOneOrFail({
        where: { id: target.user.id },
        relations: ['fwClouds'],
      });
      expect(persisted.fwClouds.some((item) => item.id === otherCloud.id)).to.eq(
        action === 'revoke',
      );
    });
  }

  it('denies cloud creation even to a manager assigned to a cloud', async () => {
    const count = await FwCloud.count();
    await request(testSuite.app.express)
      .post('/fwclouds')
      .set('Cookie', session.cookie)
      .set('x-fwc-confirm-token', manager.user.confirmation_token)
      .send({ name: 'unauthorized creation' })
      .expect(401);
    expect(await FwCloud.count()).to.eq(count);
  });

  it('denies changes to an assigned cloud when the function requires an administrator', async () => {
    await request(testSuite.app.express)
      .put(`/fwclouds/${cloud.id}`)
      .set('Cookie', session.cookie)
      .set('x-fwc-confirm-token', manager.user.confirmation_token)
      .send({ name: 'unauthorized change' })
      .expect(401);
    expect((await FwCloud.findOneByOrFail({ id: cloud.id })).name).to.eq(cloud.name);
  });

  for (const endpoint of ['/backups', '/version', '/updates']) {
    it(`denies a manager the administrative function ${endpoint}`, async () => {
      await request(testSuite.app.express).get(endpoint).set('Cookie', session.cookie).expect(401);
    });
  }

  it('allows changing only the current account password', async () => {
    const password = randomBytes(18).toString('base64url');
    await request(testSuite.app.express)
      .put('/user/changepass')
      .set('Cookie', session.cookie)
      .set('x-fwc-confirm-token', manager.user.confirmation_token)
      .send({ password })
      .expect(204);
    const persisted = await User.findOneByOrFail({ id: manager.user.id });
    expect(await bcrypt.compare(`1${manager.user.username}${password}`, persisted.password)).to.eq(
      true,
    );
    const other = await User.findOneByOrFail({ id: otherManager.user.id });
    expect(
      other.password === otherManager.user.password,
      'other account password must remain unchanged',
    ).to.eq(true);
  });
});
