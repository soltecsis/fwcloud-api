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

import type { FirewallProfileDraft } from './firewall-profile-draft.model';
import type { FirewallProfileDraftTargetKind } from './firewall-profile-draft.types';

/** The three durable checkpoints a confirmed apply of a new target walks through. */
export const TARGET_ORCHESTRATION_STEPS = [
  'target_created',
  'interfaces_created',
  'profile_applied',
] as const;
export type TargetOrchestrationStepName = (typeof TARGET_ORCHESTRATION_STEPS)[number];

/**
 * Identity of the confirmed apply operation this run belongs to. With the sole
 * exception of `targetName`, `TargetOrchestrationService` trusts none of this
 * beyond scoping/auditing: it always reloads the draft itself before acting on
 * it. `targetName` is the one field that is real input -- it names created
 * infrastructure -- so it is validated by the caller's DTO, not here.
 */
export interface TargetOrchestrationContext {
  readonly fwCloudId: number;
  readonly userId: number | null;
  readonly requestId?: string | null;
  /**
   * Name for the firewall/cluster this run creates. Absent means the stored
   * proposal's own name is used. It never renames the materialized profile,
   * which always keeps the proposal's name.
   */
  readonly targetName?: string;
}

export interface TargetOrchestrationResult {
  readonly draft: FirewallProfileDraft;
  readonly targetKind: FirewallProfileDraftTargetKind;
  readonly succeeded: boolean;
  readonly failedStep?: TargetOrchestrationStepName;
  readonly errorCode?: string;
}
