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

/**
 * Failures specific to the confirmed apply endpoint (API-14).
 *
 * Deliberately narrow: an illegal state (not `preview_ok`) reuses
 * `FirewallProfileDraftTransitionConflictError` from API-3, and a
 * duplicate/concurrent submission reuses `IdempotencyKeyInProgressError` /
 * `IdempotencyKeyPayloadMismatchError` from the idempotency-key module, so a
 * caller sees one code per condition instead of an apply-specific flavour of
 * an error it already handles elsewhere.
 */

import type { ErrorPayload } from '../../fonaments/http/response-builder';
import { HttpException } from '../../fonaments/exceptions/http/http-exception';

export const FIREWALL_PROFILE_DRAFT_APPLY_PREVIEW_HASH_MISMATCH =
  'FIREWALL_PROFILE_DRAFT_APPLY_PREVIEW_HASH_MISMATCH' as const;
export const FIREWALL_PROFILE_DRAFT_APPLY_IDEMPOTENCY_KEY_MISSING =
  'FIREWALL_PROFILE_DRAFT_APPLY_IDEMPOTENCY_KEY_MISSING' as const;

interface DraftApplyErrorPayload extends ErrorPayload {
  code: string;
  [key: string]: unknown;
}

/**
 * The confirmed apply must be bound to exactly the content the user
 * reviewed. Never exposes either hash value: a mismatch is either a stale
 * client (re-preview and confirm again) or tampering, and neither case
 * benefits from leaking the expected value.
 */
export class FirewallProfileDraftApplyPreviewHashMismatchError extends HttpException {
  public readonly code = FIREWALL_PROFILE_DRAFT_APPLY_PREVIEW_HASH_MISMATCH;

  constructor(public readonly draftId: number) {
    super(
      `Draft ${draftId} apply was not confirmed against its current preview_hash. Preview it again before confirming.`,
      422,
    );
  }

  public toResponse(): DraftApplyErrorPayload {
    return { ...super.toResponse(), code: this.code, draftId: this.draftId };
  }
}

/** API-13 requires every confirmed apply to carry an `Idempotency-Key` header. */
export class FirewallProfileDraftApplyIdempotencyKeyMissingError extends HttpException {
  public readonly code = FIREWALL_PROFILE_DRAFT_APPLY_IDEMPOTENCY_KEY_MISSING;

  constructor(public readonly draftId: number) {
    super(`Draft ${draftId} apply requires an Idempotency-Key header.`, 400);
  }

  public toResponse(): DraftApplyErrorPayload {
    return { ...super.toResponse(), code: this.code, draftId: this.draftId };
  }
}
