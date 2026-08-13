import sinon from 'sinon';
import { describeName, expect, testSuite } from '../../../mocha/global-setup';
import { AbstractApplication } from '../../../../src/fonaments/abstract-application';
import db from '../../../../src/database/database-manager';
import { FwCloudFactory, FwCloudProduct } from '../../../utils/fwcloud-factory';
import { createUser } from '../../../utils/utils';
import { makeFirewallProfileDraftAttributes } from '../../../utils/firewall-profile-draft-factory';
import StringHelper from '../../../../src/utils/string.helper';
import { User } from '../../../../src/models/user/User';
import { AuditLog } from '../../../../src/models/audit/AuditLog';
import { Firewall } from '../../../../src/models/firewall/Firewall';
import { Cluster } from '../../../../src/models/firewall/Cluster';
import { Interface } from '../../../../src/models/interface/Interface';
import { PolicyRule } from '../../../../src/models/policy/PolicyRule';
import { Tree } from '../../../../src/models/tree/Tree';
import { FirewallProfileDraft } from '../../../../src/models/firewall-profile-draft/firewall-profile-draft.model';
import {
  FIREWALL_PROFILE_DRAFT_ORCHESTRATION_AUDIT_CALLS,
  FirewallProfileDraftStateService,
} from '../../../../src/models/firewall-profile-draft/firewall-profile-draft-state.service';
import { TargetOrchestrationService } from '../../../../src/models/firewall-profile-draft/target-orchestration.service';
import {
  TargetOrchestrationAlreadyStartedError,
  TargetOrchestrationInvalidStateError,
} from '../../../../src/models/firewall-profile-draft/target-orchestration.errors';

describe(describeName('TargetOrchestrationService Unit Tests'), () => {
  let app: AbstractApplication;
  let service: TargetOrchestrationService;
  let fwc: FwCloudProduct;
  let user: User;
  const draftIds: number[] = [];
  const stubs: sinon.SinonStub[] = [];

  before(async () => {
    app = testSuite.app;
    service = await app.getService<TargetOrchestrationService>(TargetOrchestrationService.name);
  });

  beforeEach(async () => {
    await testSuite.resetDatabaseData();
    fwc = await new FwCloudFactory().make();
    await Tree.createAllTreeCloud(fwc.fwcloud);

    user = await createUser({ role: 0 });
    user.fwClouds = [fwc.fwcloud];
    await db.getSource().manager.getRepository(User).save(user);
  });

  afterEach(async () => {
    for (const stub of stubs.splice(0)) {
      stub.restore();
    }
    for (const id of draftIds.splice(0)) {
      await db.getSource().manager.getRepository(FirewallProfileDraft).delete(id);
    }
  });

  function firewallProposal(overrides: Record<string, unknown> = {}): Record<string, unknown> {
    return {
      name: `Assisted Profile FW ${StringHelper.randomize(8)}`,
      description: null,
      scope: 'generic',
      targetKind: 'firewall',
      category: 'Assisted Profile',
      model: {
        compatibility: { targetKinds: ['firewall'] },
        provision: {
          interfaces: [
            { name: 'WAN', role: 'wan' },
            { name: 'LAN', role: 'lan' },
          ],
          rules: [{ chain: 'forward', action: 'accept', inRole: 'lan', outRole: 'wan' }],
        },
      },
      ...overrides,
    };
  }

  function clusterProposal(overrides: Record<string, unknown> = {}): Record<string, unknown> {
    return firewallProposal({
      name: `Assisted Profile CL ${StringHelper.randomize(8)}`,
      targetKind: 'cluster',
      model: {
        compatibility: { targetKinds: ['cluster'] },
        provision: {
          interfaces: [
            { name: 'WAN', role: 'wan' },
            { name: 'LAN', role: 'lan' },
          ],
          rules: [{ chain: 'forward', action: 'accept', inRole: 'lan', outRole: 'wan' }],
        },
        topologyPreset: {
          nodes: [
            { name: 'node1', role: 'primary' },
            { name: 'node2', role: 'secondary' },
          ],
        },
      },
      ...overrides,
    });
  }

  async function makeDraft(
    status: 'validated' | 'preview_ok' | 'apply_pending',
    proposal: Record<string, unknown>,
    overrides: Partial<FirewallProfileDraft> = {},
  ): Promise<FirewallProfileDraft> {
    const repository = db.getSource().manager.getRepository(FirewallProfileDraft);
    const draft = repository.create(
      makeFirewallProfileDraftAttributes(fwc.fwcloud.id, status, {
        proposal,
        createdBy: user.id,
        updatedBy: user.id,
        ...overrides,
      }),
    );
    const saved = await repository.save(draft);
    draftIds.push(saved.id);
    return saved;
  }

  async function countFirewalls(): Promise<number> {
    return db
      .getSource()
      .manager.getRepository(Firewall)
      .count({ where: { fwCloudId: fwc.fwcloud.id } });
  }

  async function countClusters(): Promise<number> {
    return db
      .getSource()
      .manager.getRepository(Cluster)
      .count({ where: { fwCloudId: fwc.fwcloud.id } });
  }

  async function auditEntriesFor(call: string, draftId: number): Promise<AuditLog[]> {
    const entries = await db.getSource().manager.getRepository(AuditLog).find({ where: { call } });
    return entries.filter((entry) => entry.data.includes(`"draftId":${draftId}`));
  }

  describe('successful orchestration', () => {
    it('creates the firewall, its interfaces and applies the profile, in order, with a full audit trail', async () => {
      const before = await countFirewalls();
      const draft = await makeDraft('apply_pending', firewallProposal());

      const result = await service.execute(draft, { fwCloudId: fwc.fwcloud.id, userId: user.id });

      expect(result.succeeded).to.equal(true);
      expect(result.targetKind).to.equal('firewall');
      expect(result.draft.status).to.equal('applied');

      const steps = result.draft.stepLog!.map((entry) => entry.step);
      expect(steps).to.deep.equal([
        'target_created',
        'interfaces_created',
        'profile_applied',
        'applied',
      ]);
      expect(
        result.draft.stepLog!.slice(0, 3).every((entry) => entry.status === 'success'),
      ).to.equal(true);

      const targetIds = result.draft.targetIds!;
      expect(targetIds.firewallId).to.be.a('number');
      expect(targetIds.interfaceIds).to.have.length(2);
      expect(targetIds.profileId).to.be.a('number');

      expect(await countFirewalls()).to.equal(before + 1);

      const firewall = await db
        .getSource()
        .manager.getRepository(Firewall)
        .findOne({ where: { id: targetIds.firewallId } });
      expect(firewall).to.not.equal(null);
      expect(firewall!.fwCloudId).to.equal(fwc.fwcloud.id);

      const interfaces = await db
        .getSource()
        .manager.getRepository(Interface)
        .find({ where: { firewallId: targetIds.firewallId } });
      expect(interfaces.map((iface) => iface.name)).to.include.members(['WAN', 'LAN']);

      for (const call of Object.values(FIREWALL_PROFILE_DRAFT_ORCHESTRATION_AUDIT_CALLS)) {
        const entries = await auditEntriesFor(call, draft.id);
        expect(entries, `expected exactly one audit row for ${call}`).to.have.length(1);
      }
    });

    it('creates the cluster, its master/node ids and the master interfaces, then applies the profile', async () => {
      const draft = await makeDraft('apply_pending', clusterProposal());

      const result = await service.execute(draft, { fwCloudId: fwc.fwcloud.id, userId: user.id });

      expect(result.succeeded).to.equal(true);
      expect(result.targetKind).to.equal('cluster');
      expect(result.draft.status).to.equal('applied');

      const targetIds = result.draft.targetIds!;
      expect(targetIds.clusterId).to.be.a('number');
      expect(targetIds.nodeIds).to.have.length(2);
      expect(targetIds.masterFirewallId).to.equal(targetIds.nodeIds![0]);
      expect(targetIds.interfaceIds).to.have.length(2);

      expect(await countClusters()).to.equal(1);

      const interfaces = await db
        .getSource()
        .manager.getRepository(Interface)
        .find({ where: { firewallId: targetIds.masterFirewallId } });
      expect(interfaces.map((iface) => iface.name)).to.include.members(['WAN', 'LAN']);
    });
  });

  describe('nothing is created before confirmation', () => {
    it('refuses to run against a draft that is not apply_pending, and creates nothing', async () => {
      const before = await countFirewalls();
      const draft = await makeDraft('preview_ok', firewallProposal());

      await expect(
        service.execute(draft, { fwCloudId: fwc.fwcloud.id, userId: user.id }),
      ).to.be.rejectedWith(TargetOrchestrationInvalidStateError);

      expect(await countFirewalls()).to.equal(before);
      const reloaded = await db
        .getSource()
        .manager.getRepository(FirewallProfileDraft)
        .findOneByOrFail({ id: draft.id });
      expect(reloaded.status).to.equal('preview_ok');
      expect(reloaded.stepLog ?? []).to.have.length(0);
    });
  });

  describe('failure injection', () => {
    it('fails target creation, records apply_failed with no interfaces and no profile apply', async () => {
      const before = await countFirewalls();
      const stub = sinon
        .stub(Firewall, 'insertFirewall')
        .rejects(new Error('Forced target failure'));
      stubs.push(stub);

      const draft = await makeDraft('apply_pending', firewallProposal());
      const result = await service.execute(draft, { fwCloudId: fwc.fwcloud.id, userId: user.id });

      expect(result.succeeded).to.equal(false);
      expect(result.failedStep).to.equal('target_created');
      expect(result.errorCode).to.equal('TARGET_CREATION_FAILED');
      expect(result.draft.status).to.equal('apply_failed');
      expect(result.draft.targetIds ?? null).to.satisfy(
        (value: unknown) => value === null || !(value as Record<string, unknown>).firewallId,
      );
      expect(await countFirewalls()).to.equal(before);

      const failureStep = result.draft.stepLog!.find((entry) => entry.step === 'target_created');
      expect(failureStep?.status).to.equal('failed');
      expect(failureStep?.errorCode).to.equal('TARGET_CREATION_FAILED');
    });

    it('fails partway through interface creation, keeps the target and the interfaces already created', async () => {
      const interfaceRepo = db.getSource().manager.getRepository(Interface);
      const originalSave = interfaceRepo.save.bind(interfaceRepo);
      let calls = 0;
      const stub = sinon.stub(interfaceRepo, 'save').callsFake(async (entity: any) => {
        calls += 1;
        if (calls === 3) {
          throw new Error('Forced interface failure');
        }
        return originalSave(entity);
      });
      stubs.push(stub as unknown as sinon.SinonStub);

      const draft = await makeDraft(
        'apply_pending',
        firewallProposal({
          model: {
            compatibility: { targetKinds: ['firewall'] },
            provision: {
              interfaces: [
                { name: 'WAN', role: 'wan' },
                { name: 'LAN', role: 'lan' },
                { name: 'DMZ', role: 'dmz' },
              ],
              rules: [],
            },
          },
        }),
      );

      const result = await service.execute(draft, { fwCloudId: fwc.fwcloud.id, userId: user.id });

      expect(result.succeeded).to.equal(false);
      expect(result.failedStep).to.equal('interfaces_created');
      expect(result.errorCode).to.equal('INTERFACE_CREATION_FAILED');
      expect(result.draft.status).to.equal('apply_failed');

      const targetIds = result.draft.targetIds!;
      expect(targetIds.firewallId).to.be.a('number');
      expect(targetIds.interfaceIds).to.have.length(2);

      const createdInterfaces = await db
        .getSource()
        .manager.getRepository(Interface)
        .find({ where: { firewallId: targetIds.firewallId } });
      expect(createdInterfaces.map((iface) => iface.name)).to.include.members(['WAN', 'LAN']);
      expect(createdInterfaces.map((iface) => iface.name)).to.not.include('DMZ');

      const firewall = await db
        .getSource()
        .manager.getRepository(Firewall)
        .findOne({ where: { id: targetIds.firewallId } });
      expect(
        firewall,
        'the firewall created before the failure must not be rolled back',
      ).to.not.equal(null);

      const failureStep = result.draft.stepLog!.find(
        (entry) => entry.step === 'interfaces_created',
      );
      expect(failureStep?.resourceIds?.interfaceIds).to.have.length(2);
    });

    it('fails profile apply after interfaces already succeeded, keeping target and interfaces', async () => {
      // `insertDefaultPolicy` (part of target creation) also calls
      // `insertPolicy_r` for its own default rules, so the stub must only
      // reject the provisioning rule the profile-apply step inserts
      // (identified by the comment `provisionPolicyFromProfile` gives it),
      // otherwise target creation itself would fail first.
      const original = PolicyRule.insertPolicy_r.bind(PolicyRule);
      const stub = sinon.stub(PolicyRule, 'insertPolicy_r').callsFake(async (policyRData: any) => {
        if (policyRData?.comment === 'Provisioned by replication profile.') {
          throw new Error('Forced rule failure');
        }
        return original(policyRData);
      });
      stubs.push(stub);

      const draft = await makeDraft('apply_pending', firewallProposal());
      const result = await service.execute(draft, { fwCloudId: fwc.fwcloud.id, userId: user.id });

      expect(result.succeeded).to.equal(false);
      expect(result.failedStep).to.equal('profile_applied');
      expect(result.errorCode).to.equal('PROFILE_APPLY_FAILED');
      expect(result.draft.status).to.equal('apply_failed');

      const targetIds = result.draft.targetIds!;
      expect(targetIds.firewallId).to.be.a('number');
      expect(targetIds.interfaceIds).to.have.length(2);

      const interfacesStep = result.draft.stepLog!.find(
        (entry) => entry.step === 'interfaces_created',
      );
      expect(interfacesStep?.status).to.equal('success');
      const profileStep = result.draft.stepLog!.find((entry) => entry.step === 'profile_applied');
      expect(profileStep?.status).to.equal('failed');

      const interfacesAuditEntries = await auditEntriesFor(
        FIREWALL_PROFILE_DRAFT_ORCHESTRATION_AUDIT_CALLS.interfaces_created,
        draft.id,
      );
      expect(interfacesAuditEntries).to.have.length(1);
    });
  });

  describe('no automatic retry or resume', () => {
    it('refuses to run again once the draft has left apply_pending', async () => {
      const draft = await makeDraft('apply_pending', firewallProposal());
      const first = await service.execute(draft, { fwCloudId: fwc.fwcloud.id, userId: user.id });
      expect(first.succeeded).to.equal(true);

      await expect(
        service.execute(first.draft, { fwCloudId: fwc.fwcloud.id, userId: user.id }),
      ).to.be.rejectedWith(TargetOrchestrationInvalidStateError);
    });

    it('refuses to resume a draft that already has orchestration progress recorded', async () => {
      const before = await countFirewalls();
      const draft = await makeDraft('apply_pending', firewallProposal(), {
        stepLog: [
          {
            step: 'target_created',
            status: 'success',
            timestamp: new Date().toISOString(),
            targetKind: 'firewall',
            resourceIds: { firewallId: 999999 },
          },
        ],
      });

      await expect(
        service.execute(draft, { fwCloudId: fwc.fwcloud.id, userId: user.id }),
      ).to.be.rejectedWith(TargetOrchestrationAlreadyStartedError);

      // No new firewall was created by this refused call.
      expect(await countFirewalls()).to.equal(before);
    });
  });
});
