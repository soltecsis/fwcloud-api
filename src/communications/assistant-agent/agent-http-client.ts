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

import type { AbstractApplication } from '../../fonaments/abstract-application';
import { Service } from '../../fonaments/services/service';
import { AssistantContractCustomsService } from '../../models/assistant-contract/assistant-contract-customs.service';
import { AssistantContractMismatchException } from '../../models/assistant-contract/assistant-contract-mismatch.exception';
import {
  extractAssistantContractSchemaVersion,
  ValidatedAssistedProfileProposal,
} from '../../models/assistant-contract/assistant-contract-customs';
import {
  AgentAuthenticationError,
  AgentAuthorizationError,
  AgentBusyError,
  AgentClientRequestError,
  AgentConnectionError,
  AgentContractMismatchError,
  AgentHttpClientError,
  AgentInvalidHttpResponseError,
  AgentReadTimeoutError,
  AgentRequestCancelledError,
  AgentServerError,
  AgentTlsError,
  AgentUnknownError,
} from './agent-http-errors';
import {
  AgentHttpClientConfiguration,
  AgentHttpClientConfigurationInput,
  resolveAgentHttpClientConfiguration,
} from './agent-http-client.configuration';
import { NodeAgentHttpTransport } from './agent-http-transport';
import {
  AgentHttpClientObservation,
  AgentHttpClientObserver,
  AgentHttpTransport,
  AgentHttpTransportFailure,
  AgentHttpTransportResponse,
  AgentRequestContext,
  AssistedProfileAgentRequest,
} from './agent-http.types';
import {
  NOOP_OBSERVER,
  createObservationLogger,
  recordObservationSafely,
  safeAgentIdentifier,
} from './assistant-agent.utils';

export type AssistedProfileContractGateway = Pick<
  AssistantContractCustomsService,
  'acceptedSchemaVersions' | 'validate'
>;

export interface AgentHttpClientCreateOptions {
  configuration: AgentHttpClientConfigurationInput;
  contractGateway: AssistedProfileContractGateway;
  transport?: AgentHttpTransport;
  observer?: AgentHttpClientObserver;
  clock?: () => number;
}

type AgentHttpClientOverrides = Partial<AgentHttpClientCreateOptions>;

const INVALID_REQUEST_ID = 'invalid-request-id';

/**
 * The sole production HTTP boundary for fwcloud-ai-agent generation calls.
 *
 * Retrying is intentionally based on transport phase rather than broad error
 * codes: only a failure proven to have happened before TCP/TLS establishment
 * receives one additional attempt. Every HTTP success crosses API-1 before it
 * can be returned as a branded proposal.
 */
export class AgentHttpClient extends Service {
  private _configuration: AgentHttpClientConfiguration;
  private _contractGateway: AssistedProfileContractGateway;
  private _transport: AgentHttpTransport;
  private _observer: AgentHttpClientObserver = NOOP_OBSERVER;
  private _clock: () => number = () => performance.now();

  public constructor(
    app: AbstractApplication | null,
    private readonly _overrides: AgentHttpClientOverrides = {},
  ) {
    super(app);
  }

  /** Creates an initialized client with explicit dependencies (tests/tools). */
  public static async create(options: AgentHttpClientCreateOptions): Promise<AgentHttpClient> {
    return new AgentHttpClient(null, options).build();
  }

  public async build(): Promise<AgentHttpClient> {
    const input = this._overrides.configuration ?? this.configurationFromApplication();
    this._configuration = resolveAgentHttpClientConfiguration(input);
    this._contractGateway =
      this._overrides.contractGateway ??
      (await this._app.getService<AssistantContractCustomsService>(
        AssistantContractCustomsService.name,
      ));
    this._transport =
      this._overrides.transport ?? new NodeAgentHttpTransport({ ca: this._configuration.ca });
    this._observer =
      this._overrides.observer ??
      createObservationLogger<AgentHttpClientObservation>(
        this._app,
        'assisted-profile.agent',
        (observation) => observation.outcome !== 'success',
      );
    this._clock = this._overrides.clock ?? this._clock;

    return this;
  }

  public async close(): Promise<void> {
    await this._transport?.close?.();
  }

  public async generate(
    request: AssistedProfileAgentRequest,
    context: AgentRequestContext,
  ): Promise<ValidatedAssistedProfileProposal> {
    const startedAt = this._clock();
    const requestId = this.safeRequestId(context?.requestId);
    const correlationId = this.safeIdentifier(context?.correlationId);
    let attempts = 0;
    let httpStatus: number | undefined;

    try {
      this.assertRequestContext(context, requestId, correlationId);
      const body = this.serializeRequest(request, requestId, correlationId);
      const headers: Record<string, string> = {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'Content-Length': String(Buffer.byteLength(body)),
        'X-API-Key': this._configuration.apiKey,
        'X-Request-ID': requestId,
      };

      if (correlationId !== undefined) {
        headers['X-Correlation-ID'] = correlationId;
      }

      let response: AgentHttpTransportResponse;
      while (true) {
        attempts += 1;
        try {
          response = await this._transport.request({
            url: this._configuration.endpoint,
            method: 'POST',
            headers,
            body,
            connectTimeoutMs: this._configuration.connectTimeoutMs,
            readTimeoutMs: this._configuration.readTimeoutMs,
            signal: context.signal,
          });
          break;
        } catch (error) {
          if (this.canRetryConnectionEstablishment(error, attempts)) {
            continue;
          }
          throw this.mapTransportFailure(error, requestId, correlationId, attempts);
        }
      }

      httpStatus = response.status;
      const proposal = await this.classifyAndValidate(
        response,
        context,
        requestId,
        correlationId,
        attempts,
      );
      this.observe({
        requestId,
        correlationId,
        endpoint: this._configuration.endpointIdentifier,
        elapsedMs: this.elapsedSince(startedAt),
        attempts,
        outcome: 'success',
        httpStatus,
        contractVersion: extractAssistantContractSchemaVersion(proposal),
      });

      return proposal;
    } catch (error) {
      const typedError =
        error instanceof AgentHttpClientError
          ? error
          : new AgentUnknownError({ requestId, correlationId, attempts, httpStatus });

      this.observe({
        requestId,
        correlationId,
        endpoint: this._configuration?.endpointIdentifier ?? 'unconfigured',
        elapsedMs: this.elapsedSince(startedAt),
        attempts: typedError.attempts,
        outcome: 'error',
        errorCode: typedError.code,
        httpStatus: typedError.httpStatus ?? httpStatus,
      });

      throw typedError;
    }
  }

  private configurationFromApplication(): AgentHttpClientConfigurationInput {
    if (!this._app) {
      return {};
    }

    const config = this._app.config.get('assisted_profile.agent');
    return {
      url: config.url,
      apiKey: config.api_key,
      connectTimeoutMs: config.connect_timeout_ms,
      readTimeoutMs: config.read_timeout_ms,
      caFile: config.ca_file,
      baseDirectory: this._app.path,
      // Plain HTTP is limited to development/test fake-agent use. There is no
      // production switch that disables TLS certificate verification.
      allowInsecureHttp: this._app.config.get('env') !== 'prod',
    };
  }

  private serializeRequest(
    request: AssistedProfileAgentRequest,
    requestId: string,
    correlationId?: string,
  ): string {
    if (request === null || typeof request !== 'object' || Array.isArray(request)) {
      throw new AgentClientRequestError({ requestId, correlationId, attempts: 0 });
    }

    try {
      const body = JSON.stringify(request);
      if (body !== undefined) {
        return body;
      }
    } catch {
      // Fall through to the sanitized client-request error below.
    }

    throw new AgentClientRequestError({ requestId, correlationId, attempts: 0 });
  }

  private assertRequestContext(
    context: AgentRequestContext,
    requestId: string,
    correlationId?: string,
  ): void {
    if (!context || requestId === INVALID_REQUEST_ID) {
      throw new AgentClientRequestError({ requestId, correlationId, attempts: 0 });
    }

    if (
      context.correlationId !== undefined &&
      context.correlationId !== null &&
      correlationId === undefined
    ) {
      throw new AgentClientRequestError({ requestId, attempts: 0 });
    }
  }

  private canRetryConnectionEstablishment(error: unknown, attempts: number): boolean {
    return (
      attempts < 2 &&
      error instanceof AgentHttpTransportFailure &&
      !error.requestMayHaveReachedAgent &&
      (error.kind === 'connection' || error.kind === 'tls')
    );
  }

  private mapTransportFailure(
    error: unknown,
    requestId: string,
    correlationId: string | undefined,
    attempts: number,
  ): AgentHttpClientError {
    const errorOptions = { requestId, correlationId, attempts };

    if (!(error instanceof AgentHttpTransportFailure)) {
      return new AgentUnknownError(errorOptions);
    }

    switch (error.kind) {
      case 'connection':
        return new AgentConnectionError(errorOptions);
      case 'tls':
        return new AgentTlsError(errorOptions);
      case 'read_timeout':
        return new AgentReadTimeoutError(errorOptions);
      case 'cancelled':
        return new AgentRequestCancelledError(errorOptions);
      case 'invalid_http_response':
        return new AgentInvalidHttpResponseError(errorOptions);
      default:
        return new AgentUnknownError(errorOptions);
    }
  }

  private async classifyAndValidate(
    response: AgentHttpTransportResponse,
    context: AgentRequestContext,
    requestId: string,
    correlationId: string | undefined,
    attempts: number,
  ): Promise<ValidatedAssistedProfileProposal> {
    const status = response.status;
    const errorOptions = { requestId, correlationId, attempts };

    if (!Number.isInteger(status) || status < 100 || status > 599) {
      throw new AgentInvalidHttpResponseError(errorOptions);
    }
    const responseErrorOptions = { ...errorOptions, httpStatus: status };

    if (status === 429) {
      throw new AgentBusyError({
        ...responseErrorOptions,
        retryAfterSeconds: this.parseRetryAfterSeconds(response),
      });
    }
    if (status === 401) {
      throw new AgentAuthenticationError(responseErrorOptions);
    }
    if (status === 403) {
      throw new AgentAuthorizationError(responseErrorOptions);
    }
    if (status >= 400 && status < 500) {
      throw new AgentClientRequestError(responseErrorOptions);
    }
    if (status >= 500) {
      throw new AgentServerError(responseErrorOptions);
    }
    if (status < 200 || status >= 300) {
      throw new AgentInvalidHttpResponseError(responseErrorOptions);
    }

    let payload: unknown;
    try {
      payload = JSON.parse(response.body);
    } catch {
      // Passing the unparsed representation through API-1 ensures malformed
      // JSON follows the same typed mismatch and sanitized audit path.
      payload = response.body;
    }

    try {
      return await this._contractGateway.validate(payload, {
        fwCloudId: context.fwCloudId,
        userId: context.userId,
        userName: context.userName,
        sessionId: context.sessionId,
        sourceIp: context.sourceIp,
        requestId,
        correlationId,
        agentEndpoint: this._configuration.endpointIdentifier,
        sensitiveValues: [this._configuration.apiKey],
      });
    } catch (error) {
      if (error instanceof AssistantContractMismatchException) {
        throw new AgentContractMismatchError({
          ...responseErrorOptions,
          reason: error.reason,
          contractVersion: error.contractVersion,
          receivedVersion: error.schemaVersion,
          supportedVersions: this._contractGateway.acceptedSchemaVersions,
          validationErrors: error.errors,
        });
      }
      throw error;
    }
  }

  private parseRetryAfterSeconds(response: AgentHttpTransportResponse): number | undefined {
    const header = Object.entries(response.headers).find(
      ([name]) => name.toLowerCase() === 'retry-after',
    )?.[1];
    const value = Array.isArray(header) ? header[0] : header;

    if (typeof value !== 'string') {
      return undefined;
    }

    const normalized = value.trim();
    if (/^\d+$/.test(normalized)) {
      const seconds = Number(normalized);
      return Number.isSafeInteger(seconds) ? seconds : undefined;
    }

    const retryAt = Date.parse(normalized);
    if (!Number.isFinite(retryAt)) {
      return undefined;
    }

    return Math.max(0, Math.ceil((retryAt - Date.now()) / 1000));
  }

  private safeRequestId(value: unknown): string {
    return this.safeIdentifier(value) ?? INVALID_REQUEST_ID;
  }

  private safeIdentifier(value: unknown): string | undefined {
    return safeAgentIdentifier(value, this._configuration?.apiKey);
  }

  private elapsedSince(startedAt: number): number {
    return Math.max(0, Math.round(this._clock() - startedAt));
  }

  private observe(observation: AgentHttpClientObservation): void {
    recordObservationSafely(this._observer, observation);
  }
}
