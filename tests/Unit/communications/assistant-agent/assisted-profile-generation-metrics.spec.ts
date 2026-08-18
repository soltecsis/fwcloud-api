import { expect } from 'chai';
import type { ValidatedAssistedProfileProposal } from '../../../../src/models/assistant-contract/assistant-contract-customs';
import type { FirewallProfileDraft } from '../../../../src/models/firewall-profile-draft/firewall-profile-draft.model';
import type { CreateFirewallProfileDraftInput } from '../../../../src/models/firewall-profile-draft/firewall-profile-draft-state.service';
import type { AssistedProfileProposalMapper } from '../../../../src/models/assistant-contract/assisted-profile-proposal.mapper';
import type { GenerationQueueRequest } from '../../../../src/communications/assistant-agent/generation-queue.types';
import {
  GenerationAlreadyInProgressError,
  GenerationQueueSaturatedError,
} from '../../../../src/communications/assistant-agent/generation-queue.errors';
import {
  AgentAuthenticationError,
  AgentBusyError,
  AgentConnectionError,
  AgentContractMismatchError,
  AgentReadTimeoutError,
  AgentTlsError,
} from '../../../../src/communications/assistant-agent/agent-http-errors';
import {
  AssistedProfileGenerationService,
  type AssistedProfileGenerationCreateOptions,
} from '../../../../src/communications/assistant-agent/assisted-profile-generation.service';
import { AssistedProfileMetricsService } from '../../../../src/models/assisted-profile-metrics/assisted-profile-metrics.service';
import { ASSISTED_PROFILE_METRIC_NAMES } from '../../../../src/models/assisted-profile-metrics/assisted-profile-metrics.types';
import { metricSeriesKeys, metricValue } from '../../../utils/assisted-profile-metrics.reader';
import { waitFor } from '../../../utils/wait-for';

// Same synchronization rule as the main generation spec: `run()` is
// fire-and-forget, so every assertion waits for the attempt's audit record —
// which the pipeline writes immediately before (success) or immediately after
// (clarification, rejection, failure) the metric it is paired with.

function proposal(fields: Record<string, unknown>): ValidatedAssistedProfileProposal {
  return fields as unknown as ValidatedAssistedProfileProposal;
}

const SUCCESS_PROPOSAL = proposal({ status: 'success', metadata: { schemaVersion: '1.0.0' } });

const CLARIFICATION_PROPOSAL = proposal({
  status: 'needs_clarification',
  metadata: { schemaVersion: '1.0.0' },
  clarification: {
    questions: [{ code: 'which_service', question: 'Which service?', required: true }],
  },
});

const MAPPED_DTO = {
  targetKind: 'firewall',
  model: { provision: { interfaces: [], rules: [] } },
} as unknown as ReturnType<AssistedProfileProposalMapper['map']>;

interface Harness {
  service: AssistedProfileGenerationService;
  metrics: AssistedProfileMetricsService;
  auditCalls: Array<Record<string, unknown>>;
  channel: { emit: (event: 'message', payload: object) => boolean };
  agentGenerate: (value: ValidatedAssistedProfileProposal | Error) => void;
  waitForAuditCount: (expected: number) => Promise<void>;
  value: (name: string, labels?: Record<string, string>) => number;
}

async function buildHarness(
  overrides: Partial<AssistedProfileGenerationCreateOptions> = {},
): Promise<Harness> {
  const auditCalls: Array<Record<string, unknown>> = [];
  const metrics = await AssistedProfileMetricsService.create();
  const channel = { emit: (): boolean => true };

  let nextAgentResult: ValidatedAssistedProfileProposal | Error = SUCCESS_PROPOSAL;
  let generationCounter = 0;

  const service = await AssistedProfileGenerationService.create({
    queue: {
      enqueue: async (request: GenerationQueueRequest) => ({
        generationId: request.generationId,
        proposal: await request.execute({ generationId: request.generationId }),
      }),
    },
    agentClient: {
      generate: async () => {
        if (nextAgentResult instanceof Error) {
          throw nextAgentResult;
        }
        return nextAgentResult;
      },
    },
    mapper: { mapWithAssumptions: () => ({ dto: MAPPED_DTO, assumptions: [] }) },
    validationService: { validate: () => [] },
    draftStateService: {
      create: async (input: CreateFirewallProfileDraftInput) =>
        ({ id: 42, ...input }) as unknown as FirewallProfileDraft,
    },
    auditLogService: {
      logMutation: async (input: Record<string, unknown>) => {
        auditCalls.push(input);
        return null;
      },
    },
    rejectedProposalCapture: {
      capture: async () => ({ captured: false as const, reason: 'disabled' as const }),
    },
    metrics,
    generationIdFactory: () => `gen_test_${++generationCounter}`,
    requestIdFactory: () => `req_test_${generationCounter}`,
    rateLimit: { maxRequests: 50, windowMs: 60_000 },
    clarificationTtlMs: 60_000,
    ...overrides,
  });

  return {
    service,
    metrics,
    auditCalls,
    channel,
    agentGenerate: (value) => {
      nextAgentResult = value;
    },
    waitForAuditCount: (expected: number) => waitFor(() => auditCalls.length >= expected),
    value: (name: string, labels: Record<string, string> = {}) =>
      metricValue(metrics.snapshot().families, name, labels),
  };
}

const NAMES = ASSISTED_PROFILE_METRIC_NAMES;

const generate = (harness: Harness, instruction = 'Create a firewall with WAN and LAN') =>
  harness.service.accept({
    fwCloudId: 10,
    userId: 1,
    instruction,
    channel: harness.channel,
  });

describe('Assisted Profile generation adoption metrics unit tests', () => {
  it('counts an accepted generation before the pipeline decides anything', async () => {
    const harness = await buildHarness();
    await generate(harness);

    expect(harness.value(NAMES.generationStarted, { attempt: 'initial' })).to.equal(1);
    expect(harness.value(NAMES.generationStarted, { attempt: 'clarification_answer' })).to.equal(0);
  });

  it('records success without any rejection or failure series moving', async () => {
    const harness = await buildHarness();
    await generate(harness);
    await harness.waitForAuditCount(1);

    expect(harness.value(NAMES.generation, { outcome: 'success' })).to.equal(1);
    expect(harness.value(NAMES.generation, { outcome: 'clarification' })).to.equal(0);
    const generationFamily = harness.metrics
      .snapshot()
      .families.find((family) => family.name === NAMES.generation);
    const nonSuccess = generationFamily.samples.filter(
      (sample) => sample.labels.outcome !== 'success',
    );
    expect(nonSuccess.every((sample) => sample.value === 0)).to.equal(true);
  });

  it('does not record the validated-draft counter from the generation flow', async () => {
    // That counter belongs to the persistence event inside the draft state
    // service, which this harness replaces with a stub; counting it here too
    // would double-count every successful generation in a real deployment.
    const harness = await buildHarness();
    await generate(harness);
    await harness.waitForAuditCount(1);

    expect(harness.value(NAMES.draftValidated)).to.equal(0);
  });

  it('does not count a rate-limited request as an accepted generation', async () => {
    const harness = await buildHarness({ rateLimit: { maxRequests: 1, windowMs: 60_000 } });
    const actor = { fwCloudId: 10, userId: 7 };

    await harness.service.checkRateLimit(actor);
    let rejected = false;
    try {
      await harness.service.checkRateLimit(actor);
    } catch {
      rejected = true;
    }

    expect(rejected).to.equal(true);
    expect(harness.value(NAMES.generationStarted, { attempt: 'initial' })).to.equal(0);
  });

  describe('clarification', () => {
    it('records the clarification when it is actually emitted', async () => {
      const harness = await buildHarness();
      harness.agentGenerate(CLARIFICATION_PROPOSAL);
      await generate(harness);
      await harness.waitForAuditCount(1);

      expect(harness.value(NAMES.generation, { outcome: 'clarification' })).to.equal(1);
      expect(harness.value(NAMES.generation, { outcome: 'success' })).to.equal(0);
    });

    it('counts the later successful draft of the same generation as well', async () => {
      const harness = await buildHarness();
      harness.agentGenerate(CLARIFICATION_PROPOSAL);
      const { generationId } = await generate(harness);
      await harness.waitForAuditCount(1);

      harness.agentGenerate(SUCCESS_PROPOSAL);
      await harness.service.accept({
        fwCloudId: 10,
        userId: 1,
        clarification: { generationId, answer: 'https' },
        channel: harness.channel,
      });
      await harness.waitForAuditCount(2);

      expect(harness.value(NAMES.generation, { outcome: 'clarification' })).to.equal(1);
      expect(harness.value(NAMES.generation, { outcome: 'success' })).to.equal(1);
      expect(harness.value(NAMES.generationStarted, { attempt: 'initial' })).to.equal(1);
      expect(harness.value(NAMES.generationStarted, { attempt: 'clarification_answer' })).to.equal(
        1,
      );
    });

    it('never puts the question or the answer into a label', async () => {
      const harness = await buildHarness();
      harness.agentGenerate(CLARIFICATION_PROPOSAL);
      const { generationId } = await generate(harness, 'Protect customer-firewall-01');
      await harness.waitForAuditCount(1);

      harness.agentGenerate(SUCCESS_PROPOSAL);
      await harness.service.accept({
        fwCloudId: 10,
        userId: 1,
        clarification: { generationId, answer: 'the one at 10.20.30.40' },
        channel: harness.channel,
      });
      await harness.waitForAuditCount(2);

      const serialized = JSON.stringify(harness.metrics.snapshot());
      expect(serialized).to.not.contain('Which service');
      expect(serialized).to.not.contain('customer-firewall-01');
      expect(serialized).to.not.contain('10.20.30.40');
      expect(serialized).to.not.contain(generationId);
    });

    it('classifies a second unresolved clarification round as a rejection', async () => {
      const harness = await buildHarness();
      harness.agentGenerate(CLARIFICATION_PROPOSAL);
      const { generationId } = await generate(harness);
      await harness.waitForAuditCount(1);

      await harness.service.accept({
        fwCloudId: 10,
        userId: 1,
        clarification: { generationId, answer: 'still unclear' },
        channel: harness.channel,
      });
      await harness.waitForAuditCount(2);

      expect(
        harness.value(NAMES.generation, { outcome: 'rejected', reason: 'clarification_limit' }),
      ).to.equal(1);
    });
  });

  describe('bounded rejection and failure classification', () => {
    const cases: Array<{
      title: string;
      error: Error;
      outcome: 'rejected' | 'failed';
      reason: string;
    }> = [
      {
        title: 'contract mismatch',
        error: new AgentContractMismatchError({
          requestId: 'req_test_1',
          reason: 'schema_violation',
          contractVersion: 'apg.mvp.v1',
          receivedVersion: '1.0.0',
          supportedVersions: ['1.0.0'],
        }),
        outcome: 'rejected',
        reason: 'contract_mismatch',
      },
      {
        title: 'agent unreachable',
        error: new AgentConnectionError({ requestId: 'req_test_1' }),
        outcome: 'failed',
        reason: 'unavailable',
      },
      {
        title: 'TLS failure',
        error: new AgentTlsError({ requestId: 'req_test_1' }),
        outcome: 'failed',
        reason: 'unavailable',
      },
      {
        title: 'read timeout',
        error: new AgentReadTimeoutError({ requestId: 'req_test_1' }),
        outcome: 'failed',
        reason: 'timeout',
      },
      {
        title: 'agent busy',
        error: new AgentBusyError({ requestId: 'req_test_1' }),
        outcome: 'failed',
        reason: 'saturated',
      },
      {
        title: 'queue saturated',
        error: new GenerationQueueSaturatedError(3),
        outcome: 'failed',
        reason: 'saturated',
      },
      {
        title: 'duplicate generation',
        error: new GenerationAlreadyInProgressError('gen_test_1', 1, 10),
        outcome: 'failed',
        reason: 'duplicate_in_progress',
      },
      {
        title: 'credentials rejected',
        error: new AgentAuthenticationError({ requestId: 'req_test_1' }),
        outcome: 'failed',
        reason: 'authentication_failed',
      },
      {
        title: 'unexpected internal error',
        error: new Error('connection to 10.20.30.40 refused for user@example.com'),
        outcome: 'failed',
        reason: 'internal_error',
      },
    ];

    for (const testCase of cases) {
      it(`maps ${testCase.title} to ${testCase.outcome}/${testCase.reason}`, async () => {
        const harness = await buildHarness();
        harness.agentGenerate(testCase.error);
        await generate(harness);
        await harness.waitForAuditCount(1);

        expect(
          harness.value(NAMES.generation, {
            outcome: testCase.outcome,
            reason: testCase.reason,
          }),
        ).to.equal(1);
        expect(harness.value(NAMES.generation, { outcome: 'success' })).to.equal(0);
        expect(harness.metrics.droppedIncrements).to.equal(0);
      });
    }

    it('maps a mapper failure to a rejection without leaking its cause', async () => {
      const harness = await buildHarness({
        mapper: {
          mapWithAssumptions: () => {
            throw new Error('interface eth0 of customer-firewall-01 is unmappable');
          },
        },
      });
      await generate(harness);
      await harness.waitForAuditCount(1);

      expect(
        harness.value(NAMES.generation, { outcome: 'rejected', reason: 'mapping_failed' }),
      ).to.equal(1);
      expect(JSON.stringify(harness.metrics.snapshot())).to.not.contain('customer-firewall-01');
    });

    it('maps a domain validation rejection to its own bounded class', async () => {
      const harness = await buildHarness({
        validationService: {
          validate: () => [
            {
              code: 'INTERFACE_ADDRESS_OVERLAP',
              severity: 'error' as const,
              path: 'model.provision.interfaces[0].address',
              message: '10.20.30.40/24 overlaps',
            },
          ],
        },
      });
      await generate(harness);
      await harness.waitForAuditCount(1);

      expect(
        harness.value(NAMES.generation, { outcome: 'rejected', reason: 'domain_validation' }),
      ).to.equal(1);
      expect(JSON.stringify(harness.metrics.snapshot())).to.not.contain('10.20.30.40');
    });
  });

  it('keeps the series set fixed across many users, FWClouds and instructions', async () => {
    const harness = await buildHarness();
    const before = metricSeriesKeys(harness.metrics.snapshot().families);

    for (let index = 0; index < 8; index++) {
      await harness.service.accept({
        fwCloudId: 100 + index,
        userId: 200 + index,
        userName: `operator-${index}@example.com`,
        instruction: `Protect customer-firewall-${index}`,
        channel: harness.channel,
      });
    }
    await harness.waitForAuditCount(8);

    const after = metricSeriesKeys(harness.metrics.snapshot().families);

    expect(after).to.deep.equal(before);
    expect(harness.metrics.droppedIncrements).to.equal(0);
    expect(JSON.stringify(harness.metrics.snapshot())).to.not.contain('example.com');
  });
});
