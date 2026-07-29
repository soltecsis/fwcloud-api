import type { DataSource } from 'typeorm';
import { describeName, expect, testSuite } from '../../../mocha/global-setup';
import { DatabaseService } from '../../../../src/database/database.service';
import { FirewallProfileDraft } from '../../../../src/models/firewall-profile-draft/firewall-profile-draft.model';
import { FirewallProfileDraftStateService } from '../../../../src/models/firewall-profile-draft/firewall-profile-draft-state.service';
import {
  FirewallProfileDraftTransitionConflictError,
  UnsupportedFirewallProfileDraftContractVersionError,
} from '../../../../src/models/firewall-profile-draft/firewall-profile-draft.errors';
import type { FirewallProfileDraftStatus } from '../../../../src/models/firewall-profile-draft/firewall-profile-draft.types';
import {
  AuditLogService,
  type AuditLogMutationInput,
} from '../../../../src/models/audit/AuditLog.service';
import { AuditLog } from '../../../../src/models/audit/AuditLog';
import {
  DEFAULT_DRAFT_TTL_SECONDS,
  DEFAULT_EXPIRATION_BATCH_SIZE,
  DEFAULT_EXPIRATION_JOB_ENABLED,
  DEFAULT_EXPIRATION_JOB_INTERVAL_SECONDS,
  resolveFirewallProfileDraftExpirationConfiguration,
} from '../../../../src/models/firewall-profile-draft/firewall-profile-draft-expiration.configuration';
import { ConfigurationErrorException } from '../../../../src/config/exceptions/configuration-error.exception';
import {
  ExpireFirewallProfileDraftsJob,
  FIREWALL_PROFILE_DRAFT_EXPIRATION_AUDIT_CALL,
  FIREWALL_PROFILE_DRAFT_EXPIRATION_ELIGIBLE_STATUSES,
  FIREWALL_PROFILE_DRAFT_EXPIRATION_JOB_AUDIT_CALL,
  type ExpireFirewallProfileDraftsJobCreateOptions,
} from '../../../../src/models/firewall-profile-draft/firewall-profile-draft-expiration.service';

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

class RecordingAuditLogService {
  public readonly calls: AuditLogMutationInput[] = [];

  public async logMutation(input: AuditLogMutationInput): Promise<null> {
    this.calls.push(input);
    return null;
  }
}

describe(describeName('resolveFirewallProfileDraftExpirationConfiguration unit tests'), () => {
  it('applies documented defaults', () => {
    const configuration = resolveFirewallProfileDraftExpirationConfiguration();
    expect(configuration).to.deep.equal({
      enabled: DEFAULT_EXPIRATION_JOB_ENABLED,
      ttlSeconds: DEFAULT_DRAFT_TTL_SECONDS,
      intervalSeconds: DEFAULT_EXPIRATION_JOB_INTERVAL_SECONDS,
      batchSize: DEFAULT_EXPIRATION_BATCH_SIZE,
    });
    expect(configuration.ttlSeconds).to.equal(604800);
  });

  it('accepts coerced string values', () => {
    const configuration = resolveFirewallProfileDraftExpirationConfiguration({
      enabled: 'false',
      ttlSeconds: '120',
      intervalSeconds: '30',
      batchSize: '10',
    });
    expect(configuration).to.deep.equal({
      enabled: false,
      ttlSeconds: 120,
      intervalSeconds: 30,
      batchSize: 10,
    });
  });

  for (const invalid of [-1, 0, 1.5, Number.NaN, Number.POSITIVE_INFINITY, '', '1.5', 'many']) {
    it(`rejects invalid ttlSeconds ${String(invalid)}`, () => {
      expect(() =>
        resolveFirewallProfileDraftExpirationConfiguration({ ttlSeconds: invalid as never }),
      ).to.throw(ConfigurationErrorException);
    });

    it(`rejects invalid intervalSeconds ${String(invalid)}`, () => {
      expect(() =>
        resolveFirewallProfileDraftExpirationConfiguration({ intervalSeconds: invalid as never }),
      ).to.throw(ConfigurationErrorException);
    });

    it(`rejects invalid batchSize ${String(invalid)}`, () => {
      expect(() =>
        resolveFirewallProfileDraftExpirationConfiguration({ batchSize: invalid as never }),
      ).to.throw(ConfigurationErrorException);
    });
  }

  for (const invalid of ['yes', 'no', '1', '0', 1, 0, {}, []]) {
    it(`rejects an unsupported boolean value ${JSON.stringify(invalid)}`, () => {
      expect(() =>
        resolveFirewallProfileDraftExpirationConfiguration({ enabled: invalid as never }),
      ).to.throw(ConfigurationErrorException);
    });
  }
});

describe(describeName('ExpireFirewallProfileDraftsJob unit tests'), () => {
  let dataSource: DataSource;
  let stateService: FirewallProfileDraftStateService;
  let auditLogService: AuditLogService;
  let fwCloudId: number;
  let ownsFwCloud = false;
  const draftIds: number[] = [];
  const jobRunIds: string[] = [];

  before(async () => {
    dataSource = (await testSuite.app.getService<DatabaseService>(DatabaseService.name)).dataSource;
    stateService = await testSuite.app.getService<FirewallProfileDraftStateService>(
      FirewallProfileDraftStateService.name,
    );
    auditLogService = await testSuite.app.getService<AuditLogService>(AuditLogService.name);

    let [fwCloud] = await dataSource.query('SELECT id FROM fwcloud ORDER BY id LIMIT 1');
    if (!fwCloud) {
      const result = await dataSource.query('INSERT INTO fwcloud (name) VALUES (?)', [
        'Firewall Profile draft expiration tests',
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
    for (const id of draftIds.splice(0)) {
      await dataSource
        .getRepository(AuditLog)
        .createQueryBuilder()
        .delete()
        .where('data LIKE :draft', { draft: `%"draftId":${id}%` })
        .execute();
      await dataSource.getRepository(FirewallProfileDraft).delete(id);
    }
    // Job-summary audits carry no draftId (they aggregate a whole batch), so
    // they need their own cleanup keyed by the run's jobRunId.
    for (const jobRunId of jobRunIds.splice(0)) {
      await dataSource
        .getRepository(AuditLog)
        .createQueryBuilder()
        .delete()
        .where('call = :call', { call: FIREWALL_PROFILE_DRAFT_EXPIRATION_JOB_AUDIT_CALL })
        .andWhere('data LIKE :run', { run: `%${jobRunId}%` })
        .execute();
    }
  });

  function trackRun<T extends { jobRunId: string }>(stats: T): T {
    jobRunIds.push(stats.jobRunId);
    return stats;
  }

  async function createDraft(
    status: FirewallProfileDraftStatus,
    updatedAt: Date,
    contractVersion: string = 'apg.mvp.v1',
  ): Promise<FirewallProfileDraft> {
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
      createdAt: updatedAt,
      updatedAt,
      validatedAt: updatedAt,
      previewedAt: status === 'preview_ok' ? updatedAt : null,
      applyPendingAt: status === 'apply_pending' ? updatedAt : null,
      appliedAt: status === 'applied' ? updatedAt : null,
      failedAt: status === 'apply_failed' ? updatedAt : null,
      discardedAt: status === 'discarded' ? updatedAt : null,
      expiredAt: status === 'expired' ? updatedAt : null,
    });
    const saved = await dataSource.getRepository(FirewallProfileDraft).save(draft);
    draftIds.push(saved.id);
    return saved;
  }

  const NOW = new Date('2026-07-29T12:00:00.000Z');
  const TTL_SECONDS = 604_800; // 7 days, matches the documented default

  /** One second past the TTL threshold (optionally offset further), for
   * fixtures that just need "old enough to be eligible for expiration". */
  const staleTimestamp = (offsetMs = 0): Date =>
    new Date(NOW.getTime() - (TTL_SECONDS + 1) * 1000 + offsetMs);

  function createJob(
    overrides: Partial<ExpireFirewallProfileDraftsJobCreateOptions> = {},
  ): Promise<ExpireFirewallProfileDraftsJob> {
    return ExpireFirewallProfileDraftsJob.create({
      dataSource,
      stateService,
      auditLogService,
      now: () => NOW,
      configuration: {
        ttlSeconds: TTL_SECONDS,
        batchSize: 100,
        enabled: true,
        intervalSeconds: 3600,
      },
      ...overrides,
    });
  }

  it('expires a draft inactive beyond the TTL, populates expired_at, and audits it', async () => {
    const updatedAt = staleTimestamp();
    const draft = await createDraft('validated', updatedAt);
    const job = await createJob();

    const stats = trackRun(await job.run());

    expect(stats).to.deep.include({ scanned: 1, expired: 1, skipped: 0, failed: 0 });

    const persisted = await dataSource
      .getRepository(FirewallProfileDraft)
      .findOneByOrFail({ id: draft.id });
    expect(persisted.status).to.equal('expired');
    expect(persisted.expiredAt).to.not.be.null;

    const auditEntries = await dataSource.getRepository(AuditLog).find({
      where: { call: FIREWALL_PROFILE_DRAFT_EXPIRATION_AUDIT_CALL, fwCloudId },
    });
    const entry = auditEntries.find((row) => JSON.parse(row.data).draftId === draft.id);
    expect(entry).to.not.be.undefined;
    const data = JSON.parse(entry!.data);
    expect(data.previousStatus).to.equal('validated');
    expect(data.newStatus).to.equal('expired');
    expect(data.ttlSeconds).to.equal(TTL_SECONDS);
    expect(data.jobRunId).to.equal(stats.jobRunId);
    expect(data.lastActivityAtIso).to.equal(updatedAt.toISOString());
  });

  it('leaves an active draft (inactivity below the TTL) untouched, with no expiration audit', async () => {
    const recentUpdatedAt = new Date(NOW.getTime() - (TTL_SECONDS - 3600) * 1000);
    const draft = await createDraft('validated', recentUpdatedAt);
    const job = await createJob();

    const stats = trackRun(await job.run());

    expect(stats.scanned).to.equal(0);
    expect(stats.expired).to.equal(0);

    const persisted = await dataSource
      .getRepository(FirewallProfileDraft)
      .findOneByOrFail({ id: draft.id });
    expect(persisted.status).to.equal('validated');

    const auditEntries = await dataSource.getRepository(AuditLog).find({
      where: { call: FIREWALL_PROFILE_DRAFT_EXPIRATION_AUDIT_CALL, fwCloudId },
    });
    expect(auditEntries.find((row) => JSON.parse(row.data).draftId === draft.id)).to.be.undefined;
  });

  it('expires exactly at the TTL boundary (inactivity >= TTL) but not one second short of it', async () => {
    // `updated_at` is a MySQL/MariaDB TIMESTAMP with no fractional-seconds
    // precision, so the boundary must be exercised at whole-second
    // granularity to observe a real difference once persisted.
    const exactlyAtTtl = new Date(NOW.getTime() - TTL_SECONDS * 1000);
    const oneSecondShortOfTtl = new Date(exactlyAtTtl.getTime() + 1000);

    const atBoundary = await createDraft('validated', exactlyAtTtl);
    const belowBoundary = await createDraft('validated', oneSecondShortOfTtl);
    const job = await createJob();

    trackRun(await job.run());

    expect(
      (await dataSource.getRepository(FirewallProfileDraft).findOneByOrFail({ id: atBoundary.id }))
        .status,
    ).to.equal('expired');
    expect(
      (
        await dataSource
          .getRepository(FirewallProfileDraft)
          .findOneByOrFail({ id: belowBoundary.id })
      ).status,
    ).to.equal('validated');
  });

  for (const status of FIREWALL_PROFILE_DRAFT_EXPIRATION_ELIGIBLE_STATUSES) {
    it(`expires an inactive draft from eligible state '${status}'`, async () => {
      const draft = await createDraft(status, staleTimestamp());
      const job = await createJob();

      trackRun(await job.run());

      const persisted = await dataSource
        .getRepository(FirewallProfileDraft)
        .findOneByOrFail({ id: draft.id });
      expect(persisted.status).to.equal('expired');
    });
  }

  for (const status of ['applied', 'discarded', 'expired', 'apply_pending'] as const) {
    it(`never expires an inactive draft in excluded state '${status}'`, async () => {
      const draft = await createDraft(status, staleTimestamp());
      const job = await createJob();

      const stats = trackRun(await job.run());

      const persisted = await dataSource
        .getRepository(FirewallProfileDraft)
        .findOneByOrFail({ id: draft.id });
      expect(persisted.status).to.equal(status);
      expect(stats.scanned).to.equal(0);
    });
  }

  const nonConflictFailureCases: Array<{
    label: string;
    expectedBucket: 'skipped' | 'failed';
    buildError: (
      draftId: number,
      expectedStatus: FirewallProfileDraftStatus,
      nextStatus: FirewallProfileDraftStatus,
    ) => Error;
  }> = [
    {
      label: 'a lost CAS guard (concurrent activity)',
      expectedBucket: 'skipped',
      buildError: (draftId, expectedStatus, nextStatus) =>
        new FirewallProfileDraftTransitionConflictError(draftId, expectedStatus, nextStatus),
    },
    {
      label: 'an unsupported contract version',
      expectedBucket: 'failed',
      buildError: (draftId) =>
        new UnsupportedFirewallProfileDraftContractVersionError(draftId, 'retired.v0', [
          'apg.mvp.v1',
        ]),
    },
  ];

  for (const { label, expectedBucket, buildError } of nonConflictFailureCases) {
    it(`counts a draft whose transition throws ${label} as "${expectedBucket}", without overwriting it, auditing it, or aborting the batch`, async () => {
      const brokenDraft = await createDraft('validated', staleTimestamp());
      const normalDraft = await createDraft('preview_ok', staleTimestamp());
      const recorder = new RecordingAuditLogService();

      const stubStateService = {
        transition: async (
          draftId: number,
          expectedStatus: FirewallProfileDraftStatus,
          nextStatus: FirewallProfileDraftStatus,
        ) => {
          if (draftId === brokenDraft.id) {
            throw buildError(draftId, expectedStatus, nextStatus);
          }
          return stateService.transition(draftId, expectedStatus, nextStatus, { fwCloudId });
        },
      } as unknown as FirewallProfileDraftStateService;

      const job = await createJob({
        stateService: stubStateService,
        auditLogService: recorder as unknown as AuditLogService,
      });

      const stats = trackRun(await job.run());

      expect(stats).to.deep.include({
        scanned: 2,
        expired: 1,
        skipped: expectedBucket === 'skipped' ? 1 : 0,
        failed: expectedBucket === 'failed' ? 1 : 0,
      });

      const brokenPersisted = await dataSource
        .getRepository(FirewallProfileDraft)
        .findOneByOrFail({ id: brokenDraft.id });
      expect(brokenPersisted.status).to.equal('validated');

      const expirationAudits = recorder.calls.filter(
        (call) => call.call === FIREWALL_PROFILE_DRAFT_EXPIRATION_AUDIT_CALL,
      );
      expect(expirationAudits).to.have.lengthOf(1);
      expect((expirationAudits[0].data as { draftId: number }).draftId).to.equal(normalDraft.id);
    });
  }

  it('bounds a single run to the configured batch size, leaving the remainder for the next sweep', async () => {
    const first = await createDraft('validated', staleTimestamp());
    const second = await createDraft('validated', staleTimestamp(1000));
    await createDraft('validated', staleTimestamp(2000));

    const job = await createJob({ configuration: { ttlSeconds: TTL_SECONDS, batchSize: 2 } });
    const stats = trackRun(await job.run());

    expect(stats.scanned).to.equal(2);
    expect(stats.expired).to.equal(2);
    // Oldest-first ordering: the two oldest eligible drafts are the ones processed.
    expect(
      (await dataSource.getRepository(FirewallProfileDraft).findOneByOrFail({ id: first.id }))
        .status,
    ).to.equal('expired');
    expect(
      (await dataSource.getRepository(FirewallProfileDraft).findOneByOrFail({ id: second.id }))
        .status,
    ).to.equal('expired');
  });

  it('writes a job-level summary audit event with safe, non-proposal counts', async () => {
    await createDraft('validated', staleTimestamp());
    const recorder = new RecordingAuditLogService();
    const job = await createJob({ auditLogService: recorder as unknown as AuditLogService });

    const stats = trackRun(await job.run());

    const summary = recorder.calls.find(
      (call) => call.call === FIREWALL_PROFILE_DRAFT_EXPIRATION_JOB_AUDIT_CALL,
    );
    expect(summary).to.not.be.undefined;
    expect(summary!.data).to.deep.include({
      source: 'cron',
      task: 'assisted-profile.drafts.expire',
      scanned: stats.scanned,
      expired: stats.expired,
      skipped: stats.skipped,
      failed: stats.failed,
    });
    expect(JSON.stringify(summary!.data)).to.not.include('proposal');
  });

  it('run() is callable directly regardless of the enabled flag (manual/test invocation)', async () => {
    const draft = await createDraft('validated', staleTimestamp());
    const job = await createJob({
      configuration: {
        ttlSeconds: TTL_SECONDS,
        batchSize: 100,
        enabled: false,
        intervalSeconds: 3600,
      },
    });

    trackRun(await job.run());

    expect(
      (await dataSource.getRepository(FirewallProfileDraft).findOneByOrFail({ id: draft.id }))
        .status,
    ).to.equal('expired');
  });

  it('start() with the job disabled never schedules a run', async () => {
    const job = await createJob({
      configuration: {
        ttlSeconds: TTL_SECONDS,
        batchSize: 100,
        enabled: false,
        intervalSeconds: 1,
      },
    });
    let runCalls = 0;
    (job as unknown as { run: () => Promise<unknown> }).run = async () => {
      runCalls += 1;
      return undefined;
    };

    job.start();
    await sleep(1200);
    job.stop();

    expect(runCalls).to.equal(0);
  });

  it('start() schedules the first sweep after one interval, not immediately at boot', async () => {
    const job = await createJob({
      configuration: { ttlSeconds: TTL_SECONDS, batchSize: 100, enabled: true, intervalSeconds: 1 },
    });
    let runCalls = 0;
    (job as unknown as { run: () => Promise<unknown> }).run = async () => {
      runCalls += 1;
      return undefined;
    };

    job.start();
    expect(runCalls).to.equal(0);
    await sleep(100);
    expect(runCalls).to.equal(0);

    await sleep(1100);
    job.stop();
    expect(runCalls).to.equal(1);
  });
});
