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

import {
  ASSISTED_PROFILE_ASSUMPTION_SOURCES,
  type AssistedProfileAssumption,
  type AssistedProfileAssumptionSource,
} from '../assistant-contract/assisted-profile-assumptions';
import {
  asReplicationProfileNonEmptyString,
  asReplicationProfileRecord,
} from '../replication-profile/replication-profile.constants';
import { findSecretLikePaths } from '../replication-profile/replication-profile-secret.guard';
import { canonicalizeFirewallProfileDraftValue } from './firewall-profile-draft.hash';
import { FirewallProfileDraftPreviewAssumptionError } from './firewall-profile-draft-preview.errors';
import type { AssistedProfilePreviewAssumption } from './firewall-profile-draft-preview.types';

/**
 * Turns a draft's persisted assumptions into the reviewer-facing form that
 * `preview_hash` is calculated over.
 *
 * Shared rather than private to the preview service because the normalization
 * it performs (trimming, defaulting a missing `path` to `null`, dropping an
 * absent `value`) is part of the hashed content. API-14 must run persisted
 * assumptions through *this* function before recomputing a binding, or it would
 * be hashing a differently-shaped input and never match.
 *
 * Nothing is derived here: a draft with no recorded assumptions yields none.
 * Metadata that is present but unrepresentable is rejected rather than dropped,
 * because an assumption the reviewer never saw is exactly what the preview step
 * exists to prevent.
 */
export function readPreviewAssumptions(
  draftId: number,
  stored: unknown,
): AssistedProfilePreviewAssumption[] {
  if (stored === null || stored === undefined) {
    return [];
  }

  if (!Array.isArray(stored)) {
    throw new FirewallProfileDraftPreviewAssumptionError(
      draftId,
      'stored assumptions must be an array',
    );
  }

  const seen = new Set<string>();
  return stored.map((entry, index) =>
    readPreviewAssumption(draftId, entry as Partial<AssistedProfileAssumption>, index, seen),
  );
}

function readPreviewAssumption(
  draftId: number,
  entry: Partial<AssistedProfileAssumption>,
  index: number,
  seen: Set<string>,
): AssistedProfilePreviewAssumption {
  const reject = (reason: string): never => {
    throw new FirewallProfileDraftPreviewAssumptionError(
      draftId,
      `assumptions[${index}]: ${reason}`,
    );
  };

  if (!asReplicationProfileRecord(entry)) {
    reject('must be an object');
  }

  const id = asReplicationProfileNonEmptyString(entry.id);
  if (!id) {
    reject('must carry a non-empty id');
  }
  // Ids address assumptions across preview, acknowledgement and apply, so a
  // duplicate would make an acknowledgement ambiguous.
  if (seen.has(id)) {
    reject(`duplicates the id "${id}"`);
  }
  seen.add(id);

  const reason = asReplicationProfileNonEmptyString(entry.reason);
  if (!reason) {
    reject('must carry a non-empty reason');
  }

  if (
    !ASSISTED_PROFILE_ASSUMPTION_SOURCES.includes(entry.source as AssistedProfileAssumptionSource)
  ) {
    reject(`source must be one of: ${ASSISTED_PROFILE_ASSUMPTION_SOURCES.join(', ')}`);
  }

  // An assumption with no addressable field is legitimate — agent-reported ones
  // never have a path — but a non-string path is corrupt metadata.
  if (entry.path !== undefined && entry.path !== null && typeof entry.path !== 'string') {
    reject('path must be a string or null');
  }

  if (entry.value !== undefined) {
    try {
      canonicalizeFirewallProfileDraftValue(entry.value);
    } catch {
      reject('value is not JSON-serializable');
    }

    const secretPaths = findSecretLikePaths(entry.value);
    if (secretPaths.length > 0) {
      reject(`value contains credential-like keys: ${secretPaths.join(', ')}`);
    }
  }

  return {
    id,
    path: typeof entry.path === 'string' ? entry.path : null,
    ...(entry.value !== undefined ? { value: entry.value } : {}),
    reason,
    source: entry.source as AssistedProfileAssumptionSource,
    requires_acknowledgement: true,
  };
}
