import type { DataSource } from 'typeorm';
import { describeName, expect, testSuite } from '../../../mocha/global-setup';
import { DatabaseService } from '../../../../src/database/database.service';
import { FirewallProfileDraft } from '../../../../src/models/firewall-profile-draft/firewall-profile-draft.model';
import {
  FIREWALL_PROFILE_DRAFT_ORCHESTRATION_AUDIT_CALLS,
  FIREWALL_PROFILE_DRAFT_TRANSITION_AUDIT_CALL,
  FIREWALL_PROFILE_DRAFT_TRANSITIONS,
  FirewallProfileDraftStateService,
} from '../../../../src/models/firewall-profile-draft/firewall-profile-draft-state.service';
import {
  FirewallProfileDraftTransitionConflictError,
  UnsupportedFirewallProfileDraftContractVersionError,
} from '../../../../src/models/firewall-profile-draft/firewall-profile-draft.errors';
import {
  FIREWALL_PROFILE_DRAFT_STATUSES,
  type FirewallProfileDraftStatus,
} from '../../../../src/models/firewall-profile-draft/firewall-profile-draft.types';
import { AuditLog } from '../../../../src/models/audit/AuditLog';

describe(describeName('FirewallProfileDraftStateService Unit Tests'), () => {
  let dataSource: DataSource;
  let service: FirewallProfileDraftStateService;
  let fwCloudId: number;
  let ownsFwCloud = false;
  const draftIds: number[] = [];

  before(async () => {
    dataSource = (await testSuite.app.getService<DatabaseService>(DatabaseService.name)).dataSource;
    service = await testSuite.app.getService<FirewallProfileDraftStateService>(
      FirewallProfileDraftStateService.name,
    );
    let [fwCloud] = await dataSource.query('SELECT id FROM fwcloud ORDER BY id LIMIT 1');
    if (!fwCloud) {
      const result = await dataSource.query('INSERT INTO fwcloud (name) VALUES (?)', [
        'Firewall Profile draft tests',
      ]);
      fwCloud = { id: result.insertId };
      ownsFwCloud = true;
    }
    fwCloudId = Number(fwCloud.id);
  });

  after(async () => {
    if (ownsFwCloud) {
      await dataSource.query('DELETE FROM fwcloud WHERE id = ?', [fwCloudId]);
    }
  });

  const allAuditCalls = [
    FIREWALL_PROFILE_DRAFT_TRANSITION_AUDIT_CALL,
    ...Object.values(FIREWALL_PROFILE_DRAFT_ORCHESTRATION_AUDIT_CALLS),
  ];

  afterEach(async () => {
    if (draftIds.length === 0) return;
    for (const id of draftIds.splice(0)) {
      await dataSource
        .getRepository(AuditLog)
        .createQueryBuilder()
        .delete()
        .where('`call` IN (:...calls)', { calls: allAuditCalls })
        .andWhere('data LIKE :draft', { draft: `%"draftId":${id}%` })
        .execute();
      await dataSource.getRepository(FirewallProfileDraft).delete(id);
    }
  });

  async function createDraft(
    status: FirewallProfileDraftStatus,
    contractVersion: string = 'apg.mvp.v1',
  ): Promise<FirewallProfileDraft> {
    const now = new Date();
    const draft = dataSource.getRepository(FirewallProfileDraft).create({
      fwCloudId,
      createdBy: null,
      updatedBy: null,
      status,
      contractVersion,
      proposal: { metadata: { schemaVersion: '1.0.0' }, generated: {} },
      previewHash: null,
      applyHash: null,
      stepLog: [],
      targetIds: null,
      idempotencyKeyRef: null,
      requestId: null,
      createdAt: now,
      updatedAt: now,
      validatedAt: now,
      previewedAt: status === 'preview_ok' ? now : null,
      applyPendingAt: status === 'apply_pending' ? now : null,
      appliedAt: status === 'applied' ? now : null,
      failedAt: status === 'apply_failed' ? now : null,
      discardedAt: status === 'discarded' ? now : null,
      expiredAt: status === 'expired' ? now : null,
    });
    const saved = await dataSource.getRepository(FirewallProfileDraft).save(draft);
    draftIds.push(saved.id);
    return saved;
  }

  for (const currentStatus of FIREWALL_PROFILE_DRAFT_STATUSES) {
    for (const nextStatus of FIREWALL_PROFILE_DRAFT_STATUSES) {
      const allowed = FIREWALL_PROFILE_DRAFT_TRANSITIONS[currentStatus].includes(nextStatus);
      it(`${allowed ? 'allows' : 'rejects'} ${currentStatus} -> ${nextStatus}`, async () => {
        const draft = await createDraft(currentStatus);
        let error: unknown;
        try {
          await service.transition(draft.id, currentStatus, nextStatus, { fwCloudId });
        } catch (caught) {
          error = caught;
        }

        if (allowed) {
          expect(error).to.equal(undefined);
          expect((await service.loadForProcessing(draft.id, fwCloudId)).status).to.equal(
            nextStatus,
          );
        } else {
          expect(error).to.be.instanceOf(FirewallProfileDraftTransitionConflictError);
          const conflict = error as FirewallProfileDraftTransitionConflictError;
          expect(conflict.status).to.equal(409);
          expect(conflict.currentStatus).to.equal(currentStatus);
          expect(conflict.attemptedStatus).to.equal(nextStatus);
        }
      });
    }
  }

  it('requires a successful preview before apply_pending', async () => {
    const draft = await createDraft('validated');
    await expect(
      service.transition(draft.id, 'validated', 'apply_pending', { fwCloudId }),
    ).to.be.rejectedWith(FirewallProfileDraftTransitionConflictError);

    await service.transition(draft.id, 'validated', 'preview_ok', { fwCloudId });
    const applied = await service.transition(draft.id, 'preview_ok', 'apply_pending', {
      fwCloudId,
    });
    expect(applied.status).to.equal('apply_pending');
  });

  it('has exactly one winner for concurrent apply guards and one success audit', async () => {
    const draft = await createDraft('preview_ok');
    let applyInvocations = 0;
    const apply = async () => {
      const transitioned = await service.transition(draft.id, 'preview_ok', 'apply_pending', {
        fwCloudId,
        requestId: 'concurrency-test',
      });
      applyInvocations += 1;
      return transitioned;
    };
    const results = await Promise.allSettled([apply(), apply()]);

    expect(results.filter((result) => result.status === 'fulfilled')).to.have.length(1);
    const rejected = results.find(
      (result) => result.status === 'rejected',
    ) as PromiseRejectedResult;
    expect(rejected.reason).to.be.instanceOf(FirewallProfileDraftTransitionConflictError);
    expect(rejected.reason.status).to.equal(409);
    expect(applyInvocations).to.equal(1);
    expect((await service.loadForProcessing(draft.id, fwCloudId)).status).to.equal('apply_pending');

    const auditCount = await dataSource
      .getRepository(AuditLog)
      .createQueryBuilder('audit')
      .where('audit.call = :call', { call: FIREWALL_PROFILE_DRAFT_TRANSITION_AUDIT_CALL })
      .andWhere('audit.data LIKE :draft', { draft: `%"draftId":${draft.id}%` })
      .getCount();
    expect(auditCount).to.equal(1);
  });

  it('rejects unsupported persisted contract versions with version details', async () => {
    const draft = await createDraft('validated', 'retired.v0');
    let error: unknown;
    try {
      await service.loadForProcessing(draft.id, fwCloudId);
    } catch (caught) {
      error = caught;
    }

    expect(error).to.be.instanceOf(UnsupportedFirewallProfileDraftContractVersionError);
    const unsupported = error as UnsupportedFirewallProfileDraftContractVersionError;
    expect(unsupported.draftId).to.equal(draft.id);
    expect(unsupported.receivedVersion).to.equal('retired.v0');
    expect(unsupported.supportedVersions).to.include('apg.mvp.v1');
    expect(unsupported.supportedVersions).to.include('1.0.0');
  });

  it('lists unsupported draft versions without loading detail or integrity columns', async () => {
    const draft = await createDraft('validated', 'retired.v0');
    const summary = (await service.listByFwCloud(fwCloudId)).find(({ id }) => id === draft.id);

    expect(summary).to.include({
      id: draft.id,
      fwCloudId,
      contractVersion: 'retired.v0',
      status: 'validated',
    });
    expect(summary).not.to.have.any.keys(
      'proposal',
      'proposalHash',
      'previewHash',
      'applyHash',
      'stepLog',
      'targetIds',
      'idempotencyKeyRef',
    );
  });

  describe('recordOrchestrationStep', () => {
    it('appends the step, merges target_ids and writes a step-specific audit row while staying apply_pending', async () => {
      const draft = await createDraft('apply_pending');

      const updated = await service.recordOrchestrationStep(
        draft.id,
        {
          step: 'target_created',
          status: 'success',
          timestamp: new Date().toISOString(),
          targetKind: 'firewall',
          resourceIds: { firewallId: 42 },
        },
        { fwCloudId, targetIds: { firewallId: 42 } },
      );

      expect(updated.status).to.equal('apply_pending');
      expect(updated.stepLog).to.have.length(1);
      expect(updated.stepLog![0]).to.include({ step: 'target_created', status: 'success' });
      expect(updated.targetIds).to.deep.equal({ firewallId: 42 });

      const reloaded = await service.loadForProcessing(draft.id, fwCloudId);
      expect(reloaded.stepLog).to.have.length(1);
      expect(reloaded.targetIds).to.deep.equal({ firewallId: 42 });

      const auditEntries = await dataSource
        .getRepository(AuditLog)
        .find({ where: { call: FIREWALL_PROFILE_DRAFT_ORCHESTRATION_AUDIT_CALLS.target_created } });
      const forThisDraft = auditEntries.filter((entry) =>
        entry.data.includes(`"draftId":${draft.id}`),
      );
      expect(forThisDraft).to.have.length(1);
      expect(forThisDraft[0].firewallId).to.equal(42);
      const data = JSON.parse(forThisDraft[0].data) as Record<string, unknown>;
      expect(data.step).to.equal('target_created');
      expect(data.resourceIds).to.deep.equal({ firewallId: 42 });
    });

    it('accumulates successive steps in order without overwriting previous entries', async () => {
      const draft = await createDraft('apply_pending');

      await service.recordOrchestrationStep(
        draft.id,
        {
          step: 'target_created',
          status: 'success',
          timestamp: new Date().toISOString(),
          targetKind: 'firewall',
          resourceIds: { firewallId: 1 },
        },
        { fwCloudId, targetIds: { firewallId: 1 } },
      );
      const afterSecond = await service.recordOrchestrationStep(
        draft.id,
        {
          step: 'interfaces_created',
          status: 'success',
          timestamp: new Date().toISOString(),
          targetKind: 'firewall',
          resourceIds: { interfaceIds: [10, 11] },
        },
        { fwCloudId, targetIds: { firewallId: 1, interfaceIds: [10, 11] } },
      );

      expect(afterSecond.stepLog!.map((entry) => entry.step)).to.deep.equal([
        'target_created',
        'interfaces_created',
      ]);
      expect(afterSecond.targetIds).to.deep.equal({ firewallId: 1, interfaceIds: [10, 11] });
    });

    it('throws instead of silently no-oping when the draft has left apply_pending', async () => {
      const draft = await createDraft('applied');

      await expect(
        service.recordOrchestrationStep(
          draft.id,
          { step: 'target_created', status: 'success', timestamp: new Date().toISOString() },
          { fwCloudId },
        ),
      ).to.be.rejectedWith(FirewallProfileDraftTransitionConflictError);

      const reloaded = await service.loadForProcessing(draft.id, fwCloudId);
      expect(reloaded.stepLog ?? []).to.have.length(0);
    });

    it('rejects an unknown orchestration step name', async () => {
      const draft = await createDraft('apply_pending');

      await expect(
        service.recordOrchestrationStep(
          draft.id,
          { step: 'not_a_real_step', status: 'success', timestamp: new Date().toISOString() },
          { fwCloudId },
        ),
      ).to.be.rejectedWith('Unknown target orchestration step');
    });
  });
});
