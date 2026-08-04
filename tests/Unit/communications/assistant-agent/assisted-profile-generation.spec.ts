import { expect } from 'chai';
import type { ValidatedAssistedProfileProposal } from '../../../../src/models/assistant-contract/assistant-contract-customs';
import type { ReplicationProfileValidationError } from '../../../../src/models/replication-profile/replication-profile-validation.service';
import type { FirewallProfileDraft } from '../../../../src/models/firewall-profile-draft/firewall-profile-draft.model';
import type { CreateFirewallProfileDraftInput } from '../../../../src/models/firewall-profile-draft/firewall-profile-draft-state.service';
import type { AssistedProfileProposalMapper } from '../../../../src/models/assistant-contract/assisted-profile-proposal.mapper';
import type { GenerationQueueRequest } from '../../../../src/communications/assistant-agent/generation-queue.types';
import {
  GenerationAlreadyInProgressError,
  GenerationQueueSaturatedError,
} from '../../../../src/communications/assistant-agent/generation-queue.errors';
import {
  AgentBusyError,
  AgentConnectionError,
  AgentReadTimeoutError,
} from '../../../../src/communications/assistant-agent/agent-http-errors';
import {
  AssistedProfileGenerationService,
  type AssistedProfileGenerationCreateOptions,
} from '../../../../src/communications/assistant-agent/assisted-profile-generation.service';
import { AssistedProfileGenerationRateLimitedError } from '../../../../src/communications/assistant-agent/assisted-profile-generation.errors';
import type { AssistedProfileGenerationProgressPayload } from '../../../../src/communications/assistant-agent/assisted-profile-generation-progress.types';
import { waitFor } from '../../../utils/wait-for';

// `run()` is fire-and-forget from `accept()`'s perspective, and the exact
// microtask ordering between "accept() resolves" and "run() finishes and
// audits" is not guaranteed (a queue-admission rejection can finish `run()`
// before `accept()`'s own trailing return even settles). Polling for the
// expected audit count is therefore the only race-free way to synchronize
// with the background pipeline in these tests.

function proposal(fields: Record<string, unknown>): ValidatedAssistedProfileProposal {
  return fields as unknown as ValidatedAssistedProfileProposal;
}

const SUCCESS_PROPOSAL = proposal({
  status: 'success',
  metadata: { schemaVersion: '1.0.0' },
});

const CLARIFICATION_PROPOSAL = proposal({
  status: 'needs_clarification',
  metadata: { schemaVersion: '1.0.0' },
  clarification: {
    questions: [
      {
        code: 'which_service',
        question: 'Which service?',
        required: true,
        options: ['http', 'https'],
      },
    ],
  },
});

const MAPPED_DTO = {
  targetKind: 'firewall',
  model: { provision: { interfaces: [], rules: [] } },
} as unknown as ReturnType<AssistedProfileProposalMapper['map']>;

interface Harness {
  service: AssistedProfileGenerationService;
  auditCalls: Array<Record<string, unknown>>;
  events: AssistedProfileGenerationProgressPayload[];
  draftCreateCalls: CreateFirewallProfileDraftInput[];
  channel: { emit: (event: 'message', payload: object) => boolean };
  agentGenerate: (proposalToReturn: ValidatedAssistedProfileProposal | Error) => void;
  waitForAuditCount: (expected: number) => Promise<void>;
}

async function buildHarness(
  overrides: Partial<AssistedProfileGenerationCreateOptions> = {},
): Promise<Harness> {
  const auditCalls: Array<Record<string, unknown>> = [];
  const events: AssistedProfileGenerationProgressPayload[] = [];
  const draftCreateCalls: CreateFirewallProfileDraftInput[] = [];

  const channel = {
    emit: (_event: 'message', payload: object): boolean => {
      events.push(payload as AssistedProfileGenerationProgressPayload);
      return true;
    },
  };

  let nextAgentResult: ValidatedAssistedProfileProposal | Error = SUCCESS_PROPOSAL;
  const agentGenerate = (value: ValidatedAssistedProfileProposal | Error): void => {
    nextAgentResult = value;
  };

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
      create: async (input: CreateFirewallProfileDraftInput) => {
        draftCreateCalls.push(input);
        return { id: 42, ...input } as unknown as FirewallProfileDraft;
      },
    },
    auditLogService: {
      logMutation: async (input: Record<string, unknown>) => {
        auditCalls.push(input);
        return null;
      },
    },
    generationIdFactory: () => `gen_test_${++generationCounter}`,
    requestIdFactory: () => `req_test_${generationCounter}`,
    rateLimit: { maxRequests: 2, windowMs: 60_000 },
    clarificationTtlMs: 60_000,
    ...overrides,
  });

  return {
    service,
    auditCalls,
    events,
    draftCreateCalls,
    channel,
    agentGenerate,
    waitForAuditCount: (expected: number) => waitFor(() => auditCalls.length >= expected),
  };
}

describe('AssistedProfileGenerationService unit tests', () => {
  it('accept() returns immediately with a generation id before the pipeline finishes', async () => {
    const harness = await buildHarness();
    const result = await harness.service.accept({
      fwCloudId: 10,
      userId: 1,
      instruction: 'Create a firewall with WAN and LAN',
      channel: harness.channel,
    });

    expect(result.generationId).to.equal('gen_test_1');
  });

  it('persists a validated draft on a successful healthy proposal and audits draft_created', async () => {
    const harness = await buildHarness();
    await harness.service.accept({
      fwCloudId: 10,
      userId: 1,
      instruction: 'Create a firewall with WAN and LAN',
      channel: harness.channel,
    });
    await harness.waitForAuditCount(1);

    expect(harness.draftCreateCalls).to.have.length(1);
    expect(harness.draftCreateCalls[0]).to.include({
      fwCloudId: 10,
      createdBy: 1,
      contractVersion: '1.0.0',
      instructionOriginal: 'Create a firewall with WAN and LAN',
    });

    const stages = harness.events.map((event) => event.stage);
    expect(stages).to.deep.equal([
      'generating',
      'validating_contract',
      'mapping',
      'validating_domain',
      'persisting_draft',
      'completed',
    ]);
    const completed = harness.events[harness.events.length - 1];
    expect(completed.draft_id).to.equal(42);

    expect(harness.auditCalls).to.have.length(1);
    expect(harness.auditCalls[0].data).to.include({ result: 'draft_created', draftId: 42 });
  });

  it('does not include the full instruction in the audit record', async () => {
    const harness = await buildHarness();
    const longInstruction = 'x'.repeat(500);
    await harness.service.accept({
      fwCloudId: 10,
      userId: 1,
      instruction: longInstruction,
      channel: harness.channel,
    });
    await harness.waitForAuditCount(1);

    const excerpt = harness.auditCalls[0].data as Record<string, unknown>;
    expect(excerpt.instructionExcerpt as string).to.have.length.lessThan(longInstruction.length);
  });

  it('stores an ephemeral record and emits needs_clarification on the first clarification round', async () => {
    const harness = await buildHarness();
    harness.agentGenerate(CLARIFICATION_PROPOSAL);

    await harness.service.accept({
      fwCloudId: 10,
      userId: 1,
      instruction: 'Open some ports',
      channel: harness.channel,
    });
    await harness.waitForAuditCount(1);

    expect(harness.draftCreateCalls).to.have.length(0);
    const clarificationEvent = harness.events.find(
      (event) => event.stage === 'needs_clarification',
    );
    expect(clarificationEvent).to.exist;
    expect(clarificationEvent!.clarification).to.deep.equal({
      question: 'Which service?',
      options: ['http', 'https'],
    });
    expect(harness.auditCalls[0].data).to.include({ result: 'clarification_requested' });
  });

  it('answers a pending clarification and succeeds on the second round', async () => {
    const harness = await buildHarness();
    harness.agentGenerate(CLARIFICATION_PROPOSAL);

    const first = await harness.service.accept({
      fwCloudId: 10,
      userId: 1,
      instruction: 'Open some ports',
      channel: harness.channel,
    });
    await harness.waitForAuditCount(1);

    harness.agentGenerate(SUCCESS_PROPOSAL);
    await harness.service.accept({
      fwCloudId: 10,
      userId: 1,
      clarification: { generationId: first.generationId, answer: 'Use https' },
      channel: harness.channel,
    });
    await harness.waitForAuditCount(2);

    expect(harness.draftCreateCalls).to.have.length(1);
    expect(harness.draftCreateCalls[0].instructionOriginal).to.equal('Open some ports');
    expect(harness.auditCalls[1].data).to.include({ result: 'draft_created' });
  });

  it('rejects a second consecutive clarification request as a terminal limit', async () => {
    const harness = await buildHarness();
    harness.agentGenerate(CLARIFICATION_PROPOSAL);

    const first = await harness.service.accept({
      fwCloudId: 10,
      userId: 1,
      instruction: 'Open some ports',
      channel: harness.channel,
    });
    await harness.waitForAuditCount(1);

    await harness.service.accept({
      fwCloudId: 10,
      userId: 1,
      clarification: { generationId: first.generationId, answer: 'still unclear' },
      channel: harness.channel,
    });
    await harness.waitForAuditCount(2);

    expect(harness.draftCreateCalls).to.have.length(0);
    const failedEvent = harness.events.find((event) => event.stage === 'failed');
    expect(failedEvent!.error!.code).to.equal('ASSISTED_PROFILE_CLARIFICATION_LIMIT_REACHED');
    expect(harness.auditCalls[1].data).to.include({ result: 'clarification_limit_reached' });
  });

  it('rejects an unknown or foreign clarification generation id before any agent call', async () => {
    const harness = await buildHarness();

    let thrown: unknown;
    try {
      await harness.service.accept({
        fwCloudId: 10,
        userId: 1,
        clarification: { generationId: 'gen_does_not_exist', answer: 'anything' },
        channel: harness.channel,
      });
    } catch (error) {
      thrown = error;
    }

    expect(thrown).to.be.instanceOf(Error);
    expect((thrown as { code?: string }).code).to.equal('ASSISTED_PROFILE_GENERATION_NOT_FOUND');
    expect(harness.draftCreateCalls).to.have.length(0);
  });

  it('emits a typed domain_validation_failed failure and creates no draft', async () => {
    const domainErrors: ReplicationProfileValidationError[] = [
      {
        code: 'invalid_rule_role',
        message: "Role 'wan' is not defined.",
        path: 'model.provision.rules[0].outRole',
        severity: 'error',
      },
    ];
    const harness = await buildHarness({ validationService: { validate: () => domainErrors } });

    await harness.service.accept({
      fwCloudId: 10,
      userId: 1,
      instruction: 'Create a firewall',
      channel: harness.channel,
    });
    await harness.waitForAuditCount(1);

    expect(harness.draftCreateCalls).to.have.length(0);
    const failedEvent = harness.events.find((event) => event.stage === 'failed');
    expect(failedEvent!.error!.code).to.equal('ASSISTED_PROFILE_DOMAIN_VALIDATION_FAILED');
    expect(failedEvent!.error!.errors).to.deep.equal([
      { path: 'model.provision.rules[0].outRole', message: "Role 'wan' is not defined." },
    ]);
    expect(harness.auditCalls[0].data).to.include({ result: 'domain_validation_failed' });
  });

  const agentFailureCases: Array<{
    name: string;
    error: Error;
    expectedAuditOutcome: string;
  }> = [
    {
      name: 'connection failure',
      error: new AgentConnectionError({ requestId: 'r1' }),
      expectedAuditOutcome: 'agent_connection_failed',
    },
    {
      name: 'read timeout',
      error: new AgentReadTimeoutError({ requestId: 'r1' }),
      expectedAuditOutcome: 'agent_timeout',
    },
    {
      name: 'busy',
      error: new AgentBusyError({ requestId: 'r1' }),
      expectedAuditOutcome: 'agent_busy',
    },
  ];

  for (const testCase of agentFailureCases) {
    it(`classifies an agent ${testCase.name} as a terminal failure with no draft`, async () => {
      const harness = await buildHarness();
      harness.agentGenerate(testCase.error);

      await harness.service.accept({
        fwCloudId: 10,
        userId: 1,
        instruction: 'Create a firewall',
        channel: harness.channel,
      });
      await harness.waitForAuditCount(1);

      expect(harness.draftCreateCalls).to.have.length(0);
      const failedEvent = harness.events.find((event) => event.stage === 'failed');
      expect(failedEvent).to.exist;
      expect(harness.auditCalls[0].data).to.include({ result: testCase.expectedAuditOutcome });
    });
  }

  it('classifies queue saturation and duplicate-in-progress as distinguishable terminal failures', async () => {
    const saturatedHarness = await buildHarness({
      queue: {
        enqueue: async () => {
          throw new GenerationQueueSaturatedError(3);
        },
      },
    });
    await saturatedHarness.service.accept({
      fwCloudId: 10,
      userId: 1,
      instruction: 'Create a firewall',
      channel: saturatedHarness.channel,
    });
    await saturatedHarness.waitForAuditCount(1);
    expect(saturatedHarness.auditCalls[0].data).to.include({ result: 'queue_saturated' });

    const duplicateHarness = await buildHarness({
      queue: {
        enqueue: async () => {
          throw new GenerationAlreadyInProgressError('gen_other', 1, 10);
        },
      },
    });
    await duplicateHarness.service.accept({
      fwCloudId: 10,
      userId: 1,
      instruction: 'Create a firewall',
      channel: duplicateHarness.channel,
    });
    await duplicateHarness.waitForAuditCount(1);
    expect(duplicateHarness.auditCalls[0].data).to.include({
      result: 'duplicate_generation_in_progress',
    });
  });

  it('enforces the per-user rate limit independently of the queue and audits the rejection', async () => {
    const harness = await buildHarness();
    const actor = { fwCloudId: 10, userId: 1 };

    await harness.service.checkRateLimit(actor);
    await harness.service.checkRateLimit(actor);

    let thrown: unknown;
    try {
      await harness.service.checkRateLimit(actor);
    } catch (error) {
      thrown = error;
    }

    expect(thrown).to.be.instanceOf(AssistedProfileGenerationRateLimitedError);
    expect(harness.auditCalls).to.have.length(1);
    expect(harness.auditCalls[0].data).to.include({ result: 'rate_limited' });
  });

  it('does not emit progress when no channel was supplied', async () => {
    const harness = await buildHarness();
    await harness.service.accept({
      fwCloudId: 10,
      userId: 1,
      instruction: 'Create a firewall with WAN and LAN',
    });
    await harness.waitForAuditCount(1);

    expect(harness.events).to.have.length(0);
    expect(harness.draftCreateCalls).to.have.length(1);
  });
});
