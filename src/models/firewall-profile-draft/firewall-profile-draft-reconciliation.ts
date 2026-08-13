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
import { TARGET_ORCHESTRATION_STEPS } from './target-orchestration.types';

/**
 * UI-safe view of what a `TargetOrchestrationService` run already created,
 * derived purely from `draft.step_log` and `draft.target_ids` so the read
 * endpoint never has to fall back to audit logs for reconciliation.
 */
export interface AssistedProfileReconciliationData {
  target?: { kind: FirewallProfileDraftTargetKind; id: number };
  nodeIds?: number[];
  interfaceIds?: number[];
  completedSteps: string[];
  failedStep?: string;
  errorCode?: string;
}

/**
 * Builds the reconciliation view for a draft's detail response. Returns
 * `null` for drafts that never entered orchestration (no target-orchestration
 * step in the log), since there is nothing to reconcile.
 */
export function deriveAssistedProfileReconciliationData(
  draft: FirewallProfileDraft,
): AssistedProfileReconciliationData | null {
  const orchestrationSteps = (draft.stepLog ?? []).filter((entry) =>
    (TARGET_ORCHESTRATION_STEPS as readonly string[]).includes(entry.step),
  );

  if (orchestrationSteps.length === 0) {
    return null;
  }

  const completedSteps = orchestrationSteps
    .filter((entry) => entry.status === 'success')
    .map((entry) => entry.step);
  const failedEntry = orchestrationSteps.find((entry) => entry.status === 'failed');

  const targetIds = draft.targetIds;
  // Every entry `TargetOrchestrationService` writes for these steps carries
  // `targetKind`, so the first orchestration step already names it.
  const targetKind = orchestrationSteps[0]?.targetKind;
  const targetId = targetKind === 'cluster' ? targetIds?.clusterId : targetIds?.firewallId;

  const data: AssistedProfileReconciliationData = { completedSteps };
  if (targetKind && targetId !== undefined) {
    data.target = { kind: targetKind, id: targetId };
  }
  if (targetIds?.nodeIds && targetIds.nodeIds.length > 0) {
    data.nodeIds = targetIds.nodeIds;
  }
  if (targetIds?.interfaceIds && targetIds.interfaceIds.length > 0) {
    data.interfaceIds = targetIds.interfaceIds;
  }
  if (failedEntry) {
    data.failedStep = failedEntry.step;
    if (failedEntry.errorCode) {
      data.errorCode = failedEntry.errorCode;
    }
  }
  return data;
}
