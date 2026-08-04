/*!
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
 * Failures specific to building a preview.
 *
 * Deliberately narrow: an illegal state reuses
 * `FirewallProfileDraftTransitionConflictError` and an unsupported contract
 * version reuses `UnsupportedFirewallProfileDraftContractVersionError`, both
 * from API-3, so a caller sees one code per condition instead of a preview
 * flavour of an error it already handles.
 */

import type { ErrorPayload } from '../../fonaments/http/response-builder';
import { HttpException } from '../../fonaments/exceptions/http/http-exception';
import type { ReplicationProfileValidationError } from '../replication-profile/replication-profile-validation.service';

export const FIREWALL_PROFILE_DRAFT_PREVIEW_VALIDATION_FAILED =
  'FIREWALL_PROFILE_DRAFT_PREVIEW_VALIDATION_FAILED' as const;
export const FIREWALL_PROFILE_DRAFT_PREVIEW_ASSUMPTIONS_INVALID =
  'FIREWALL_PROFILE_DRAFT_PREVIEW_ASSUMPTIONS_INVALID' as const;
export const FIREWALL_PROFILE_DRAFT_PREVIEW_HASH_FAILED =
  'FIREWALL_PROFILE_DRAFT_PREVIEW_HASH_FAILED' as const;

interface DraftPreviewErrorPayload extends ErrorPayload {
  code: string;
  [key: string]: unknown;
}

/**
 * The stored proposal is contract-valid and maps, but the existing FWCloud
 * domain validator rejects it. The draft stays in `validated` and no preview
 * hash is persisted, so the proposal cannot be confirmed on a stale review.
 */
export class FirewallProfileDraftPreviewValidationError extends HttpException {
  public readonly code = FIREWALL_PROFILE_DRAFT_PREVIEW_VALIDATION_FAILED;

  constructor(
    public readonly draftId: number,
    public readonly validationErrors: ReplicationProfileValidationError[],
  ) {
    super(`Draft ${draftId} does not satisfy FWCloud domain rules and cannot be previewed.`, 422);
  }

  public toResponse(): DraftPreviewErrorPayload {
    return {
      ...super.toResponse(),
      code: this.code,
      draftId: this.draftId,
      errors: { profile: this.validationErrors },
    };
  }
}

/**
 * Persisted normalization metadata could not be represented safely. Preview is
 * rejected rather than silently dropping an assumption, because an assumption
 * the reviewer never saw is exactly what the preview step exists to prevent.
 */
export class FirewallProfileDraftPreviewAssumptionError extends HttpException {
  public readonly code = FIREWALL_PROFILE_DRAFT_PREVIEW_ASSUMPTIONS_INVALID;

  constructor(
    public readonly draftId: number,
    public readonly reason: string,
  ) {
    super(`Draft ${draftId} has unrepresentable normalization assumptions: ${reason}`, 422);
  }

  public toResponse(): DraftPreviewErrorPayload {
    return {
      ...super.toResponse(),
      code: this.code,
      draftId: this.draftId,
      reason: this.reason,
    };
  }
}

/** The preview-bound content could not be canonicalized or bound to a hash. */
export class FirewallProfileDraftPreviewHashError extends HttpException {
  public readonly code = FIREWALL_PROFILE_DRAFT_PREVIEW_HASH_FAILED;

  constructor(
    message: string,
    public readonly cause?: unknown,
  ) {
    super(message, 500);
  }

  public toResponse(): DraftPreviewErrorPayload {
    return { ...super.toResponse(), code: this.code };
  }
}
