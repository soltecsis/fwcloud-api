import { strict as assert } from 'node:assert';
import sinon from 'sinon';
import { mkdtemp, mkdir, writeFile, access, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import config from '../../../../src/config/config';
import { Ca } from '../../../../src/models/vpn/pki/Ca';
import { Crt } from '../../../../src/models/vpn/pki/Crt';
import { CaPrefix } from '../../../../src/models/vpn/pki/CaPrefix';
import { Tree } from '../../../../src/models/tree/Tree';
import { ProfileVpnRollback } from '../../../../src/models/replication-profile/profile-vpn-rollback';
import {
  provisionVpnTemplatePki,
  ensureWireGuardTechnicalCertificate,
} from '../../../../src/models/replication-profile/profile-vpn-pki-provisioning.service';

// No running database or EasyRSA required: exercise failure boundaries with real temporary PKI files.
describe('VPN application rollback', () => {
  let sandbox: sinon.SinonSandbox;
  let directory: string;
  let caIds: Set<number>;
  let certificates: Map<number, number>;
  let tree: sinon.SinonStub;
  let easyRsa: sinon.SinonStub;
  let nextCa: number;
  let nextCertificate: number;
  const dbCon = {
    query: (
      _sql: string,
      _params: unknown[],
      callback: (error: unknown, rows: Array<{ id: number }>) => void,
    ) => callback(null, [{ id: 1 }]),
  };
  const cas = [{ id: 'ca', name: 'Template CA', validityDays: 365 }];
  const certs = [
    { id: 'cert', name: 'Client', caId: 'ca', kind: 'client' as const, validityDays: 365 },
  ];

  beforeEach(async () => {
    sandbox = sinon.createSandbox();
    directory = await mkdtemp(join(tmpdir(), 'profile-pki-rollback-'));
    nextCa = 100;
    nextCertificate = 200;
    caIds = new Set([99]); // Existing CA and its certificate must survive.
    certificates = new Map([[199, 99]]);
    sandbox.stub(config, 'get').callThrough().withArgs('pki').returns({ data_dir: directory });
    sandbox.stub(Ca, 'createCA').callsFake(async () => {
      caIds.add(++nextCa);
      return nextCa;
    });
    sandbox.stub(Crt, 'existsCRT').resolves(false);
    sandbox.stub(Crt, 'createCRT').callsFake(async (req) => {
      certificates.set(++nextCertificate, req.body.ca);
      return nextCertificate;
    });
    sandbox.stub(Crt, 'deleteCRT').callsFake(async (req) => {
      certificates.delete(req.body.crt);
    });
    sandbox.stub(Ca, 'deleteCA').callsFake(async (req) => {
      assert.equal(
        [...certificates.values()].includes(req.body.ca),
        false,
        'certificates must be removed before their CA',
      );
      caIds.delete(req.body.ca);
    });
    sandbox.stub(CaPrefix, 'applyCrtPrefixes').resolves();
    sandbox.stub(Tree, 'newNode').resolves(10);
    tree = sandbox.stub(Tree, 'deleteObjFromTree').resolves();
    easyRsa = sandbox.stub(Ca, 'runEasyRsaCmd').callsFake(async (req) => {
      const root = join(directory, '7', String(req.caId));
      await mkdir(root, { recursive: true });
      await writeFile(join(root, 'private.key'), 'test fixture');
    });
  });

  afterEach(async () => {
    sandbox.restore();
    await rm(directory, { recursive: true, force: true });
  });

  for (const command of ['init-pki', 'build-ca', 'gen-crl', 'gen-dh', 'build-client-full']) {
    it(`cleans rows, keys and tree nodes when ${command} fails after creating a row`, async () => {
      easyRsa.callsFake(async (req, cmd) => {
        const root = join(directory, '7', String(req.caId));
        await mkdir(root, { recursive: true });
        await writeFile(join(root, 'private.key'), 'test fixture');
        if (cmd === command) throw new Error('injected EasyRSA failure');
      });
      const rollback = new ProfileVpnRollback();
      const errors: string[] = [];
      await provisionVpnTemplatePki(dbCon, 7, cas, certs, errors, rollback);
      assert.ok(errors.some((error) => error.includes('injected EasyRSA failure')));
      await rollback.rollback(errors);
      assert.deepEqual([...caIds], [99]);
      assert.deepEqual([...certificates], [[199, 99]]);
      assert.ok(tree.calledWith(7, 101, 300));
      await assert.rejects(access(join(directory, '7', '101')));
      const count = tree.callCount;
      await rollback.rollback(errors);
      assert.equal(tree.callCount, count, 'a completed rollback must not delete resources twice');
    });
  }

  it('cleans certificates even if rebuilding their tree fails', async () => {
    (CaPrefix.applyCrtPrefixes as sinon.SinonStub).rejects(new Error('tree failure'));
    const rollback = new ProfileVpnRollback();
    const errors: string[] = [];
    await provisionVpnTemplatePki(dbCon, 7, cas, certs, errors, rollback);
    await rollback.rollback(errors);
    assert.deepEqual([...certificates], [[199, 99]]);
    assert.deepEqual([...caIds], [99]);
  });

  it('includes WireGuard technical PKI in the same rollback', async () => {
    const errors: string[] = [];
    const pki = await provisionVpnTemplatePki(dbCon, 7, [], [], errors);
    await ensureWireGuardTechnicalCertificate(dbCon, 7, pki, 'server', 'wg-server', errors);
    await ensureWireGuardTechnicalCertificate(dbCon, 7, pki, 'client', 'wg-client', errors);
    assert.equal(caIds.size, 2);
    assert.equal(certificates.size, 3);
    await pki.rollback.rollback(errors);
    assert.deepEqual([...caIds], [99]);
    assert.deepEqual([...certificates], [[199, 99]]);
    assert.deepEqual(errors, []);
  });

  it('keeps PKI after successful provisioning until a rollback is requested', async () => {
    const errors: string[] = [];
    await provisionVpnTemplatePki(dbCon, 7, cas, certs, errors);
    assert.deepEqual(errors, []);
    assert.equal(caIds.size, 2);
    assert.equal(certificates.size, 2);
    assert.equal(tree.callCount, 0);
    await access(join(directory, '7', '101', 'private.key'));
  });

  it('continues independent cleanup and reports failures without losing the original error', async () => {
    const rollback = new ProfileVpnRollback();
    const order: string[] = [];
    rollback.add('CA', async () => {
      order.push('CA');
    });
    rollback.add('certificate', async () => {
      order.push('certificate');
      throw new Error('database unavailable');
    });
    rollback.add('VPN config', async () => {
      order.push('VPN config');
    });
    const errors = ['policy failed'];
    await rollback.rollback(errors);
    assert.deepEqual(order, ['VPN config', 'certificate', 'CA']);
    assert.deepEqual(errors, ['policy failed', 'VPN rollback (certificate): database unavailable']);
  });
});

import db from '../../../../src/database/database-manager';
import { ReplicationProfilePolicy } from '../../../../src/policies/replication-profile.policy';
import { ProfileApplicationService } from '../../../../src/models/replication-profile/profile-application.service';
import * as pkiProvisioning from '../../../../src/models/replication-profile/profile-vpn-pki-provisioning.service';
import { HttpException } from '../../../../src/fonaments/exceptions/http/http-exception';

describe('Profile application rollback boundary', () => {
  let sandbox: sinon.SinonSandbox;
  let service: any;
  let undo: sinon.SinonStub;
  let provision: sinon.SinonStub;
  let pki: sinon.SinonStub;
  const request: any = {
    fwCloudId: 7,
    profileCode: 'template',
    profileVersion: 1,
    replication: { target: { kind: 'firewall', id: 12 }, mode: 'replace_defaults' },
  };

  beforeEach(() => {
    sandbox = sinon.createSandbox();
    service = Object.create(ProfileApplicationService.prototype);
    sandbox
      .stub(db, 'getSource')
      .returns({ manager: { getRepository: () => ({ findOne: async () => ({ id: 7 }) }) } } as any);
    sandbox.stub(db, 'getQuery').returns({} as any);
    sandbox.stub(ReplicationProfilePolicy, 'apply').resolves({ authorize() {} } as any);
    sandbox.stub(service, 'loadUsableProfile').resolves({
      profile: { code: 'template', version: 1 },
      model: {
        provision: { interfaces: [{ name: 'wan' }], rules: [] },
        vpnTemplate: { cas: [], certificates: [], connections: [] },
      },
    });
    sandbox.stub(service, 'validateTarget').resolves({ kind: 'firewall', id: 12 });
    sandbox.stub(service, 'auditAttempt').resolves();
    provision = sandbox.stub().resolves({ applied: true, errors: [] });
    service._policyReplicationService = { provisionPolicyFromProfile: provision };
    undo = sandbox.stub().resolves();
    pki = sandbox
      .stub(pkiProvisioning, 'provisionVpnTemplatePki')
      .callsFake(async (_db, _cloud, _cas, _certs, _errors, rollback) => {
        rollback.add('CA', undo);
        return { caIds: new Map(), certificateIds: new Map(), rollback };
      });
  });
  afterEach(() => sandbox.restore());

  for (const method of ['apply', 'provisionVpn'] as const) {
    for (const cleanupFails of [false, true]) {
      it(`${method} preserves the HTTP failure and audit details when cleanup ${cleanupFails ? 'fails' : 'succeeds'}`, async () => {
        const failure = new HttpException('PKI creation failed', 422);
        pki.callsFake(async (_db, _cloud, _cas, _certs, _errors, rollback) => {
          rollback.add('CA', undo);
          throw failure;
        });
        if (cleanupFails) undo.rejects(new Error('cleanup failed'));

        let thrown: unknown;
        await assert.rejects(service[method]({ user: {} }, request), (error) => {
          thrown = error;
          if (!cleanupFails) return error === failure;
          return (
            error instanceof HttpException &&
            error.status === 422 &&
            error.message === 'PKI creation failed | VPN rollback (CA): cleanup failed'
          );
        });
        assert.equal(undo.callCount, 1);
        assert.equal(service.auditAttempt.callCount, 1);
        assert.equal(service.auditAttempt.firstCall.args[6], thrown);
        assert.equal(provision.callCount, 0);
      });
    }
  }

  it('rolls back on returned policy errors and marks the application unsuccessful', async () => {
    provision.resolves({ applied: true, errors: ['invalid rule'] });
    const result = await service.apply({ user: {} }, request);
    assert.equal(result.applied, false);
    assert.deepEqual(result.errors, ['invalid rule']);
    assert.equal(undo.callCount, 1);
  });

  it('rolls back on exceptions while preserving the original failure', async () => {
    const failure = new Error('policy write failed');
    provision.rejects(failure);
    await assert.rejects(service.apply({ user: {} }, request), (error) => error === failure);
    assert.equal(undo.callCount, 1);
  });

  it('rolls back a partial PKI creation even if provisioning never returns', async () => {
    const failure = new Error('PKI tree unavailable');
    pki.callsFake(async (_db, _cloud, _cas, _certs, _errors, rollback) => {
      rollback.add('CA', undo);
      throw failure;
    });
    await assert.rejects(service.apply({ user: {} }, request), (error) => error === failure);
    assert.equal(undo.callCount, 1);
    assert.equal(provision.callCount, 0);
  });

  it('reports cleanup errors alongside the policy error', async () => {
    provision.resolves({ applied: false, errors: ['invalid rule'] });
    undo.rejects(new Error('cleanup failed'));
    const result = await service.apply({ user: {} }, request);
    assert.deepEqual(result.errors, ['invalid rule', 'VPN rollback (CA): cleanup failed']);
  });

  it('keeps resources on success and never creates PKI during preview', async () => {
    const result = await service.apply({ user: {} }, request);
    assert.equal(result.applied, true);
    assert.equal(undo.callCount, 0);
    pki.resetHistory();
    await service.apply(
      { user: {} },
      { ...request, replication: { ...request.replication, mode: 'dry_run' } },
    );
    assert.equal(pki.callCount, 0);
    assert.equal(undo.callCount, 0);
  });
});
