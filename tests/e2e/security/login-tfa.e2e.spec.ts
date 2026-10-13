import request = require('supertest');
import Sinon = require('sinon');
import { Tfa } from '../../../src/models/user/Tfa';
import { expect, testSuite } from '../../mocha/global-setup';
import { useProductionAuthentication } from '../../utils/production-auth-harness';
import { SecurityAccount, loginPayload, securityAccount } from '../../utils/security-fixtures';
const speakeasy = require('speakeasy');

describe('Security: optional persisted 2FA during real login', () => {
  useProductionAuthentication();
  let account: SecurityAccount;
  let secret: string;
  let setup: Tfa;
  let clock: Sinon.SinonFakeTimers;

  beforeEach(async () => {
    await testSuite.resetDatabaseData();
    account = await securityAccount(2);
    secret = speakeasy.generateSecret().base32;
    setup = await Tfa.create({
      userId: account.user.id,
      secret,
      tempSecret: secret,
      dataURL: '',
      tfaURL: '',
    }).save();
    clock = Sinon.useFakeTimers({ now: Date.now(), toFake: ['Date'] });
  });
  afterEach(() => clock?.restore());

  for (const kind of ['absent', 'wrong']) {
    it(`rejects an ${kind} code without leaving an authenticated session`, async () => {
      const agent = request.agent(testSuite.app.express);
      const call = agent.post('/user/login').send(loginPayload(account));
      if (kind === 'wrong') call.set('x-tfa', 'invalid-code');
      const response = await call.expect(401);
      expect(response.body.fwcErr).to.eq(1001);
      await agent.get('/config').expect(400);
    });
  }

  it('accepts a valid header TOTP and permits protected access without returning its secret', async () => {
    const agent = request.agent(testSuite.app.express);
    const response = await agent
      .post('/user/login')
      .set('x-tfa', speakeasy.totp({ secret, encoding: 'base32' }))
      .send(loginPayload(account))
      .expect(200);
    expect(response.body.user).to.eq(account.user.id);
    expect(JSON.stringify(response.body).includes(secret)).to.eq(false);
    await agent.get('/config').expect(200);
  });

  it('supports the authCode body field with a valid TOTP', async () => {
    const agent = request.agent(testSuite.app.express);
    await agent
      .post('/user/login')
      .send({ ...loginPayload(account), authCode: speakeasy.totp({ secret, encoding: 'base32' }) })
      .expect(200);
    await agent.get('/config').expect(200);
  });

  it('keeps 2FA optional when no verified secret exists', async () => {
    await Tfa.update(setup.id, { secret: '' });
    const agent = request.agent(testSuite.app.express);
    await agent.post('/user/login').send(loginPayload(account)).expect(200);
    await agent.get('/config').expect(200);
  });

  it('does not reuse an authenticated cookie after a failed 2FA login', async () => {
    const agent = request.agent(testSuite.app.express);
    await agent
      .post('/user/login')
      .set('x-tfa', speakeasy.totp({ secret, encoding: 'base32' }))
      .send(loginPayload(account))
      .expect(200);
    await agent.get('/config').expect(200);
    await agent
      .post('/user/login')
      .set('x-tfa', 'invalid-code')
      .send(loginPayload(account))
      .expect(401);
    await agent.get('/config').expect(400);
  });
});
