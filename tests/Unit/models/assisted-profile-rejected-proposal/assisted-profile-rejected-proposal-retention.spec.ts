import type { DataSource } from 'typeorm';
import { describeName, expect, testSuite } from '../../../mocha/global-setup';
import { DatabaseService } from '../../../../src/database/database.service';
import { AuditLog } from '../../../../src/models/audit/AuditLog';
import { RecordingAuditLogService } from '../../../utils/recording-audit-log.service';
import { ASSISTED_PROFILE_ANONYMIZATION_VERSION } from '../../../../src/models/assisted-profile-rejected-proposal/assisted-profile-proposal-anonymizer';
import { AssistedProfileRejectedProposal } from '../../../../src/models/assisted-profile-rejected-proposal/assisted-profile-rejected-proposal.model';
import { TypeOrmAssistedProfileRejectedProposalRepository } from '../../../../src/models/assisted-profile-rejected-proposal/assisted-profile-rejected-proposal.repository';
import {
  ASSISTED_PROFILE_REJECTED_PURGE_AUDIT_CALL,
  PurgeAssistedProfileRejectedProposalsJob,
  REJECTED_PROPOSAL_PURGE_MAX_BATCHES_PER_RUN,
  type PurgeAssistedProfileRejectedProposalsJobCreateOptions,
} from '../../../../src/models/assisted-profile-rejected-proposal/assisted-profile-rejected-proposal-retention.service';

describe(describeName('PurgeAssistedProfileRejectedProposalsJob unit tests'), () => {
  const NOW = new Date('2026-08-17T12:00:00.000Z');
  let dataSource: DataSource;
  const createdIds: number[] = [];

  before(async () => {
    dataSource = (await testSuite.app.getService<DatabaseService>(DatabaseService.name)).dataSource;
  });

  afterEach(async () => {
    for (const id of createdIds.splice(0)) {
      await dataSource.getRepository(AssistedProfileRejectedProposal).delete(id);
    }
    await dataSource
      .getRepository(AuditLog)
      .createQueryBuilder()
      .delete()
      .where('call = :call', { call: ASSISTED_PROFILE_REJECTED_PURGE_AUDIT_CALL })
      .execute();
  });

  async function createSample(expiresAt: Date): Promise<AssistedProfileRejectedProposal> {
    const repository = dataSource.getRepository(AssistedProfileRejectedProposal);
    const saved = await repository.save(
      repository.create({
        rejectionCategory: 'domain_validation_failed',
        rejectionCode: 'ASSISTED_PROFILE_DOMAIN_VALIDATION_FAILED',
        contractVersion: '1.0.0',
        anonymizedProposal: { status: 'validation_failed', intent: { detectedTarget: 'cluster' } },
        anonymizationVersion: ASSISTED_PROFILE_ANONYMIZATION_VERSION,
        proposalFingerprint: null,
        requestId: null,
        capturedAt: new Date(expiresAt.getTime() - 86_400_000),
        expiresAt,
      }),
    );
    createdIds.push(saved.id);
    return saved;
  }

  function createJob(
    overrides: Partial<PurgeAssistedProfileRejectedProposalsJobCreateOptions> = {},
  ): Promise<PurgeAssistedProfileRejectedProposalsJob> {
    return PurgeAssistedProfileRejectedProposalsJob.create({
      repository: new TypeOrmAssistedProfileRejectedProposalRepository(dataSource),
      auditLogService: new RecordingAuditLogService(),
      now: () => NOW,
      configuration: {
        captureEnabled: true,
        retentionDays: 14,
        purgeEnabled: true,
        purgeIntervalSeconds: 3600,
        purgeBatchSize: 500,
      },
      ...overrides,
    });
  }

  async function exists(id: number): Promise<boolean> {
    return (
      (await dataSource.getRepository(AssistedProfileRejectedProposal).findOneBy({ id })) !== null
    );
  }

  describe('retention boundary', () => {
    it('keeps a record while now < expires_at', async () => {
      const sample = await createSample(new Date(NOW.getTime() + 1000));

      const stats = await (await createJob()).run();

      expect(stats.purged).to.equal(0);
      expect(await exists(sample.id)).to.equal(true);
    });

    it('treats a record as expired exactly at now == expires_at', async () => {
      const sample = await createSample(NOW);

      const stats = await (await createJob()).run();

      expect(stats.purged).to.equal(1);
      expect(await exists(sample.id)).to.equal(false);
    });

    it('purges a record past its expiration', async () => {
      const sample = await createSample(new Date(NOW.getTime() - 3_600_000));

      const stats = await (await createJob()).run();

      expect(stats.purged).to.equal(1);
      expect(await exists(sample.id)).to.equal(false);
    });
  });

  describe('purge', () => {
    it('physically removes expired samples and leaves active ones intact', async () => {
      const expired = await createSample(new Date(NOW.getTime() - 86_400_000));
      const active = await createSample(new Date(NOW.getTime() + 86_400_000));

      const stats = await (await createJob()).run();

      expect(stats).to.include({ scanned: 1, purged: 1, batches: 1 });
      expect(stats.jobRunId).to.be.a('string');
      expect(await exists(expired.id)).to.equal(false);
      expect(await exists(active.id)).to.equal(true);
    });

    it('processes the backlog in bounded batches', async () => {
      const expired = [
        await createSample(new Date(NOW.getTime() - 3 * 86_400_000)),
        await createSample(new Date(NOW.getTime() - 2 * 86_400_000)),
        await createSample(new Date(NOW.getTime() - 86_400_000)),
      ];
      const active = await createSample(new Date(NOW.getTime() + 86_400_000));

      const stats = await (
        await createJob({
          configuration: {
            captureEnabled: true,
            retentionDays: 14,
            purgeEnabled: true,
            purgeIntervalSeconds: 3600,
            purgeBatchSize: 2,
          },
        })
      ).run();

      expect(stats.purged).to.equal(3);
      expect(stats.batches).to.equal(2);
      expect(stats.batches).to.be.at.most(REJECTED_PROPOSAL_PURGE_MAX_BATCHES_PER_RUN);
      for (const sample of expired) {
        expect(await exists(sample.id)).to.equal(false);
      }
      expect(await exists(active.id)).to.equal(true);
    });

    it('is a no-op, without audit noise, when nothing has expired', async () => {
      const active = await createSample(new Date(NOW.getTime() + 86_400_000));
      const auditLogService = new RecordingAuditLogService();

      const stats = await (await createJob({ auditLogService })).run();

      expect(stats).to.include({ scanned: 0, purged: 0, batches: 0 });
      expect(auditLogService.calls).to.have.length(0);
      expect(await exists(active.id)).to.equal(true);
    });
  });

  describe('purge audit', () => {
    it('summarizes one sweep without naming any sample or its contents', async () => {
      await createSample(new Date(NOW.getTime() - 86_400_000));
      await createSample(new Date(NOW.getTime() - 86_400_000));
      const auditLogService = new RecordingAuditLogService();

      const stats = await (await createJob({ auditLogService })).run();

      expect(auditLogService.calls).to.have.length(1);
      const [entry] = auditLogService.calls;
      expect(entry.call).to.equal(ASSISTED_PROFILE_REJECTED_PURGE_AUDIT_CALL);
      expect(entry.data).to.include({
        source: 'cron',
        task: 'assisted-profile.rejected-proposal.purge',
        retentionDays: 14,
        purged: 2,
        jobRunId: stats.jobRunId,
      });
      const serialized = JSON.stringify(entry);
      expect(serialized).to.not.contain('validation_failed');
      expect(serialized).to.not.contain('anonymizedProposal');
    });
  });

  describe('scheduling', () => {
    it('does not schedule anything while the purge job is disabled', async () => {
      const job = await createJob({
        configuration: {
          captureEnabled: false,
          retentionDays: 14,
          purgeEnabled: false,
          purgeIntervalSeconds: 3600,
          purgeBatchSize: 500,
        },
      });

      job.start();
      expect(job.configuration.purgeEnabled).to.equal(false);
      job.stop();
    });

    it('still purges samples captured before capture was switched off', async () => {
      const expired = await createSample(new Date(NOW.getTime() - 86_400_000));
      // Capture disabled, purge job enabled: the retention obligation survives
      // the end of a pilot.
      const job = await createJob({
        configuration: {
          captureEnabled: false,
          retentionDays: 14,
          purgeEnabled: true,
          purgeIntervalSeconds: 3600,
          purgeBatchSize: 500,
        },
      });

      const stats = await job.run();

      expect(stats.purged).to.equal(1);
      expect(await exists(expired.id)).to.equal(false);
    });

    it('start() and stop() are idempotent', async () => {
      const job = await createJob();

      job.start();
      job.start();
      job.stop();
      job.stop();
      await job.close();
    });
  });
});
