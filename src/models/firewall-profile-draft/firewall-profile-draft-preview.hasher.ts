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

import { findSecretLikePaths } from '../replication-profile/replication-profile-secret.guard';
import { hashFirewallProfileDraftValue } from './firewall-profile-draft.hash';
import { FirewallProfileDraftPreviewHashError } from './firewall-profile-draft-preview.errors';
import type { FirewallProfileDraftPreviewHashInput } from './firewall-profile-draft-preview.types';

/**
 * Version of the preview *representation*, independent of the API-1 contract
 * version that the proposal itself carries.
 *
 * Bump it whenever the set of fields bound by `preview_hash`, or their meaning,
 * changes. Because it is the first field of every hash input, bumping it
 * invalidates every previously issued preview binding — which is the point: a
 * hash issued under different rules must never be accepted as equivalent.
 */
export const FIREWALL_PROFILE_DRAFT_PREVIEW_CONTRACT_VERSION = 'preview.v1';

/**
 * The single place `preview_hash` is produced, and the contract API-14 must
 * reuse verbatim when it verifies a confirmation against a preview.
 *
 * Canonicalization is delegated to `canonicalizeFirewallProfileDraftValue`,
 * shared with `proposal_hash`:
 *
 * - object keys are recursively sorted, so property insertion order — including
 *   whatever order a JSON column happens to deserialize in — cannot change the
 *   hash;
 * - array order is significant, because it is significant in the proposal
 *   (interface and rule position are addressable, and assumption paths point at
 *   indexes);
 * - `undefined`-valued properties are dropped while explicit `null` is kept, so
 *   an omitted optional field and a field set to null stay distinguishable;
 * - values are encoded as standard JSON and hashed as UTF-8 bytes with SHA-256,
 *   so no locale or platform formatting takes part.
 *
 * The caller assembles `FirewallProfileDraftPreviewHashInput`, whose fields are
 * exactly the reviewed content: no timestamps, request ids, audit ids or row
 * metadata, so re-previewing unchanged content is stable.
 *
 * The result is an integrity binding, not a credential: it proves a later
 * confirmation refers to the content that was reviewed. It is not secret, not
 * an authorization token, not a substitute for `DraftPolicy`, and not an
 * idempotency key.
 */
export class FirewallProfileDraftPreviewHasher {
  public calculatePreviewHash(input: FirewallProfileDraftPreviewHashInput): string {
    if (input.preview_contract_version !== FIREWALL_PROFILE_DRAFT_PREVIEW_CONTRACT_VERSION) {
      throw new FirewallProfileDraftPreviewHashError(
        `Preview hash input declares contract version '${input.preview_contract_version}', expected '${FIREWALL_PROFILE_DRAFT_PREVIEW_CONTRACT_VERSION}'.`,
      );
    }

    // A hash is a binding, not a sanitizer: refuse to bind content that should
    // never have been persisted in the first place rather than immortalize it.
    const secretPaths = findSecretLikePaths(input.proposal);
    if (secretPaths.length > 0) {
      throw new FirewallProfileDraftPreviewHashError(
        `Preview content contains credential-like keys: ${secretPaths.join(', ')}.`,
      );
    }

    try {
      return hashFirewallProfileDraftValue(input);
    } catch (error) {
      throw new FirewallProfileDraftPreviewHashError(
        'Preview content could not be canonicalized.',
        error,
      );
    }
  }
}
