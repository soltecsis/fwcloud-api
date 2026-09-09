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

import { HttpException } from '../../fonaments/exceptions/http/http-exception';
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

  const profile = await createProfileOrNextVersion(replicationProfileService, payload, options);
  return { id: profile.id, code: profile.code, version: profile.version };
}

/**
 * Materializes the proposal's profile, adding a version when its code is
 * already taken in this FWCloud.
 *
 * Generators derive the profile code from the request, so asking twice for the
 * same thing yields the same code -- and the second apply used to fail with
 * "already exists" only AFTER the firewall had been created, leaving the
 * operator with orphaned infrastructure and a draft that cannot be retried.
 * Versioning is the catalog's own answer to "this code exists and is in use",
 * so the second apply now lands as v2 instead of half-finishing.
 */
async function createProfileOrNextVersion(
  replicationProfileService: ReplicationProfileService,
  payload: CreateCustomReplicationProfilePayload,
  options: CreateCustomReplicationProfileOptions,
): Promise<{ id: number; code: string; version: number }> {
  try {
    return await replicationProfileService.createCustomProfile(payload, options);
  } catch (error) {
    const code = payload.code;

    // Only the taken-identity case falls through to versioning: anything else
    // (an invalid definition, a persistence failure) must surface unchanged.
    if (!code || !isProfileIdentityTakenError(error)) {
      throw error;
    }

    const { code: _code, version: _version, ...versionPayload } = payload;
    return replicationProfileService.createCustomProfileVersion(code, versionPayload, options);
  }
}

function isProfileIdentityTakenError(error: unknown): boolean {
  return (
    error instanceof HttpException &&
    error.status === 409 &&
    typeof error.message === 'string' &&
    error.message.includes('already exists in this FWCloud')
  );
}

/**
 * Shared by every step-log/audit message in both apply paths (this file's
 * `materializeCustomProfileFromDraftProposal` callers): a thrown value isn't
 * always an `Error`, so this is the one place that normalizes it to a string.
 */
export function describeApplyError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  // Legacy FWCloud models reject with a plain `{ fwcErr, msg }` object
  // (src/utils/error_table.js) rather than an Error. `String()` renders that
  // as '[object Object]', and this message is the only diagnostic the step
  // log -- and therefore the UI -- ever gets for a failed step, so the shape
  // is unpacked instead of stringified.
  const legacy = error as { fwcErr?: unknown; msg?: unknown } | null;
  if (legacy !== null && typeof legacy === 'object' && typeof legacy.msg === 'string') {
    return typeof legacy.fwcErr === 'number'
      ? `${legacy.msg} (fwcErr ${legacy.fwcErr})`
      : legacy.msg;
  }

  // eslint-disable-next-line @typescript-eslint/no-base-to-string -- best-effort fallback for non-Error throws
  return String(error);
}
