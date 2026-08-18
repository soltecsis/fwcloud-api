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

import type { AbstractApplication } from '../../fonaments/abstract-application';
import { logger } from '../../fonaments/abstract-application';
import { Service } from '../../fonaments/services/service';
import { CounterRegistry, type CounterLabels, type MetricFamilySnapshot } from './counter-registry';
import {
  ASSISTED_PROFILE_COUNTER_DECLARATIONS,
  ASSISTED_PROFILE_METRIC_NAMES,
  ASSISTED_PROFILE_NO_REASON,
  type AssistedProfileApplyResult,
  type AssistedProfileGenerationAttempt,
  type AssistedProfileGenerationFailureReason,
  type AssistedProfileGenerationOutcome,
  type AssistedProfileGenerationRejectionReason,
  type AssistedProfilePreviewFailureReason,
} from './assisted-profile-metrics.types';

/**
 * What an instrumented service is allowed to do with metrics: record an event
 * that already happened. Deliberately narrower than the service itself, so a
 * lifecycle service can neither read nor reset the counters, and so tests can
 * substitute a recorder without a container.
 */
export interface AssistedProfileMetricsRecorder {
  recordGenerationStarted(attempt: AssistedProfileGenerationAttempt): void;
  recordGenerationSuccess(): void;
  recordClarification(): void;
  recordGenerationRejected(reason: AssistedProfileGenerationRejectionReason): void;
  recordGenerationFailed(reason: AssistedProfileGenerationFailureReason): void;
  recordDraftValidated(): void;
  recordPreviewCompleted(): void;
  recordPreviewFailed(reason: AssistedProfilePreviewFailureReason): void;
  recordApply(result: AssistedProfileApplyResult): void;
  recordDraftDiscarded(): void;
  recordDraftExpired(): void;
}

export interface AssistedProfileMetricsSnapshot {
  /** Start of the current observation window: process start, or the last reset. */
  readonly collectionStartedAt: string;
  readonly collectedAt: string;
  readonly families: readonly MetricFamilySnapshot[];
}

/**
 * A recorder that does nothing, for the paths where no application container is
 * available (unit tests constructing a lifecycle service directly). Adoption
 * metrics are never load-bearing, so "no recorder" must behave exactly like
 * "recorder that observed nothing".
 */
export const NOOP_ASSISTED_PROFILE_METRICS: AssistedProfileMetricsRecorder = Object.freeze({
  recordGenerationStarted: () => undefined,
  recordGenerationSuccess: () => undefined,
  recordClarification: () => undefined,
  recordGenerationRejected: () => undefined,
  recordGenerationFailed: () => undefined,
  recordDraftValidated: () => undefined,
  recordPreviewCompleted: () => undefined,
  recordPreviewFailed: () => undefined,
  recordApply: () => undefined,
  recordDraftDiscarded: () => undefined,
  recordDraftExpired: () => undefined,
});

/**
 * The single Assisted Profile instrumentation abstraction (API-17).
 *
 * Every adoption counter in the funnel is incremented through one of the
 * `record*` methods below; no controller, service or job names a raw metric
 * string. Three properties hold for all of them:
 *
 * 1. **Authoritative.** Callers invoke them at the point the backend already
 *    knows the event happened — after the guarded state transition committed,
 *    after the draft row was persisted — never on request receipt. Retries,
 *    conflicts, rejected requests and API-13 idempotency replays therefore
 *    cannot inflate adoption data, because none of them reach those points.
 * 2. **Non-throwing.** Each method swallows and logs anything the registry
 *    could raise. A metrics failure must never turn a successful apply into a
 *    500; the business transaction has already been decided by the time these
 *    are called.
 * 3. **Bounded and anonymous.** The arguments are closed unions, and
 *    `CounterRegistry` cannot create a series that was not declared in
 *    `assisted-profile-metrics.types.ts`. There is no method that accepts free
 *    text, an identifier or an error object.
 */
export class AssistedProfileMetricsService
  extends Service
  implements AssistedProfileMetricsRecorder
{
  private readonly _registry = new CounterRegistry(ASSISTED_PROFILE_COUNTER_DECLARATIONS);

  /** Creates a standalone instance with no container (tests/tools). */
  public static async create(): Promise<AssistedProfileMetricsService> {
    return new AssistedProfileMetricsService(null).build();
  }

  public async build(): Promise<AssistedProfileMetricsService> {
    return this;
  }

  /** A generation request passed admission and entered the pipeline. */
  public recordGenerationStarted(attempt: AssistedProfileGenerationAttempt): void {
    this.increment(ASSISTED_PROFILE_METRIC_NAMES.generationStarted, { attempt });
  }

  /** A generation run produced a persisted, validated draft. */
  public recordGenerationSuccess(): void {
    this.recordGeneration('success');
  }

  /**
   * A clarification question was actually emitted to the user. Recorded as a
   * lifecycle event, not as the generation's verdict: when the user answers,
   * that second run records its own `success`, `rejected` or `failed` outcome,
   * so a clarified-then-successful generation appears in both places.
   */
  public recordClarification(): void {
    this.recordGeneration('clarification');
  }

  /** The agent answered and the answer failed one of API-8's validation gates. */
  public recordGenerationRejected(reason: AssistedProfileGenerationRejectionReason): void {
    this.recordGeneration('rejected', reason);
  }

  /** No proposal could be judged: transport, timeout, saturation or an internal error. */
  public recordGenerationFailed(reason: AssistedProfileGenerationFailureReason): void {
    this.recordGeneration('failed', reason);
  }

  /** A draft row reached the database in `validated`. */
  public recordDraftValidated(): void {
    this.increment(ASSISTED_PROFILE_METRIC_NAMES.draftValidated);
  }

  /** The `validated -> preview_ok` transition committed. */
  public recordPreviewCompleted(): void {
    this.increment(ASSISTED_PROFILE_METRIC_NAMES.preview);
  }

  /** A preview attempt was rejected. Kept out of the adoption count on purpose. */
  public recordPreviewFailed(reason: AssistedProfilePreviewFailureReason): void {
    this.increment(ASSISTED_PROFILE_METRIC_NAMES.previewFailed, { reason });
  }

  /** A terminal apply transition committed. */
  public recordApply(result: AssistedProfileApplyResult): void {
    this.increment(ASSISTED_PROFILE_METRIC_NAMES.apply, { result });
  }

  /** The `-> discarded` transition committed. */
  public recordDraftDiscarded(): void {
    this.increment(ASSISTED_PROFILE_METRIC_NAMES.draftDiscarded);
  }

  /** The `-> expired` transition committed. */
  public recordDraftExpired(): void {
    this.increment(ASSISTED_PROFILE_METRIC_NAMES.draftExpired);
  }

  /** Operator-facing read. Includes every declared series, zeros included. */
  public snapshot(): AssistedProfileMetricsSnapshot {
    return {
      collectionStartedAt: this._registry.collectionStartedAt.toISOString(),
      collectedAt: new Date().toISOString(),
      families: this._registry.snapshot(),
    };
  }

  /** Increments that named an undeclared series. Asserted to stay 0 by the tests. */
  public get droppedIncrements(): number {
    return this._registry.droppedIncrements;
  }

  /** Returns every counter to zero. Not reachable over HTTP; tests and tooling only. */
  public reset(): void {
    this._registry.reset();
  }

  /**
   * The one generation-counter series builder. Outcomes without a reason use
   * the `none` placeholder so the family's label set stays uniform.
   */
  private recordGeneration(
    outcome: AssistedProfileGenerationOutcome,
    reason: string = ASSISTED_PROFILE_NO_REASON,
  ): void {
    this.increment(ASSISTED_PROFILE_METRIC_NAMES.generation, { outcome, reason });
  }

  /**
   * The only place that touches the registry. Failure isolation lives here so
   * every `record*` method inherits it rather than repeating a try/catch.
   */
  private increment(name: string, labels: CounterLabels = {}): void {
    try {
      if (!this._registry.increment(name, labels)) {
        this.warn(
          `Assisted Profile metrics: dropped an increment for an undeclared series of ${name}.`,
        );
      }
    } catch (error) {
      this.warn(
        `Assisted Profile metrics: ${name} could not be recorded ` +
          `(${error?.constructor?.name ?? 'Error'}). The operation itself was unaffected.`,
      );
    }
  }

  /**
   * Best-effort logging. `logger()` returns null outside a running application,
   * and reporting a metrics problem must not itself become one, so even the
   * report is guarded.
   */
  private warn(message: string): void {
    try {
      logger()?.warn(message);
    } catch {
      // Nothing left to do; the counter is secondary to the caller's work.
    }
  }
}

/**
 * Resolves the shared recorder for an instrumented lifecycle service.
 *
 * Falls back to the no-op recorder whenever the container cannot supply one —
 * a service built without an application (unit tests), or a container where the
 * provider is not registered. Instrumentation must never be the reason a
 * lifecycle service fails to build.
 */
export async function resolveAssistedProfileMetricsRecorder(
  app: AbstractApplication | null,
): Promise<AssistedProfileMetricsRecorder> {
  if (!app) {
    return NOOP_ASSISTED_PROFILE_METRICS;
  }

  try {
    const service = await app.getService<AssistedProfileMetricsService>(
      AssistedProfileMetricsService.name,
    );
    return service ?? NOOP_ASSISTED_PROFILE_METRICS;
  } catch {
    return NOOP_ASSISTED_PROFILE_METRICS;
  }
}
