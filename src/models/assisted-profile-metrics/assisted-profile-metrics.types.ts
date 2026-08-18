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

import type { CounterDeclaration, CounterLabels } from './counter-registry';

/**
 * The complete, closed vocabulary of the Assisted Profile adoption metrics.
 *
 * Two rules govern every value below, and both are structural rather than
 * advisory:
 *
 * 1. **Bounded.** Each label has a finite, enumerated value set declared here,
 *    and `ASSISTED_PROFILE_COUNTER_DECLARATIONS` enumerates the exact series
 *    each counter may ever expose. `CounterRegistry` materializes that list at
 *    construction time and refuses to create anything else, so no runtime value
 *    can widen the series set.
 * 2. **Non-identifying.** No label carries a draft id, generation id, user id,
 *    FWCloud id, target id, request id, hostname, address, name, instruction,
 *    proposal fragment or backend error message. Every value is a
 *    classification chosen from the lists below.
 *
 * Audit (`AuditLog`) remains the place where an individual operation can be
 * traced with its identifiers; these counters exist only to answer aggregate
 * pilot-adoption questions.
 */

export const ASSISTED_PROFILE_METRIC_NAMES = Object.freeze({
  generationStarted: 'assisted_profile_generation_started_total',
  generation: 'assisted_profile_generation_total',
  draftValidated: 'assisted_profile_draft_validated_total',
  preview: 'assisted_profile_preview_total',
  previewFailed: 'assisted_profile_preview_failed_total',
  apply: 'assisted_profile_apply_total',
  draftDiscarded: 'assisted_profile_draft_discarded_total',
  draftExpired: 'assisted_profile_draft_expired_total',
} as const);

export type AssistedProfileMetricName =
  (typeof ASSISTED_PROFILE_METRIC_NAMES)[keyof typeof ASSISTED_PROFILE_METRIC_NAMES];

/**
 * Which round of one generation was accepted. A generation that asks for
 * clarification is answered through a second accepted request carrying the
 * same `generation_id`, so `initial` alone is the funnel's entry count.
 */
export const ASSISTED_PROFILE_GENERATION_ATTEMPTS = ['initial', 'clarification_answer'] as const;
export type AssistedProfileGenerationAttempt =
  (typeof ASSISTED_PROFILE_GENERATION_ATTEMPTS)[number];

/** Terminal outcome of one generation run (not of the whole generation). */
export const ASSISTED_PROFILE_GENERATION_OUTCOMES = [
  'success',
  'clarification',
  'rejected',
  'failed',
] as const;
export type AssistedProfileGenerationOutcome =
  (typeof ASSISTED_PROFILE_GENERATION_OUTCOMES)[number];

/**
 * Rejections *of the proposal's content*: the agent answered, and the answer
 * did not survive one of API-8's validation boundaries. Mirrors
 * `AssistedProfileGenerationService.classifyFailure()` one-for-one.
 */
export const ASSISTED_PROFILE_GENERATION_REJECTION_REASONS = [
  /** API-1 schema customs rejected the agent payload. */
  'contract_mismatch',
  /** The payload passed customs but API-9's mapper could not normalize it. */
  'mapping_failed',
  /** The mapped proposal failed the ReplicationProfile domain validator. */
  'domain_validation',
  /** Still incomplete after the single allowed clarification round. */
  'clarification_limit',
] as const;
export type AssistedProfileGenerationRejectionReason =
  (typeof ASSISTED_PROFILE_GENERATION_REJECTION_REASONS)[number];

/**
 * Failures that prevented a proposal from ever being judged: infrastructure,
 * transport and admission problems. Also mirrors `classifyFailure()`.
 */
export const ASSISTED_PROFILE_GENERATION_FAILURE_REASONS = [
  /** The agent could not be reached (connection or TLS establishment). */
  'unavailable',
  /** Local queue saturation or an agent-reported busy state. */
  'saturated',
  /** The agent did not answer within the read timeout. */
  'timeout',
  /** The agent rejected the request credentials. */
  'authentication_failed',
  /** A generation for the same user and FWCloud was already running. */
  'duplicate_in_progress',
  /** Any other classified agent client failure. */
  'transport_error',
  /** An unclassified error inside the generation pipeline. */
  'internal_error',
] as const;
export type AssistedProfileGenerationFailureReason =
  (typeof ASSISTED_PROFILE_GENERATION_FAILURE_REASONS)[number];

/** Placeholder for outcomes that have no reason, keeping the label set uniform. */
export const ASSISTED_PROFILE_NO_REASON = 'none' as const;

/** Why a preview attempt did not reach `preview_ok`. From API-12's own reasons. */
export const ASSISTED_PROFILE_PREVIEW_FAILURE_REASONS = [
  /** The draft was not in `validated` when the preview was requested (409). */
  'illegal_state',
  /** The stored proposal failed the domain validator at preview time (422). */
  'domain_validation_failed',
  /** The preview hash could not be calculated (500). */
  'hash_generation_failed',
  /** A concurrent transition won the compare-and-set guard (409). */
  'transition_conflict',
] as const;
export type AssistedProfilePreviewFailureReason =
  (typeof ASSISTED_PROFILE_PREVIEW_FAILURE_REASONS)[number];

/** Terminal apply states from API-14/API-15. */
export const ASSISTED_PROFILE_APPLY_RESULTS = ['applied', 'apply_failed'] as const;
export type AssistedProfileApplyResult = (typeof ASSISTED_PROFILE_APPLY_RESULTS)[number];

/** The series of a counter whose cardinality is one closed list of values. */
const singleLabelSeries = (label: string, values: readonly string[]): readonly CounterLabels[] =>
  values.map((value) => ({ [label]: value }));

/**
 * Which reasons each generation outcome may carry. This table *is* the
 * outcome/reason contract: the counter's series are generated from it, so a new
 * pairing cannot be introduced by editing one place and forgetting the other,
 * and the documented tables in `docs/assisted-profile-adoption-metrics.md` have
 * a single code counterpart to be checked against.
 */
const GENERATION_REASONS_BY_OUTCOME: Readonly<
  Record<AssistedProfileGenerationOutcome, readonly string[]>
> = Object.freeze({
  success: [ASSISTED_PROFILE_NO_REASON],
  clarification: [ASSISTED_PROFILE_NO_REASON],
  rejected: ASSISTED_PROFILE_GENERATION_REJECTION_REASONS,
  failed: ASSISTED_PROFILE_GENERATION_FAILURE_REASONS,
});

/**
 * The exhaustive series list of every Assisted Profile counter.
 *
 * This is the cardinality guarantee: `CounterRegistry` pre-creates exactly
 * these series at zero and can never add another one, whatever a caller passes.
 * A new dimension is therefore a deliberate edit here, reviewable alongside the
 * documentation in `docs/assisted-profile-adoption-metrics.md`.
 */
export const ASSISTED_PROFILE_COUNTER_DECLARATIONS: readonly CounterDeclaration[] = Object.freeze([
  {
    name: ASSISTED_PROFILE_METRIC_NAMES.generationStarted,
    help: 'Assisted Profile generation requests accepted for processing, by round.',
    labelNames: ['attempt'],
    series: singleLabelSeries('attempt', ASSISTED_PROFILE_GENERATION_ATTEMPTS),
  },
  {
    name: ASSISTED_PROFILE_METRIC_NAMES.generation,
    help: 'Assisted Profile generation runs by terminal outcome and bounded reason class.',
    labelNames: ['outcome', 'reason'],
    series: ASSISTED_PROFILE_GENERATION_OUTCOMES.flatMap((outcome) =>
      GENERATION_REASONS_BY_OUTCOME[outcome].map((reason) => ({ outcome, reason })),
    ),
  },
  {
    name: ASSISTED_PROFILE_METRIC_NAMES.draftValidated,
    help: 'Drafts persisted in the validated state by a successful generation.',
    labelNames: [],
    series: [{}],
  },
  {
    name: ASSISTED_PROFILE_METRIC_NAMES.preview,
    help: 'Successful draft preview transitions (validated -> preview_ok).',
    labelNames: [],
    series: [{}],
  },
  {
    name: ASSISTED_PROFILE_METRIC_NAMES.previewFailed,
    help: 'Preview attempts that did not reach preview_ok, by bounded reason class.',
    labelNames: ['reason'],
    series: singleLabelSeries('reason', ASSISTED_PROFILE_PREVIEW_FAILURE_REASONS),
  },
  {
    name: ASSISTED_PROFILE_METRIC_NAMES.apply,
    help: 'Terminal draft apply transitions, by result.',
    labelNames: ['result'],
    series: singleLabelSeries('result', ASSISTED_PROFILE_APPLY_RESULTS),
  },
  {
    name: ASSISTED_PROFILE_METRIC_NAMES.draftDiscarded,
    help: 'Drafts transitioned to discarded.',
    labelNames: [],
    series: [{}],
  },
  {
    name: ASSISTED_PROFILE_METRIC_NAMES.draftExpired,
    help: 'Drafts transitioned to expired by the TTL job.',
    labelNames: [],
    series: [{}],
  },
]);
