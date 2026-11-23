import request = require('supertest');
import sinon = require('sinon');
import { expect, testSuite } from '../../mocha/global-setup';
import { useProductionAuthentication } from '../../utils/production-auth-harness';
import {
  assignClouds,
  securityAccount,
  securityLogin,
  securityResource,
  type SecurityAccount,
  type SecuritySession,
} from '../../utils/security-fixtures';
import { FwCloud } from '../../../src/models/fwcloud/FwCloud';
import { WebSocketService } from '../../../src/sockets/web-socket.service';

describe('FWCloud lock ownership and administrator takeover', () => {
  useProductionAuthentication();
  let cloud: FwCloud;
  let manager: SecurityAccount;
  let admin: SecurityAccount;
  let managerSession: SecuritySession;
  let adminSession: SecuritySession;
  const sandbox = sinon.createSandbox();

  beforeEach(async () => {
    await testSuite.resetDatabaseData();
    testSuite.app.config.set('confirmation_token', true);
    cloud = (await securityResource('lock coordination')).fwcloud;
    manager = await securityAccount(2);
    admin = await securityAccount(1);
    await assignClouds(manager, [cloud]);
    await assignClouds(admin, [cloud]);
    managerSession = await securityLogin(manager);
    adminSession = await securityLogin(admin);
  });

  afterEach(() => sandbox.restore());

  function command(action: string, account: SecurityAccount, session: SecuritySession) {
    return request(testSuite.app.express)
      .put(`/fwcloud/${action}`)
      .set('Cookie', session.cookie)
      .set('x-fwc-confirm-token', account.user.confirmation_token)
      .send({ fwcloud: cloud.id });
  }

  async function owner() {
    return (await FwCloud.findOneByOrFail({ id: cloud.id })).locked_by;
  }

  it('still requires confirmation before acquiring a lock', async () => {
    const response = await request(testSuite.app.express)
      .put('/fwcloud/lock')
      .set('Cookie', managerSession.cookie)
      .send({ fwcloud: cloud.id })
      .expect(403);
    expect(response.body.fwc_confirm_token).to.be.a('string');
    expect(await owner()).to.equal(null);
  });

  it('acquires for exactly one concurrent session and only the owner can renew or release', async () => {
    const [first, second] = await Promise.all([
      command('lock', manager, managerSession).expect(200),
      command('lock', admin, adminSession).expect(200),
    ]);
    expect([first.body.result, second.body.result]).to.have.members([true, false]);
    const [winner, winnerSession, loser, loserSession] = first.body.result
      ? [manager, managerSession, admin, adminSession]
      : [admin, adminSession, manager, managerSession];
    expect(await owner()).to.equal(winnerSession.id);
    expect((await command('lock', winner, winnerSession).expect(200)).body.result).to.equal(true);
    expect((await command('unlock', loser, loserSession).expect(200)).body.result).to.equal(false);
    expect(await owner()).to.equal(winnerSession.id);
    expect((await command('unlock', winner, winnerSession).expect(200)).body.result).to.equal(true);
    expect(await owner()).to.equal(null);
  });

  it('keeps forced takeover administrator-only and identifies the affected cloud', async () => {
    const sockets = await testSuite.app.getService<WebSocketService>(WebSocketService.name);
    const emit = sandbox.stub(sockets, 'emitToRoom');
    expect((await command('lock', admin, adminSession).expect(200)).body.result).to.equal(true);
    expect((await command('forcelock', manager, managerSession).expect(200)).body.result).to.equal(
      false,
    );
    expect(await owner()).to.equal(adminSession.id);
    expect(emit.called).to.equal(false);
    await command('unlock', admin, adminSession).expect(200);
    expect((await command('lock', manager, managerSession).expect(200)).body.result).to.equal(true);
    expect((await command('forcelock', admin, adminSession).expect(200)).body.result).to.equal(
      true,
    );
    expect(await owner()).to.equal(adminSession.id);
    expect(
      emit.calledOnceWithExactly(managerSession.id, 'fwcloud:forceUnlock', { fwcloud: cloud.id }),
    ).to.equal(true);
  });
});
