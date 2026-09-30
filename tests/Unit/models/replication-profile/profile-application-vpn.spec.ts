import { strict as assert } from 'node:assert';
import sinon from 'sinon';
import db from '../../../../src/database/database-manager';
import { ReplicationProfilePolicy } from '../../../../src/policies/replication-profile.policy';
import { ProfileApplicationService } from '../../../../src/models/replication-profile/profile-application.service';
import { PolicyReplicationService } from '../../../../src/models/replication-profile/policy-replication.service';
import * as pkiProvisioning from '../../../../src/models/replication-profile/profile-vpn-pki-provisioning.service';
import * as configProvisioning from '../../../../src/models/replication-profile/profile-vpn-config-provisioning.service';
import { vpnConnection } from '../../../utils/vpn-template-fixtures';

const connection = (
  id: string,
  kind: 'openvpn' | 'wireguard' | 'ipsec',
  role: 'server' | 'client' = 'client',
) => vpnConnection({ id, name: id, kind, role });

describe('Profile application: VPN references', () => {
  let sandbox: sinon.SinonSandbox;
  let service: any;
  let provision: sinon.SinonStub;
  let pki: sinon.SinonStub;
  let configs: sinon.SinonStub;
  let ownedRows: Array<{ id: number }>;
  let ownerQueries: Array<{ sql: string; params: unknown[] }>;
  let connections: any[];
  let target: { kind: 'firewall' | 'cluster'; id: number };

  const request = (mode: string, extra: Record<string, unknown> = {}): any => ({
    fwCloudId: 7,
    profileCode: 'template',
    profileVersion: 1,
    replication: { target: { kind: target.kind, id: target.id }, mode },
    ...extra,
  });

  beforeEach(() => {
    sandbox = sinon.createSandbox();
    connections = [connection('office', 'openvpn')];
    target = { kind: 'firewall', id: 12 };
    ownedRows = [];
    ownerQueries = [];
    service = Object.create(ProfileApplicationService.prototype);
    sandbox
      .stub(db, 'getSource')
      .returns({ manager: { getRepository: () => ({ findOne: async () => ({ id: 7 }) }) } } as any);
    sandbox.stub(db, 'getQuery').returns({
      query: (sql: string, params: unknown[], callback: (e: unknown, rows: unknown[]) => void) => {
        ownerQueries.push({ sql, params });
        callback(null, ownedRows);
      },
    } as any);
    sandbox.stub(ReplicationProfilePolicy, 'apply').resolves({ authorize() {} } as any);
    sandbox.stub(service, 'loadUsableProfile').callsFake(async () => ({
      profile: { code: 'template', version: 1 },
      model: {
        provision: { interfaces: [{ name: 'wan' }], rules: [] },
        vpnTemplate: { cas: [], certificates: [], connections },
      },
    }));
    sandbox.stub(service, 'validateTarget').callsFake(async () => ({ ...target }));
    sandbox.stub(service, 'auditAttempt').resolves();
    provision = sandbox.stub().resolves({ applied: true, errors: [], warnings: [] });
    service._policyReplicationService = { provisionPolicyFromProfile: provision };
    pki = sandbox
      .stub(pkiProvisioning, 'provisionVpnTemplatePki')
      .callsFake(async (_db, _cloud, _cas, _certs, _errors, rollback) => ({
        caIds: new Map(),
        certificateIds: new Map(),
        rollback,
      }));
    configs = sandbox.stub(configProvisioning, 'provisionVpnTemplateConfigs').resolves(new Map());
  });
  afterEach(() => sandbox.restore());

  const optionsOf = () => provision.firstCall.args[4];

  describe('preview (dry run)', () => {
    it('lets rules reference the VPN clients a real apply would create, without creating anything', async () => {
      connections = [connection('office', 'openvpn'), connection('branch', 'wireguard')];
      const result = await service.apply({ user: {} }, request('dry_run'));

      assert.deepEqual(result.errors, []);
      assert.deepEqual(
        [...optionsOf().vpnConfigIds.entries()].map(([id, config]: any) => [id, config.protocol]),
        [
          ['office', 'openvpn'],
          ['branch', 'wireguard'],
        ],
      );
      assert.equal(pki.callCount, 0);
      assert.equal(configs.callCount, 0);
    });

    it('lets rules reference IPsec clients of a server of the profile', async () => {
      connections = [
        connection('office', 'ipsec', 'server'),
        { ...connection('laptop', 'ipsec'), serverId: 'office' },
      ];
      const result = await service.apply({ user: {} }, request('dry_run'));

      assert.deepEqual(result.errors, []);
      assert.deepEqual(
        [...optionsOf().vpnConfigIds.entries()].map(([id, config]: any) => [id, config.protocol]),
        [
          ['office', 'ipsec'],
          ['laptop', 'ipsec'],
        ],
      );
    });

    it('reports what a real apply would refuse, so the preview never promises more than it can do', async () => {
      connections = [connection('office', 'openvpn'), connection('site', 'ipsec')];
      const result = await service.apply({ user: {} }, request('dry_run'));

      assert.equal(optionsOf().vpnConfigIds.has('office'), true);
      assert.equal(optionsOf().vpnConfigIds.has('site'), false);
      assert.ok(result.errors.some((error: string) => error.includes('IPsec connection "site"')));
      assert.ok(result.errors.some((error: string) => error.includes('pre-shared key')));
      assert.equal(provision.callCount, 1, 'the rest of the preview is still computed');
    });

    it('lets rules of a cluster reference the VPN clients its master node would hold', async () => {
      target = { kind: 'cluster', id: 3 };
      sandbox.stub(service, 'vpnFirewallIdOf').resolves(20);
      const result = await service.apply({ user: {} }, request('dry_run'));

      assert.deepEqual(result.errors, []);
      assert.deepEqual([...optionsOf().vpnConfigIds.keys()], ['office']);
    });

    it('reports a cluster without a master node instead of an unresolved VPN client', async () => {
      target = { kind: 'cluster', id: 3 };
      sandbox.stub(service, 'vpnFirewallIdOf').resolves(null);
      const result = await service.apply({ user: {} }, request('dry_run'));

      assert.ok(result.errors.some((error: string) => error.includes('no master node')));
      assert.equal(optionsOf().vpnConfigIds, undefined);
    });
  });

  describe('VPN configs supplied by the caller', () => {
    it('rejects ids that are not VPN configs of this FWCloud and target firewall', async () => {
      ownedRows = [];
      const result = await service.apply(
        { user: {} },
        request('replace_defaults', { vpnConnectionIds: { office: 999 } }),
      );

      assert.equal(result.applied, false);
      assert.ok(result.errors.some((error: string) => error.includes('"office"')));
      assert.equal(provision.callCount, 0, 'nothing is written on a rejected reference');
      assert.deepEqual(ownerQueries[0].params, [999, 12, 7]);
      assert.match(ownerQueries[0].sql, /FROM openvpn/);
    });

    it('is checked in a preview too', async () => {
      const result = await service.apply(
        { user: {} },
        request('dry_run', { vpnConnectionIds: { office: 999 } }),
      );

      assert.ok(result.errors.length > 0);
    });

    it('rejects ids for connections the template does not define', async () => {
      const result = await service.apply(
        { user: {} },
        request('replace_defaults', { vpnConnectionIds: { ghost: 5 } }),
      );

      assert.ok(result.errors.some((error: string) => error.includes('"ghost"')));
      assert.equal(ownerQueries.length, 0);
      assert.equal(provision.callCount, 0);
    });

    it('checks them against the master node for a cluster target', async () => {
      target = { kind: 'cluster', id: 3 };
      sandbox.stub(service, 'vpnFirewallIdOf').resolves(20);
      ownedRows = [{ id: 5 }];
      const result = await service.apply(
        { user: {} },
        request('replace_defaults', { vpnConnectionIds: { office: 5 } }),
      );

      assert.deepEqual(result.errors, []);
      assert.deepEqual(ownerQueries[0].params, [5, 20, 7]);
    });

    it('uses them when they belong to the target firewall', async () => {
      ownedRows = [{ id: 55 }];
      const result = await service.apply(
        { user: {} },
        request('replace_defaults', { vpnConnectionIds: { office: 55 } }),
      );

      assert.deepEqual(result.errors, []);
      assert.deepEqual(
        [...optionsOf().vpnConfigIds.entries()],
        [['office', { id: 55, protocol: 'openvpn' }]],
      );
    });
  });

  describe('real apply', () => {
    it('creates the VPN configs of a cluster on its master node', async () => {
      target = { kind: 'cluster', id: 3 };
      sandbox.stub(service, 'vpnFirewallIdOf').resolves(20);
      configs.resolves(new Map([['office', { id: 41, protocol: 'openvpn' }]]));

      const result = await service.apply({ user: {} }, request('replace_defaults'));

      assert.deepEqual(result.errors, []);
      assert.equal(configs.firstCall.args[2], 20);
      assert.deepEqual(
        [...optionsOf().vpnConfigIds.entries()],
        [['office', { id: 41, protocol: 'openvpn' }]],
      );
    });

    it('writes no policy at all when the VPN could not be created', async () => {
      const rollbackUndo = sandbox.stub().resolves();
      pki.callsFake(async (_db, _cloud, _cas, _certs, errors, rollback) => {
        rollback.add('CA', rollbackUndo);
        errors.push('VPN CA "Template CA": easy-rsa failed');
        return { caIds: new Map(), certificateIds: new Map(), rollback };
      });

      const result = await service.apply({ user: {} }, request('replace_defaults'));

      assert.equal(provision.callCount, 0);
      assert.equal(result.applied, false);
      assert.deepEqual(result.errors, ['VPN CA "Template CA": easy-rsa failed']);
      assert.equal(rollbackUndo.callCount, 1);
    });
  });
});

describe('PolicyReplicationService: VPN client references', () => {
  it('turns a VPN client into the relation row of its protocol, previews included', () => {
    const service: any = Object.create(PolicyReplicationService.prototype);
    const result: any = { errors: [] };
    const resolved = service.resolveVpnClientObject(
      { kind: 'vpnClient', vpnId: 'office', name: 'Office' },
      { label: 'Rule 1 source' },
      new Map([['office', { id: 0, protocol: 'openvpn' }]]),
      result,
    );

    assert.deepEqual(resolved.ref.vpnRelation, { table: 'policy_r__openvpn', column: 'openvpn' });
    assert.equal(resolved.type, 311);
    assert.deepEqual(result.errors, []);
  });
});
