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

import type {
  ContractCustomsErrorDetail,
  ContractCustomsRejectionReason,
} from '../../models/assistant-contract/assistant-contract-customs';

export const AGENT_CONNECTION_ERROR = 'AGENT_CONNECTION_ERROR' as const;
export const AGENT_READ_TIMEOUT = 'AGENT_READ_TIMEOUT' as const;
export const AGENT_BUSY = 'AGENT_BUSY' as const;
export const AGENT_AUTHENTICATION_ERROR = 'AGENT_AUTHENTICATION_ERROR' as const;
export const AGENT_AUTHORIZATION_ERROR = 'AGENT_AUTHORIZATION_ERROR' as const;
export const AGENT_CLIENT_REQUEST_ERROR = 'AGENT_CLIENT_REQUEST_ERROR' as const;
export const AGENT_SERVER_ERROR = 'AGENT_SERVER_ERROR' as const;
export const AGENT_TLS_ERROR = 'AGENT_TLS_ERROR' as const;
export const AGENT_INVALID_HTTP_RESPONSE = 'AGENT_INVALID_HTTP_RESPONSE' as const;
export const ASSISTED_PROFILE_CONTRACT_MISMATCH = 'ASSISTED_PROFILE_CONTRACT_MISMATCH' as const;
export const AGENT_REQUEST_CANCELLED = 'AGENT_REQUEST_CANCELLED' as const;
export const AGENT_UNKNOWN_ERROR = 'AGENT_UNKNOWN_ERROR' as const;

export type AgentHttpErrorCode =
  | typeof AGENT_CONNECTION_ERROR
  | typeof AGENT_READ_TIMEOUT
  | typeof AGENT_BUSY
  | typeof AGENT_AUTHENTICATION_ERROR
  | typeof AGENT_AUTHORIZATION_ERROR
  | typeof AGENT_CLIENT_REQUEST_ERROR
  | typeof AGENT_SERVER_ERROR
  | typeof AGENT_TLS_ERROR
  | typeof AGENT_INVALID_HTTP_RESPONSE
  | typeof ASSISTED_PROFILE_CONTRACT_MISMATCH
  | typeof AGENT_REQUEST_CANCELLED
  | typeof AGENT_UNKNOWN_ERROR;

export interface AgentHttpErrorOptions {
  readonly requestId: string;
  readonly correlationId?: string;
  readonly attempts?: number;
  readonly httpStatus?: number;
}

export interface AgentHttpStatusErrorOptions extends AgentHttpErrorOptions {
  readonly httpStatus: number;
}

/**
 * Root of the public error taxonomy. Messages are fixed by this module so
 * transport messages, credentials, and untrusted response bodies cannot leak
 * through an error returned to application code.
 */
export abstract class AgentHttpClientError<
  TCode extends AgentHttpErrorCode = AgentHttpErrorCode,
> extends Error {
  public readonly attempts: number;
  public readonly requestId: string;
  public readonly correlationId?: string;
  public readonly httpStatus?: number;

  protected constructor(
    public readonly code: TCode,
    message: string,
    options: AgentHttpErrorOptions,
  ) {
    super(message);
    this.name = new.target.name;
    this.attempts = options.attempts ?? 1;
    this.requestId = options.requestId;
    this.correlationId = options.correlationId;
    this.httpStatus = options.httpStatus;
  }
}

/** Backwards-friendly short name for callers that only need the base type. */
export { AgentHttpClientError as AgentHttpError };

export class AgentConnectionError extends AgentHttpClientError<typeof AGENT_CONNECTION_ERROR> {
  constructor(options: AgentHttpErrorOptions) {
    super(AGENT_CONNECTION_ERROR, 'Unable to establish a connection to the agent', options);
  }
}

export class AgentReadTimeoutError extends AgentHttpClientError<typeof AGENT_READ_TIMEOUT> {
  constructor(options: AgentHttpErrorOptions) {
    super(AGENT_READ_TIMEOUT, 'Timed out while waiting for the agent response', options);
  }
}

export interface AgentBusyErrorOptions extends AgentHttpErrorOptions {
  readonly retryAfterSeconds?: number;
}

export class AgentBusyError extends AgentHttpClientError<typeof AGENT_BUSY> {
  public readonly retryAfterSeconds?: number;

  constructor(options: AgentBusyErrorOptions) {
    super(AGENT_BUSY, 'The agent is busy', { ...options, httpStatus: 429 });
    this.retryAfterSeconds = options.retryAfterSeconds;
  }
}

export class AgentAuthenticationError extends AgentHttpClientError<
  typeof AGENT_AUTHENTICATION_ERROR
> {
  constructor(options: AgentHttpErrorOptions) {
    super(AGENT_AUTHENTICATION_ERROR, 'Agent authentication failed', {
      ...options,
      httpStatus: 401,
    });
  }
}

export class AgentAuthorizationError extends AgentHttpClientError<
  typeof AGENT_AUTHORIZATION_ERROR
> {
  constructor(options: AgentHttpErrorOptions) {
    super(AGENT_AUTHORIZATION_ERROR, 'Agent authorization failed', {
      ...options,
      httpStatus: 403,
    });
  }
}

export class AgentClientRequestError extends AgentHttpClientError<
  typeof AGENT_CLIENT_REQUEST_ERROR
> {
  constructor(options: AgentHttpErrorOptions) {
    super(AGENT_CLIENT_REQUEST_ERROR, 'The agent rejected the request', options);
  }
}

export class AgentServerError extends AgentHttpClientError<typeof AGENT_SERVER_ERROR> {
  constructor(options: AgentHttpStatusErrorOptions) {
    super(AGENT_SERVER_ERROR, 'The agent returned a server error', options);
  }
}

export class AgentTlsError extends AgentHttpClientError<typeof AGENT_TLS_ERROR> {
  constructor(options: AgentHttpErrorOptions) {
    super(AGENT_TLS_ERROR, 'A secure connection to the agent could not be established', options);
  }
}

export class AgentInvalidHttpResponseError extends AgentHttpClientError<
  typeof AGENT_INVALID_HTTP_RESPONSE
> {
  constructor(options: AgentHttpErrorOptions) {
    super(AGENT_INVALID_HTTP_RESPONSE, 'The agent returned an invalid HTTP response', options);
  }
}

export interface AgentContractMismatchErrorOptions extends AgentHttpErrorOptions {
  readonly reason: ContractCustomsRejectionReason;
  readonly contractVersion: string;
  readonly receivedVersion: string | null;
  readonly supportedVersions: readonly string[];
  readonly validationErrors?: readonly ContractCustomsErrorDetail[];
  readonly validationPaths?: readonly string[];
}

export class AgentContractMismatchError extends AgentHttpClientError<
  typeof ASSISTED_PROFILE_CONTRACT_MISMATCH
> {
  public readonly reason: ContractCustomsRejectionReason;
  public readonly contractVersion: string;
  public readonly receivedVersion: string | null;
  public readonly supportedVersions: readonly string[];
  public readonly validationErrors?: readonly ContractCustomsErrorDetail[];
  public readonly validationPaths: readonly string[];

  constructor(options: AgentContractMismatchErrorOptions) {
    super(
      ASSISTED_PROFILE_CONTRACT_MISMATCH,
      'The agent response does not match a supported Assisted Profile contract',
      options,
    );
    this.reason = options.reason;
    this.contractVersion = options.contractVersion;
    this.receivedVersion = options.receivedVersion;
    this.supportedVersions = [...options.supportedVersions];
    this.validationErrors = options.validationErrors?.map((error) => ({ ...error }));
    this.validationPaths = [
      ...(options.validationPaths ??
        options.validationErrors?.map((error) => error.instancePath) ??
        []),
    ];
  }
}

export class AgentRequestCancelledError extends AgentHttpClientError<
  typeof AGENT_REQUEST_CANCELLED
> {
  constructor(options: AgentHttpErrorOptions) {
    super(AGENT_REQUEST_CANCELLED, 'The agent request was cancelled', options);
  }
}

export class AgentUnknownError extends AgentHttpClientError<typeof AGENT_UNKNOWN_ERROR> {
  constructor(options: AgentHttpErrorOptions) {
    super(AGENT_UNKNOWN_ERROR, 'An unknown agent communication error occurred', options);
  }
}
