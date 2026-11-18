import request = require('supertest');
import Sinon = require('sinon');
import { Tfa } from '../../../src/models/user/Tfa';
import { describeName, expect, testSuite } from '../../mocha/global-setup';
import { useProductionAuthentication } from '../../utils/production-auth-harness';
import {
  SecurityAccount,
  SecuritySession,
  securityAccount,
  securityLogin,
} from '../../utils/security-fixtures';
const speakeasy = require('speakeasy');

describe(describeName('Security: personal two-factor setup ownership'), () => {
  useProductionAuthentication();
  let account: SecurityAccount;
  let other: SecurityAccount;
  let session: SecuritySession;
  let pending: Tfa;
  let foreign: Tfa;
  let clock: Sinon.SinonFakeTimers;

  beforeEach(async () => {
    await testSuite.resetDatabaseData();
    account = await securityAccount(2);
    other = await securityAccount(2);
    session = await securityLogin(account);
    // Keep real TOTP calculation deterministic at the 30-second rollover boundary.
    clock = Sinon.useFakeTimers({ now: Date.now(), toFake: ['Date'] });
    pending = await Tfa.create({
      userId: account.user.id,
      secret: '',
      tempSecret: speakeasy.generateSecret().base32,
      dataURL: '',
      tfaURL: '',
    }).save();
    foreign = await Tfa.create({
      userId: other.user.id,
      secret: '',
      tempSecret: speakeasy.generateSecret().base32,
      dataURL: '',
      tfaURL: '',
    }).save();
  });

  afterEach(() => {
    clock?.restore();
  });

  async function expectUnchanged() {
    expect((await Tfa.findOneByOrFail({ id: pending.id })).secret.length).to.eq(0);
    expect((await Tfa.findOneByOrFail({ id: foreign.id })).secret.length).to.eq(0);
  }

  it('does not expose another account setup through a forged user query', async () => {
    const response = await request(testSuite.app.express)
      .get(`/profile/tfa/setup?user=${other.user.id}`)
      .set('Cookie', session.cookie)
      .expect(200);
    expect(response.body.data.tfa.userId).to.eq(account.user.id);
  });

  it('rejects setup for another account without creating a record', async () => {
    const count = await Tfa.count();
    await request(testSuite.app.express)
      .post('/profile/tfa/setup')
      .set('Cookie', session.cookie)
      .send({ user: other.user.id, username: other.user.username })
      .expect(401);
    expect(await Tfa.count()).to.eq(count);
    await expectUnchanged();
  });

  it('persists an authorized personal setup before reporting success', async () => {
    await Tfa.delete(pending.id);
    await request(testSuite.app.express)
      .post('/profile/tfa/setup')
      .set('Cookie', session.cookie)
      .send({ user: account.user.id, username: account.user.username })
      .expect(200);
    const current = await Tfa.findOneByOrFail({ userId: account.user.id });
    expect(current.tempSecret.length > 0).to.eq(true);
    expect(current.secret.length).to.eq(0);
    expect(await Tfa.countBy({ id: foreign.id })).to.eq(1);
  });

  it('rejects verification of another account temporary secret even with a valid code', async () => {
    await request(testSuite.app.express)
      .post('/profile/tfa/verify')
      .set('Cookie', session.cookie)
      .send({
        tempSecret: foreign.tempSecret,
        authCode: speakeasy.totp({ secret: foreign.tempSecret, encoding: 'base32' }),
      })
      .expect(401);
    await expectUnchanged();
  });

  it('rejects an incorrect code without activating either account', async () => {
    await request(testSuite.app.express)
      .post('/profile/tfa/verify')
      .set('Cookie', session.cookie)
      .send({ tempSecret: pending.tempSecret, authCode: 'invalid-code' })
      .expect(401);
    await expectUnchanged();
  });

  it('rejects a missing code without activating either account', async () => {
    await request(testSuite.app.express)
      .post('/profile/tfa/verify')
      .set('Cookie', session.cookie)
      .send({ tempSecret: pending.tempSecret })
      .expect(401);
    await expectUnchanged();
  });

  it('verifies a real TOTP code only for the current account', async () => {
    await request(testSuite.app.express)
      .post('/profile/tfa/verify')
      .set('Cookie', session.cookie)
      .send({
        tempSecret: pending.tempSecret,
        authCode: speakeasy.totp({ secret: pending.tempSecret, encoding: 'base32' }),
      })
      .expect(200);
    const current = await Tfa.findOneByOrFail({ id: pending.id });
    expect(current.secret === pending.tempSecret, 'own temporary secret must be activated').to.eq(
      true,
    );
    expect((await Tfa.findOneByOrFail({ id: foreign.id })).secret.length).to.eq(0);
  });

  it('does not update another account even if its temporary secret matches', async () => {
    await Tfa.update(foreign.id, { tempSecret: pending.tempSecret });
    await request(testSuite.app.express)
      .post('/profile/tfa/verify')
      .set('Cookie', session.cookie)
      .send({
        tempSecret: pending.tempSecret,
        authCode: speakeasy.totp({ secret: pending.tempSecret, encoding: 'base32' }),
      })
      .expect(200);
    expect((await Tfa.findOneByOrFail({ id: pending.id })).secret === pending.tempSecret).to.eq(
      true,
    );
    expect((await Tfa.findOneByOrFail({ id: foreign.id })).secret.length).to.eq(0);
  });

  it('deletes only the current account setup', async () => {
    await request(testSuite.app.express)
      .delete('/profile/tfa/setup')
      .set('Cookie', session.cookie)
      .expect(204);
    expect(await Tfa.countBy({ id: pending.id })).to.eq(0);
    expect(await Tfa.countBy({ id: foreign.id })).to.eq(1);
  });
});
