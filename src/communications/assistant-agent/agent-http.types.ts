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

import type { AssistantContractValidationContext } from '../../models/assistant-contract/assistant-contract-customs.service';

/** Untrusted generation input sent to the Assisted Profile agent. */
export interface AssistedProfileAgentRequest {
  text: string;
  [key: string]: unknown;
}

/**
 * Per-request metadata shared with the API-1 validation/audit gateway. The
 * request id is mandatory at this boundary so every transport outcome can be
 * correlated without inspecting request or response bodies.
 */
export interface AgentRequestContext extends AssistantContractValidationContext {
  requestId: string;
  correlationId?: string;
  signal?: AbortSignal;
}

export type AgentHttpRequestHeaders = Readonly<Record<string, string>>;
export type AgentHttpResponseHeaders = Readonly<
  Record<string, string | readonly string[] | undefined>
>;

/** Request shape consumed by an injected, direct (non-proxying) transport. */
export interface AgentHttpTransportRequest {
  readonly method: 'POST';
  readonly url: URL;
  readonly headers: AgentHttpRequestHeaders;
  readonly body: string;
  readonly connectTimeoutMs: number;
  readonly readTimeoutMs: number;
  readonly signal?: AbortSignal;
}

/** The transport deliberately returns the body as untrusted text. */
export interface AgentHttpTransportResponse {
  readonly status: number;
  readonly headers: AgentHttpResponseHeaders;
  readonly body: string;
}

export interface AgentHttpTransport {
  request(request: AgentHttpTransportRequest): Promise<AgentHttpTransportResponse>;
  close?(): void | Promise<void>;
}

/**
 * `connection` is reserved for failures proven to have happened before an
 * HTTP request could reach the agent. A reset after transmission is `unknown`,
 * which prevents the client from retrying potentially duplicated inference.
 */
export type AgentHttpTransportFailureKind =
  | 'connection'
  | 'read_timeout'
  | 'tls'
  | 'cancelled'
  | 'invalid_http_response'
  | 'unknown';

const TRANSPORT_FAILURE_MESSAGES: Record<AgentHttpTransportFailureKind, string> = {
  connection: 'Agent connection establishment failed',
  read_timeout: 'Timed out while waiting for the agent response',
  tls: 'Agent TLS connection establishment failed',
  cancelled: 'Agent request was cancelled',
  invalid_http_response: 'The agent returned an invalid HTTP response',
  unknown: 'Agent transport failed',
};

/**
 * Safe classification emitted by transports. It intentionally does not retain
 * an arbitrary upstream message, URL, headers, body, or cause.
 */
export class AgentHttpTransportFailure extends Error {
  constructor(
    public readonly kind: AgentHttpTransportFailureKind,
    public readonly requestMayHaveReachedAgent: boolean,
    _safeTransportMessage?: string,
  ) {
    super(TRANSPORT_FAILURE_MESSAGES[kind]);
    this.name = AgentHttpTransportFailure.name;
  }
}

export type AgentHttpClientOutcome = 'success' | 'error';

/** Safe, body-free operational metadata emitted once per logical request. */
export interface AgentHttpClientObservation {
  readonly requestId: string;
  readonly correlationId?: string;
  readonly endpoint: string;
  readonly elapsedMs: number;
  readonly attempts: number;
  readonly outcome: AgentHttpClientOutcome;
  readonly errorCode?: string;
  readonly httpStatus?: number;
  readonly contractVersion?: string;
}

/** Implementations may log, meter, or discard an observation. */
export interface AgentHttpClientObserver {
  record(observation: AgentHttpClientObservation): void;
}
