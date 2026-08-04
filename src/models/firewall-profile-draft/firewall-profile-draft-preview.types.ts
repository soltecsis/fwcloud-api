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

import type { AssistedProfileAssumptionSource } from '../assistant-contract/assisted-profile-assumptions';
import type { ReplicationProfileValidationError } from '../replication-profile/replication-profile-validation.service';

/**
 * An assumption as the reviewer sees it.
 *
 * Identical to the persisted record except for `requires_acknowledgement`,
 * the marker that keeps a value nobody asked for from reading like one the
 * user requested. It is part of the hashed content, so a change of that
 * meaning would change the binding.
 */
export interface AssistedProfilePreviewAssumption {
  readonly id: string;
  readonly path: string | null;
  readonly value?: unknown;
  readonly reason: string;
  readonly source: AssistedProfileAssumptionSource;
  readonly requires_acknowledgement: true;
}

/** What the proposal would create, derived only from the stored proposal. */
export interface AssistedProfilePreviewTarget {
  readonly kind: 'firewall' | 'cluster';
  readonly name?: string;
  readonly node_count?: number;
  readonly interface_count: number;
  readonly rule_count: number;
}

/** The existing FWCloud domain validator's verdict, reported verbatim. */
export interface AssistedProfilePreviewValidation {
  readonly valid: boolean;
  readonly errors: ReplicationProfileValidationError[];
  readonly warnings: ReplicationProfileValidationError[];
}

/**
 * Exactly what `preview_hash` is calculated over.
 *
 * Deliberately free of volatile fields (timestamps, request ids, audit ids, row
 * versions): two previews of unchanged content must produce the same hash, and
 * a change to any field here must produce a different one.
 */
export interface FirewallProfileDraftPreviewHashInput {
  readonly preview_contract_version: string;
  readonly draft_id: number;
  readonly fwcloud_id: number;
  readonly contract_version: string;
  readonly proposal_hash: string;
  readonly proposal: unknown;
  readonly target_kind: 'firewall' | 'cluster';
  readonly validation: AssistedProfilePreviewValidation;
  readonly assumptions: readonly AssistedProfilePreviewAssumption[];
}

/** The synthetic preview: what would be created, never what was created. */
export interface FirewallProfileDraftPreview {
  readonly draft_id: number;
  readonly fwcloud_id: number;
  readonly user_id: number | null;
  readonly status: 'preview_ok';
  readonly preview_contract_version: string;
  readonly contract_version: string;
  readonly proposal_hash: string;
  readonly preview_hash: string;
  readonly proposal: unknown;
  readonly target: AssistedProfilePreviewTarget;
  readonly validation: AssistedProfilePreviewValidation;
  readonly assumptions: AssistedProfilePreviewAssumption[];
  readonly previewed_at: string;
}
