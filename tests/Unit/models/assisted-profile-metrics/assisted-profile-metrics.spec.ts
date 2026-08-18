import { expect } from 'chai';
import { CounterRegistry } from '../../../../src/models/assisted-profile-metrics/counter-registry';
import {
  AssistedProfileMetricsService,
  NOOP_ASSISTED_PROFILE_METRICS,
} from '../../../../src/models/assisted-profile-metrics/assisted-profile-metrics.service';
import {
  ASSISTED_PROFILE_APPLY_RESULTS,
  ASSISTED_PROFILE_COUNTER_DECLARATIONS,
  ASSISTED_PROFILE_GENERATION_ATTEMPTS,
  ASSISTED_PROFILE_GENERATION_FAILURE_REASONS,
  ASSISTED_PROFILE_GENERATION_REJECTION_REASONS,
  ASSISTED_PROFILE_METRIC_NAMES,
  ASSISTED_PROFILE_PREVIEW_FAILURE_REASONS,
} from '../../../../src/models/assisted-profile-metrics/assisted-profile-metrics.types';
import { metricValue } from '../../../utils/assisted-profile-metrics.reader';

/**
 * Identifiers that must never become a metric label name. Kept as a literal
 * list rather than derived from the declarations, so adding a forbidden
 * dimension fails this test instead of silently redefining what "forbidden"
 * means.
 */
const FORBIDDEN_LABEL_NAMES = [
  'draft_id',
  'draftId',
  'generation_id',
  'generationId',
  'user_id',
  'userId',
  'user',
  'username',
  'fwcloud_id',
  'fwCloudId',
  'target_id',
  'targetId',
  'request_id',
  'requestId',
  'idempotency_key',
  'instruction',
  'proposal',
  'message',
  'error',
  'host',
  'hostname',
  'ip',
  'email',
];

const sampleValue = (
  service: AssistedProfileMetricsService,
  name: string,
  labels: Record<string, string> = {},
): number => metricValue(service.snapshot().families, name, labels);

describe('Assisted Profile adoption metrics unit tests', () => {
  describe('CounterRegistry', () => {
    const declarations = [
      {
        name: 'test_counter_total',
        help: 'help',
        labelNames: ['result'],
        series: [{ result: 'ok' }, { result: 'ko' }],
      },
      { name: 'test_plain_total', help: 'help', labelNames: [], series: [{}] },
    ];

    it('materializes every declared series at zero, including untouched ones', () => {
      const registry = new CounterRegistry(declarations);
      const snapshot = registry.snapshot();

      expect(snapshot.map((family) => family.name)).to.deep.equal([
        'test_counter_total',
        'test_plain_total',
      ]);
      expect(snapshot[0].samples).to.deep.equal([
        { labels: { result: 'ok' }, value: 0 },
        { labels: { result: 'ko' }, value: 0 },
      ]);
    });

    it('increments only the addressed series', () => {
      const registry = new CounterRegistry(declarations);
      registry.increment('test_counter_total', { result: 'ok' });
      registry.increment('test_counter_total', { result: 'ok' });
      registry.increment('test_plain_total');

      expect(registry.read('test_counter_total', { result: 'ok' })).to.equal(2);
      expect(registry.read('test_counter_total', { result: 'ko' })).to.equal(0);
      expect(registry.read('test_plain_total')).to.equal(1);
    });

    it('never creates a series that was not declared', () => {
      const registry = new CounterRegistry(declarations);

      expect(registry.increment('test_counter_total', { result: 'draft-4711' })).to.equal(false);
      expect(registry.increment('test_counter_total', { draft_id: '4711' })).to.equal(false);
      expect(registry.increment('unknown_total')).to.equal(false);

      expect(registry.droppedIncrements).to.equal(3);
      const series = registry.snapshot().flatMap((family) => family.samples);
      expect(series).to.have.length(3);
      expect(series.every((sample) => sample.value === 0)).to.equal(true);
    });

    it('treats label order as irrelevant to series identity', () => {
      const registry = new CounterRegistry([
        {
          name: 'two_label_total',
          help: 'help',
          labelNames: ['a', 'b'],
          series: [{ a: '1', b: '2' }],
        },
      ]);

      registry.increment('two_label_total', { b: '2', a: '1' });

      expect(registry.read('two_label_total', { a: '1', b: '2' })).to.equal(1);
    });

    it('reset() returns every series to zero and restarts the window', () => {
      const registry = new CounterRegistry(declarations, () => new Date('2026-01-01T00:00:00Z'));
      registry.increment('test_plain_total');

      registry.reset(() => new Date('2026-02-01T00:00:00Z'));

      expect(registry.read('test_plain_total')).to.equal(0);
      expect(registry.droppedIncrements).to.equal(0);
      expect(registry.collectionStartedAt.toISOString()).to.equal('2026-02-01T00:00:00.000Z');
    });
  });

  describe('declared vocabulary', () => {
    it('exposes exactly the documented metric families', () => {
      expect(ASSISTED_PROFILE_COUNTER_DECLARATIONS.map((item) => item.name)).to.deep.equal([
        'assisted_profile_generation_started_total',
        'assisted_profile_generation_total',
        'assisted_profile_draft_validated_total',
        'assisted_profile_preview_total',
        'assisted_profile_preview_failed_total',
        'assisted_profile_apply_total',
        'assisted_profile_draft_discarded_total',
        'assisted_profile_draft_expired_total',
      ]);
    });

    it('uses no identifying or free-text label name', () => {
      const labelNames = ASSISTED_PROFILE_COUNTER_DECLARATIONS.flatMap(
        (declaration) => declaration.labelNames,
      );

      expect([...new Set(labelNames)].sort()).to.deep.equal([
        'attempt',
        'outcome',
        'reason',
        'result',
      ]);
      for (const forbidden of FORBIDDEN_LABEL_NAMES) {
        expect(labelNames).to.not.include(forbidden);
      }
    });

    it('declares only label values drawn from the closed vocabularies', () => {
      const allowed: Record<string, readonly string[]> = {
        attempt: ASSISTED_PROFILE_GENERATION_ATTEMPTS,
        outcome: ['success', 'clarification', 'rejected', 'failed'],
        reason: [
          'none',
          ...ASSISTED_PROFILE_GENERATION_REJECTION_REASONS,
          ...ASSISTED_PROFILE_GENERATION_FAILURE_REASONS,
          ...ASSISTED_PROFILE_PREVIEW_FAILURE_REASONS,
        ],
        result: ASSISTED_PROFILE_APPLY_RESULTS,
      };

      for (const declaration of ASSISTED_PROFILE_COUNTER_DECLARATIONS) {
        for (const series of declaration.series) {
          expect(Object.keys(series).sort()).to.deep.equal([...declaration.labelNames].sort());
          for (const [label, value] of Object.entries(series)) {
            expect(allowed[label], `undocumented label ${label}`).to.include(value);
          }
        }
      }
    });

    it('keeps every series free of characters that could carry embedded data', () => {
      for (const declaration of ASSISTED_PROFILE_COUNTER_DECLARATIONS) {
        for (const series of declaration.series) {
          for (const value of Object.values(series)) {
            expect(value).to.match(/^[a-z][a-z0-9_]*$/);
          }
        }
      }
    });
  });

  describe('AssistedProfileMetricsService', () => {
    let service: AssistedProfileMetricsService;

    beforeEach(async () => {
      service = await AssistedProfileMetricsService.create();
    });

    it('starts with every declared series at zero', () => {
      const snapshot = service.snapshot();
      const samples = snapshot.families.flatMap((family) => family.samples);

      expect(samples).to.have.length.greaterThan(0);
      expect(samples.every((sample) => sample.value === 0)).to.equal(true);
      expect(snapshot.collectionStartedAt).to.be.a('string');
      expect(snapshot.collectedAt).to.be.a('string');
    });

    it('routes each record method to its own series', () => {
      service.recordGenerationStarted('initial');
      service.recordGenerationStarted('clarification_answer');
      service.recordGenerationSuccess();
      service.recordClarification();
      service.recordGenerationRejected('contract_mismatch');
      service.recordGenerationFailed('timeout');
      service.recordDraftValidated();
      service.recordPreviewCompleted();
      service.recordPreviewFailed('illegal_state');
      service.recordApply('applied');
      service.recordApply('apply_failed');
      service.recordDraftDiscarded();
      service.recordDraftExpired();

      const names = ASSISTED_PROFILE_METRIC_NAMES;
      expect(sampleValue(service, names.generationStarted, { attempt: 'initial' })).to.equal(1);
      expect(
        sampleValue(service, names.generationStarted, { attempt: 'clarification_answer' }),
      ).to.equal(1);
      expect(sampleValue(service, names.generation, { outcome: 'success' })).to.equal(1);
      expect(sampleValue(service, names.generation, { outcome: 'clarification' })).to.equal(1);
      expect(
        sampleValue(service, names.generation, {
          outcome: 'rejected',
          reason: 'contract_mismatch',
        }),
      ).to.equal(1);
      expect(
        sampleValue(service, names.generation, { outcome: 'failed', reason: 'timeout' }),
      ).to.equal(1);
      expect(sampleValue(service, names.draftValidated)).to.equal(1);
      expect(sampleValue(service, names.preview)).to.equal(1);
      expect(sampleValue(service, names.previewFailed, { reason: 'illegal_state' })).to.equal(1);
      expect(sampleValue(service, names.apply, { result: 'applied' })).to.equal(1);
      expect(sampleValue(service, names.apply, { result: 'apply_failed' })).to.equal(1);
      expect(sampleValue(service, names.draftDiscarded)).to.equal(1);
      expect(sampleValue(service, names.draftExpired)).to.equal(1);
      expect(service.droppedIncrements).to.equal(0);
    });

    it('keeps a successful preview out of the preview-failure counter and vice versa', () => {
      service.recordPreviewFailed('transition_conflict');
      service.recordPreviewFailed('domain_validation_failed');

      expect(sampleValue(service, ASSISTED_PROFILE_METRIC_NAMES.preview)).to.equal(0);
      expect(
        sampleValue(service, ASSISTED_PROFILE_METRIC_NAMES.previewFailed, {
          reason: 'transition_conflict',
        }),
      ).to.equal(1);
    });

    it('never throws when the underlying registry fails', () => {
      const broken = service as unknown as { _registry: { increment: () => boolean } };
      const original = broken._registry.increment;
      broken._registry.increment = () => {
        throw new Error('registry exploded');
      };

      try {
        expect(() => service.recordApply('applied')).to.not.throw();
        expect(() => service.recordDraftValidated()).to.not.throw();
        expect(() => service.recordGenerationFailed('internal_error')).to.not.throw();
      } finally {
        broken._registry.increment = original;
      }
    });

    it('exposes a no-op recorder with the full recorder surface', () => {
      const methods = Object.keys(NOOP_ASSISTED_PROFILE_METRICS);

      expect(methods).to.have.length(11);
      for (const method of methods) {
        expect(() =>
          (NOOP_ASSISTED_PROFILE_METRICS as unknown as Record<string, () => void>)[method](),
        ).to.not.throw();
      }
    });

    it('reset() clears the counters', () => {
      service.recordDraftDiscarded();
      service.reset();

      expect(sampleValue(service, ASSISTED_PROFILE_METRIC_NAMES.draftDiscarded)).to.equal(0);
    });
  });
});
