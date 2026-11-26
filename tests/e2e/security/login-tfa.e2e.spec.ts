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

  const validCode = () => speakeasy.totp({ secret, encoding: 'base32' });
  const startLogin = (agent: ReturnType<typeof request.agent>) =>
    agent.post('/user/login').send(loginPayload(account)).expect(401);

  it('starts a challenge without revealing identity or granting protected access', async () => {
    const agent = request.agent(testSuite.app.express);
    const first = await startLogin(agent);
    expect(first.body).to.deep.eq({
      fwcErr: 1001,
      msg: 'Bad username or password',
      mfaRequired: true,
    });
    await agent.get('/config').expect(400);

    const second = await agent.post('/user/login').send({ authCode: validCode() }).expect(200);
    expect(second.body.user).to.eq(account.user.id);
    expect(second.headers['set-cookie'][0].split(';')[0]).not.to.eq(
      first.headers['set-cookie'][0].split(';')[0],
    );
    await agent.get('/config').expect(200);
  });

  it('rejects a code submitted without the pending session cookie', async () => {
    await startLogin(request.agent(testSuite.app.express));
    await request(testSuite.app.express)
      .post('/user/login')
      .send({ authCode: validCode() })
      .expect(401);
  });

  it('rejects an expired challenge even with a current code', async () => {
    const agent = request.agent(testSuite.app.express);
    await startLogin(agent);
    clock.setSystemTime(Date.now() + 5 * 60 * 1000);
    await agent.post('/user/login').send({ authCode: validCode() }).expect(401);
    await agent.get('/config').expect(400);
  });

  it('rejects an incorrect code and discards the pending login', async () => {
    const agent = request.agent(testSuite.app.express);
    await startLogin(agent);
    const wrong = validCode() === '000000' ? '111111' : '000000';
    await agent.post('/user/login').send({ authCode: wrong }).expect(401);
    await agent.post('/user/login').send({ authCode: validCode() }).expect(401);
    await agent.get('/config').expect(400);
  });

  it('does not reveal 2FA status when the password is invalid', async () => {
    const response = await request(testSuite.app.express)
      .post('/user/login')
      .send({ ...loginPayload(account), password: 'synthetic-invalid-password' })
      .expect(401);
    expect(response.body).not.to.have.property('mfaRequired');
  });

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
