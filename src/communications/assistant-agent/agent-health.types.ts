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

/** Parsed AG-3 health payload. Never interpreted as an apg.mvp.v1 proposal. */
export interface AgentHealthCheckResponse {
  readonly alive: boolean;
  readonly busy: boolean;
  readonly modelReady: boolean;
}

export interface AgentHealthCheckOptions {
  readonly timeoutMs: number;
  readonly signal?: AbortSignal;
}

export type AgentHealthFailureCode = 'connection_error' | 'timeout' | 'invalid_response';

/**
 * Safe classification for a failed health check. Deliberately separate from
 * AgentHttpClientError: a health probe has no request id/correlation id and
 * must never be retried the way generation requests are.
 */
export class AgentHealthCheckError extends Error {
  constructor(public readonly failureCode: AgentHealthFailureCode) {
    super(`Assisted Profile agent health check failed: ${failureCode}`);
    this.name = AgentHealthCheckError.name;
  }
}
