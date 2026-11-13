import request = require('supertest');
import { randomBytes } from 'crypto';
import { FwCloud } from '../../../src/models/fwcloud/FwCloud';
import { User } from '../../../src/models/user/User';
import { describeName, expect, testSuite } from '../../mocha/global-setup';
import { useProductionAuthentication } from '../../utils/production-auth-harness';
import {
  SecurityAccount,
  SecuritySession,
  assignClouds,
  securityAccount,
  securityLogin,
} from '../../utils/security-fixtures';

describe(describeName('Security: confirmation tokens do not replace authorization'), () => {
  useProductionAuthentication();
  let admin: SecurityAccount;
  let manager: SecurityAccount;
  let session: SecuritySession;
  let cloud: FwCloud;

  beforeEach(async () => {
    await testSuite.resetDatabaseData();
    admin = await securityAccount(1);
    manager = await securityAccount(2);
    cloud = await FwCloud.create({ name: 'original cloud', locked: false }).save();
    await assignClouds(admin, [cloud]);
    await assignClouds(manager, [cloud]);
    session = await securityLogin(admin);
    testSuite.app.config.set('confirmation_token', true);
  });

  function update(token?: string) {
    const call = request(testSuite.app.express)
      .put(`/fwclouds/${cloud.id}`)
      .set('Cookie', session.cookie)
      .send({ name: 'authorized change' });
    if (token !== undefined) call.set('x-fwc-confirm-token', token);
    return call;
  }

  for (const kind of ['missing', 'incorrect', 'other-user']) {
    it(`rejects a ${kind} token without changing the target cloud`, async () => {
      const token =
        kind === 'missing'
          ? undefined
          : kind === 'other-user'
            ? manager.user.confirmation_token
            : randomBytes(24).toString('hex');
      const response = await update(token).expect(403);
      expect(typeof response.body.fwc_confirm_token).to.eq('string');
      expect((await FwCloud.findOneByOrFail({ id: cloud.id })).name).to.eq(cloud.name);
    });
  }

  it('rejects a stale token after a challenge regenerates it', async () => {
    await update().expect(403);
    const current = await User.findOneByOrFail({ id: admin.user.id });
    expect(current.confirmation_token !== admin.user.confirmation_token).to.eq(true);
    await update(admin.user.confirmation_token).expect(403);
    expect((await FwCloud.findOneByOrFail({ id: cloud.id })).name).to.eq(cloud.name);
  });

  it('allows a valid token and authorized account to perform the intended operation', async () => {
    await update(admin.user.confirmation_token).expect(200);
    expect((await FwCloud.findOneByOrFail({ id: cloud.id })).name).to.eq('authorized change');
  });

  it('does not allow a valid token to bypass the administrator requirement', async () => {
    session = await securityLogin(manager);
    await update(manager.user.confirmation_token).expect(401);
    expect((await FwCloud.findOneByOrFail({ id: cloud.id })).name).to.eq(cloud.name);
  });

  it('does not treat a valid confirmation token as an authentication credential', async () => {
    const response = await request(testSuite.app.express)
      .put(`/fwclouds/${cloud.id}`)
      .set('x-fwc-confirm-token', admin.user.confirmation_token)
      .send({ name: 'forbidden' })
      .expect(400);
    expect(response.body.fwcErr).to.eq(1010);
    expect((await FwCloud.findOneByOrFail({ id: cloud.id })).name).to.eq(cloud.name);
  });
});
