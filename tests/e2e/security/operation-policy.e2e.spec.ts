import request = require('supertest');
import sinon = require('sinon');
import { expect, testSuite } from '../../mocha/global-setup';
import { useProductionAuthentication } from '../../utils/production-auth-harness';
import {
  assignClouds,
  securityAccount,
  securityLogin,
  securityResource,
  SecurityAccount,
  SecurityResource,
  SecuritySession,
} from '../../utils/security-fixtures';
import { UserRole } from '../../../src/models/user/user-role';
import { FwCloud } from '../../../src/models/fwcloud/FwCloud';
import { User } from '../../../src/models/user/User';
import { PolicyRuleService } from '../../../src/policy-rule/policy-rule.service';
import { RouterService } from '../../../src/fonaments/http/router/router.service';
import { FwCloudFactory } from '../../utils/fwcloud-factory';
import { WireGuardOption } from '../../../src/models/vpn/wireguard/wireguard-option.model';
import { FwcTree } from '../../../src/models/tree/fwc-tree.model';

describe('Security: route-declared operation policy', () => {
  useProductionAuthentication();
  let account: SecurityAccount;
  let resource: SecurityResource;
  let session: SecuritySession;
  let sandbox: sinon.SinonSandbox;

  beforeEach(async () => {
    await testSuite.resetDatabaseData();
    testSuite.app.config.set('confirmation_token', true);
    sandbox = sinon.createSandbox();
    account = await securityAccount(2);
    account.user.role = UserRole.Viewer;
    account.user.confirmation_token = null;
    await account.user.save();
    resource = await securityResource('operation policy');
    await assignClouds(account, [resource.fwcloud]);
    session = await securityLogin(account);
  });

  afterEach(() => sandbox?.restore());

  it('registers modern and legacy declarations from the same source as their handlers', async () => {
    const router = await testSuite.app.getService<RouterService>(RouterService.name);
    for (const [method, path] of [
      ['GET', '/ipobj/types'],
      ['GET', '/policy/types'],
      ['PUT', '/ping'],
      ['GET', `/fwclouds/${resource.fwcloud.id}/firewalls/${resource.firewall.id}/routingTables`],
    ]) {
      expect(router.resolveOperation(method, path)?.viewerAllowed).to.equal(true);
    }
    expect(router.resolveOperation('GET', '/updates')).to.equal(undefined);
    // Exercise production authentication, too.
    await request(testSuite.app.express)
      .put('/ping')
      .set('Cookie', session.cookie)
      .send({})
      .expect(200);
  });

  it('permits migrated consultations under another session lock without writes or token generation', async () => {
    resource.fwcloud.locked = true;
    resource.fwcloud.locked_by = 'another-session';
    await resource.fwcloud.save();
    const lock = sandbox.spy(FwCloud, 'updateFwcloudLock');
    const base = `/fwclouds/${resource.fwcloud.id}/firewalls/${resource.firewall.id}/routingTables`;
    for (const path of [
      '/ipobj/types',
      '/policy/types',
      base,
      `${base}/${resource.table.id}`,
      `${base}/${resource.table.id}/grid`,
    ]) {
      await request(testSuite.app.express).get(path).set('Cookie', session.cookie).expect(200);
    }
    expect(lock.called).to.equal(false);
    expect((await FwCloud.findOneByOrFail({ id: resource.fwcloud.id })).locked_by).to.equal(
      'another-session',
    );
    expect((await User.findOneByOrFail({ id: account.user.id })).confirmation_token).to.equal(null);
  });

  it('allows the reviewed POST download without acquiring a lock, generating a token or compiling', async () => {
    const service = await testSuite.app.getService<PolicyRuleService>(PolicyRuleService.name);
    const content = sandbox.stub(service, 'content').resolves('# stored script');
    const compile = sandbox.spy(service, 'compile');
    const lock = sandbox.spy(FwCloud, 'updateFwcloudLock');
    const path = `/fwclouds/${resource.fwcloud.id}/firewalls/${resource.firewall.id}/policyRules/download`;
    await request(testSuite.app.express)
      .post(path)
      .set('Cookie', session.cookie)
      .send({})
      .expect(200);
    expect(content.calledOnce).to.equal(true);
    expect(compile.called).to.equal(false);
    expect(lock.called).to.equal(false);
    expect((await User.findOneByOrFail({ id: account.user.id })).confirmation_token).to.equal(null);
  });

  it('allows Where used and tooltip reads without requiring an unlocked cloud', async () => {
    const cloud = await new FwCloudFactory().make();
    await assignClouds(account, [cloud.fwcloud]);
    cloud.fwcloud.locked = true;
    cloud.fwcloud.locked_by = 'another-session';
    await cloud.fwcloud.save();
    const lock = sandbox.spy(FwCloud, 'updateFwcloudLock');
    const fwcloud = cloud.fwcloud.id;
    const id = cloud.interfaces.get('firewall-interface1').id;
    const hostInterface = cloud.ipobjs.get('host-eth2-addr1').interfaceId;
    const host = cloud.ipobjs.get('host').id;
    const hostFolder = await FwcTree.create({ fwCloudId: fwcloud, node_type: 'OIH' }).save();
    await FwcTree.save([
      { fwCloudId: fwcloud, id_obj: cloud.ipobjGroup.id, ipObjTypeId: 20, node_type: 'OIG' },
      { fwCloudId: fwcloud, id_obj: hostInterface, ipObjTypeId: 11, node_type: 'IFH' },
      {
        fwCloudId: fwcloud,
        id_obj: host,
        ipObjTypeId: 8,
        parentId: hostFolder.id,
        node_type: 'OIH',
      },
    ]);
    const calls: [string, object][] = [
      ['/ipobj/where', { id: cloud.ipobjs.get('address').id, type: 5 }],
      ['/ipobj/group/where', { id: cloud.ipobjGroup.id }],
      ['/ipobj/mark/where', { mark: cloud.mark.id }],
      ['/interface/where', { id, type: 10 }],
      ['/vpn/openvpn/where', { openvpn: cloud.openvpnClients.get('OpenVPN-Cli-3').id }],
      ['/vpn/openvpn/prefix/where', { prefix: cloud.openvpnPrefix.id }],
      ['/vpn/wireguard/where', { wireguard: cloud.wireguardClients.get('WireGuard-Cli-3').id }],
      ['/vpn/wireguard/prefix/where', { prefix: cloud.wireguardPrefix.id }],
      ['/vpn/ipsec/where', { ipsec: cloud.ipsecClients.get('IPSec-Cli-3').id }],
      ['/vpn/ipsec/prefix/where', { prefix: cloud.ipsecPrefix.id }],
      ['/ipobj/get', { id: cloud.ipobjs.get('address').id }],
      ['/ipobj/group/get', { id: cloud.ipobjGroup.id }],
      ['/ipobj/mark/get', { mark: cloud.mark.id }],
      ['/interface/fw/get', { id, firewall: cloud.firewall.id }],
      ['/interface/host/get', { id: hostInterface, host }],
    ];
    for (const [path, body] of calls) {
      const response = await request(testSuite.app.express)
        .put(path)
        .set('Cookie', session.cookie)
        .send({ fwcloud, ...body });
      expect(response.status, `${path}: ${JSON.stringify(response.body)}`).to.equal(200);
    }

    await request(testSuite.app.express)
      .put('/vpn/openvpn/where')
      .set('Cookie', session.cookie)
      .send({ fwcloud, openvpn: cloud.openvpnServer.id })
      .expect(204);
    expect(lock.called).to.equal(false);
    expect((await User.findOneByOrFail({ id: account.user.id })).confirmation_token).to.equal(null);
  });

  it('keeps Where used scoped to the assigned cloud and excludes private keys', async () => {
    const cloud = await new FwCloudFactory().make();
    const other = await new FwCloudFactory().make();
    await assignClouds(account, [cloud.fwcloud]);
    const shared = cloud.ipobjs.get('network');
    shared.fwCloudId = null;
    await shared.save();
    cloud.wireguardServer.private_key = 'test-only-key';
    await cloud.wireguardServer.save();
    await WireGuardOption.create({
      wireGuardId: other.wireguardServer.id,
      ipObjId: shared.id,
      name: 'Address',
      order: 2,
      scope: 0,
    }).save();
    const put = (path: string, body: object) =>
      request(testSuite.app.express)
        .put(path)
        .set('Cookie', session.cookie)
        .send({ fwcloud: cloud.fwcloud.id, ...body });

    const response = await put('/ipobj/where', { id: shared.id, type: 7 }).expect(200);
    const refs = response.body.restrictions.IpobjInWireguard;
    expect(refs).to.have.length(1);
    expect(refs[0]).to.include({ id: cloud.wireguardServer.id, cloud_id: cloud.fwcloud.id });
    expect(refs[0]).not.to.have.property('private_key');
    await put('/ipobj/where', { fwcloud: other.fwcloud.id, id: shared.id, type: 7 }).expect(400);
    await put('/vpn/wireguard/where', { wireguard: other.wireguardServer.id }).expect(400);
    await put('/vpn/wireguard/where', {
      wireguard: cloud.wireguardServer.id,
      fwcloud: null,
    }).expect(400);
    await put('/interface/fw/get', {
      id: other.interfaces.get('firewall-interface1').id,
      firewall: cloud.firewall.id,
    }).expect(400);
    await put('/vpn/wireguard/info/get', { wireguard: cloud.wireguardServer.id }).expect(403);
  });

  it('does not grant access to unassigned resources or mismatched resource paths', async () => {
    const other = await securityResource('unassigned operation');
    for (const path of [
      `/fwclouds/${other.fwcloud.id}/firewalls/${other.firewall.id}/routingTables`,
      `/fwclouds/${resource.fwcloud.id}/firewalls/${resource.firewall.id}/routingTables/${other.table.id}`,
    ]) {
      const response = await request(testSuite.app.express).get(path).set('Cookie', session.cookie);
      expect([401, 404]).to.include(response.status);
    }
  });

  it('fails closed on unclassified operations, including GET compilation and personal changes', async () => {
    const base = `/fwclouds/${resource.fwcloud.id}/firewalls/${resource.firewall.id}/routingTables/${resource.table.id}`;
    const lock = sandbox.spy(FwCloud, 'updateFwcloudLock');
    for (const [method, path] of [
      ['GET', `${base}/routes/compile`],
      ['PUT', base],
      ['DELETE', base],
      ['PUT', '/user/changepass'],
      ['GET', '/updates'],
      ['GET', '/unknown/get'],
    ]) {
      const response = await request(testSuite.app.express)
        [method.toLowerCase()](path)
        .set('Cookie', session.cookie)
        .send({})
        .expect(403);
      expect(response.body.fwcErr).to.equal(7013);
      expect(response.body).not.to.have.property('fwc_confirm_token');
    }
    expect(lock.called).to.equal(false);
    expect((await User.findOneByOrFail({ id: account.user.id })).confirmation_token).to.equal(null);
  });

  it('allows viewer logout without unlocking clouds', async () => {
    const unlock = sandbox.spy(FwCloud, 'unlockAllLockedFwclouds');
    await request(testSuite.app.express)
      .post('/user/logout')
      .set('Cookie', session.cookie)
      .send({})
      .expect(204);
    expect(unlock.called).to.equal(false);
  });
});
