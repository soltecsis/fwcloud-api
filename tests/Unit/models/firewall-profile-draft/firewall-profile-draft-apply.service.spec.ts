import { describeName, expect, testSuite } from '../../../mocha/global-setup';
import { AbstractApplication } from '../../../../src/fonaments/abstract-application';
import db from '../../../../src/database/database-manager';
import { FwCloudFactory, FwCloudProduct } from '../../../utils/fwcloud-factory';
import { createUser } from '../../../utils/utils';
import { makeFirewallProfileDraftAttributes } from '../../../utils/firewall-profile-draft-factory';
import StringHelper from '../../../../src/utils/string.helper';
import { User } from '../../../../src/models/user/User';
import { AuditLog } from '../../../../src/models/audit/AuditLog';
import { Interface } from '../../../../src/models/interface/Interface';
import { Firewall } from '../../../../src/models/firewall/Firewall';
import { Tree } from '../../../../src/models/tree/Tree';
import { FirewallProfileDraft } from '../../../../src/models/firewall-profile-draft/firewall-profile-draft.model';
import { FirewallProfileDraftTransitionConflictError } from '../../../../src/models/firewall-profile-draft/firewall-profile-draft.errors';
import {
  FirewallProfileDraftApplyPreviewHashMismatchError,
  FirewallProfileDraftApplyTargetKindMismatchError,
} from '../../../../src/models/firewall-profile-draft/firewall-profile-draft-apply.errors';
import { TargetOrchestrationProposalError } from '../../../../src/models/firewall-profile-draft/target-orchestration.errors';
import { FirewallProfileDraftApplyService } from '../../../../src/models/firewall-profile-draft/firewall-profile-draft-apply.service';
import { PROFILE_APPLICATION_AUDIT_CALL } from '../../../../src/models/replication-profile/profile-application.service';
import { FIREWALL_PROFILE_DRAFT_TRANSITION_AUDIT_CALL } from '../../../../src/models/firewall-profile-draft/firewall-profile-draft-state.service';

describe(describeName('FirewallProfileDraftApplyService Unit Tests'), () => {
  let app: AbstractApplication;
  let service: FirewallProfileDraftApplyService;
  let fwc: FwCloudProduct;
  let user: User;
  const draftIds: number[] = [];

  before(async () => {
    app = testSuite.app;
    service = await app.getService<FirewallProfileDraftApplyService>(
      FirewallProfileDraftApplyService.name,
    );
  });

  beforeEach(async () => {
    await testSuite.resetDatabaseData();
    fwc = await new FwCloudFactory().make();

    user = await createUser({ role: 0 });
    user.fwClouds = [fwc.fwcloud];
    await db.getSource().manager.getRepository(User).save(user);
  });

  afterEach(async () => {
    for (const id of draftIds.splice(0)) {
      await db.getSource().manager.getRepository(FirewallProfileDraft).delete(id);
    }
  });

  const PREVIEW_HASH = 'test-preview-hash';

  function provisioningProposal(overrides: Record<string, unknown> = {}): Record<string, unknown> {
    return {
      name: `Assisted Profile ${StringHelper.randomize(8)}`,
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

  async function makeDraft(
    status: 'validated' | 'preview_ok' | 'apply_pending',
    overrides: Partial<FirewallProfileDraft> = {},
  ): Promise<FirewallProfileDraft> {
    const repository = db.getSource().manager.getRepository(FirewallProfileDraft);
    const draft = repository.create(
      makeFirewallProfileDraftAttributes(fwc.fwcloud.id, status, {
        proposal: provisioningProposal(),
        previewHash: status === 'preview_ok' ? PREVIEW_HASH : null,
        createdBy: user.id,
        updatedBy: user.id,
        ...overrides,
      }),
    );
    const saved = await repository.save(draft);
    draftIds.push(saved.id);
    return saved;
  }

  describe('successful apply onto an existing target', () => {
    it('transitions preview_ok -> apply_pending -> applied and applies the profile onto the chosen firewall', async () => {
      const draft = await makeDraft('preview_ok');

      const applied = await service.apply(
        draft.id,
        fwc.fwcloud.id,
        { previewHash: PREVIEW_HASH, target: { kind: 'firewall', id: fwc.firewall.id } },
        { userId: user.id },
      );

      expect(applied.status).to.equal('applied');
      expect(applied.targetIds!.firewallId).to.equal(fwc.firewall.id);
      expect(applied.targetIds!.profileId).to.be.a('number');
      expect(applied.stepLog!.map((entry) => entry.step)).to.deep.equal([
        'apply_pending',
        'applied',
      ]);

      const interfaces = await db
        .getSource()
        .manager.getRepository(Interface)
        .find({ where: { firewallId: fwc.firewall.id } });
      expect(interfaces.map((iface) => iface.name)).to.include.members(['WAN', 'LAN']);

      const profileAuditEntries = await db
        .getSource()
        .manager.getRepository(AuditLog)
        .find({ where: { call: PROFILE_APPLICATION_AUDIT_CALL, fwCloudId: fwc.fwcloud.id } });
      expect(profileAuditEntries).to.have.length(1);

      const transitionAuditEntries = (
        await db
          .getSource()
          .manager.getRepository(AuditLog)
          .find({ where: { call: FIREWALL_PROFILE_DRAFT_TRANSITION_AUDIT_CALL } })
      ).filter((entry) => entry.data.includes(`"draftId":${draft.id}`));
      expect(transitionAuditEntries).to.have.length(2);
    });
  });

  describe('confirmation integrity', () => {
    it('refuses to apply when the preview_hash does not match, without touching draft state', async () => {
      const draft = await makeDraft('preview_ok');

      await expect(
        service.apply(
          draft.id,
          fwc.fwcloud.id,
          { previewHash: 'stale-hash', target: { kind: 'firewall', id: fwc.firewall.id } },
          { userId: user.id },
        ),
      ).to.be.rejectedWith(FirewallProfileDraftApplyPreviewHashMismatchError);

      const reloaded = await db
        .getSource()
        .manager.getRepository(FirewallProfileDraft)
        .findOneByOrFail({ id: draft.id });
      expect(reloaded.status).to.equal('preview_ok');
      expect(reloaded.stepLog ?? []).to.have.length(0);
    });

    it('rejects apply from any status other than preview_ok with a 409 conflict', async () => {
      const draft = await makeDraft('validated', { previewHash: null });

      await expect(
        service.apply(
          draft.id,
          fwc.fwcloud.id,
          { previewHash: PREVIEW_HASH, target: { kind: 'firewall', id: fwc.firewall.id } },
          { userId: user.id },
        ),
      ).to.be.rejectedWith(FirewallProfileDraftTransitionConflictError);
    });

    it('lets exactly one of two concurrent apply attempts win the atomic guard', async () => {
      const draft = await makeDraft('preview_ok');
      const attempt = () =>
        service.apply(
          draft.id,
          fwc.fwcloud.id,
          { previewHash: PREVIEW_HASH, target: { kind: 'firewall', id: fwc.firewall.id } },
          { userId: user.id },
        );

      const results = await Promise.allSettled([attempt(), attempt()]);

      expect(results.filter((result) => result.status === 'fulfilled')).to.have.length(1);
      const rejected = results.find(
        (result) => result.status === 'rejected',
      ) as PromiseRejectedResult;
      expect(rejected.reason).to.be.instanceOf(FirewallProfileDraftTransitionConflictError);

      const profileAuditEntries = await db
        .getSource()
        .manager.getRepository(AuditLog)
        .find({ where: { call: PROFILE_APPLICATION_AUDIT_CALL, fwCloudId: fwc.fwcloud.id } });
      expect(profileAuditEntries).to.have.length(1);
    });
  });

  describe('failure handling', () => {
    it('transitions to apply_failed with a readable message when the underlying apply fails', async () => {
      const otherFwCloud = await new FwCloudFactory().make();
      const draft = await makeDraft('preview_ok');

      const applied = await service.apply(
        draft.id,
        fwc.fwcloud.id,
        // Target firewall belongs to a DIFFERENT FWCloud: ProfileApplicationService
        // rejects this as a scope violation, so the underlying apply throws.
        { previewHash: PREVIEW_HASH, target: { kind: 'firewall', id: otherFwCloud.firewall.id } },
        { userId: user.id },
      );

      expect(applied.status).to.equal('apply_failed');
      const failedStep = applied.stepLog!.find((entry) => entry.step === 'apply_failed');
      expect(failedStep?.status).to.equal('failed');
      expect(failedStep?.errorCode).to.equal('APPLY_FAILED');
      expect(failedStep?.message).to.be.a('string').and.not.equal('');
    });
  });
  describe('confirmed apply that creates a new target', () => {
    beforeEach(async () => {
      // Same ambient-state precaution the orchestration suite takes: other
      // suites mutate these limits on the shared `app` singleton and do not
      // always restore them. 0 means "no limit".
      app.config.set('limits.firewalls', 0);
      app.config.set('limits.clusters', 0);
      app.config.set('limits.nodes', 0);
      await Tree.createAllTreeCloud(fwc.fwcloud);
    });

    async function countFirewalls(): Promise<number> {
      return db
        .getSource()
        .manager.getRepository(Firewall)
        .count({ where: { fwCloudId: fwc.fwcloud.id } });
    }

    function reload(draftId: number): Promise<FirewallProfileDraft> {
      return db
        .getSource()
        .manager.getRepository(FirewallProfileDraft)
        .findOneByOrFail({ id: draftId });
    }

    it('walks preview_ok -> apply_pending -> applied and creates the firewall the proposal describes', async () => {
      const draft = await makeDraft('preview_ok');
      const before = await countFirewalls();

      const applied = await service.applyToNewTarget(
        draft.id,
        fwc.fwcloud.id,
        { previewHash: PREVIEW_HASH, target: { kind: 'firewall' } },
        { userId: user.id },
      );

      expect(applied.status).to.equal('applied');
      // The orchestrator's own three checkpoints sit between this service's
      // apply_pending guard and the terminal transition it owns.
      expect(applied.stepLog!.map((entry) => entry.step)).to.deep.equal([
        'apply_pending',
        'target_created',
        'interfaces_created',
        'profile_applied',
        'applied',
      ]);

      const firewallId = applied.targetIds!.firewallId!;
      expect(firewallId).to.be.a('number');
      // Created, never the FWCloud's pre-existing firewall.
      expect(firewallId).to.not.equal(fwc.firewall.id);
      expect(await countFirewalls()).to.equal(before + 1);

      const interfaces = await db
        .getSource()
        .manager.getRepository(Interface)
        .find({ where: { firewallId } });
      expect(interfaces.map((iface) => iface.name)).to.include.members(['WAN', 'LAN']);
    });

    it('names the created firewall from the request, leaving the materialized profile named after the proposal', async () => {
      const draft = await makeDraft('preview_ok');
      const chosenName = `edge-${StringHelper.randomize(8)}`;

      const applied = await service.applyToNewTarget(
        draft.id,
        fwc.fwcloud.id,
        { previewHash: PREVIEW_HASH, target: { kind: 'firewall', name: chosenName } },
        { userId: user.id },
      );

      const firewall = await db
        .getSource()
        .manager.getRepository(Firewall)
        .findOneByOrFail({ id: applied.targetIds!.firewallId });
      expect(firewall.name).to.equal(chosenName);
      // The override renames infrastructure only: the proposal's own name is
      // what the profile keeps, and the draft's proposal is untouched.
      expect((applied.proposal as { name: string }).name).to.not.equal(chosenName);
    });

    it('falls back to the proposal name when the request does not choose one', async () => {
      const draft = await makeDraft('preview_ok');
      const proposalName = (draft.proposal as { name: string }).name;

      const applied = await service.applyToNewTarget(
        draft.id,
        fwc.fwcloud.id,
        { previewHash: PREVIEW_HASH, target: { kind: 'firewall' } },
        { userId: user.id },
      );

      const firewall = await db
        .getSource()
        .manager.getRepository(Firewall)
        .findOneByOrFail({ id: applied.targetIds!.firewallId });
      expect(firewall.name).to.equal(proposalName);
    });

    it('rejects a confirmation for a different target kind than the proposal declares, creating nothing', async () => {
      const draft = await makeDraft('preview_ok');
      const before = await countFirewalls();

      await expect(
        service.applyToNewTarget(
          draft.id,
          fwc.fwcloud.id,
          // The proposal declares 'firewall'.
          { previewHash: PREVIEW_HASH, target: { kind: 'cluster' } },
          { userId: user.id },
        ),
      ).to.be.rejectedWith(FirewallProfileDraftApplyTargetKindMismatchError);

      const reloaded = await reload(draft.id);
      expect(reloaded.status).to.equal('preview_ok');
      expect(reloaded.stepLog ?? []).to.have.length(0);
      expect(await countFirewalls()).to.equal(before);
    });

    it('rejects an unorchestratable proposal while the draft is still preview_ok, so it is never stranded in apply_pending', async () => {
      const draft = await makeDraft('preview_ok', {
        // No `provision` block: nothing for the orchestrator to create.
        proposal: provisioningProposal({
          model: { compatibility: { targetKinds: ['firewall'] } },
        }),
      });

      await expect(
        service.applyToNewTarget(
          draft.id,
          fwc.fwcloud.id,
          { previewHash: PREVIEW_HASH, target: { kind: 'firewall' } },
          { userId: user.id },
        ),
      ).to.be.rejectedWith(TargetOrchestrationProposalError);

      // The point of checking before the transition: `apply_pending` is
      // excluded from TTL expiration, so a draft parked there by a proposal
      // that can never be orchestrated would have no way out.
      const reloaded = await reload(draft.id);
      expect(reloaded.status).to.equal('preview_ok');
      expect(reloaded.stepLog ?? []).to.have.length(0);
    });

    it('applies the same confirmation guard as the existing apply endpoint', async () => {
      const stale = await makeDraft('preview_ok');
      await expect(
        service.applyToNewTarget(
          stale.id,
          fwc.fwcloud.id,
          { previewHash: 'stale-hash', target: { kind: 'firewall' } },
          { userId: user.id },
        ),
      ).to.be.rejectedWith(FirewallProfileDraftApplyPreviewHashMismatchError);

      const notPreviewed = await makeDraft('validated', { previewHash: null });
      await expect(
        service.applyToNewTarget(
          notPreviewed.id,
          fwc.fwcloud.id,
          { previewHash: PREVIEW_HASH, target: { kind: 'firewall' } },
          { userId: user.id },
        ),
      ).to.be.rejectedWith(FirewallProfileDraftTransitionConflictError);
    });

    it('creates exactly one firewall when two attempts race', async () => {
      const draft = await makeDraft('preview_ok');
      const before = await countFirewalls();
      const attempt = () =>
        service.applyToNewTarget(
          draft.id,
          fwc.fwcloud.id,
          { previewHash: PREVIEW_HASH, target: { kind: 'firewall' } },
          { userId: user.id },
        );

      const results = await Promise.allSettled([attempt(), attempt()]);

      // The loser has two legitimate outcomes, and which one it gets is a race:
      // the `preview_ok -> apply_pending` compare-and-set rejects it, or the
      // concurrent legacy writes of the winner's firewall creation deadlock it.
      // Asserting either specific error makes the test flaky; what must hold is
      // that only one attempt won and only one firewall exists.
      expect(results.filter((result) => result.status === 'fulfilled')).to.have.length(1);
      expect(await countFirewalls()).to.equal(before + 1);
    });
  });
});
