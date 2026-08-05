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
 * The persisted "this value was not asked for" record.
 *
 * An assumption is any value present in a stored proposal that the user never
 * requested: something the API-9 mapper normalized or defaulted, or something
 * the agent itself reported as an assumption. They are captured once, when the
 * draft is generated, and are part of the draft's immutable reviewed content —
 * the preview flow only ever reads them back. It must never derive new ones
 * for presentation, because an assumption a human acknowledged must be exactly
 * the assumption that was recorded.
 *
 * Defined here, next to the mapper that produces most of them, so both the
 * contract layer and the draft persistence layer can share one shape.
 */

import type { ValidatedAssistedProfileProposal } from './assistant-contract-customs';

export const ASSISTED_PROFILE_ASSUMPTION_SOURCES = ['normalization', 'agent', 'default'] as const;

export type AssistedProfileAssumptionSource = (typeof ASSISTED_PROFILE_ASSUMPTION_SOURCES)[number];

export interface AssistedProfileAssumption {
  /** Stable within a draft; reused verbatim by preview and confirmation. */
  readonly id: string;
  /**
   * Dot/bracket path into the stored proposal, or `null` for assumptions with
   * no single editor field (agent-reported ones in particular).
   */
  readonly path: string | null;
  readonly value?: unknown;
  readonly reason: string;
  readonly source: AssistedProfileAssumptionSource;
}

interface ProposalWarning {
  code?: unknown;
  message?: unknown;
  severity?: unknown;
}

/**
 * Turns the agent's own `warnings[]` into assumptions.
 *
 * Every warning becomes one: the agent emits them precisely to flag content it
 * inferred rather than derived from the instruction, and none of them carries a
 * proposal path, which is why `path` is `null` here.
 */
export function collectAgentAssumptions(
  proposal: ValidatedAssistedProfileProposal,
): AssistedProfileAssumption[] {
  const warnings = (proposal as { warnings?: unknown }).warnings;
  if (!Array.isArray(warnings)) {
    return [];
  }

  const assumptions: AssistedProfileAssumption[] = [];
  warnings.forEach((entry, index) => {
    const warning = entry as ProposalWarning;
    const message = typeof warning?.message === 'string' ? warning.message.trim() : '';
    if (message.length === 0) {
      return;
    }

    const code =
      typeof warning?.code === 'string' && warning.code.trim() ? warning.code.trim() : null;
    assumptions.push({
      id: `agent.warning.${index}${code ? `.${code}` : ''}`,
      path: null,
      reason: message,
      source: 'agent',
    });
  });

  return assumptions;
}
