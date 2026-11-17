import request from 'supertest';
import { expect, testSuite } from '../../mocha/global-setup';
import { useProductionAuthentication } from '../../utils/production-auth-harness';
import { loginPayload, securityAccount, SecurityAccount } from '../../utils/security-fixtures';
import { AuditLog } from '../../../src/models/audit/AuditLog';
import { AuditEventType } from '../../../src/models/audit/audit-event-type';
import db from '../../../src/database/database-manager';

describe('Security: authentication audit capture through real routes', () => {
  useProductionAuthentication();
  let account: SecurityAccount;
  const repository = () => db.getSource().getRepository(AuditLog);
  const waitForEvents = async (count: number): Promise<AuditLog[]> => {
    for (let attempt = 0; attempt < 100; attempt++) {
      const entries = await repository().find({ order: { id: 'ASC' } });
      if (entries.length >= count && entries.every((entry) => entry.durationMs !== null))
        return entries;
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    throw new Error('Authentication audit entries were not completed');
  };

  beforeEach(async () => {
    await repository().clear();
    account = await securityAccount(2);
  });

  it('records one successful login and logout with the same identity while preserving the session lifecycle', async () => {
    const agent = request.agent(testSuite.app.express);
    const response = await agent
      .post('/user/login')
      .set('X-Forwarded-For', '192.0.2.20')
      .send(loginPayload(account))
      .expect(200);
    await agent.get('/config').expect(200);
    const [login] = await waitForEvents(1);
    await agent.post('/user/logout').send({}).expect(204);
    await agent.get('/config').expect(400);
    const entries = await waitForEvents(2);
    expect(entries).to.have.length(2);
    expect(login.eventType).to.equal(AuditEventType.Login);
    expect(login.outcome).to.equal('success');
    expect(login.userId).to.equal(account.user.id);
    expect(login.sourceIp).to.equal('192.0.2.20');
    expect(login.status).to.equal(200);
    expect(entries[1].eventType).to.equal(AuditEventType.Logout);
    expect(entries[1].outcome).to.equal('success');
    expect(entries[1].userId).to.equal(account.user.id);
    expect(entries[1].sessionId).to.equal(login.sessionId);
    expect(entries[1].status).to.equal(204);
    const stored = JSON.stringify(entries);
    expect(stored).not.to.contain(account.password);
    expect(stored).not.to.contain('synthetic-client-public-key');
    expect(stored).not.to.contain(response.body.publicKey);
    expect(stored).not.to.contain(response.headers['set-cookie'][0]);
  });

  for (const existingUser of [true, false]) {
    it(`records an anonymous failure without disclosing username existence (existing=${existingUser})`, async () => {
      const payload = {
        ...loginPayload(account),
        username: existingUser ? account.user.username : 'unknownaudituser',
        password: 'invalid-audit-password',
      };
      const response = await request(testSuite.app.express)
        .post('/user/login')
        .send(payload)
        .expect(401);
      expect(response.body.fwcErr).to.equal(1001);
      const entries = await waitForEvents(1);
      expect(entries).to.have.length(1);
      expect(entries[0].eventType).to.equal(AuditEventType.Login);
      expect(entries[0].outcome).to.equal('failure');
      expect(entries[0].userId).to.be.null;
      expect(entries[0].userName).to.be.null;
      expect(entries[0].sessionId).to.be.null;
      expect(entries[0].status).to.equal(401);
      expect(JSON.stringify(entries[0])).not.to.contain(payload.username);
      expect(JSON.stringify(entries[0])).not.to.contain(payload.password);
    });
  }
});
