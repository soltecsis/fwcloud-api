import type { DataSource } from 'typeorm';
import { describeName, expect, testSuite } from '../../../mocha/global-setup';
import { DatabaseService } from '../../../../src/database/database.service';
import { FirewallProfileDraft } from '../../../../src/models/firewall-profile-draft/firewall-profile-draft.model';
import {
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
  FirewallProfileDraftStatus,
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

  afterEach(async () => {
    if (draftIds.length === 0) return;
    for (const id of draftIds.splice(0)) {
      await dataSource
        .getRepository(AuditLog)
        .createQueryBuilder()
        .delete()
        .where('`call` = :call', { call: FIREWALL_PROFILE_DRAFT_TRANSITION_AUDIT_CALL })
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
});
