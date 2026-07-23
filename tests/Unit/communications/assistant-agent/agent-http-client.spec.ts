import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { rootCertificates } from 'node:tls';
import { expect } from 'chai';
import { ConfigurationErrorException } from '../../../../src/config/exceptions/configuration-error.exception';
import { AbstractApplication } from '../../../../src/fonaments/abstract-application';
import { ServiceContainer } from '../../../../src/fonaments/services/service-container';
import {
  AgentHttpClient,
  AssistedProfileContractGateway,
} from '../../../../src/communications/assistant-agent/agent-http-client';
import {
  DEFAULT_AGENT_CONNECT_TIMEOUT_MS,
  DEFAULT_AGENT_READ_TIMEOUT_MS,
  MAX_AGENT_TIMEOUT_MS,
  AgentHttpClientConfigurationInput,
  resolveAgentHttpClientConfiguration,
} from '../../../../src/communications/assistant-agent/agent-http-client.configuration';
import { NodeAgentHttpTransport } from '../../../../src/communications/assistant-agent/agent-http-transport';
import { AgentHttpClientProvider } from '../../../../src/communications/assistant-agent/agent-http-client.provider';
import {
  AGENT_AUTHENTICATION_ERROR,
  AGENT_AUTHORIZATION_ERROR,
  AGENT_BUSY,
  AGENT_CLIENT_REQUEST_ERROR,
  AGENT_CONNECTION_ERROR,
  AGENT_INVALID_HTTP_RESPONSE,
  AGENT_READ_TIMEOUT,
  AGENT_REQUEST_CANCELLED,
  AGENT_SERVER_ERROR,
  AGENT_TLS_ERROR,
  AGENT_UNKNOWN_ERROR,
  ASSISTED_PROFILE_CONTRACT_MISMATCH,
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
} from '../../../../src/communications/assistant-agent/agent-http-errors';
import {
  AgentHttpClientObservation,
  AgentHttpClientObserver,
  AgentHttpTransport,
  AgentHttpTransportFailure,
  AgentHttpTransportRequest,
  AgentHttpTransportResponse,
  AgentRequestContext,
  AssistedProfileAgentRequest,
} from '../../../../src/communications/assistant-agent/agent-http.types';
import { AssistantContractValidationContext } from '../../../../src/models/assistant-contract/assistant-contract-customs.service';
import { AssistantContractMismatchException } from '../../../../src/models/assistant-contract/assistant-contract-mismatch.exception';
import { ValidatedAssistedProfileProposal } from '../../../../src/models/assistant-contract/assistant-contract-customs';
import validSuccess from '../../models/assistant-contract/fixtures/valid-success.json';
import invalidMissingField from '../../models/assistant-contract/fixtures/invalid-missing-field.json';
import invalidUnknownVersion from '../../models/assistant-contract/fixtures/invalid-unknown-version.json';
import { ErrorConstructor, expectRejectedAs } from '../../../utils/assertions';

const API_KEY = 'unit-test-agent-key-never-log';
const AGENT_URL = 'http://fake-agent.test:8080';
const AGENT_ENDPOINT = `${AGENT_URL}/generate`;
const REQUEST: AssistedProfileAgentRequest = {
  text: 'Create a guarded edge profile',
  target: 'firewall',
};
const CONTEXT: AgentRequestContext = {
  fwCloudId: 17,
  userId: 23,
  userName: 'agent-client-test',
  sessionId: 31,
  sourceIp: '192.0.2.10',
  requestId: 'request-unit-123',
  correlationId: 'correlation-unit-456',
};
const BASE_CONFIGURATION: AgentHttpClientConfigurationInput = {
  url: AGENT_URL,
  apiKey: API_KEY,
  connectTimeoutMs: 1_234,
  readTimeoutMs: 180_123,
  allowInsecureHttp: true,
};

type TransportOutcome =
  | AgentHttpTransportResponse
  | Error
  | ((
      request: AgentHttpTransportRequest,
    ) => AgentHttpTransportResponse | Promise<AgentHttpTransportResponse>);

/** Deterministic transport: each request consumes exactly one queued outcome. */
class QueueAgentHttpTransport implements AgentHttpTransport {
  public readonly requests: AgentHttpTransportRequest[] = [];
  private readonly outcomes: TransportOutcome[];

  constructor(outcomes: readonly TransportOutcome[]) {
    this.outcomes = [...outcomes];
  }

  public async request(request: AgentHttpTransportRequest): Promise<AgentHttpTransportResponse> {
    this.requests.push(request);
    const outcome = this.outcomes.shift();

    if (outcome === undefined) {
      throw new Error('Unexpected extra transport request');
    }
    if (outcome instanceof Error) {
      throw outcome;
    }
    if (typeof outcome === 'function') {
      return outcome(request);
    }

    return outcome;
  }
}

interface GatewayCall {
  payload: unknown;
  context?: AssistantContractValidationContext;
}

type GatewayHandler = (
  payload: unknown,
  context?: AssistantContractValidationContext,
) => ValidatedAssistedProfileProposal | Promise<ValidatedAssistedProfileProposal>;

class FakeContractGateway implements AssistedProfileContractGateway {
  public readonly calls: GatewayCall[] = [];

  constructor(
    private readonly handler: GatewayHandler = () =>
      validSuccess as unknown as ValidatedAssistedProfileProposal,
    public readonly acceptedSchemaVersions: string[] = ['1.0.0'],
  ) {}

  public async validate(
    payload: unknown,
    context?: AssistantContractValidationContext,
  ): Promise<ValidatedAssistedProfileProposal> {
    this.calls.push({ payload, context });
    return this.handler(payload, context);
  }
}

interface ClientHarnessOptions {
  outcomes?: readonly TransportOutcome[];
  gateway?: FakeContractGateway;
  configuration?: Partial<AgentHttpClientConfigurationInput>;
  observer?: AgentHttpClientObserver;
  clock?: () => number;
}

interface ClientHarness {
  client: AgentHttpClient;
  gateway: FakeContractGateway;
  observations: AgentHttpClientObservation[];
  transport: QueueAgentHttpTransport;
}

function response(
  status = 200,
  body = JSON.stringify(validSuccess),
  headers: AgentHttpTransportResponse['headers'] = {},
): AgentHttpTransportResponse {
  return { status, body, headers };
}

function safeConnectionFailure(): AgentHttpTransportFailure {
  return new AgentHttpTransportFailure('connection', false, 'upstream text must never escape');
}

async function makeClient(options: ClientHarnessOptions = {}): Promise<ClientHarness> {
  const transport = new QueueAgentHttpTransport(options.outcomes ?? [response()]);
  const gateway = options.gateway ?? new FakeContractGateway();
  const observations: AgentHttpClientObservation[] = [];
  const observer =
    options.observer ??
    ({
      record: (observation: AgentHttpClientObservation): void => {
        observations.push(observation);
      },
    } satisfies AgentHttpClientObserver);
  const client = await AgentHttpClient.create({
    configuration: { ...BASE_CONFIGURATION, ...options.configuration },
    contractGateway: gateway,
    transport,
    observer,
    clock: options.clock,
  });

  return { client, gateway, observations, transport };
}

describe('AgentHttpClient unit tests', () => {
  it('adds authentication and request identifiers, validates the payload, and returns only the gateway result', async () => {
    const signal = new AbortController().signal;
    const requestContext: AgentRequestContext = { ...CONTEXT, signal };
    const validated = structuredClone(validSuccess) as unknown as ValidatedAssistedProfileProposal;
    const gateway = new FakeContractGateway(() => validated);
    const { client, transport } = await makeClient({ gateway });

    const result = await client.generate(REQUEST, requestContext);

    expect(result).to.equal(validated);
    expect(transport.requests).to.have.length(1);
    const sent = transport.requests[0];
    const serializedRequest = JSON.stringify(REQUEST);
    expect(sent.method).to.equal('POST');
    expect(sent.url.href).to.equal(AGENT_ENDPOINT);
    expect(sent.headers).to.include({
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'Content-Length': String(Buffer.byteLength(serializedRequest)),
      'X-API-Key': API_KEY,
      'X-Request-ID': CONTEXT.requestId,
      'X-Correlation-ID': CONTEXT.correlationId,
    });
    expect(sent.headers).not.to.have.property('Authorization');
    expect(sent.body).to.equal(serializedRequest);
    expect(sent.connectTimeoutMs).to.equal(1_234);
    expect(sent.readTimeoutMs).to.equal(180_123);
    expect(sent.signal).to.equal(signal);

    expect(gateway.calls).to.have.length(1);
    expect(gateway.calls[0].payload).to.deep.equal(validSuccess);
    expect(gateway.calls[0].context).to.deep.equal({
      fwCloudId: CONTEXT.fwCloudId,
      userId: CONTEXT.userId,
      userName: CONTEXT.userName,
      sessionId: CONTEXT.sessionId,
      sourceIp: CONTEXT.sourceIp,
      requestId: CONTEXT.requestId,
      correlationId: CONTEXT.correlationId,
      agentEndpoint: AGENT_ENDPOINT,
      sensitiveValues: [API_KEY],
    });
  });

  it('retries a proven-safe connection-establishment failure exactly once', async () => {
    const { client, gateway, transport } = await makeClient({
      outcomes: [safeConnectionFailure(), safeConnectionFailure(), response()],
    });

    const error = await expectRejectedAs(client.generate(REQUEST, CONTEXT), AgentConnectionError);

    expect(error.code).to.equal(AGENT_CONNECTION_ERROR);
    expect(error.attempts).to.equal(2);
    expect(error.requestId).to.equal(CONTEXT.requestId);
    expect(transport.requests).to.have.length(2);
    expect(gateway.calls).to.have.length(0);
  });

  it('retries once after a safe connection failure and validates the successful response', async () => {
    const validated = structuredClone(validSuccess) as unknown as ValidatedAssistedProfileProposal;
    const gateway = new FakeContractGateway(() => validated);
    const { client, observations, transport } = await makeClient({
      outcomes: [safeConnectionFailure(), response()],
      gateway,
    });

    const result = await client.generate(REQUEST, CONTEXT);

    expect(result).to.equal(validated);
    expect(transport.requests).to.have.length(2);
    expect(gateway.calls).to.have.length(1);
    expect(gateway.calls[0].payload).to.deep.equal(validSuccess);
    expect(observations).to.have.length(1);
    expect(observations[0].attempts).to.equal(2);
  });

  it('never retries a read timeout after the request reaches the response phase', async () => {
    const { client, gateway, transport } = await makeClient({
      outcomes: [new AgentHttpTransportFailure('read_timeout', true), response()],
    });

    const error = await expectRejectedAs(client.generate(REQUEST, CONTEXT), AgentReadTimeoutError);

    expect(error.code).to.equal(AGENT_READ_TIMEOUT);
    expect(error.attempts).to.equal(1);
    expect(transport.requests).to.have.length(1);
    expect(gateway.calls).to.have.length(0);
  });

  it('classifies 429 as busy, preserves Retry-After, and never retries', async () => {
    const { client, gateway, transport } = await makeClient({
      outcomes: [response(429, 'busy-response-must-not-be-inspected', { 'Retry-After': '10' })],
    });

    const error = await expectRejectedAs(client.generate(REQUEST, CONTEXT), AgentBusyError);

    expect(error.code).to.equal(AGENT_BUSY);
    expect(error.httpStatus).to.equal(429);
    expect(error.retryAfterSeconds).to.equal(10);
    expect(error.attempts).to.equal(1);
    expect(transport.requests).to.have.length(1);
    expect(gateway.calls).to.have.length(0);
  });

  it('drops unsafe Retry-After values instead of exposing infinity or rounded metadata', async () => {
    const { client, transport } = await makeClient({
      outcomes: [response(429, 'busy', { 'retry-after': '9'.repeat(400) })],
    });

    const error = await expectRejectedAs(client.generate(REQUEST, CONTEXT), AgentBusyError);

    expect(error.retryAfterSeconds).to.equal(undefined);
    expect(transport.requests).to.have.length(1);
  });

  const statusCases: Array<{
    status: number;
    label: string;
    expected: ErrorConstructor<AgentHttpClientError>;
    code:
      | typeof AGENT_AUTHENTICATION_ERROR
      | typeof AGENT_AUTHORIZATION_ERROR
      | typeof AGENT_CLIENT_REQUEST_ERROR
      | typeof AGENT_SERVER_ERROR;
  }> = [
    {
      status: 401,
      label: '401 as an authentication failure',
      expected: AgentAuthenticationError,
      code: AGENT_AUTHENTICATION_ERROR,
    },
    {
      status: 403,
      label: '403 as an authorization failure',
      expected: AgentAuthorizationError,
      code: AGENT_AUTHORIZATION_ERROR,
    },
    {
      status: 422,
      label: 'other 4xx as a client request failure',
      expected: AgentClientRequestError,
      code: AGENT_CLIENT_REQUEST_ERROR,
    },
    {
      status: 503,
      label: '5xx as a server failure',
      expected: AgentServerError,
      code: AGENT_SERVER_ERROR,
    },
  ];

  for (const testCase of statusCases) {
    it(`classifies ${testCase.label} without retrying`, async () => {
      const { client, gateway, transport } = await makeClient({
        outcomes: [response(testCase.status), response()],
      });

      const error = await expectRejectedAs(client.generate(REQUEST, CONTEXT), testCase.expected);

      expect(error.code).to.equal(testCase.code);
      expect(error.httpStatus).to.equal(testCase.status);
      expect(error.attempts).to.equal(1);
      expect(transport.requests).to.have.length(1);
      expect(gateway.calls).to.have.length(0);
    });
  }

  it('retries a proven-safe TLS establishment failure exactly once', async () => {
    const tlsFailure = (): AgentHttpTransportFailure =>
      new AgentHttpTransportFailure('tls', false, 'certificate detail must stay private');
    const { client, gateway, transport } = await makeClient({
      outcomes: [tlsFailure(), tlsFailure(), response()],
    });

    const error = await expectRejectedAs(client.generate(REQUEST, CONTEXT), AgentTlsError);

    expect(error.code).to.equal(AGENT_TLS_ERROR);
    expect(error.attempts).to.equal(2);
    expect(transport.requests).to.have.length(2);
    expect(gateway.calls).to.have.length(0);
  });

  it('maps an invalid transport-level HTTP response without retrying', async () => {
    const { client, gateway, transport } = await makeClient({
      outcomes: [new AgentHttpTransportFailure('invalid_http_response', true), response()],
    });

    const error = await expectRejectedAs(
      client.generate(REQUEST, CONTEXT),
      AgentInvalidHttpResponseError,
    );

    expect(error.code).to.equal(AGENT_INVALID_HTTP_RESPONSE);
    expect(error.attempts).to.equal(1);
    expect(transport.requests).to.have.length(1);
    expect(gateway.calls).to.have.length(0);
  });

  for (const status of [99, 302, 600]) {
    it(`rejects invalid/unexpected HTTP status ${status} without retrying`, async () => {
      const { client, gateway, transport } = await makeClient({
        outcomes: [response(status), response()],
      });

      const error = await expectRejectedAs(
        client.generate(REQUEST, CONTEXT),
        AgentInvalidHttpResponseError,
      );

      expect(error.code).to.equal(AGENT_INVALID_HTTP_RESPONSE);
      // Out-of-range values are deliberately not retained as an HTTP status;
      // a syntactically valid but unsupported response (such as 302) is.
      expect(error.httpStatus).to.equal(status >= 100 && status <= 599 ? status : undefined);
      expect(error.attempts).to.equal(1);
      expect(transport.requests).to.have.length(1);
      expect(gateway.calls).to.have.length(0);
    });
  }

  it('maps cancellation without retrying', async () => {
    const { client, gateway, transport } = await makeClient({
      outcomes: [new AgentHttpTransportFailure('cancelled', true), response()],
    });

    const error = await expectRejectedAs(
      client.generate(REQUEST, CONTEXT),
      AgentRequestCancelledError,
    );

    expect(error.code).to.equal(AGENT_REQUEST_CANCELLED);
    expect(error.attempts).to.equal(1);
    expect(transport.requests).to.have.length(1);
    expect(gateway.calls).to.have.length(0);
  });

  it('maps an unclassified thrown value to a sanitized unknown error without retrying', async () => {
    const rawFailure = new Error(`${API_KEY}: raw transport body detail`);
    const { client, gateway, transport } = await makeClient({
      outcomes: [rawFailure, response()],
    });

    const error = await expectRejectedAs(client.generate(REQUEST, CONTEXT), AgentUnknownError);

    expect(error.code).to.equal(AGENT_UNKNOWN_ERROR);
    expect(error.attempts).to.equal(1);
    expect(error.message).not.to.contain(API_KEY);
    expect(error.message).not.to.contain('raw transport body detail');
    expect(transport.requests).to.have.length(1);
    expect(gateway.calls).to.have.length(0);
  });

  it('does not retry a reset after establishment because the request may have reached the agent', async () => {
    const { client, gateway, transport } = await makeClient({
      outcomes: [new AgentHttpTransportFailure('unknown', true), response()],
    });

    const error = await expectRejectedAs(client.generate(REQUEST, CONTEXT), AgentUnknownError);

    expect(error.code).to.equal(AGENT_UNKNOWN_ERROR);
    expect(error.attempts).to.equal(1);
    expect(transport.requests).to.have.length(1);
    expect(gateway.calls).to.have.length(0);
  });

  it('does not retry even a connection-labelled failure when it may have reached the agent', async () => {
    const { client, transport } = await makeClient({
      outcomes: [new AgentHttpTransportFailure('connection', true), response()],
    });

    const error = await expectRejectedAs(client.generate(REQUEST, CONTEXT), AgentConnectionError);

    expect(error.attempts).to.equal(1);
    expect(transport.requests).to.have.length(1);
  });

  it('routes malformed non-JSON through the contract gateway and wraps its audited rejection', async () => {
    const malformedBody = '{not-json-response';
    const mismatch = new AssistantContractMismatchException(
      'Agent response is not a JSON object',
      'malformed_payload',
      'apg.mvp.v1',
      null,
    );
    const gateway = new FakeContractGateway(() => {
      throw mismatch;
    });
    const { client, transport } = await makeClient({
      outcomes: [response(200, malformedBody)],
      gateway,
    });
    let domainCallbackCalls = 0;

    const error = await expectRejectedAs(
      client.generate(REQUEST, CONTEXT).then((proposal) => {
        domainCallbackCalls += 1;
        return proposal;
      }),
      AgentContractMismatchError,
    );

    expect(error.code).to.equal(ASSISTED_PROFILE_CONTRACT_MISMATCH);
    expect(error.reason).to.equal('malformed_payload');
    expect(error.contractVersion).to.equal('apg.mvp.v1');
    expect(error.receivedVersion).to.equal(null);
    expect(error.supportedVersions).to.deep.equal(['1.0.0']);
    expect(error.validationPaths).to.deep.equal([]);
    expect(error.requestId).to.equal(CONTEXT.requestId);
    expect(error.correlationId).to.equal(CONTEXT.correlationId);
    expect(error.httpStatus).to.equal(200);
    expect(error.attempts).to.equal(1);
    expect(gateway.calls).to.have.length(1);
    expect(gateway.calls[0].payload).to.equal(malformedBody);
    expect(transport.requests).to.have.length(1);
    expect(domainCallbackCalls).to.equal(0);
  });

  it('preserves schema violation details, supported versions, safe paths, and audit context', async () => {
    const validationErrors = [
      { instancePath: '/intent', message: "must have required property 'intent'" },
      { instancePath: '/metadata/modelProvider', message: 'must be string' },
    ];
    const mismatch = new AssistantContractMismatchException(
      'Agent response does not conform to the contract',
      'schema_violation',
      'apg.mvp.v1',
      '1.0.0',
      validationErrors,
    );
    const gateway = new FakeContractGateway(() => {
      throw mismatch;
    }, ['0.9.0', '1.0.0']);
    const { client } = await makeClient({
      outcomes: [response(200, JSON.stringify(invalidMissingField))],
      gateway,
    });

    const error = await expectRejectedAs(
      client.generate(REQUEST, CONTEXT),
      AgentContractMismatchError,
    );

    expect(error.reason).to.equal('schema_violation');
    expect(error.contractVersion).to.equal('apg.mvp.v1');
    expect(error.receivedVersion).to.equal('1.0.0');
    expect(error.supportedVersions).to.deep.equal(['0.9.0', '1.0.0']);
    expect(error.validationErrors).to.deep.equal(validationErrors);
    expect(error.validationPaths).to.deep.equal(['/intent', '/metadata/modelProvider']);
    expect(error.requestId).to.equal(CONTEXT.requestId);
    expect(error.correlationId).to.equal(CONTEXT.correlationId);
    expect(gateway.calls[0].payload).to.deep.equal(invalidMissingField);
    expect(gateway.calls[0].context).to.deep.equal({
      fwCloudId: CONTEXT.fwCloudId,
      userId: CONTEXT.userId,
      userName: CONTEXT.userName,
      sessionId: CONTEXT.sessionId,
      sourceIp: CONTEXT.sourceIp,
      requestId: CONTEXT.requestId,
      correlationId: CONTEXT.correlationId,
      agentEndpoint: AGENT_ENDPOINT,
      sensitiveValues: [API_KEY],
    });
  });

  it('preserves received and supported versions for an unknown contract version', async () => {
    const mismatch = new AssistantContractMismatchException(
      'Unsupported contract schema version',
      'unknown_schema_version',
      'apg.mvp.v1',
      '9.9.9',
    );
    const gateway = new FakeContractGateway(() => {
      throw mismatch;
    }, ['0.9.0', '1.0.0']);
    const { client, transport } = await makeClient({
      outcomes: [response(200, JSON.stringify(invalidUnknownVersion))],
      gateway,
    });

    const error = await expectRejectedAs(
      client.generate(REQUEST, CONTEXT),
      AgentContractMismatchError,
    );

    expect(error.reason).to.equal('unknown_schema_version');
    expect(error.receivedVersion).to.equal('9.9.9');
    expect(error.supportedVersions).to.deep.equal(['0.9.0', '1.0.0']);
    expect(error.validationPaths).to.deep.equal([]);
    expect(error.requestId).to.equal(CONTEXT.requestId);
    expect(error.attempts).to.equal(1);
    expect(gateway.calls).to.have.length(1);
    expect(gateway.calls[0].payload).to.deep.equal(invalidUnknownVersion);
    expect(transport.requests).to.have.length(1);
  });

  it('records safe success observations with elapsed time, attempts, status, and contract version', async () => {
    const ticks = [1_000, 1_047];
    const { client, observations } = await makeClient({
      clock: () => ticks.shift() ?? 1_047,
    });

    await client.generate(REQUEST, CONTEXT);

    expect(observations).to.deep.equal([
      {
        requestId: CONTEXT.requestId,
        correlationId: CONTEXT.correlationId,
        endpoint: AGENT_ENDPOINT,
        elapsedMs: 47,
        attempts: 1,
        outcome: 'success',
        httpStatus: 200,
        contractVersion: '1.0.0',
      },
    ]);
  });

  it('records only safe error metadata and never exposes the API key or either body', async () => {
    const requestSecret = 'request-body-secret-marker';
    const responseSecret = 'response-body-secret-marker';
    const request: AssistedProfileAgentRequest = { text: requestSecret };
    const { client, observations, transport } = await makeClient({
      outcomes: [response(500, responseSecret)],
    });

    const error = await expectRejectedAs(client.generate(request, CONTEXT), AgentServerError);
    const serializedError = `${error.name}:${error.message}:${JSON.stringify(error)}`;
    const serializedObservations = JSON.stringify(observations);

    expect(observations).to.have.length(1);
    expect(observations[0]).to.include({
      requestId: CONTEXT.requestId,
      correlationId: CONTEXT.correlationId,
      endpoint: AGENT_ENDPOINT,
      attempts: 1,
      outcome: 'error',
      errorCode: AGENT_SERVER_ERROR,
      httpStatus: 500,
    });
    for (const secret of [API_KEY, requestSecret, responseSecret]) {
      expect(serializedError).not.to.contain(secret);
      expect(serializedObservations).not.to.contain(secret);
    }
    expect(transport.requests).to.have.length(1);
  });

  it('does not let an observer failure alter a successful validated response', async () => {
    const validated = structuredClone(validSuccess) as unknown as ValidatedAssistedProfileProposal;
    const gateway = new FakeContractGateway(() => validated);
    const { client } = await makeClient({
      gateway,
      observer: {
        record: () => {
          throw new Error('metrics backend unavailable');
        },
      },
    });

    expect(await client.generate(REQUEST, CONTEXT)).to.equal(validated);
  });

  it('classifies request serialization failure before invoking the transport or gateway', async () => {
    const cyclic: AssistedProfileAgentRequest = { text: 'cyclic request' };
    cyclic.self = cyclic;
    const { client, gateway, observations, transport } = await makeClient({ outcomes: [] });

    const error = await expectRejectedAs(client.generate(cyclic, CONTEXT), AgentClientRequestError);

    expect(error.code).to.equal(AGENT_CLIENT_REQUEST_ERROR);
    expect(error.attempts).to.equal(0);
    expect(transport.requests).to.have.length(0);
    expect(gateway.calls).to.have.length(0);
    expect(observations).to.have.length(1);
    expect(observations[0].attempts).to.equal(0);
  });

  it('redacts a request identifier that echoes the configured API key', async () => {
    const { client, observations, transport } = await makeClient({ outcomes: [] });

    const error = await expectRejectedAs(
      client.generate(REQUEST, { ...CONTEXT, requestId: API_KEY }),
      AgentClientRequestError,
    );

    expect(error.requestId).to.equal('invalid-request-id');
    expect(error.message).to.not.contain(API_KEY);
    expect(JSON.stringify(observations)).to.not.contain(API_KEY);
    expect(transport.requests).to.have.length(0);
  });

  it('does not reject normal identifiers when a configured API key is short', async () => {
    const { client, transport } = await makeClient({ configuration: { apiKey: 'a' } });

    await client.generate(REQUEST, CONTEXT);

    expect(transport.requests).to.have.length(1);
    expect(transport.requests[0].headers['X-API-Key']).to.equal('a');
    expect(transport.requests[0].headers['X-Request-ID']).to.equal(CONTEXT.requestId);
  });
});

describe('AgentHttpClient configuration unit tests', () => {
  let caTestDirectory: string;

  before(() => {
    caTestDirectory = mkdtempSync(join(tmpdir(), 'fwcloud-agent-http-client-'));
  });

  after(() => {
    rmSync(caTestDirectory, { recursive: true, force: true });
  });

  async function expectConfigurationError(
    overrides: Partial<AgentHttpClientConfigurationInput>,
  ): Promise<ConfigurationErrorException> {
    const transport = new QueueAgentHttpTransport([response()]);
    const promise = AgentHttpClient.create({
      configuration: { ...BASE_CONFIGURATION, ...overrides },
      contractGateway: new FakeContractGateway(),
      transport,
    });
    const error = await expectRejectedAs(promise, ConfigurationErrorException);
    expect(transport.requests).to.have.length(0);
    return error;
  }

  it('applies the documented connect and read timeout defaults', async () => {
    const { client, transport } = await makeClient({
      configuration: {
        connectTimeoutMs: undefined,
        readTimeoutMs: undefined,
      },
    });

    await client.generate(REQUEST, CONTEXT);

    expect(transport.requests[0].connectTimeoutMs).to.equal(DEFAULT_AGENT_CONNECT_TIMEOUT_MS);
    expect(transport.requests[0].readTimeoutMs).to.equal(DEFAULT_AGENT_READ_TIMEOUT_MS);
  });

  it('rejects a missing URL during client initialization', async () => {
    const error = await expectConfigurationError({ url: undefined });
    expect(error.message).to.contain('agent URL must be defined');
  });

  it('rejects a missing API key during client initialization', async () => {
    const error = await expectConfigurationError({ apiKey: undefined });
    expect(error.message).to.contain('agent API key must be defined');
  });

  it('rejects control characters in the API key without echoing the key', async () => {
    const unsafeApiKey = 'top-secret\r\nX-Injected: true';
    const error = await expectConfigurationError({ apiKey: unsafeApiKey });

    expect(error.message).to.contain('API key contains invalid characters');
    expect(error.message).not.to.contain(unsafeApiKey);
    expect(error.message).not.to.contain('top-secret');
  });

  it('rejects unsupported URL protocols', async () => {
    const error = await expectConfigurationError({ url: 'ftp://fake-agent.test:21' });
    expect(error.message).to.contain('must use http or https');
  });

  it('rejects credentials embedded in the agent URL without exposing them', async () => {
    const error = await expectConfigurationError({
      url: 'https://service-user:service-password@fake-agent.test:8443',
    });

    expect(error.message).to.contain('must not contain credentials');
    expect(error.message).not.to.contain('service-password');
  });

  for (const url of [
    'https://fake-agent.test:8443?route=proxy',
    'https://fake-agent.test:8443#fragment',
  ]) {
    it(`rejects a query or fragment in ${url}`, async () => {
      const error = await expectConfigurationError({ url });
      expect(error.message).to.contain('must not contain a query or fragment');
    });
  }

  it('rejects HTTP unless the caller explicitly enables test/development transport', async () => {
    const error = await expectConfigurationError({ allowInsecureHttp: false });
    expect(error.message).to.contain('requires allowInsecureHttp=true');
  });

  it('allows HTTP when the test-only permission is explicit', async () => {
    const { client, transport } = await makeClient({
      configuration: { allowInsecureHttp: true },
    });

    await client.generate(REQUEST, CONTEXT);

    expect(transport.requests).to.have.length(1);
    expect(transport.requests[0].url.protocol).to.equal('http:');
  });

  const invalidTimeouts: Array<{
    label: string;
    overrides: Partial<AgentHttpClientConfigurationInput>;
  }> = [
    { label: 'zero connect timeout', overrides: { connectTimeoutMs: 0 } },
    { label: 'negative connect timeout', overrides: { connectTimeoutMs: -1 } },
    { label: 'fractional connect timeout', overrides: { connectTimeoutMs: 1.5 } },
    { label: 'non-numeric connect timeout', overrides: { connectTimeoutMs: 'slow' } },
    {
      label: 'connect timeout above the timer limit',
      overrides: { connectTimeoutMs: MAX_AGENT_TIMEOUT_MS + 1 },
    },
    { label: 'zero read timeout', overrides: { readTimeoutMs: '0' } },
    { label: 'negative read timeout', overrides: { readTimeoutMs: -1 } },
    { label: 'fractional read timeout', overrides: { readTimeoutMs: 1.5 } },
    { label: 'non-numeric read timeout', overrides: { readTimeoutMs: 'slow' } },
    {
      label: 'read timeout above the timer limit',
      overrides: { readTimeoutMs: MAX_AGENT_TIMEOUT_MS + 1 },
    },
  ];

  for (const testCase of invalidTimeouts) {
    it(`rejects ${testCase.label}`, async () => {
      const error = await expectConfigurationError(testCase.overrides);
      expect(error.message).to.contain('must be a positive integer');
    });
  }

  it('rejects a custom CA file that does not exist', async () => {
    const error = await expectConfigurationError({
      url: 'https://fake-agent.test:8443',
      allowInsecureHttp: false,
      caFile: 'missing-ca.pem',
      baseDirectory: caTestDirectory,
    });

    expect(error.message).to.contain('CA file is not readable');
  });

  it('rejects a CA path that is not a regular file', async () => {
    const error = await expectConfigurationError({
      url: 'https://fake-agent.test:8443',
      allowInsecureHttp: false,
      caFile: '.',
      baseDirectory: caTestDirectory,
    });

    expect(error.message).to.contain('CA file is not readable');
  });

  it('rejects an empty custom CA file', async () => {
    writeFileSync(join(caTestDirectory, 'empty-ca.pem'), '');
    const error = await expectConfigurationError({
      url: 'https://fake-agent.test:8443',
      allowInsecureHttp: false,
      caFile: 'empty-ca.pem',
      baseDirectory: caTestDirectory,
    });

    expect(error.message).to.contain('CA file is empty');
  });

  it('rejects malformed custom CA contents', async () => {
    writeFileSync(join(caTestDirectory, 'invalid-ca.pem'), 'not a PEM certificate');
    const error = await expectConfigurationError({
      url: 'https://fake-agent.test:8443',
      allowInsecureHttp: false,
      caFile: 'invalid-ca.pem',
      baseDirectory: caTestDirectory,
    });

    expect(error.message).to.contain('CA file is not valid PEM');
  });

  it('loads a valid custom CA while keeping HTTPS verification enabled', () => {
    const caPath = join(caTestDirectory, 'valid-ca.pem');
    writeFileSync(caPath, rootCertificates[0]);

    const configuration = resolveAgentHttpClientConfiguration({
      url: 'https://fake-agent.test:8443',
      apiKey: API_KEY,
      caFile: caPath,
    });
    const transport = new NodeAgentHttpTransport({ ca: configuration.ca });

    expect(configuration.ca?.toString('utf8')).to.equal(rootCertificates[0]);
    expect((transport as any).httpsAgent.options.rejectUnauthorized).to.equal(true);
    expect((transport as any).httpsAgent.options.ca).to.deep.equal(configuration.ca);
    transport.close();
  });

  it('rejects custom CA configuration for HTTP transport', async () => {
    const error = await expectConfigurationError({
      caFile: 'unused-ca.pem',
      baseDirectory: caTestDirectory,
      allowInsecureHttp: true,
    });

    expect(error.message).to.contain('custom CA can only be configured for HTTPS');
  });
});

describe('AgentHttpClient provider unit tests', () => {
  it('returns one in-flight singleton to concurrent first callers', async () => {
    const gateway = new FakeContractGateway();
    const application = {
      path: process.cwd(),
      config: {
        get: (key: string): unknown => {
          if (key === 'env') {
            return 'prod';
          }
          if (key === 'assisted_profile.agent') {
            return {
              url: 'https://fake-agent.test:8443',
              api_key: API_KEY,
              connect_timeout_ms: 10_000,
              read_timeout_ms: 180_000,
              ca_file: '',
            };
          }
          return undefined;
        },
      },
      getService: async () => gateway,
      logger: () => ({ info: () => undefined, warn: () => undefined }),
    } as unknown as AbstractApplication;
    const container = new ServiceContainer(application);
    new AgentHttpClientProvider(application).register(container);

    const [first, second] = await Promise.all([
      container.get<AgentHttpClient>(AgentHttpClient.name),
      container.get<AgentHttpClient>(AgentHttpClient.name),
    ]);

    expect(first).to.equal(second);
    expect(container.services[0].instance).to.equal(first);
    await container.close();
  });
});
