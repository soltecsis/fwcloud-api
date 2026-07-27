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

import type { ErrorPayload } from '../../fonaments/http/response-builder';
import { HttpException } from '../../fonaments/exceptions/http/http-exception';
import type { ReplicationProfileValidationError } from '../../models/replication-profile/replication-profile-validation.service';

export const ASSISTED_PROFILE_INSTRUCTION_TOO_LARGE =
  'ASSISTED_PROFILE_INSTRUCTION_TOO_LARGE' as const;
export const ASSISTED_PROFILE_GENERATION_RATE_LIMITED =
  'ASSISTED_PROFILE_GENERATION_RATE_LIMITED' as const;
export const ASSISTED_PROFILE_GENERATION_NOT_FOUND =
  'ASSISTED_PROFILE_GENERATION_NOT_FOUND' as const;
export const ASSISTED_PROFILE_CLARIFICATION_LIMIT_REACHED =
  'ASSISTED_PROFILE_CLARIFICATION_LIMIT_REACHED' as const;
export const ASSISTED_PROFILE_DOMAIN_VALIDATION_FAILED =
  'ASSISTED_PROFILE_DOMAIN_VALIDATION_FAILED' as const;
export const ASSISTED_PROFILE_MAPPING_FAILED = 'ASSISTED_PROFILE_MAPPING_FAILED' as const;

interface GenerationErrorPayload extends ErrorPayload {
  code: string;
  [key: string]: unknown;
}

/**
 * Below: the three errors that can ever become an HTTP response. Every one
 * of them is decided before the 202 is sent (authorization, DTO validation,
 * the 2KB byte limit, the rate limit, and the clarification-reference
 * lookup are all synchronous, pre-queue checks per the ticket's required
 * processing order).
 */

export class AssistedProfileInstructionTooLargeException extends HttpException {
  public readonly code = ASSISTED_PROFILE_INSTRUCTION_TOO_LARGE;

  constructor(public readonly maxBytes: number) {
    super(`The instruction cannot exceed ${maxBytes} bytes.`, 422);
  }

  public toResponse(): GenerationErrorPayload {
    return {
      ...super.toResponse(),
      code: this.code,
      maxBytes: this.maxBytes,
    };
  }
}

export class AssistedProfileGenerationRateLimitedError extends HttpException {
  public readonly code = ASSISTED_PROFILE_GENERATION_RATE_LIMITED;

  constructor() {
    super('Too many Assisted Profile generation requests. Please try again later.', 429);
  }

  public toResponse(): GenerationErrorPayload {
    return {
      ...super.toResponse(),
      code: this.code,
    };
  }
}

export class AssistedProfileGenerationNotFoundError extends HttpException {
  public readonly code = ASSISTED_PROFILE_GENERATION_NOT_FOUND;

  constructor(public readonly generationId: string) {
    super(
      `Assisted Profile generation '${generationId}' is not an active clarification-awaiting generation for this user and FWCloud.`,
      404,
    );
  }

  public toResponse(): GenerationErrorPayload {
    return {
      ...super.toResponse(),
      code: this.code,
      generation_id: this.generationId,
    };
  }
}

/**
 * Below: post-202 terminal outcomes. These are plain typed errors, never
 * rendered as an HTTP response — they only ever appear as the Channel
 * `failed` event's `error` field and as the attempt's audit record.
 */

export class AssistedProfileClarificationLimitReachedError extends Error {
  public readonly code = ASSISTED_PROFILE_CLARIFICATION_LIMIT_REACHED;

  constructor() {
    super('The proposal still lacks required information after the allowed clarification round.');
    this.name = AssistedProfileClarificationLimitReachedError.name;
  }
}

export class AssistedProfileDomainValidationFailedError extends Error {
  public readonly code = ASSISTED_PROFILE_DOMAIN_VALIDATION_FAILED;

  constructor(public readonly errors: ReplicationProfileValidationError[]) {
    super('The generated proposal is not valid for FWCloud.');
    this.name = AssistedProfileDomainValidationFailedError.name;
  }
}

export class AssistedProfileMappingFailedError extends Error {
  public readonly code = ASSISTED_PROFILE_MAPPING_FAILED;
  public readonly cause?: unknown;

  constructor(cause: unknown) {
    super('The agent proposal could not be mapped into the FWCloud domain model.');
    this.name = AssistedProfileMappingFailedError.name;
    this.cause = cause;
  }
}
