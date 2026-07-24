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
import type { ValidatedAssistedProfileProposal } from '../../models/assistant-contract/assistant-contract-customs';
import {
  resolveGenerationQueueConfiguration,
  type GenerationQueueConfiguration,
  type GenerationQueueConfigurationInput,
} from './generation-queue.configuration';
import {
  GenerationAlreadyInProgressError,
  GenerationQueueSaturatedError,
} from './generation-queue.errors';
import {
  GENERATION_COMPLETED_EVENT,
  GENERATION_FAILED_EVENT,
  GENERATION_POSITION_CHANGED_EVENT,
  GENERATION_QUEUED_EVENT,
  GENERATION_STARTED_EVENT,
  type GenerationQueueEvent,
  type GenerationQueueEventName,
  type GenerationQueueObservation,
  type GenerationQueueObserver,
  type GenerationQueueRequest,
  type GenerationQueueResult,
  type GenerationQueueStats,
  type GenerationQueueStatus,
} from './generation-queue.types';
import {
  NOOP_OBSERVER,
  createObservationLogger,
  recordObservationSafely,
  safeAgentIdentifier,
} from './assistant-agent.utils';

const SAFE_ERROR_CODE = /^[A-Z][A-Z0-9_]{0,127}$/;
const FALLBACK_TIMESTAMP = new Date(0).toISOString();
const EVENT_STATUS: Record<GenerationQueueEventName, GenerationQueueStatus> = {
  [GENERATION_QUEUED_EVENT]: 'queued',
  [GENERATION_POSITION_CHANGED_EVENT]: 'queued',
  [GENERATION_STARTED_EVENT]: 'running',
  [GENERATION_COMPLETED_EVENT]: 'completed',
  [GENERATION_FAILED_EVENT]: 'failed',
};

export interface GenerationQueueCreateOptions {
  readonly configuration?: GenerationQueueConfigurationInput;
  readonly observer?: GenerationQueueObserver;
  readonly generationIdFactory?: () => string;
  /** Monotonic clock used for elapsed durations. */
  readonly clock?: () => number;
  /** Wall clock used only for Channel timestamps. */
  readonly now?: () => Date;
}

interface GenerationJob {
  readonly generationId: string;
  readonly fwcloudId: number;
  readonly userId: number;
  readonly requestId?: string;
  readonly channel?: GenerationQueueRequest['channel'];
  readonly execute: GenerationQueueRequest['execute'];
  readonly enqueuedAt: number;
  readonly resolve: (result: GenerationQueueResult) => void;
  readonly reject: (error: unknown) => void;
}

interface MutableGenerationQueueStats {
  enqueueCount: number;
  overflowRejectionCount: number;
  duplicateRejectionCount: number;
  completedCount: number;
  failedCount: number;
}

/**
 * Process-local FIFO admission control for Assisted Profile inference.
 *
 * The active slot is assigned before execute() is called and is not released
 * until the callback settles, including every failure path. Consequently no
 * two accepted callbacks can overlap inside one API process.
 */
export class GenerationQueue extends Service {
  private _configuration: GenerationQueueConfiguration;
  private _observer: GenerationQueueObserver = NOOP_OBSERVER;
  private _generationIdFactory: () => string = () => `gen_${uuid.v7()}`;
  private _clock: () => number = () => performance.now();
  private _now: () => Date = () => new Date();

  private _active: GenerationJob | null = null;
  private readonly _waiting: GenerationJob[] = [];
  private readonly _generationByUserAndFwcloud = new Map<string, string>();
  private readonly _stats: MutableGenerationQueueStats = {
    enqueueCount: 0,
    overflowRejectionCount: 0,
    duplicateRejectionCount: 0,
    completedCount: 0,
    failedCount: 0,
  };

  public constructor(
    app: AbstractApplication | null,
    private readonly _overrides: GenerationQueueCreateOptions = {},
  ) {
    super(app);
  }

  /** Creates an initialized queue with explicit dependencies (tests/tools). */
  public static async create(options: GenerationQueueCreateOptions = {}): Promise<GenerationQueue> {
    return new GenerationQueue(null, options).build();
  }

  public async build(): Promise<GenerationQueue> {
    this._configuration = resolveGenerationQueueConfiguration(
      this._overrides.configuration ?? this.configurationFromApplication(),
    );
    this._observer =
      this._overrides.observer ??
      createObservationLogger<GenerationQueueObservation>(
        this._app,
        'assisted-profile.queue',
        (observation) =>
          observation.type === 'failed' ||
          observation.type === 'overflow_rejected' ||
          observation.type === 'duplicate_rejected',
      );
    this._generationIdFactory = this._overrides.generationIdFactory ?? this._generationIdFactory;
    this._clock = this._overrides.clock ?? this._clock;
    this._now = this._overrides.now ?? this._now;
    return this;
  }

  public get maxDepth(): number {
    return this._configuration.maxDepth;
  }

  /** Current number of waiting jobs; excludes the active generation. */
  public get queueDepth(): number {
    return this._waiting.length;
  }

  public get activeGenerationId(): string | null {
    return this._active?.generationId ?? null;
  }

  public get stats(): GenerationQueueStats {
    return {
      maxDepth: this.maxDepth,
      queueDepth: this.queueDepth,
      activeGenerationId: this.activeGenerationId,
      ...this._stats,
    };
  }

  public async enqueue(request: GenerationQueueRequest): Promise<GenerationQueueResult> {
    this.assertRequest(request);
    const key = this.inFlightKey(request.userId, request.fwcloudId);
    const existingGenerationId = this._generationByUserAndFwcloud.get(key);
    const requestId = safeAgentIdentifier(request.requestId);

    if (existingGenerationId) {
      this._stats.duplicateRejectionCount += 1;
      this.observe({
        type: 'duplicate_rejected',
        generationId: existingGenerationId,
        requestId,
        fwcloudId: request.fwcloudId,
        userId: request.userId,
        queueDepth: this.queueDepth,
        activeGenerationId: this._active?.generationId,
      });
      throw new GenerationAlreadyInProgressError(
        existingGenerationId,
        request.userId,
        request.fwcloudId,
      );
    }

    if (this._active && this.queueDepth >= this.maxDepth) {
      this._stats.overflowRejectionCount += 1;
      this.observe({
        type: 'overflow_rejected',
        requestId,
        fwcloudId: request.fwcloudId,
        userId: request.userId,
        queueDepth: this.queueDepth,
        activeGenerationId: this._active.generationId,
      });
      throw new GenerationQueueSaturatedError(this.maxDepth);
    }

    const generationId = this.resolveGenerationId(request.generationId);
    let resolveCompletion: (result: GenerationQueueResult) => void;
    let rejectCompletion: (error: unknown) => void;
    const completion = new Promise<GenerationQueueResult>((resolve, reject) => {
      resolveCompletion = resolve;
      rejectCompletion = reject;
    });
    const job: GenerationJob = {
      generationId,
      fwcloudId: request.fwcloudId,
      userId: request.userId,
      requestId,
      channel: request.channel,
      execute: request.execute,
      enqueuedAt: this.monotonicNow(),
      resolve: resolveCompletion,
      reject: rejectCompletion,
    };

    // Reserve the duplicate guard before exposing the accepted job to any
    // asynchronous code.
    this._generationByUserAndFwcloud.set(key, generationId);
    this._stats.enqueueCount += 1;

    if (this._active) {
      this._waiting.push(job);
      this.publish(job, GENERATION_QUEUED_EVENT, this._waiting.length);
      this.observeJob('enqueued', job, { position: this._waiting.length });
    } else {
      // An idle queue accepts directly into the active slot. A queued event at
      // position zero still gives every accepted generation a uniform initial
      // lifecycle event before its started event.
      this.claimActive(job);
      this.publish(job, GENERATION_QUEUED_EVENT, 0);
      this.observeJob('enqueued', job, { position: 0 });
      void this.execute(job);
    }

    return completion;
  }

  private claimActive(job: GenerationJob): void {
    if (this._active) {
      throw new Error('GenerationQueue invariant violated: an active job already exists');
    }

    this._active = job;
  }

  private async execute(job: GenerationJob): Promise<void> {
    const startedAt = this.monotonicNow();
    const waitingMs = this.elapsed(job.enqueuedAt, startedAt);
    this.publish(job, GENERATION_STARTED_EVENT, 0);
    this.observeJob('started', job, { position: 0, waitingMs });

    let proposal: ValidatedAssistedProfileProposal;
    let failure: unknown;
    let succeeded = false;

    try {
      proposal = await job.execute({ generationId: job.generationId });
      succeeded = true;
    } catch (error) {
      failure = error;
    } finally {
      const executionMs = this.elapsed(startedAt, this.monotonicNow());

      if (succeeded) {
        this._stats.completedCount += 1;
        this.publish(job, GENERATION_COMPLETED_EVENT);
        this.observeJob('completed', job, { waitingMs, executionMs });
      } else {
        this._stats.failedCount += 1;
        this.publish(job, GENERATION_FAILED_EVENT);
        this.observeJob('failed', job, {
          waitingMs,
          executionMs,
          errorCode: this.safeErrorCode(failure),
        });
      }

      // Cleanup precedes settlement so a caller reacting to completion may
      // immediately enqueue another generation for the same user/FWCloud.
      this._generationByUserAndFwcloud.delete(this.inFlightKey(job.userId, job.fwcloudId));
      this._active = null;

      if (succeeded) {
        job.resolve({ generationId: job.generationId, proposal });
      } else {
        job.reject(failure);
      }

      this.startNext();
    }
  }

  private startNext(): void {
    const next = this._waiting.shift();
    if (!next) {
      return;
    }

    this.claimActive(next);
    void this.execute(next);

    // Every remaining job moved exactly one place toward the active slot.
    this._waiting.forEach((job, index) => {
      const position = index + 1;
      this.publish(job, GENERATION_POSITION_CHANGED_EVENT, position);
      this.observeJob('position_changed', job, { position });
    });
  }

  private publish(job: GenerationJob, event: GenerationQueueEventName, position?: number): void {
    if (!job.channel) {
      return;
    }

    const payload: GenerationQueueEvent = {
      event,
      generation_id: job.generationId,
      fwcloud_id: job.fwcloudId,
      user_id: job.userId,
      status: EVENT_STATUS[event],
      ...(position === undefined ? {} : { position }),
      queue_depth: this.queueDepth,
      timestamp: this.timestamp(),
    };

    try {
      job.channel.emit('message', payload);
    } catch {
      // Channel availability must never affect admission, execution, or
      // duplicate-guard cleanup.
    }
  }

  private observeJob(
    type: GenerationQueueObservation['type'],
    job: GenerationJob,
    details: Pick<
      GenerationQueueObservation,
      'position' | 'waitingMs' | 'executionMs' | 'errorCode'
    > = {},
  ): void {
    this.observe({
      type,
      generationId: job.generationId,
      requestId: job.requestId,
      fwcloudId: job.fwcloudId,
      userId: job.userId,
      queueDepth: this.queueDepth,
      activeGenerationId: this._active?.generationId,
      ...details,
    });
  }

  private observe(observation: GenerationQueueObservation): void {
    recordObservationSafely(this._observer, observation);
  }

  private configurationFromApplication(): GenerationQueueConfigurationInput {
    if (!this._app) {
      return {};
    }

    const config = this._app.config.get('assisted_profile.generation_queue');
    return { maxDepth: config.max_depth };
  }

  private assertRequest(request: GenerationQueueRequest): void {
    if (!request || typeof request !== 'object') {
      throw new TypeError('Generation queue request must be defined');
    }
    if (!Number.isSafeInteger(request.userId) || request.userId < 0) {
      throw new TypeError('Generation queue userId must be a non-negative integer');
    }
    if (!Number.isSafeInteger(request.fwcloudId) || request.fwcloudId < 0) {
      throw new TypeError('Generation queue fwcloudId must be a non-negative integer');
    }
    if (typeof request.execute !== 'function') {
      throw new TypeError('Generation queue execute callback must be a function');
    }
  }

  private resolveGenerationId(value: string | undefined): string {
    const generationId = safeAgentIdentifier(value ?? this._generationIdFactory());
    if (generationId === undefined) {
      throw new TypeError('Generation id must be a non-empty safe string');
    }
    return generationId;
  }

  private safeErrorCode(error: unknown): string {
    if (
      error &&
      typeof error === 'object' &&
      'code' in error &&
      typeof error.code === 'string' &&
      SAFE_ERROR_CODE.test(error.code)
    ) {
      return error.code;
    }
    return 'GENERATION_EXECUTION_FAILED';
  }

  private inFlightKey(userId: number, fwcloudId: number): string {
    return `${userId}:${fwcloudId}`;
  }

  private monotonicNow(): number {
    try {
      const value = this._clock();
      return Number.isFinite(value) ? value : 0;
    } catch {
      return 0;
    }
  }

  private elapsed(start: number, end: number): number {
    return Math.max(0, Math.round(end - start));
  }

  private timestamp(): string {
    try {
      const value = this._now();
      return value instanceof Date && Number.isFinite(value.valueOf())
        ? value.toISOString()
        : FALLBACK_TIMESTAMP;
    } catch {
      return FALLBACK_TIMESTAMP;
    }
  }
}

export {
  ASSISTED_PROFILE_GENERATION_ALREADY_IN_PROGRESS,
  ASSISTED_PROFILE_GENERATION_QUEUE_SATURATED,
  GenerationAlreadyInProgressError,
  GenerationQueueSaturatedError,
} from './generation-queue.errors';
export type {
  GenerationQueueEvent,
  GenerationQueueExecutionContext,
  GenerationQueueObserver,
  GenerationQueueRequest,
  GenerationQueueResult,
  GenerationQueueStats,
} from './generation-queue.types';
