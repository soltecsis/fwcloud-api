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

import {
  ReplicationProfileService,
  type CreateCustomReplicationProfileOptions,
  type CreateCustomReplicationProfilePayload,
} from '../replication-profile/replication-profile.service';

export interface MaterializedDraftProfile {
  readonly id: number;
  readonly code: string;
  readonly version: number;
}

/**
 * Turns a draft's stored `proposal` (the API-9 mapped `ReplicationProfileStoreDto`)
 * into a real `ReplicationProfile` catalog entry, reusing the existing profile
 * persistence path rather than duplicating it.
 *
 * Nothing today materializes a catalog profile from a draft before apply time,
 * so both apply paths that need one -- the existing-target confirmed apply
 * (API-14) and `TargetOrchestrationService` (API-15, new-target apply) --
 * share this one implementation instead of each inventing its own mapping.
 */
export async function materializeCustomProfileFromDraftProposal(
  replicationProfileService: ReplicationProfileService,
  proposal: unknown,
  options: CreateCustomReplicationProfileOptions,
): Promise<MaterializedDraftProfile> {
  const record = proposal as
    (CreateCustomReplicationProfilePayload & { targetKind?: string }) | null | undefined;

  if (!record || typeof record !== 'object') {
    throw new Error('Draft has no stored proposal to materialize into a profile');
  }

  const payload: CreateCustomReplicationProfilePayload = {
    name: record.name,
    description: record.description,
    code: record.code,
    version: record.version,
    scope: record.scope,
    targetKind: record.targetKind,
    category: record.category,
    model: record.model,
  };

  const profile = await replicationProfileService.createCustomProfile(payload, options);
  return { id: profile.id, code: profile.code, version: profile.version };
}

/**
 * Shared by every step-log/audit message in both apply paths (this file's
 * `materializeCustomProfileFromDraftProposal` callers): a thrown value isn't
 * always an `Error`, so this is the one place that normalizes it to a string.
 */
export function describeApplyError(error: unknown): string {
  // eslint-disable-next-line @typescript-eslint/no-base-to-string -- best-effort fallback for non-Error throws
  return error instanceof Error ? error.message : String(error);
}
