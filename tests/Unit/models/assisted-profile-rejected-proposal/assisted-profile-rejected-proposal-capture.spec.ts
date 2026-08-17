import { createHash } from 'crypto';
import type { DataSource } from 'typeorm';
import { describeName, expect, testSuite } from '../../../mocha/global-setup';
import { ConfigurationErrorException } from '../../../../src/config/exceptions/configuration-error.exception';
import { DatabaseService } from '../../../../src/database/database.service';
import { AuditLog } from '../../../../src/models/audit/AuditLog';
import { RecordingAuditLogService } from '../../../utils/recording-audit-log.service';
import { canonicalizeFirewallProfileDraftValue } from '../../../../src/models/firewall-profile-draft/firewall-profile-draft.hash';
import {
  ASSISTED_PROFILE_ANONYMIZATION_VERSION,
  AssistedProfileProposalAnonymizationError,
  REDACTED_TEXT,
} from '../../../../src/models/assisted-profile-rejected-proposal/assisted-profile-proposal-anonymizer';
import {
  ASSISTED_PROFILE_REJECTED_CAPTURE_AUDIT_CALL,
  AssistedProfileRejectedProposalCaptureService,
  type AssistedProfileRejectedProposalCaptureCreateOptions,
} from '../../../../src/models/assisted-profile-rejected-proposal/assisted-profile-rejected-proposal-capture.service';
import {
  DEFAULT_REJECTED_PROPOSAL_CAPTURE_ENABLED,
  DEFAULT_REJECTED_PROPOSAL_PURGE_BATCH_SIZE,
  DEFAULT_REJECTED_PROPOSAL_PURGE_INTERVAL_SECONDS,
  DEFAULT_REJECTED_PROPOSAL_PURGE_JOB_ENABLED,
  DEFAULT_REJECTED_PROPOSAL_RETENTION_DAYS,
  resolveAssistedProfileRejectedProposalConfiguration,
} from '../../../../src/models/assisted-profile-rejected-proposal/assisted-profile-rejected-proposal.configuration';
import { AssistedProfileRejectedProposal } from '../../../../src/models/assisted-profile-rejected-proposal/assisted-profile-rejected-proposal.model';
import {
  TypeOrmAssistedProfileRejectedProposalRepository,
  type AssistedProfileRejectedProposalRepository,
  type ExpiredRejectedProposalRef,
  type PersistRejectedProposalInput,
} from '../../../../src/models/assisted-profile-rejected-proposal/assisted-profile-rejected-proposal.repository';
import { ASSISTED_PROFILE_REJECTION_CATEGORIES } from '../../../../src/models/assisted-profile-rejected-proposal/assisted-profile-rejected-proposal.types';

/** A rejected proposal carrying the kind of content a pilot would really see. */
const REJECTED_PROPOSAL = {
  status: 'validation_failed',
  intent: {
    detectedTarget: 'cluster',
    confidence: 0.5,
    summary: 'Cluster for Alice Smith at Madrid-office',
    language: 'en',
  },
  errors: [{ code: 'MISSING_SYNC_INTERFACE', severity: 'error', message: 'alice@example.com' }],
  generated: {
    target: {
      type: 'cluster',
      name: 'ACME Industrial S.L.',
      interfaces: [{ name: 'wan0', role: 'wan', address: '10.20.30.40/24' }],
      nodes: [],
    },
    rules: [],
  },
  metadata: { schemaVersion: '1.0.0' },
};

class RecordingRepository implements AssistedProfileRejectedProposalRepository {
  public readonly persisted: PersistRejectedProposalInput[] = [];
  public readonly deleted: number[][] = [];
  public failOnPersist = false;

  public async persist(
    input: PersistRejectedProposalInput,
  ): Promise<AssistedProfileRejectedProposal> {
    if (this.failOnPersist) {
      throw new Error('database unavailable');
    }
    this.persisted.push(input);
    return { id: this.persisted.length, ...input } as unknown as AssistedProfileRejectedProposal;
  }

  public async findExpired(): Promise<ExpiredRejectedProposalRef[]> {
    return [];
  }

  public async deleteByIds(ids: readonly number[]): Promise<number> {
    this.deleted.push([...ids]);
    return ids.length;
  }
}

describe(describeName('resolveAssistedProfileRejectedProposalConfiguration unit tests'), () => {
  it('defaults to capture disabled', () => {
    const configuration = resolveAssistedProfileRejectedProposalConfiguration();

    expect(configuration.captureEnabled).to.equal(false);
    expect(configuration).to.deep.equal({
      captureEnabled: DEFAULT_REJECTED_PROPOSAL_CAPTURE_ENABLED,
      retentionDays: DEFAULT_REJECTED_PROPOSAL_RETENTION_DAYS,
      purgeEnabled: DEFAULT_REJECTED_PROPOSAL_PURGE_JOB_ENABLED,
      purgeIntervalSeconds: DEFAULT_REJECTED_PROPOSAL_PURGE_INTERVAL_SECONDS,
      purgeBatchSize: DEFAULT_REJECTED_PROPOSAL_PURGE_BATCH_SIZE,
    });
    expect(DEFAULT_REJECTED_PROPOSAL_CAPTURE_ENABLED).to.equal(false);
  });

  it('treats an absent or empty capture flag exactly as false', () => {
    expect(
      resolveAssistedProfileRejectedProposalConfiguration({ captureEnabled: undefined })
        .captureEnabled,
    ).to.equal(false);
    expect(
      resolveAssistedProfileRejectedProposalConfiguration({ captureEnabled: '' }).captureEnabled,
    ).to.equal(false);
    expect(
      resolveAssistedProfileRejectedProposalConfiguration({ captureEnabled: 'false' })
        .captureEnabled,
    ).to.equal(false);
  });

  it('accepts coerced string values', () => {
    expect(
      resolveAssistedProfileRejectedProposalConfiguration({
        captureEnabled: 'true',
        retentionDays: '7',
        purgeEnabled: 'false',
        purgeIntervalSeconds: '60',
        purgeBatchSize: '10',
      }),
    ).to.deep.equal({
      captureEnabled: true,
      retentionDays: 7,
      purgeEnabled: false,
      purgeIntervalSeconds: 60,
      purgeBatchSize: 10,
    });
  });

  it('never allows an unlimited or nonsensical retention window', () => {
    for (const invalid of [0, -1, 1.5, 91, Number.NaN, 'forever']) {
      expect(() =>
        resolveAssistedProfileRejectedProposalConfiguration({ retentionDays: invalid as never }),
      ).to.throw(ConfigurationErrorException);
    }
  });

  it('rejects an unsupported boolean value', () => {
    for (const invalid of ['yes', '1', 1, {}]) {
      expect(() =>
        resolveAssistedProfileRejectedProposalConfiguration({ captureEnabled: invalid as never }),
      ).to.throw(ConfigurationErrorException);
    }
  });
});

describe(describeName('AssistedProfileRejectedProposalCaptureService unit tests'), () => {
  const NOW = new Date('2026-08-17T12:00:00.000Z');
  let dataSource: DataSource;
  const capturedIds: number[] = [];

  before(async () => {
    dataSource = (await testSuite.app.getService<DatabaseService>(DatabaseService.name)).dataSource;
  });

  afterEach(async () => {
    for (const id of capturedIds.splice(0)) {
      await dataSource.getRepository(AssistedProfileRejectedProposal).delete(id);
    }
    await dataSource
      .getRepository(AuditLog)
      .createQueryBuilder()
      .delete()
      .where('call = :call', { call: ASSISTED_PROFILE_REJECTED_CAPTURE_AUDIT_CALL })
      .execute();
  });

  function createService(
    overrides: Partial<AssistedProfileRejectedProposalCaptureCreateOptions> = {},
  ): Promise<AssistedProfileRejectedProposalCaptureService> {
    return AssistedProfileRejectedProposalCaptureService.create({
      configuration: { captureEnabled: true, retentionDays: 14 },
      repository: new RecordingRepository(),
      auditLogService: new RecordingAuditLogService(),
      now: () => NOW,
      ...overrides,
    });
  }

  describe('flag disabled', () => {
    it('never invokes the persistence layer', async () => {
      const repository = new RecordingRepository();
      const auditLogService = new RecordingAuditLogService();
      const service = await createService({
        configuration: { captureEnabled: false },
        repository,
        auditLogService,
      });

      const outcome = await service.capture({
        proposal: REJECTED_PROPOSAL,
        rejectionCategory: 'domain_validation_failed',
      });

      expect(outcome).to.deep.equal({ captured: false, reason: 'disabled' });
      expect(repository.persisted).to.have.length(0);
      expect(auditLogService.calls).to.have.length(0);
      expect(service.enabled).to.equal(false);
    });

    it('does not even anonymize while disabled', async () => {
      let anonymizeCalls = 0;
      const service = await createService({
        configuration: { captureEnabled: false },
        anonymizer: {
          anonymize: () => {
            anonymizeCalls += 1;
            throw new Error('must not be reached');
          },
        },
      });

      await service.capture({
        proposal: REJECTED_PROPOSAL,
        rejectionCategory: 'contract_mismatch',
      });

      expect(anonymizeCalls).to.equal(0);
    });

    it('behaves identically when the flag is missing entirely', async () => {
      const repository = new RecordingRepository();
      const service = await createService({ configuration: {}, repository });

      const outcome = await service.capture({
        proposal: REJECTED_PROPOSAL,
        rejectionCategory: 'mapping_failed',
      });

      expect(outcome).to.deep.equal({ captured: false, reason: 'disabled' });
      expect(repository.persisted).to.have.length(0);
    });
  });

  describe('flag enabled', () => {
    it('persists exactly one anonymized record with the documented metadata', async () => {
      const repository = new RecordingRepository();
      const service = await createService({ repository });

      const outcome = await service.capture({
        proposal: REJECTED_PROPOSAL,
        rejectionCategory: 'domain_validation_failed',
        rejectionCode: 'ASSISTED_PROFILE_DOMAIN_VALIDATION_FAILED',
        contractVersion: '1.0.0',
        requestId: 'b7c0f5f2-0000-4000-8000-000000000000',
      });

      expect(repository.persisted).to.have.length(1);
      expect(outcome.captured).to.equal(true);

      const [record] = repository.persisted;
      expect(record.rejectionCategory).to.equal('domain_validation_failed');
      expect(record.rejectionCode).to.equal('ASSISTED_PROFILE_DOMAIN_VALIDATION_FAILED');
      expect(record.contractVersion).to.equal('1.0.0');
      expect(record.anonymizationVersion).to.equal(ASSISTED_PROFILE_ANONYMIZATION_VERSION);
      expect(record.requestId).to.equal('b7c0f5f2-0000-4000-8000-000000000000');
      expect(record.capturedAt.toISOString()).to.equal(NOW.toISOString());
      expect(record.expiresAt.toISOString()).to.equal('2026-08-31T12:00:00.000Z');
    });

    it('hands the persistence layer the anonymized proposal and nothing else', async () => {
      const repository = new RecordingRepository();
      const service = await createService({ repository });

      await service.capture({
        proposal: REJECTED_PROPOSAL,
        rejectionCategory: 'domain_validation_failed',
      });

      const [record] = repository.persisted;
      const serialized = JSON.stringify(record);
      for (const value of ['Alice Smith', 'alice@example.com', 'ACME', 'Madrid', '10.20.30.40']) {
        expect(serialized).to.not.contain(value);
      }
      // There is no field through which a raw proposal could travel.
      expect(Object.keys(record).sort()).to.deep.equal([
        'anonymizationVersion',
        'anonymizedProposal',
        'capturedAt',
        'contractVersion',
        'expiresAt',
        'proposalFingerprint',
        'rejectionCategory',
        'rejectionCode',
        'requestId',
      ]);
      expect((record.anonymizedProposal as any).intent.summary).to.equal(REDACTED_TEXT);
      expect((record.anonymizedProposal as any).generated.target.interfaces[0].address).to.equal(
        '198.51.100.1/24',
      );
    });

    it('fingerprints the anonymized payload, not the original proposal', async () => {
      const repository = new RecordingRepository();
      const service = await createService({ repository });

      const outcome = await service.capture({
        proposal: REJECTED_PROPOSAL,
        rejectionCategory: 'mapping_failed',
      });

      const [record] = repository.persisted;
      const expected = createHash('sha256')
        .update(canonicalizeFirewallProfileDraftValue(record.anonymizedProposal), 'utf8')
        .digest('hex');
      const rawHash = createHash('sha256')
        .update(canonicalizeFirewallProfileDraftValue(REJECTED_PROPOSAL), 'utf8')
        .digest('hex');

      expect(record.proposalFingerprint).to.equal(expected);
      expect(record.proposalFingerprint).to.not.equal(rawHash);
      expect(outcome.captured === true && outcome.fingerprint).to.equal(expected);
    });

    it('audits the capture with metadata only', async () => {
      const auditLogService = new RecordingAuditLogService();
      const service = await createService({ auditLogService });

      await service.capture({
        proposal: REJECTED_PROPOSAL,
        rejectionCategory: 'contract_mismatch',
        rejectionCode: 'schema_violation',
        contractVersion: 'apg.mvp.v1',
        requestId: 'req-1',
      });

      expect(auditLogService.calls).to.have.length(1);
      const [entry] = auditLogService.calls;
      expect(entry.call).to.equal(ASSISTED_PROFILE_REJECTED_CAPTURE_AUDIT_CALL);
      expect(entry.data).to.include({
        rejectionCategory: 'contract_mismatch',
        rejectionCode: 'schema_violation',
        contractVersion: 'apg.mvp.v1',
        anonymizationVersion: ASSISTED_PROFILE_ANONYMIZATION_VERSION,
        retentionDays: 14,
        expiresAt: '2026-08-31T12:00:00.000Z',
      });
      // No payload, anonymized or otherwise.
      const serialized = JSON.stringify(entry);
      expect(serialized).to.not.contain('Alice');
      expect(serialized).to.not.contain(REDACTED_TEXT);
      expect(entry.data).to.not.have.property('proposal');
      expect(entry.data).to.not.have.property('anonymizedProposal');
      // Neither an actor nor an FWCloud is recorded for a capture.
      expect(entry.userId).to.equal(undefined);
      expect(entry.fwCloudId).to.equal(undefined);
    });

    it('rejects a category outside the documented capture boundary', async () => {
      const repository = new RecordingRepository();
      const service = await createService({ repository });

      const outcome = await service.capture({
        proposal: REJECTED_PROPOSAL,
        rejectionCategory: 'agent_timeout' as never,
      });

      expect(outcome).to.deep.equal({ captured: false, reason: 'not_eligible' });
      expect(repository.persisted).to.have.length(0);
      expect(ASSISTED_PROFILE_REJECTION_CATEGORIES).to.deep.equal([
        'contract_mismatch',
        'mapping_failed',
        'domain_validation_failed',
      ]);
    });
  });

  describe('failure isolation', () => {
    it('never falls back to raw persistence when anonymization fails', async () => {
      const repository = new RecordingRepository();
      const service = await createService({
        repository,
        anonymizer: {
          anonymize: () => {
            throw new AssistedProfileProposalAnonymizationError('forced failure');
          },
        },
      });

      const outcome = await service.capture({
        proposal: REJECTED_PROPOSAL,
        rejectionCategory: 'domain_validation_failed',
      });

      expect(outcome).to.deep.equal({ captured: false, reason: 'anonymization_failed' });
      expect(repository.persisted).to.have.length(0);
    });

    it('resolves rather than throwing when persistence fails', async () => {
      const repository = new RecordingRepository();
      repository.failOnPersist = true;
      const service = await createService({ repository });

      const outcome = await service.capture({
        proposal: REJECTED_PROPOSAL,
        rejectionCategory: 'mapping_failed',
      });

      expect(outcome).to.deep.equal({ captured: false, reason: 'persistence_failed' });
    });

    it('keeps a stored sample even if its audit entry fails', async () => {
      const auditLogService = new RecordingAuditLogService();
      auditLogService.fail = true;
      const repository = new RecordingRepository();
      const service = await createService({ repository, auditLogService });

      const outcome = await service.capture({
        proposal: REJECTED_PROPOSAL,
        rejectionCategory: 'mapping_failed',
      });

      expect(outcome.captured).to.equal(true);
      expect(repository.persisted).to.have.length(1);
    });
  });

  describe('database persistence', () => {
    it('stores a real row with the anonymized payload and an expiration', async () => {
      const service = await createService({
        repository: new TypeOrmAssistedProfileRejectedProposalRepository(dataSource),
        configuration: { captureEnabled: true, retentionDays: 3 },
      });

      const outcome = await service.capture({
        proposal: REJECTED_PROPOSAL,
        rejectionCategory: 'domain_validation_failed',
        rejectionCode: 'ASSISTED_PROFILE_DOMAIN_VALIDATION_FAILED',
        contractVersion: '1.0.0',
        requestId: 'req-db-1',
      });

      expect(outcome.captured).to.equal(true);
      const id = outcome.captured === true ? outcome.id : 0;
      capturedIds.push(id);

      const stored = await dataSource
        .getRepository(AssistedProfileRejectedProposal)
        .findOneByOrFail({ id });
      expect(stored.rejectionCategory).to.equal('domain_validation_failed');
      expect(stored.anonymizationVersion).to.equal(ASSISTED_PROFILE_ANONYMIZATION_VERSION);
      expect(stored.proposalFingerprint).to.have.length(64);
      expect(stored.expiresAt.getTime() - stored.capturedAt.getTime()).to.equal(3 * 86_400_000);
      expect(JSON.stringify(stored.anonymizedProposal)).to.not.contain('Alice');

      // The table holds no column able to carry the original proposal.
      const columns: Array<{ Field: string }> = await dataSource.query(
        'SHOW COLUMNS FROM assisted_profile_rejected_proposal',
      );
      const names = columns.map((column) => column.Field);
      expect(names).to.deep.equal([
        'id',
        'rejection_category',
        'rejection_code',
        'contract_version',
        'anonymized_proposal',
        'anonymization_version',
        'proposal_fingerprint',
        'request_id',
        'captured_at',
        'expires_at',
      ]);
      for (const forbidden of [
        'raw_proposal',
        'proposal',
        'instruction',
        'user_id',
        'fwcloud_id',
      ]) {
        expect(names).to.not.contain(forbidden);
      }
    });

    it('refuses to store a payload that is not anonymizer output', async () => {
      const repository = dataSource.getRepository(AssistedProfileRejectedProposal);
      const record = repository.create({
        rejectionCategory: 'domain_validation_failed',
        rejectionCode: null,
        contractVersion: '1.0.0',
        anonymizedProposal: { generated: { target: { name: 'ACME Industrial S.L.' } } },
        anonymizationVersion: ASSISTED_PROFILE_ANONYMIZATION_VERSION,
        proposalFingerprint: null,
        requestId: null,
        capturedAt: NOW,
        expiresAt: NOW,
      });

      await expect(repository.save(record)).to.be.rejectedWith(
        AssistedProfileProposalAnonymizationError,
      );
    });

    it('refuses to store a payload without the current anonymization version', async () => {
      const repository = dataSource.getRepository(AssistedProfileRejectedProposal);
      const record = repository.create({
        rejectionCategory: 'mapping_failed',
        rejectionCode: null,
        contractVersion: '1.0.0',
        anonymizedProposal: { status: 'success' },
        anonymizationVersion: 'made-up.v0',
        proposalFingerprint: null,
        requestId: null,
        capturedAt: NOW,
        expiresAt: NOW,
      });

      await expect(repository.save(record)).to.be.rejectedWith(/anonymization version/);
    });
  });
});
