import * as fs from 'fs';
import { randomBytes } from 'crypto';
import request = require('supertest');
import { User } from '../../../src/models/user/User';
import { FwCloud } from '../../../src/models/fwcloud/FwCloud';
import { describeName, expect, testSuite } from '../../mocha/global-setup';
import { useProductionAuthentication } from '../../utils/production-auth-harness';
import {
  SecurityAccount,
  changeSession,
  assignClouds,
  loginPayload,
  securityAccount,
  securityLogin,
  sessionFile,
} from '../../utils/security-fixtures';

describe(describeName('Security: production authentication and session lifecycle'), () => {
  useProductionAuthentication();
  let account: SecurityAccount;

  beforeEach(async () => {
    await testSuite.resetDatabaseData();
    account = await securityAccount(2);
  });

  it('accepts a real login and signed cookie on a protected endpoint', async () => {
    const session = await securityLogin(account);
    await request(testSuite.app.express)
      .get('/profile/tfa/setup')
      .set('Cookie', session.cookie)
      .expect(200);
  });

  for (const field of ['password', 'username', 'customer'] as const) {
    it(`rejects incorrect ${field} and leaves no usable authenticated session`, async () => {
      const agent = request.agent(testSuite.app.express);
      const payload = loginPayload(account);
      if (field === 'customer') payload.customer = 2147483647;
      else payload[field] = randomBytes(10).toString('hex');
      const response = await agent.post('/user/login').send(payload).expect(401);
      expect(response.body.fwcErr).to.eq(1001);
      const protectedResponse = await agent.get('/profile/tfa/setup').expect(400);
      expect(protectedResponse.body.fwcErr).to.eq(1010);
    });
  }

  it('rejects malformed login input without creating an authenticated session', async () => {
    const agent = request.agent(testSuite.app.express);
    await agent.post('/user/login').send({ username: account.user.username }).expect(400);
    await agent.get('/profile/tfa/setup').expect(400);
  });

  for (const endpoint of ['/profile/tfa/setup', '/config', '/fwcloud/all/get']) {
    it(`rejects an unauthenticated request to ${endpoint}`, async () => {
      const response = await request(testSuite.app.express).get(endpoint).expect(400);
      expect(response.body.fwcErr).to.eq(1010);
    });
  }

  it('rejects a tampered signature on an otherwise valid session cookie', async () => {
    const session = await securityLogin(account);
    const last = session.cookie.slice(-1);
    const tampered = session.cookie.slice(0, -1) + (last === 'A' ? 'B' : 'A');
    const response = await request(testSuite.app.express)
      .get('/profile/tfa/setup')
      .set('Cookie', tampered)
      .expect(400);
    expect(response.body.fwcErr).to.eq(1010);
    await request(testSuite.app.express)
      .get('/profile/tfa/setup')
      .set('Cookie', session.cookie)
      .expect(200);
  });

  it('rejects a cookie whose stored session has been deleted', async () => {
    const session = await securityLogin(account);
    fs.unlinkSync(sessionFile(session));
    const response = await request(testSuite.app.express)
      .get('/profile/tfa/setup')
      .set('Cookie', session.cookie)
      .expect(400);
    expect(response.body.fwcErr).to.eq(1010);
  });

  for (const field of ['keepalive_ts', 'customer_id', 'user_id', 'username', 'pgp']) {
    it(`rejects an incomplete persisted session missing ${field}`, async () => {
      const session = await securityLogin(account);
      changeSession(session, (data) => delete data[field]);
      const response = await request(testSuite.app.express)
        .get('/profile/tfa/setup')
        .set('Cookie', session.cookie)
        .expect(400);
      expect(response.body.fwcErr).to.eq(1010);
    });
  }

  it('rejects a session exceeding the inactivity limit', async () => {
    const session = await securityLogin(account);
    const cloud = await FwCloud.create({
      name: 'session lock',
      locked: true,
      locked_by: session.id,
    }).save();
    await assignClouds(account, [cloud]);
    changeSession(session, (data) => {
      data.keepalive_ts = Date.now() - testSuite.app.config.get('session').keepalive_ms - 1000;
    });
    const response = await request(testSuite.app.express)
      .get('/profile/tfa/setup')
      .set('Cookie', session.cookie)
      .expect(400);
    expect(response.body.fwcErr).to.eq(1009);
    expect((await FwCloud.findOneByOrFail({ id: cloud.id })).locked).to.eq(false);
    await request(testSuite.app.express)
      .get('/profile/tfa/setup')
      .set('Cookie', session.cookie)
      .expect(400);
  });

  it('invalidates the original cookie after authenticated logout', async () => {
    const session = await securityLogin(account);
    const cloud = await FwCloud.create({
      name: 'logout lock',
      locked: true,
      locked_by: session.id,
    }).save();
    await request(testSuite.app.express)
      .post('/user/logout')
      .set('Cookie', session.cookie)
      .expect(204);
    expect((await FwCloud.findOneByOrFail({ id: cloud.id })).locked).to.eq(false);
    const response = await request(testSuite.app.express)
      .get('/profile/tfa/setup')
      .set('Cookie', session.cookie)
      .expect(400);
    expect(response.body.fwcErr).to.eq(1010);
  });

  it('rejects a session after the account is removed', async () => {
    const session = await securityLogin(account);
    await User.delete(account.user.id);
    const response = await request(testSuite.app.express)
      .get('/profile/tfa/setup')
      .set('Cookie', session.cookie)
      .expect(400);
    expect(response.body.fwcErr).to.eq(1010);
  });
});
