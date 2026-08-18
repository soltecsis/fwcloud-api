import type { DataSource } from 'typeorm';
import { describeName, expect, testSuite } from '../../../mocha/global-setup';
import { DatabaseService } from '../../../../src/database/database.service';
import { AuditLog } from '../../../../src/models/audit/AuditLog';
import { FirewallProfileDraft } from '../../../../src/models/firewall-profile-draft/firewall-profile-draft.model';
import { FirewallProfileDraftStateService } from '../../../../src/models/firewall-profile-draft/firewall-profile-draft-state.service';
import { FirewallProfileDraftTransitionConflictError } from '../../../../src/models/firewall-profile-draft/firewall-profile-draft.errors';
import type { FirewallProfileDraftStatus } from '../../../../src/models/firewall-profile-draft/firewall-profile-draft.types';
import { ExpireFirewallProfileDraftsJob } from '../../../../src/models/firewall-profile-draft/firewall-profile-draft-expiration.service';
import { AssistedProfileMetricsService } from '../../../../src/models/assisted-profile-metrics/assisted-profile-metrics.service';
import { ASSISTED_PROFILE_METRIC_NAMES } from '../../../../src/models/assisted-profile-metrics/assisted-profile-metrics.types';
import { metricSeriesKeys, metricValue } from '../../../utils/assisted-profile-metrics.reader';
import { makeFirewallProfileDraftAttributes } from '../../../utils/firewall-profile-draft-factory';
import { RecordingAuditLogService } from '../../../utils/recording-audit-log.service';

/**
 * Drives the real state machine against the real database, because the whole
 * point of these counters is that they describe committed transitions. A stub
 * state service could not prove that a conflicting transition leaves the
 * numbers untouched.
 */
describe(describeName('Assisted Profile draft lifecycle metrics unit tests'), () => {
  let dataSource: DataSource;
  let stateService: FirewallProfileDraftStateService;
  let metrics: AssistedProfileMetricsService;
  let fwCloudId: number;
  let ownsFwCloud = false;
  const draftIds: number[] = [];

  const NAMES = ASSISTED_PROFILE_METRIC_NAMES;

  const value = (name: string, labels: Record<string, string> = {}): number =>
    metricValue(metrics.snapshot().families, name, labels);

  before(async () => {
    dataSource = (await testSuite.app.getService<DatabaseService>(DatabaseService.name)).dataSource;
    stateService = await testSuite.app.getService<FirewallProfileDraftStateService>(
      FirewallProfileDraftStateService.name,
    );
    metrics = await testSuite.app.getService<AssistedProfileMetricsService>(
      AssistedProfileMetricsService.name,
    );

    let [fwCloud] = await dataSource.query('SELECT id FROM fwcloud ORDER BY id LIMIT 1');
    if (!fwCloud) {
      const result = await dataSource.query('INSERT INTO fwcloud (name) VALUES (?)', [
        'Assisted Profile metrics tests',
      ]);
      fwCloud = { id: result.insertId };
      ownsFwCloud = true;
    }
    fwCloudId = Number(fwCloud.id);
  });

  after(async () => {
    metrics.reset();
    if (ownsFwCloud) {
      await dataSource.query('DELETE FROM fwcloud WHERE id = ?', [fwCloudId]);
    }
  });

  beforeEach(() => {
    metrics.reset();
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
  });

  /** Uses the shared factory so each parked draft carries the lifecycle
   * timestamps its status implies, exactly as the other draft suites do. */
  async function createDraft(status: FirewallProfileDraftStatus): Promise<FirewallProfileDraft> {
    const repository = dataSource.getRepository(FirewallProfileDraft);
    const draft = await repository.save(
      repository.create(
        makeFirewallProfileDraftAttributes(fwCloudId, status, {
          proposal: { metadata: { schemaVersion: '1.0.0' }, generated: {} },
          previewHash: status === 'preview_ok' ? 'a'.repeat(64) : null,
        }),
      ),
    );
    draftIds.push(draft.id);
    return draft;
  }

  describe('validated draft creation', () => {
    it('counts the persistence event exactly once', async () => {
      const draft = await stateService.create({
        fwCloudId,
        createdBy: null,
        contractVersion: 'apg.mvp.v1',
        proposal: { metadata: { schemaVersion: '1.0.0' } },
      });
      draftIds.push(draft.id);

      expect(value(NAMES.draftValidated)).to.equal(1);
      expect(draft.status).to.equal('validated');
    });

    it('is unaffected by later reads of the same draft', async () => {
      const draft = await stateService.create({
        fwCloudId,
        createdBy: null,
        contractVersion: 'apg.mvp.v1',
        proposal: { metadata: { schemaVersion: '1.0.0' } },
      });
      draftIds.push(draft.id);

      await stateService.loadForProcessing(draft.id, fwCloudId);
      await stateService.loadForProcessing(draft.id, fwCloudId);
      await stateService.listByFwCloud(fwCloudId);

      expect(value(NAMES.draftValidated)).to.equal(1);
    });

    it('is not re-incremented when a preview is invalidated back to validated', async () => {
      const draft = await createDraft('preview_ok');

      await stateService.updatePreviewBoundContent(draft.id, { assumptions: [] }, { fwCloudId });

      expect(value(NAMES.draftValidated)).to.equal(0);
      expect(value(NAMES.preview)).to.equal(0);
    });
  });

  describe('preview', () => {
    it('counts a committed validated -> preview_ok transition', async () => {
      const draft = await createDraft('validated');

      await stateService.transition(draft.id, 'validated', 'preview_ok', {
        fwCloudId,
        previewHash: 'b'.repeat(64),
      });

      expect(value(NAMES.preview)).to.equal(1);
    });

    it('does not count a transition that was refused as a conflict', async () => {
      const draft = await createDraft('applied');

      await expect(
        stateService.transition(draft.id, 'validated', 'preview_ok', { fwCloudId }),
      ).to.be.rejectedWith(FirewallProfileDraftTransitionConflictError);

      expect(value(NAMES.preview)).to.equal(0);
    });
  });

  describe('apply', () => {
    it('counts a committed apply_pending -> applied transition', async () => {
      const draft = await createDraft('apply_pending');

      await stateService.transition(draft.id, 'apply_pending', 'applied', { fwCloudId });

      expect(value(NAMES.apply, { result: 'applied' })).to.equal(1);
      expect(value(NAMES.apply, { result: 'apply_failed' })).to.equal(0);
    });

    it('counts a committed apply_pending -> apply_failed transition separately', async () => {
      const draft = await createDraft('apply_pending');

      await stateService.transition(draft.id, 'apply_pending', 'apply_failed', {
        fwCloudId,
        errorCode: 'APPLY_FAILED',
      });

      expect(value(NAMES.apply, { result: 'apply_failed' })).to.equal(1);
      expect(value(NAMES.apply, { result: 'applied' })).to.equal(0);
    });

    it('does not count the intermediate preview_ok -> apply_pending step', async () => {
      const draft = await createDraft('preview_ok');

      await stateService.transition(draft.id, 'preview_ok', 'apply_pending', {
        fwCloudId,
        applyHash: draft.previewHash,
      });

      expect(value(NAMES.apply, { result: 'applied' })).to.equal(0);
      expect(value(NAMES.apply, { result: 'apply_failed' })).to.equal(0);
    });

    it('does not count a second apply attempt on an already applied draft', async () => {
      const draft = await createDraft('apply_pending');
      await stateService.transition(draft.id, 'apply_pending', 'applied', { fwCloudId });

      await expect(
        stateService.transition(draft.id, 'apply_pending', 'applied', { fwCloudId }),
      ).to.be.rejectedWith(FirewallProfileDraftTransitionConflictError);

      expect(value(NAMES.apply, { result: 'applied' })).to.equal(1);
    });
  });

  describe('discard', () => {
    it('counts a committed discard', async () => {
      const draft = await createDraft('validated');

      await stateService.transition(draft.id, 'validated', 'discarded', { fwCloudId });

      expect(value(NAMES.draftDiscarded)).to.equal(1);
    });

    it('does not count a repeated discard of an already discarded draft', async () => {
      const draft = await createDraft('validated');
      await stateService.transition(draft.id, 'validated', 'discarded', { fwCloudId });

      await expect(
        stateService.transition(draft.id, 'discarded', 'discarded', { fwCloudId }),
      ).to.be.rejectedWith(FirewallProfileDraftTransitionConflictError);

      expect(value(NAMES.draftDiscarded)).to.equal(1);
    });
  });

  describe('expiration', () => {
    it('counts each draft the job actually transitions, once', async () => {
      const first = await createDraft('validated');
      const second = await createDraft('preview_ok');
      const auditLogService = new RecordingAuditLogService();
      const job = await ExpireFirewallProfileDraftsJob.create({
        configuration: { ttlSeconds: 1, enabled: false, intervalSeconds: 3600, batchSize: 50 },
        dataSource,
        stateService,
        auditLogService: auditLogService as never,
        now: () => new Date(Date.now() + 86_400_000),
      });

      const stats = await job.run();

      expect(stats.expired).to.be.greaterThanOrEqual(2);
      expect(value(NAMES.draftExpired)).to.equal(stats.expired);
      for (const draft of [first, second]) {
        const reloaded = await dataSource
          .getRepository(FirewallProfileDraft)
          .findOneByOrFail({ id: draft.id });
        expect(reloaded.status).to.equal('expired');
      }

      // A second sweep can no longer see them: `expired` is terminal and the
      // candidate query only selects statuses that may still reach it.
      const before = value(NAMES.draftExpired);
      const secondRun = await job.run();
      expect(secondRun.expired).to.equal(0);
      expect(value(NAMES.draftExpired)).to.equal(before);
    });
  });

  it('creates no new metric series whatever the drafts, FWClouds or users are', async () => {
    const before = metricSeriesKeys(metrics.snapshot().families);

    for (let index = 0; index < 5; index++) {
      const draft = await stateService.create({
        fwCloudId,
        createdBy: null,
        contractVersion: 'apg.mvp.v1',
        proposal: { metadata: { schemaVersion: '1.0.0' } },
        requestId: `req-${index}-customer-firewall-01`,
        instructionOriginal: `Protect 10.20.30.4${index} for user@example.com`,
      });
      draftIds.push(draft.id);
      await stateService.transition(draft.id, 'validated', 'discarded', {
        fwCloudId,
        userId: null,
      });
    }

    const after = metricSeriesKeys(metrics.snapshot().families);

    expect(after).to.deep.equal(before);
    expect(metrics.droppedIncrements).to.equal(0);

    const serialized = JSON.stringify(metrics.snapshot());
    expect(serialized).to.not.contain('customer-firewall-01');
    expect(serialized).to.not.contain('user@example.com');
    expect(serialized).to.not.contain('10.20.30.4');
    for (const id of draftIds) {
      expect(serialized).to.not.contain(`"${id}"`);
    }
  });
});
