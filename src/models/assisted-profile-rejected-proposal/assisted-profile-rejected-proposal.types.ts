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
 * The rejection categories eligible for optional anonymized capture. Derived
 * from the authoritative Assisted Profile validation taxonomy, and limited to
 * the boundaries where a proposal actually exists and was rejected *because of
 * its content*:
 *
 * - `contract_mismatch`: API-1 schema customs rejected the agent payload
 *   (`malformed_payload`, `unknown_schema_version`, `schema_violation`).
 * - `mapping_failed`: the payload crossed the contract gate but API-9's mapper
 *   could not normalize it into the FWCloud domain model (this also covers an
 *   agent-declared `validation_failed`/unexpected `status`, which API-8
 *   classifies as a mapping failure).
 * - `domain_validation_failed`: the mapped proposal was rejected by the
 *   ReplicationProfile domain validator.
 *
 * Everything else is deliberately absent: agent transport failures, timeouts,
 * queue saturation, rate limiting, authentication/authorization failures,
 * clarification rounds and unexpected errors never produce a rejected proposal
 * worth evaluating, and several of them never produce a proposal at all.
 */
export const ASSISTED_PROFILE_REJECTION_CATEGORIES = [
  'contract_mismatch',
  'mapping_failed',
  'domain_validation_failed',
] as const;

export type AssistedProfileRejectionCategory =
  (typeof ASSISTED_PROFILE_REJECTION_CATEGORIES)[number];

/** Whether a category is one of the documented capture-eligible rejections. */
export function isCapturableAssistedProfileRejectionCategory(
  category: string,
): category is AssistedProfileRejectionCategory {
  return (ASSISTED_PROFILE_REJECTION_CATEGORIES as readonly string[]).includes(category);
}
