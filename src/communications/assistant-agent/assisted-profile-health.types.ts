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

import type { AgentHealthFailureCode } from './agent-health.types';

export type AssistedProfileHealthStatus = 'ready' | 'busy' | 'unavailable';

/** Derived, UI-facing Assisted Profile availability state. */
export interface AssistedProfileAvailability {
  readonly available: boolean;
  readonly busy: boolean;
  readonly alive: boolean;
  readonly modelReady: boolean;
  readonly status: AssistedProfileHealthStatus;
}

/**
 * In-memory snapshot held by AssistedProfileHealthService. Never contains the
 * agent URL, API key, TLS configuration, or a raw upstream error message.
 */
export interface AssistedProfileHealthSnapshot extends AssistedProfileAvailability {
  readonly lastCheckedAt?: string;
  readonly lastSuccessfulCheckAt?: string;
  readonly failureCode?: AgentHealthFailureCode | 'model_not_ready' | null;
}

export type AssistedProfileHealthObservationType = 'check';

/** Safe, per-check operational metadata. Never contains a health response body. */
export interface AssistedProfileHealthObservation {
  readonly type: AssistedProfileHealthObservationType;
  readonly outcome: 'success' | 'failure';
  readonly durationMs: number;
  readonly snapshot: AssistedProfileHealthSnapshot;
  readonly transitioned: boolean;
}

export interface AssistedProfileHealthObserver {
  record(observation: AssistedProfileHealthObservation): void;
}

export interface AssistedProfileHealthStats {
  readonly checkCount: number;
  readonly successCount: number;
  readonly failureCount: number;
  readonly transitionCount: number;
}
