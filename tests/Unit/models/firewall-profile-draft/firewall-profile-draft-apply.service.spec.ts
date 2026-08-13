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
import { FirewallProfileDraft } from '../../../../src/models/firewall-profile-draft/firewall-profile-draft.model';
import { FirewallProfileDraftTransitionConflictError } from '../../../../src/models/firewall-profile-draft/firewall-profile-draft.errors';
import { FirewallProfileDraftApplyPreviewHashMismatchError } from '../../../../src/models/firewall-profile-draft/firewall-profile-draft-apply.errors';
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
});
