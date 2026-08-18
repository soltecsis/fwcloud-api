/*
    Copyright 2026 SOLTECSIS SOLUCIONES TECNOLOGICAS, SLU
    https://soltecsis.com
    info@soltecsis.com


    This file is part of FWCloud (https://fwcloud.net).

    FWCloud is free software: you can redistribute it and/or modify
    it under the terms of the GNU Affero General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    FWCloud is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU General Public License for more details.

    You should have received a copy of the GNU General Public License
    along with FWCloud.  If not, see <https://www.gnu.org/licenses/>.
*/

import * as uuid from 'uuid';
import type { AbstractApplication } from '../../fonaments/abstract-application';
import { Service } from '../../fonaments/services/service';
import { AuditLogService } from '../../models/audit/AuditLog.service';
import {
  extractAssistantContractSchemaVersion,
  type ValidatedAssistedProfileProposal,
} from '../../models/assistant-contract/assistant-contract-customs';
import {
  collectAgentAssumptions,
  type AssistedProfileAssumption,
} from '../../models/assistant-contract/assisted-profile-assumptions';
import { AssistedProfileProposalMapper } from '../../models/assistant-contract/assisted-profile-proposal.mapper';
import {
  ReplicationProfileValidationService,
  type ReplicationProfileValidationError,
} from '../../models/replication-profile/replication-profile-validation.service';
import {
  FirewallProfileDraftStateService,
  type CreateFirewallProfileDraftInput,
} from '../../models/firewall-profile-draft/firewall-profile-draft-state.service';
import { AssistedProfileRejectedProposalCaptureService } from '../../models/assisted-profile-rejected-proposal/assisted-profile-rejected-proposal-capture.service';
import {
  NOOP_ASSISTED_PROFILE_METRICS,
  resolveAssistedProfileMetricsRecorder,
  type AssistedProfileMetricsRecorder,
} from '../../models/assisted-profile-metrics/assisted-profile-metrics.service';
import {
  ASSISTED_PROFILE_GENERATION_REJECTION_REASONS,
  type AssistedProfileGenerationFailureReason,
  type AssistedProfileGenerationRejectionReason,
} from '../../models/assisted-profile-metrics/assisted-profile-metrics.types';
import type { AssistedProfileRejectionCategory } from '../../models/assisted-profile-rejected-proposal/assisted-profile-rejected-proposal.types';
import { GenerationQueue } from './generation-queue';
import type { GenerationQueueRequest } from './generation-queue.types';
import {
  GenerationAlreadyInProgressError,
  GenerationQueueSaturatedError,
} from './generation-queue.errors';
import { AgentHttpClient } from './agent-http-client';
import type { AssistedProfileAgentRequest, AgentRequestContext } from './agent-http.types';
import {
  AgentAuthenticationError,
  AgentAuthorizationError,
  AgentBusyError,
  AgentConnectionError,
  AgentContractMismatchError,
  AgentHttpClientError,
  AgentReadTimeoutError,
  AgentTlsError,
} from './agent-http-errors';
import {
  AssistedProfileClarificationLimitReachedError,
  AssistedProfileDomainValidationFailedError,
  AssistedProfileGenerationNotFoundError,
  AssistedProfileGenerationRateLimitedError,
  AssistedProfileMappingFailedError,
} from './assisted-profile-generation.errors';
import {
  AssistedProfileGenerationProgressPayload,
  type AssistedProfileGenerationChannel,
  type AssistedProfileGenerationProgressClarification,
  type AssistedProfileGenerationProgressError,
  type AssistedProfileGenerationStage,
} from './assisted-profile-generation-progress.types';

export const ASSISTED_PROFILE_GENERATION_AUDIT_CALL = 'assistant.drafts.generate';
const AUDIT_INSTRUCTION_EXCERPT_LENGTH = 200;
const DEFAULT_RATE_LIMIT_MAX_REQUESTS = 5;
const DEFAULT_RATE_LIMIT_WINDOW_MS = 60_000;
const DEFAULT_CLARIFICATION_TTL_MS = 900_000;

export interface AssistedProfileGenerationClarificationAnswer {
  readonly generationId: string;
  readonly answer: string;
}

export interface AssistedProfileGenerationActor {
  readonly fwCloudId: number;
  readonly userId: number;
  readonly userName?: string | null;
  readonly sessionId?: number | null;
  readonly sourceIp?: string | null;
}

export interface AssistedProfileGenerationAcceptRequest extends AssistedProfileGenerationActor {
  readonly instruction?: string;
  readonly language?: string;
  readonly targetKind?: string;
  readonly clarification?: AssistedProfileGenerationClarificationAnswer;
  readonly channel?: AssistedProfileGenerationChannel;
}

export interface AssistedProfileGenerationAcceptResult {
  readonly generationId: string;
}

interface EphemeralGeneration {
  readonly generationId: string;
  readonly userId: number;
  readonly fwCloudId: number;
  readonly originalInstruction: string;
  readonly language?: string;
  readonly targetKind?: string;
  readonly clarificationRounds: number;
  readonly expiresAt: number;
}

interface GenerationRunContext {
  readonly generationId: string;
  readonly requestId: string;
  readonly fwCloudId: number;
  readonly userId: number;
  readonly userName: string | null;
  readonly sessionId: number | null;
  readonly sourceIp: string | null;
  readonly originalInstruction: string;
  readonly language?: string;
  readonly targetKind?: string;
  readonly clarificationRounds: number;
  readonly agentText: string;
  readonly channel?: AssistedProfileGenerationChannel;
}

interface FailureClassification {
  readonly code: string;
  readonly message: string;
  readonly auditOutcome: string;
  /**
   * The bounded adoption-metric class for this failure (API-17). Decided in
   * `classifyFailure()` alongside the audit outcome so the two taxonomies are
   * derived from one `instanceof` chain and cannot drift apart, and so no
   * caller is ever tempted to build a label out of an error message.
   */
  readonly metricReason:
    AssistedProfileGenerationRejectionReason | AssistedProfileGenerationFailureReason;
}

/** Whether a classified failure is a rejection of the proposal or an infrastructure failure. */
const isRejectionReason = (
  reason: FailureClassification['metricReason'],
): reason is AssistedProfileGenerationRejectionReason =>
  (ASSISTED_PROFILE_GENERATION_REJECTION_REASONS as readonly string[]).includes(reason);

export interface AssistedProfileGenerationRateLimitInput {
  readonly maxRequests?: number;
  readonly windowMs?: number;
}

export interface AssistedProfileGenerationCreateOptions {
  readonly queue?: Pick<GenerationQueue, 'enqueue'>;
  readonly agentClient?: Pick<AgentHttpClient, 'generate'>;
  readonly mapper?: Pick<AssistedProfileProposalMapper, 'mapWithAssumptions'>;
  readonly validationService?: Pick<ReplicationProfileValidationService, 'validate'>;
  readonly draftStateService?: Pick<FirewallProfileDraftStateService, 'create'>;
  readonly auditLogService?: Pick<AuditLogService, 'logMutation'>;
  readonly rejectedProposalCapture?: Pick<AssistedProfileRejectedProposalCaptureService, 'capture'>;
  readonly metrics?: AssistedProfileMetricsRecorder;
  readonly rateLimit?: AssistedProfileGenerationRateLimitInput;
  readonly clarificationTtlMs?: number;
  readonly generationIdFactory?: () => string;
  readonly requestIdFactory?: () => string;
  readonly now?: () => Date;
}

/**
 * Orchestrates the full Assisted Profile generation flow: GenerationQueue ->
 * AgentHttpClient (which already crosses the API-1 contract gateway) -> the
 * optional one clarification round -> the API-9 mapper -> the existing
 * ReplicationProfile domain validator -> FirewallProfileDraft persistence,
 * reporting progress through the caller-supplied Channel and auditing every
 * attempt exactly once, whatever its outcome.
 *
 * `accept()` is the only method a controller should await: it performs the
 * fast, synchronous, pre-202 decisions (clarification-reference lookup) and
 * then continues the actual generation in the background. Every error that
 * can only be discovered afterwards (agent failures, contract mismatch,
 * mapping failure, clarification-limit-reached, domain validation) never
 * becomes an HTTP response — it only ever reaches the caller through the
 * Channel `failed` event and the attempt's audit record.
 */
export class AssistedProfileGenerationService extends Service {
  private _queue: Pick<GenerationQueue, 'enqueue'>;
  private _agentClient: Pick<AgentHttpClient, 'generate'> | undefined;
  private _agentClientPromise: Promise<Pick<AgentHttpClient, 'generate'>> | undefined;
  private _mapper: Pick<AssistedProfileProposalMapper, 'mapWithAssumptions'>;
  private _validationService: Pick<ReplicationProfileValidationService, 'validate'>;
  private _draftStateService: Pick<FirewallProfileDraftStateService, 'create'>;
  private _auditLogService: Pick<AuditLogService, 'logMutation'>;
  private _rejectedProposalCapture: Pick<AssistedProfileRejectedProposalCaptureService, 'capture'>;
  private _metrics: AssistedProfileMetricsRecorder = NOOP_ASSISTED_PROFILE_METRICS;

  private _rateLimitMaxRequests = DEFAULT_RATE_LIMIT_MAX_REQUESTS;
  private _rateLimitWindowMs = DEFAULT_RATE_LIMIT_WINDOW_MS;
  private _clarificationTtlMs = DEFAULT_CLARIFICATION_TTL_MS;
  private _generationIdFactory: () => string = () => `gen_${uuid.v7()}`;
  private _requestIdFactory: () => string = () => uuid.v4();
  private _now: () => Date = () => new Date();

  private readonly _rateLimitHits = new Map<number, number[]>();
  private readonly _ephemeral = new Map<string, EphemeralGeneration>();

  public constructor(
    app: AbstractApplication | null,
    private readonly _overrides: AssistedProfileGenerationCreateOptions = {},
  ) {
    super(app);
  }

  /** Creates an initialized service with explicit dependencies (tests/tools). */
  public static async create(
    options: AssistedProfileGenerationCreateOptions = {},
  ): Promise<AssistedProfileGenerationService> {
    return new AssistedProfileGenerationService(null, options).build();
  }

  public async build(): Promise<AssistedProfileGenerationService> {
    this._queue =
      this._overrides.queue ?? (await this._app.getService<GenerationQueue>(GenerationQueue.name));
    // AgentHttpClient is deliberately NOT resolved here. Its DI singleton
    // throws at build time whenever the agent is unconfigured, and
    // ServiceContainer.singleFlight() caches that rejection permanently for
    // the process's lifetime (same gotcha AssistedProfileHealthService
    // already works around). Resolving it eagerly would mean a misconfigured
    // or not-yet-configured agent permanently breaks this whole service,
    // including checkRateLimit() and accept()'s synchronous admission phase,
    // neither of which need the agent at all. It is resolved lazily, once,
    // inside callAgent() instead, so only the actual generation attempt that
    // needs it can ever fail because of it.
    this._agentClient = this._overrides.agentClient;
    this._mapper = this._overrides.mapper ?? new AssistedProfileProposalMapper();
    this._validationService =
      this._overrides.validationService ??
      (await this._app.getService<ReplicationProfileValidationService>(
        ReplicationProfileValidationService.name,
      ));
    this._draftStateService =
      this._overrides.draftStateService ??
      (await this._app.getService<FirewallProfileDraftStateService>(
        FirewallProfileDraftStateService.name,
      ));
    this._auditLogService =
      this._overrides.auditLogService ??
      (await this._app.getService<AuditLogService>(AuditLogService.name));
    this._rejectedProposalCapture =
      this._overrides.rejectedProposalCapture ??
      (await this._app.getService<AssistedProfileRejectedProposalCaptureService>(
        AssistedProfileRejectedProposalCaptureService.name,
      ));
    this._metrics =
      this._overrides.metrics ?? (await resolveAssistedProfileMetricsRecorder(this._app));

    const rateLimit = this._overrides.rateLimit ?? this.rateLimitConfigFromApplication();
    this._rateLimitMaxRequests = rateLimit.maxRequests ?? this._rateLimitMaxRequests;
    this._rateLimitWindowMs = rateLimit.windowMs ?? this._rateLimitWindowMs;
    this._clarificationTtlMs =
      this._overrides.clarificationTtlMs ?? this.clarificationTtlFromApplication();
    this._generationIdFactory = this._overrides.generationIdFactory ?? this._generationIdFactory;
    this._requestIdFactory = this._overrides.requestIdFactory ?? this._requestIdFactory;
    this._now = this._overrides.now ?? this._now;

    return this;
  }

  /**
   * Per-user generation rate limit. Independent of queue saturation, the
   * one-generation-per-user-and-FWCloud guard, and agent 429 AGENT_BUSY.
   * Audits the rejection itself, since a rate-limited request never reaches
   * a point where a `generation_id` (and therefore a Channel event) exists.
   */
  public async checkRateLimit(actor: AssistedProfileGenerationActor): Promise<void> {
    const now = this._now().getTime();
    const windowStart = now - this._rateLimitWindowMs;
    const timestamps = (this._rateLimitHits.get(actor.userId) ?? []).filter(
      (hit) => hit > windowStart,
    );

    if (timestamps.length >= this._rateLimitMaxRequests) {
      this._rateLimitHits.set(actor.userId, timestamps);
      await this.safeAudit({
        call: ASSISTED_PROFILE_GENERATION_AUDIT_CALL,
        description: 'Assisted Profile generation request rate-limited.',
        status: 429,
        userId: actor.userId,
        userName: actor.userName,
        sessionId: actor.sessionId,
        sourceIp: actor.sourceIp,
        fwCloudId: actor.fwCloudId,
        data: { result: 'rate_limited' },
      });
      throw new AssistedProfileGenerationRateLimitedError();
    }

    timestamps.push(now);
    this._rateLimitHits.set(actor.userId, timestamps);
  }

  /**
   * Resolves (synchronously enough for a 202 response) the generation id and
   * validates a clarification reference, then continues the actual pipeline
   * in the background. Never throws for anything that can only fail after
   * the agent has been called.
   */
  public async accept(
    request: AssistedProfileGenerationAcceptRequest,
  ): Promise<AssistedProfileGenerationAcceptResult> {
    let generationId: string;
    let originalInstruction: string;
    let language: string | undefined;
    let targetKind: string | undefined;
    let clarificationRounds: number;
    let agentText: string;

    if (request.clarification) {
      const ephemeral = this.consumeEphemeralForClarification(request);
      generationId = ephemeral.generationId;
      originalInstruction = ephemeral.originalInstruction;
      language = ephemeral.language;
      targetKind = ephemeral.targetKind;
      clarificationRounds = ephemeral.clarificationRounds;
      agentText = this.combineWithAnswer(originalInstruction, request.clarification.answer);
    } else {
      generationId = this._generationIdFactory();
      originalInstruction = request.instruction ?? '';
      language = request.language;
      targetKind = request.targetKind;
      clarificationRounds = 0;
      agentText = originalInstruction;
    }

    const context: GenerationRunContext = {
      generationId,
      requestId: this._requestIdFactory(),
      fwCloudId: request.fwCloudId,
      userId: request.userId,
      userName: request.userName ?? null,
      sessionId: request.sessionId ?? null,
      sourceIp: request.sourceIp ?? null,
      originalInstruction,
      language,
      targetKind,
      clarificationRounds,
      agentText,
      channel: request.channel,
    };

    // Counted here, after every synchronous admission decision has passed
    // (rate limit in the controller, clarification-reference lookup above):
    // a request rejected before this line never entered the pipeline and must
    // not appear in the funnel. A clarification answer is a second accepted
    // request for the same `generation_id`, so it is counted under its own
    // `attempt` value rather than as a new generation.
    this._metrics.recordGenerationStarted(
      request.clarification ? 'clarification_answer' : 'initial',
    );

    void this.run(context);

    return { generationId };
  }

  private consumeEphemeralForClarification(
    request: AssistedProfileGenerationAcceptRequest,
  ): EphemeralGeneration {
    const generationId = request.clarification.generationId;
    const entry = this._ephemeral.get(generationId);
    const now = this._now().getTime();

    if (
      !entry ||
      entry.expiresAt < now ||
      entry.userId !== request.userId ||
      entry.fwCloudId !== request.fwCloudId
    ) {
      throw new AssistedProfileGenerationNotFoundError(generationId);
    }

    this._ephemeral.delete(generationId);
    return entry;
  }

  private storeEphemeralForClarification(context: GenerationRunContext): void {
    this._ephemeral.set(context.generationId, {
      generationId: context.generationId,
      userId: context.userId,
      fwCloudId: context.fwCloudId,
      originalInstruction: context.originalInstruction,
      language: context.language,
      targetKind: context.targetKind,
      clarificationRounds: 1,
      expiresAt: this._now().getTime() + this._clarificationTtlMs,
    });
  }

  private combineWithAnswer(originalInstruction: string, answer: string): string {
    return `${originalInstruction}\n\nClarification: ${answer}`;
  }

  private async run(context: GenerationRunContext): Promise<void> {
    let keepEphemeral = false;
    // Hoisted so the rejection path can still reach the proposal that was
    // rejected. It stays in request memory only for the duration of this run.
    let proposal: ValidatedAssistedProfileProposal | undefined;
    try {
      this.emitProgress(context, {
        stage: 'generating',
        message: 'Calling the Assisted Profile agent.',
      });

      const request: GenerationQueueRequest = {
        generationId: context.generationId,
        fwcloudId: context.fwCloudId,
        userId: context.userId,
        requestId: context.requestId,
        channel: context.channel,
        execute: () => this.callAgent(context),
      };
      proposal = (await this._queue.enqueue(request)).proposal;

      this.emitProgress(context, {
        stage: 'validating_contract',
        message: 'Agent response passed the contract gateway.',
      });

      const status = this.readProposalStatus(proposal);

      if (status === 'needs_clarification') {
        if (context.clarificationRounds >= 1) {
          throw new AssistedProfileClarificationLimitReachedError();
        }

        this.storeEphemeralForClarification(context);
        keepEphemeral = true;
        const clarification = this.extractClarification(proposal);
        this.emitProgress(context, {
          stage: 'needs_clarification',
          message: 'The agent needs more information to continue.',
          clarification,
        });
        await this.safeAudit(
          this.baseAuditFields(context, {
            result: 'clarification_requested',
            status: 200,
          }),
        );
        // The clarification was actually emitted; the answer's own run records
        // its outcome separately, so a clarified-then-successful generation is
        // visible as both a clarification and a success.
        this._metrics.recordClarification();
        return;
      }

      if (status !== 'success') {
        const safeStatus = typeof status === 'string' ? status : JSON.stringify(status);
        throw new AssistedProfileMappingFailedError(
          new Error(`Unexpected Assisted Profile agent status '${safeStatus}'`),
        );
      }

      this.emitProgress(context, {
        stage: 'mapping',
        message: 'Mapping the proposal into the FWCloud domain model.',
      });

      let mapped: ReturnType<AssistedProfileProposalMapper['map']>;
      // Whatever the mapper had to invent, plus whatever the agent itself
      // flagged. Both are unrecoverable from the mapped DTO once persisted, and
      // the preview flow is required to replay them rather than re-derive them.
      let assumptions: AssistedProfileAssumption[];
      try {
        const result = this._mapper.mapWithAssumptions(proposal);
        mapped = result.dto;
        assumptions = [...collectAgentAssumptions(proposal), ...result.assumptions];
      } catch (error) {
        throw new AssistedProfileMappingFailedError(error);
      }

      this.emitProgress(context, {
        stage: 'validating_domain',
        message: 'Validating the proposal against FWCloud domain rules.',
      });

      const domainErrors: ReplicationProfileValidationError[] = this._validationService.validate(
        { targetKind: mapped.targetKind, model: mapped.model },
        { validateSecrets: false },
      );
      if (domainErrors.length > 0) {
        throw new AssistedProfileDomainValidationFailedError(domainErrors);
      }

      this.emitProgress(context, {
        stage: 'persisting_draft',
        message: 'Persisting the validated draft.',
      });

      const contractVersion = extractAssistantContractSchemaVersion(proposal) ?? 'unknown';
      const draftInput: CreateFirewallProfileDraftInput = {
        fwCloudId: context.fwCloudId,
        createdBy: context.userId,
        contractVersion,
        proposal: mapped,
        assumptions,
        requestId: context.requestId,
        instructionOriginal: context.originalInstruction,
        stepLog: [
          {
            step: 'generate',
            status: 'success',
            timestamp: this._now().toISOString(),
            requestId: context.requestId,
          },
        ],
      };
      const draft = await this._draftStateService.create(draftInput);

      this.emitProgress(context, {
        stage: 'completed',
        message: 'Draft created.',
        draftId: draft.id,
      });
      await this.safeAudit(
        this.baseAuditFields(context, {
          result: 'draft_created',
          status: 201,
          draftId: draft.id,
          contractVersion,
        }),
      );
      // The validated-draft counter is not incremented here: it belongs to the
      // persistence event inside FirewallProfileDraftStateService.create().
      this._metrics.recordGenerationSuccess();
    } catch (error) {
      const classification = this.classifyFailure(error);
      this.emitProgress(context, {
        stage: 'failed',
        message: classification.message,
        error: this.errorPayload(error, classification),
      });
      await this.safeAudit(
        this.baseAuditFields(context, {
          result: classification.auditOutcome,
          status: 500,
          errorCode: classification.code,
        }),
      );
      if (isRejectionReason(classification.metricReason)) {
        this._metrics.recordGenerationRejected(classification.metricReason);
      } else {
        this._metrics.recordGenerationFailed(classification.metricReason);
      }
      // Optional evaluation capture, strictly after the client-visible outcome
      // and its audit record have been decided. Never changes either one.
      await this.captureRejectedProposal(context, error, proposal);
    } finally {
      if (!keepEphemeral) {
        this._ephemeral.delete(context.generationId);
      }
    }
  }

  /** The only place in this service allowed to call AgentHttpClient.generate. */
  private async callAgent(
    context: GenerationRunContext,
  ): Promise<ValidatedAssistedProfileProposal> {
    const agentRequest: AssistedProfileAgentRequest = {
      text: context.agentText,
      ...(context.language ? { language: context.language } : {}),
      ...(context.targetKind ? { targetKind: context.targetKind } : {}),
    };
    const agentContext: AgentRequestContext = {
      requestId: context.requestId,
      fwCloudId: context.fwCloudId,
      userId: context.userId,
      userName: context.userName,
      sessionId: context.sessionId,
      sourceIp: context.sourceIp,
    };

    const client = await this.resolveAgentClient();
    return client.generate(agentRequest, agentContext);
  }

  private resolveAgentClient(): Promise<Pick<AgentHttpClient, 'generate'>> {
    if (this._agentClient) {
      return Promise.resolve(this._agentClient);
    }
    if (!this._agentClientPromise) {
      this._agentClientPromise = this._app.getService<AgentHttpClient>(AgentHttpClient.name);
    }
    return this._agentClientPromise;
  }

  private readProposalStatus(proposal: ValidatedAssistedProfileProposal): unknown {
    return (proposal as unknown as { status?: unknown }).status;
  }

  private extractClarification(
    proposal: ValidatedAssistedProfileProposal,
  ): AssistedProfileGenerationProgressClarification | undefined {
    const record = proposal as unknown as {
      clarification?: { questions?: Array<{ question?: unknown; options?: unknown }> } | null;
    };
    const first = record.clarification?.questions?.[0];

    if (!first || typeof first.question !== 'string') {
      return undefined;
    }

    const options = Array.isArray(first.options)
      ? first.options.filter((option): option is string => typeof option === 'string')
      : undefined;

    return {
      question: first.question,
      ...(options && options.length > 0 ? { options } : {}),
    };
  }

  /**
   * The single classification point for every post-202 failure. It decides
   * three things at once — the Channel error code, the audit outcome and the
   * bounded adoption-metric class — so an error type can never be described one
   * way in the audit trail and another way in the metrics. Nothing derived from
   * the error's own message ever reaches the metric class.
   */
  private classifyFailure(error: unknown): FailureClassification {
    const classify = (
      code: string,
      message: string,
      auditOutcome: string,
      metricReason: FailureClassification['metricReason'],
    ): FailureClassification => ({
      code,
      message,
      auditOutcome,
      metricReason,
    });

    if (error instanceof GenerationAlreadyInProgressError) {
      return classify(
        error.code,
        error.message,
        'duplicate_generation_in_progress',
        'duplicate_in_progress',
      );
    }
    if (error instanceof GenerationQueueSaturatedError) {
      return classify(error.code, error.message, 'queue_saturated', 'saturated');
    }
    if (error instanceof AgentConnectionError || error instanceof AgentTlsError) {
      return classify(
        error.code,
        'The Assisted Profile agent could not be reached.',
        'agent_connection_failed',
        'unavailable',
      );
    }
    if (error instanceof AgentReadTimeoutError) {
      return classify(
        error.code,
        'The Assisted Profile agent did not respond in time.',
        'agent_timeout',
        'timeout',
      );
    }
    if (error instanceof AgentBusyError) {
      return classify(
        error.code,
        'The Assisted Profile agent is currently busy.',
        'agent_busy',
        'saturated',
      );
    }
    if (error instanceof AgentAuthenticationError || error instanceof AgentAuthorizationError) {
      return classify(
        error.code,
        'The Assisted Profile agent rejected the request credentials.',
        'agent_authentication_failed',
        'authentication_failed',
      );
    }
    if (error instanceof AgentContractMismatchError) {
      return classify(
        error.code,
        'The agent response did not match the expected contract.',
        'contract_mismatch',
        'contract_mismatch',
      );
    }
    if (error instanceof AssistedProfileMappingFailedError) {
      return classify(error.code, error.message, 'mapping_failed', 'mapping_failed');
    }
    if (error instanceof AssistedProfileClarificationLimitReachedError) {
      return classify(
        error.code,
        error.message,
        'clarification_limit_reached',
        'clarification_limit',
      );
    }
    if (error instanceof AssistedProfileDomainValidationFailedError) {
      return classify(error.code, error.message, 'domain_validation_failed', 'domain_validation');
    }
    if (error instanceof AgentHttpClientError) {
      return classify(
        error.code,
        'The Assisted Profile agent request failed.',
        'agent_connection_failed',
        'transport_error',
      );
    }

    return classify(
      'ASSISTED_PROFILE_GENERATION_UNEXPECTED_ERROR',
      'Assisted Profile generation failed unexpectedly.',
      'unexpected_error',
      'internal_error',
    );
  }

  /**
   * Maps a post-contract-gate failure to a capture-eligible rejection
   * category, or `undefined` when the failure is not a rejection *of the
   * proposal's content*: agent transport failures, timeouts, queue saturation,
   * duplicate generations, an outstanding clarification and unexpected errors
   * are all excluded, and most of them never produce a proposal at all.
   */
  private rejectionCategoryFor(error: unknown): AssistedProfileRejectionCategory | undefined {
    if (error instanceof AssistedProfileDomainValidationFailedError) {
      return 'domain_validation_failed';
    }
    if (error instanceof AssistedProfileMappingFailedError) {
      return 'mapping_failed';
    }
    return undefined;
  }

  /**
   * Hands an eligible rejected proposal to the optional capture service. The
   * service is off by default, anonymizes before persisting and never throws;
   * the extra guard here documents that not even a misbehaving capture
   * implementation may alter the rejection this run already reported.
   */
  private async captureRejectedProposal(
    context: GenerationRunContext,
    error: unknown,
    proposal: ValidatedAssistedProfileProposal | undefined,
  ): Promise<void> {
    const rejectionCategory = this.rejectionCategoryFor(error);
    if (!rejectionCategory || proposal === undefined) {
      return;
    }

    try {
      await this._rejectedProposalCapture.capture({
        proposal,
        rejectionCategory,
        rejectionCode: (error as { code?: string })?.code ?? null,
        contractVersion: extractAssistantContractSchemaVersion(proposal) ?? null,
        requestId: context.requestId,
      });
    } catch {
      // Evaluation capture must never affect the generation outcome.
    }
  }

  private errorPayload(
    error: unknown,
    classification: FailureClassification,
  ): AssistedProfileGenerationProgressError {
    if (error instanceof AssistedProfileDomainValidationFailedError) {
      return {
        code: classification.code,
        message: classification.message,
        errors: error.errors.map((item) => ({ path: item.path, message: item.message })),
      };
    }

    return { code: classification.code, message: classification.message };
  }

  private emitProgress(
    context: GenerationRunContext,
    fields: {
      stage: AssistedProfileGenerationStage;
      message: string;
      draftId?: number;
      error?: AssistedProfileGenerationProgressError;
      clarification?: AssistedProfileGenerationProgressClarification;
    },
  ): void {
    if (!context.channel) {
      return;
    }

    const payload = new AssistedProfileGenerationProgressPayload({
      generationId: context.generationId,
      fwcloudId: context.fwCloudId,
      userId: context.userId,
      stage: fields.stage,
      message: fields.message,
      draftId: fields.draftId,
      error: fields.error,
      clarification: fields.clarification,
    });

    try {
      context.channel.emit('message', payload);
    } catch {
      // Channel availability must never affect the generation pipeline.
    }
  }

  private baseAuditFields(
    context: GenerationRunContext,
    details: {
      result: string;
      status: number;
      draftId?: number;
      contractVersion?: string;
      errorCode?: string;
    },
  ): Parameters<AuditLogService['logMutation']>[0] {
    return {
      call: ASSISTED_PROFILE_GENERATION_AUDIT_CALL,
      description: `Assisted Profile generation ${context.generationId}: ${details.result}.`,
      status: details.status,
      userId: context.userId,
      userName: context.userName,
      sessionId: context.sessionId,
      sourceIp: context.sourceIp,
      fwCloudId: context.fwCloudId,
      data: {
        generationId: context.generationId,
        requestId: context.requestId,
        result: details.result,
        instructionExcerpt: this.truncateInstruction(context.originalInstruction),
        clarificationRounds: context.clarificationRounds,
        ...(details.draftId !== undefined ? { draftId: details.draftId } : {}),
        ...(details.contractVersion !== undefined
          ? { contractVersion: details.contractVersion }
          : {}),
        ...(details.errorCode !== undefined ? { errorCode: details.errorCode } : {}),
      },
    };
  }

  private truncateInstruction(instruction: string): string {
    const text = instruction ?? '';
    return text.length > AUDIT_INSTRUCTION_EXCERPT_LENGTH
      ? `${text.slice(0, AUDIT_INSTRUCTION_EXCERPT_LENGTH)}...`
      : text;
  }

  private async safeAudit(input: Parameters<AuditLogService['logMutation']>[0]): Promise<void> {
    // AuditLogService.logMutation already catches and logs internally; this
    // wrapper only documents that audit failures must never affect the
    // generation outcome that has already been decided.
    await this._auditLogService.logMutation(input);
  }

  private rateLimitConfigFromApplication(): AssistedProfileGenerationRateLimitInput {
    if (!this._app) {
      return {};
    }

    const config = this._app.config.get('assisted_profile.generation.rate_limit');
    return { maxRequests: config?.max_requests, windowMs: config?.window_ms };
  }

  private clarificationTtlFromApplication(): number {
    if (!this._app) {
      return DEFAULT_CLARIFICATION_TTL_MS;
    }

    const config = this._app.config.get('assisted_profile.generation');
    return config?.clarification_ttl_ms ?? DEFAULT_CLARIFICATION_TTL_MS;
  }
}
