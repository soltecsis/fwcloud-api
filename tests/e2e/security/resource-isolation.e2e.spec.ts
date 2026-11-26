import request = require('supertest');
import { Route } from '../../../src/models/routing/route/route.model';
import { RoutingTable } from '../../../src/models/routing/routing-table/routing-table.model';
import { describeName, expect, testSuite } from '../../mocha/global-setup';
import { useProductionAuthentication } from '../../utils/production-auth-harness';
import {
  SecurityAccount,
  SecurityResource,
  SecuritySession,
  assignClouds,
  securityAccount,
  securityLogin,
  securityResource,
  tableUrl,
} from '../../utils/security-fixtures';

describe(describeName('Security: two-manager and two-cloud resource isolation'), () => {
  useProductionAuthentication();
  let managerA: SecurityAccount;
  let managerB: SecurityAccount;
  let session: SecuritySession;
  let a: SecurityResource;
  let b: SecurityResource;

  beforeEach(async () => {
    await testSuite.resetDatabaseData();
    managerA = await securityAccount(2);
    managerB = await securityAccount(2);
    a = await securityResource('cloud A');
    b = await securityResource('cloud B');
    await assignClouds(managerA, [a.fwcloud]);
    await assignClouds(managerB, [b.fwcloud]);
    session = await securityLogin(managerA);
    testSuite.app.config.set('confirmation_token', true);
  });

  it('allows each manager to read only their assigned resource', async () => {
    const response = await request(testSuite.app.express)
      .get(tableUrl(a))
      .set('Cookie', session.cookie)
      .expect(200);
    expect(response.body.data.id).to.eq(a.table.id);
    await request(testSuite.app.express).get(tableUrl(b)).set('Cookie', session.cookie).expect(401);
    const otherSession = await securityLogin(managerB);
    await request(testSuite.app.express)
      .get(tableUrl(b))
      .set('Cookie', otherSession.cookie)
      .expect(200);
    await request(testSuite.app.express)
      .get(tableUrl(a))
      .set('Cookie', otherSession.cookie)
      .expect(401);
  });

  it('allows a manager to update an assigned resource', async () => {
    await request(testSuite.app.express)
      .put(tableUrl(a))
      .set('Cookie', session.cookie)
      .set('x-fwc-confirm-token', managerA.user.confirmation_token)
      .send({ comment: 'authorized change' })
      .expect(200);
    expect((await RoutingTable.findOneByOrFail({ id: a.table.id })).comment).to.eq(
      'authorized change',
    );
  });

  it('rejects modification of an existing foreign resource without changing it', async () => {
    await request(testSuite.app.express)
      .put(tableUrl(b))
      .set('Cookie', session.cookie)
      .set('x-fwc-confirm-token', managerA.user.confirmation_token)
      .send({ name: 'forbidden', comment: 'forbidden' })
      .expect(401);
    const persisted = await RoutingTable.findOneByOrFail({ id: b.table.id });
    expect(persisted.name).to.eq(b.table.name);
    expect(persisted.comment).to.eq('original');
  });

  it('rejects deletion of an existing foreign resource without removing children', async () => {
    await request(testSuite.app.express)
      .delete(tableUrl(b))
      .set('Cookie', session.cookie)
      .set('x-fwc-confirm-token', managerA.user.confirmation_token)
      .expect(401);
    expect(await RoutingTable.countBy({ id: b.table.id })).to.eq(1);
    expect(await Route.countBy({ id: b.route.id })).to.eq(1);
  });

  it('rejects a foreign firewall substituted beneath an assigned cloud', async () => {
    const url = `/fwclouds/${a.fwcloud.id}/firewalls/${b.firewall.id}/routingTables/${b.table.id}`;
    await request(testSuite.app.express).get(url).set('Cookie', session.cookie).expect(404);
  });

  it('rejects a foreign table substituted beneath an assigned firewall', async () => {
    const url = `/fwclouds/${a.fwcloud.id}/firewalls/${a.firewall.id}/routingTables/${b.table.id}`;
    await request(testSuite.app.express).get(url).set('Cookie', session.cookie).expect(404);
  });

  it('rejects a foreign route substituted beneath an assigned table', async () => {
    await request(testSuite.app.express)
      .get(`${tableUrl(a)}/routes/${b.route.id}`)
      .set('Cookie', session.cookie)
      .expect(404);
  });

  it('does not reveal foreign resources through the assigned collection', async () => {
    const response = await request(testSuite.app.express)
      .get(tableUrl(a).slice(0, tableUrl(a).lastIndexOf('/')))
      .set('Cookie', session.cookie)
      .expect(200);
    expect(response.body.data.map((item: RoutingTable) => item.id)).to.deep.eq([a.table.id]);
  });

  it('rechecks cloud membership when an existing session is reused', async () => {
    await request(testSuite.app.express).get(tableUrl(a)).set('Cookie', session.cookie).expect(200);
    await assignClouds(managerA, []);
    await request(testSuite.app.express).get(tableUrl(a)).set('Cookie', session.cookie).expect(401);
  });

  for (const operation of ['bulkUpdate', 'bulkRemove']) {
    it(`rejects mixed own and foreign route identifiers atomically during ${operation}`, async () => {
      const url = `${tableUrl(a)}/routes/${operation}?routes[]=${a.route.id}&routes[]=${b.route.id}`;
      const req = request(testSuite.app.express);
      const call =
        operation === 'bulkUpdate' ? req.put(url).send({ active: false }) : req.delete(url);
      await call
        .set('Cookie', session.cookie)
        .set('x-fwc-confirm-token', managerA.user.confirmation_token)
        .expect(404);
      expect(await Route.countBy({ id: a.route.id })).to.eq(1);
      expect(await Route.countBy({ id: b.route.id })).to.eq(1);
      expect((await Route.findOneByOrFail({ id: a.route.id })).active).to.eq(true);
      expect((await Route.findOneByOrFail({ id: b.route.id })).active).to.eq(true);
    });
  }

  it('rejects foreign cloud identifiers in the legacy access-control path', async () => {
    const response = await request(testSuite.app.express)
      .put('/firewall/get')
      .set('Cookie', session.cookie)
      .send({ fwcloud: b.fwcloud.id, firewall: b.firewall.id })
      .expect(400);
    expect(response.body.fwcErr).to.eq(7000);
  });

  it('rejects foreign firewall identifiers in an otherwise allowed legacy cloud', async () => {
    const response = await request(testSuite.app.express)
      .put('/firewall/get')
      .set('Cookie', session.cookie)
      .send({ fwcloud: a.fwcloud.id, firewall: b.firewall.id })
      .expect(400);
    expect(response.body.fwcErr).to.eq(7001);
  });
});
